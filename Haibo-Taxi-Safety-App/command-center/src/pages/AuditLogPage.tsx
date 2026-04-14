import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { admin } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Table, TH, TD } from "../components/Table";
import { Badge, BadgeTone } from "../components/Badge";
import { Button } from "../components/Button";
import { LoadingState, ErrorState, EmptyState } from "../components/States";
import { colors, radius, spacing } from "../lib/brand";

const PAGE_SIZE = 50;

const ACTION_FILTERS: Array<{ label: string; value: string }> = [
  { label: "All", value: "" },
  { label: "Withdrawals", value: "withdrawal" },
  { label: "Moderation", value: "moderation" },
  { label: "Complaints", value: "complaint" },
  { label: "Taxis", value: "taxi" },
];

/**
 * Group an action string ("withdrawal.approve", "moderation.update") by
 * its prefix so users can see "withdrawals" as one filter without the
 * Command Center knowing the full set of actions ahead of time.
 */
function actionPrefix(action: string): string {
  return action.split(".")[0];
}

function actionTone(action: string): BadgeTone {
  const prefix = actionPrefix(action);
  switch (prefix) {
    case "withdrawal":
      return "warning";
    case "moderation":
      return "info";
    case "complaint":
      return "rose";
    case "taxi":
      return "success";
    default:
      return "neutral";
  }
}

interface AuditRow {
  id: string;
  adminUserId: string;
  adminPhone: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  meta: Record<string, any> | null;
  ipAddress: string | null;
  createdAt: string | null;
}

export function AuditLogPage() {
  const [filter, setFilter] = useState("");
  const [offset, setOffset] = useState(0);

  const auditQ = useQuery({
    queryKey: ["admin", "audit-log", filter, offset],
    queryFn: () =>
      admin.getAuditLog({
        action: filter || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
  });

  // The server exposes an exact `action` filter but the tabs above are
  // action prefixes (e.g. `withdrawal`), so we post-filter client-side
  // when the current filter isn't an exact action value. For small admin
  // teams the list is tiny — no pagination friction from this.
  const allRows: AuditRow[] = auditQ.data?.data || [];
  const rows = filter
    ? allRows.filter((r) => actionPrefix(r.action) === filter)
    : allRows;
  const total = auditQ.data?.total ?? 0;
  const hasMore = !filter && offset + PAGE_SIZE < total;

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle={
          auditQ.isSuccess
            ? `${rows.length} shown · ${total} total admin actions recorded`
            : "Who did what, and when."
        }
      />

      <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.lg, flexWrap: "wrap" }}>
        {ACTION_FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value || "all"}
              onClick={() => {
                setFilter(f.value);
                setOffset(0);
              }}
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
              {f.label}
            </button>
          );
        })}
      </div>

      {auditQ.isError ? (
        <ErrorState error={auditQ.error} onRetry={() => auditQ.refetch()} />
      ) : auditQ.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No admin actions yet"
          hint="Every withdrawal approval, complaint update, moderation toggle, and taxi verification shows up here."
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <TH>Time</TH>
                <TH>Admin</TH>
                <TH>Action</TH>
                <TH>Resource</TH>
                <TH>Target</TH>
                <TH>Details</TH>
                <TH>IP</TH>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <TD>
                    {r.createdAt ? new Date(r.createdAt).toLocaleString("en-ZA") : "—"}
                  </TD>
                  <TD>
                    <div style={{ fontWeight: 600 }}>{r.adminPhone || "—"}</div>
                    <div style={{ fontSize: 11, color: colors.textTertiary }}>
                      {r.adminUserId.slice(0, 8)}
                    </div>
                  </TD>
                  <TD>
                    <Badge tone={actionTone(r.action)}>{r.action}</Badge>
                  </TD>
                  <TD>{r.resource}</TD>
                  <TD>
                    <span
                      style={{
                        fontFamily: "ui-monospace, Menlo, monospace",
                        fontSize: 12,
                      }}
                    >
                      {r.resourceId ? r.resourceId.slice(0, 12) : "—"}
                    </span>
                  </TD>
                  <TD truncate>
                    {r.meta ? (
                      <span
                        style={{
                          fontFamily: "ui-monospace, Menlo, monospace",
                          fontSize: 12,
                          color: colors.textSecondary,
                        }}
                        title={JSON.stringify(r.meta, null, 2)}
                      >
                        {JSON.stringify(r.meta)}
                      </span>
                    ) : (
                      <span style={{ color: colors.textTertiary }}>—</span>
                    )}
                  </TD>
                  <TD>
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "ui-monospace, Menlo, monospace",
                        color: colors.textTertiary,
                      }}
                    >
                      {r.ipAddress || "—"}
                    </span>
                  </TD>
                </tr>
              ))}
            </tbody>
          </Table>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: spacing.lg,
            }}
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setOffset(Math.max(offset - PAGE_SIZE, 0))}
              disabled={offset === 0 || !!filter}
            >
              ← Newer
            </Button>
            <span style={{ fontSize: 12, color: colors.textTertiary }}>
              {filter
                ? "Filter applied — showing most recent page only"
                : `Page ${Math.floor(offset / PAGE_SIZE) + 1}`}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={!hasMore}
            >
              Older →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
