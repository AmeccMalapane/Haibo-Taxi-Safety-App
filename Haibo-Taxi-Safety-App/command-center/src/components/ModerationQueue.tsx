import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { admin } from "../api/client";
import { PageHeader } from "./PageHeader";
import { Table, TH, TD } from "./Table";
import { Button } from "./Button";
import { Badge, statusTone, BadgeTone } from "./Badge";
import { LoadingState, ErrorState, EmptyState } from "./States";
import { colors, radius, spacing } from "../lib/brand";

/**
 * Generic moderation queue. Each concrete page (Reels, LostFound, Jobs)
 * builds a config and drops it in here. The config declares:
 *   - which server resource to fetch from
 *   - which status tabs to show
 *   - how to render a row's cells
 *   - which actions are available and what patch each applies
 *
 * The rest (query + mutation + realtime invalidation + empty/error states
 * + tab switching) is shared.
 */

export interface ModerationColumn<T> {
  header: string;
  cell: (item: T) => React.ReactNode;
  truncate?: boolean;
}

export interface ModerationAction<T> {
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /**
   * Patch to send to PUT /api/admin/moderation/:resource/:id. Can be a
   * static object or a function of the row (for row-dependent toggles).
   */
  patch: Partial<{ status: string; isVerified: boolean; isFeatured: boolean }> |
    ((item: T) => Partial<{ status: string; isVerified: boolean; isFeatured: boolean }>);
  /**
   * Optional predicate — hide the action unless the row matches.
   */
  when?: (item: T) => boolean;
  confirmMessage?: string;
}

export interface ModerationStatusTab {
  label: string;
  value: string;
  tone?: BadgeTone;
}

export interface ModerationQueueConfig<T> {
  title: string;
  subtitle?: string;
  /** Server resource name — must match a MODERATION_RESOURCES key */
  resource: string;
  /** React-query queryKey prefix; the status filter is appended */
  queryKey: string;
  /** Status tabs; the first tab is the default selection */
  tabs: ModerationStatusTab[];
  /** Column renderers */
  columns: ModerationColumn<T>[];
  /** Action buttons shown in the last cell */
  actions: ModerationAction<T>[];
  /** Pull the row status (used for the trailing status Badge) */
  getStatus: (item: T) => string;
  /** Pull the row id (used as the mutation target + row key) */
  getId: (item: T) => string;
  /** Optional empty-state hint */
  emptyHint?: string;
}

export function ModerationQueue<T>({ config }: { config: ModerationQueueConfig<T> }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>(config.tabs[0].value);

  const listQ = useQuery({
    queryKey: [config.queryKey, status],
    queryFn: () => admin.getModerationQueue(config.resource, status || undefined),
  });

  const mutateM = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<{ status: string; isVerified: boolean; isFeatured: boolean }>;
    }) => admin.moderateContent(config.resource, id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [config.queryKey] });
      qc.invalidateQueries({ queryKey: ["admin", "system-metrics"] });
      toast.success("Updated");
    },
    onError: (err: any) => toast.error(err?.message || "Update failed"),
  });

  const rows: T[] = listQ.data?.data || [];

  const runAction = (item: T, action: ModerationAction<T>) => {
    if (action.confirmMessage && !window.confirm(action.confirmMessage)) return;
    const patch = typeof action.patch === "function" ? action.patch(item) : action.patch;
    mutateM.mutate({ id: config.getId(item), patch });
  };

  return (
    <div>
      <PageHeader
        title={config.title}
        subtitle={
          listQ.isSuccess
            ? `${rows.length} ${status || "total"}${config.subtitle ? ` · ${config.subtitle}` : ""}`
            : config.subtitle
        }
      />

      <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.lg, flexWrap: "wrap" }}>
        {config.tabs.map((tab) => {
          const active = status === tab.value;
          return (
            <button
              key={tab.value || "all"}
              onClick={() => setStatus(tab.value)}
              aria-pressed={active}
              style={{
                padding: `${spacing.sm}px ${spacing.lg}px`,
                borderRadius: radius.full,
                border: `1px solid ${active ? colors.rose : colors.border}`,
                background: active ? colors.rose : colors.surface,
                color: active ? "#FFFFFF" : colors.text,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {listQ.isError ? (
        <ErrorState error={listQ.error} onRetry={() => listQ.refetch()} />
      ) : listQ.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          title={`No ${status || "matching"} items`}
          hint={config.emptyHint}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              {config.columns.map((c) => (
                <TH key={c.header}>{c.header}</TH>
              ))}
              <TH>Status</TH>
              <TH>Actions</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const rowId = config.getId(item);
              return (
                <tr key={rowId}>
                  {config.columns.map((c) => (
                    <TD key={c.header} truncate={c.truncate}>
                      {c.cell(item)}
                    </TD>
                  ))}
                  <TD>
                    <Badge tone={statusTone(config.getStatus(item))}>
                      {config.getStatus(item)}
                    </Badge>
                  </TD>
                  <TD>
                    <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap" }}>
                      {config.actions
                        .filter((a) => !a.when || a.when(item))
                        .map((a) => (
                          <Button
                            key={a.label}
                            size="sm"
                            variant={a.variant || "secondary"}
                            onClick={() => runAction(item, a)}
                            disabled={mutateM.isPending}
                          >
                            {a.label}
                          </Button>
                        ))}
                    </div>
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
