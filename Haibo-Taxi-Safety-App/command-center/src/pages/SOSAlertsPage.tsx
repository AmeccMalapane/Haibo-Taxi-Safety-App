import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertOctagon, MapPin, Phone, ExternalLink, Clock, User } from "lucide-react";
import { admin } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { LoadingState, ErrorState, EmptyState } from "../components/States";
import { useAdminSocket } from "../hooks/useAdminSocket";
import { colors, radius, shadows, spacing, gradients, fonts } from "../lib/brand";

type StatusFilter = "unresolved" | "resolved" | "all";

const STATUS_TABS: Array<{ label: string; value: StatusFilter }> = [
  { label: "Active", value: "unresolved" },
  { label: "Resolved", value: "resolved" },
  { label: "All", value: "all" },
];

interface SOSRow {
  id: string;
  userId: string | null;
  phone: string | null;
  latitude: number;
  longitude: number;
  message: string | null;
  source: string | null;
  adminRecipients: number | null;
  smsRecipients: number | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string | null;
  reporterName: string | null;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function responseTime(createdAt: string | null, resolvedAt: string | null): string {
  if (!createdAt || !resolvedAt) return "—";
  const ms = new Date(resolvedAt).getTime() - new Date(createdAt).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

export function SOSAlertsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("unresolved");

  const alertsQ = useQuery({
    queryKey: ["admin", "sos-alerts", status],
    queryFn: () => admin.getSOSAlerts({ status }),
    refetchInterval: status === "unresolved" ? 15_000 : false,
  });

  const resolveM = useMutation({
    mutationFn: (id: string) => admin.resolveSOSAlert(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "sos-alerts"] });
      qc.invalidateQueries({ queryKey: ["admin", "system-metrics"] });
      toast.success("SOS alert marked as resolved");
    },
    onError: (err: any) => toast.error(err?.message || "Resolve failed"),
  });

  // Realtime: when sendSOSAlert emits sos:alert to the admins room, this
  // page invalidates so the new row shows up without a refetch tap. The
  // dashboard has its own global handler for the toast so we don't double-toast
  // when the operator is already on this page.
  const handlers = useMemo(
    () => ({
      "sos:alert": () => {
        qc.invalidateQueries({ queryKey: ["admin", "sos-alerts"] });
      },
    }),
    [qc]
  );
  useAdminSocket(handlers);

  const rows: SOSRow[] = alertsQ.data?.data || [];
  const unresolvedCount: number = alertsQ.data?.unresolvedCount ?? 0;

  return (
    <div>
      <PageHeader
        title="SOS alerts"
        subtitle={
          alertsQ.isSuccess
            ? unresolvedCount > 0
              ? `${unresolvedCount} active · ${rows.length} shown`
              : "All clear — no active incidents"
            : "Emergency trigger audit log"
        }
      />

      {/* Active alarm banner — only shows when there's unresolved SOS activity */}
      {unresolvedCount > 0 ? (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing.lg,
            padding: `${spacing.lg}px ${spacing.xl}px`,
            borderRadius: radius.lg,
            background: gradients.primary,
            color: "#FFFFFF",
            boxShadow: shadows.brandLg,
            marginBottom: spacing.xl,
          }}
        >
          <AlertOctagon size={28} strokeWidth={2.5} />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: fonts.heading,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: -0.2,
              }}
            >
              {unresolvedCount} active emergency {unresolvedCount === 1 ? "alert" : "alerts"}
            </div>
            <div style={{ fontSize: 13, opacity: 0.92, marginTop: 2 }}>
              Respond immediately — every minute matters.
            </div>
          </div>
        </div>
      ) : null}

      {/* Status tabs */}
      <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.lg, flexWrap: "wrap" }}>
        {STATUS_TABS.map((tab) => {
          const active = status === tab.value;
          return (
            <button
              key={tab.value}
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
                transition: "all 0.15s",
              }}
            >
              {tab.label}
              {tab.value === "unresolved" && unresolvedCount > 0 ? (
                <span
                  style={{
                    marginLeft: 6,
                    padding: "1px 7px",
                    borderRadius: radius.full,
                    background: active ? "rgba(255,255,255,0.2)" : colors.rose,
                    color: "#FFFFFF",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {unresolvedCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {alertsQ.isError ? (
        <ErrorState error={alertsQ.error} onRetry={() => alertsQ.refetch()} />
      ) : alertsQ.isLoading ? (
        <LoadingState label="Loading SOS alerts…" />
      ) : rows.length === 0 ? (
        <EmptyState
          title={
            status === "unresolved"
              ? "No active SOS alerts"
              : `No ${status} alerts`
          }
          hint={
            status === "unresolved"
              ? "Good news. This page will light up automatically when a trigger fires."
              : undefined
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          {rows.map((alert) => (
            <SOSCard
              key={alert.id}
              alert={alert}
              onResolve={() => resolveM.mutate(alert.id)}
              isResolving={resolveM.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Card layout — chosen over table because SOS needs glanceable scan ────

function SOSCard({
  alert,
  onResolve,
  isResolving,
}: {
  alert: SOSRow;
  onResolve: () => void;
  isResolving: boolean;
}) {
  const isActive = !alert.resolvedAt;
  const mapsLink = `https://maps.google.com/?q=${alert.latitude},${alert.longitude}`;

  return (
    <div
      style={{
        background: colors.surface,
        borderRadius: radius.lg,
        border: `1px solid ${isActive ? colors.rose : colors.border}`,
        boxShadow: isActive ? shadows.brandSm : shadows.sm,
        padding: spacing.xl,
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: spacing.lg,
        alignItems: "start",
      }}
    >
      <div style={{ minWidth: 0 }}>
        {/* Top row: status dot + reporter identity */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing.sm,
            marginBottom: spacing.sm,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: isActive ? colors.rose : colors.success,
              boxShadow: isActive ? `0 0 0 4px ${colors.roseAccent}` : "none",
              flexShrink: 0,
              animation: isActive ? "sos-pulse 2s ease-in-out infinite" : "none",
            }}
          />
          <User size={14} color={colors.textTertiary} />
          <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>
            {alert.reporterName || alert.phone || (
              <span style={{ color: colors.textTertiary, fontStyle: "italic" }}>
                Anonymous guest
              </span>
            )}
          </span>
          {alert.phone && alert.reporterName ? (
            <span style={{ fontSize: 12, color: colors.textTertiary }}>
              · {alert.phone}
            </span>
          ) : null}
          {alert.source && alert.source !== "api" ? (
            <span
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                fontWeight: 600,
                color: colors.textTertiary,
                border: `1px solid ${colors.border}`,
                padding: "1px 6px",
                borderRadius: radius.full,
              }}
            >
              {alert.source === "guest_api" ? "guest" : alert.source}
            </span>
          ) : null}
        </div>

        {/* Message */}
        <div
          style={{
            fontSize: 14,
            color: colors.text,
            lineHeight: 1.5,
            marginBottom: spacing.md,
            wordBreak: "break-word",
          }}
        >
          {alert.message || (
            <span style={{ color: colors.textTertiary, fontStyle: "italic" }}>
              No message attached
            </span>
          )}
        </div>

        {/* Metadata row: location, time, response time */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: spacing.lg,
            fontSize: 12,
            color: colors.textSecondary,
          }}
        >
          <a
            href={mapsLink}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              color: colors.rose,
              textDecoration: "none",
              fontWeight: 600,
              fontFamily: fonts.mono,
            }}
          >
            <MapPin size={13} />
            {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)}
            <ExternalLink size={11} />
          </a>
          {alert.phone ? (
            <a
              href={`tel:${alert.phone}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: colors.info,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              <Phone size={13} />
              {alert.phone}
            </a>
          ) : null}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Clock size={13} />
            {relativeTime(alert.createdAt)}
          </span>
          {!isActive ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: colors.success, fontWeight: 600 }}>
                Resolved in {responseTime(alert.createdAt, alert.resolvedAt)}
              </span>
            </span>
          ) : null}
          {alert.adminRecipients != null && alert.adminRecipients > 0 ? (
            <span style={{ color: colors.textTertiary }}>
              Alerted {alert.adminRecipients} admin{alert.adminRecipients === 1 ? "" : "s"}
              {alert.smsRecipients ? ` · ${alert.smsRecipients} SMS` : ""}
            </span>
          ) : null}
        </div>
      </div>

      {/* Action column */}
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
        {isActive ? (
          <Button
            variant="primary"
            onClick={onResolve}
            disabled={isResolving}
          >
            Mark resolved
          </Button>
        ) : (
          <div
            style={{
              fontSize: 11,
              color: colors.success,
              fontWeight: 600,
              textAlign: "center",
              padding: `${spacing.sm}px ${spacing.md}px`,
              background: colors.successSoft,
              borderRadius: radius.md,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Resolved
          </div>
        )}
      </div>

      <style>{`
        @keyframes sos-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.9); }
        }
      `}</style>
    </div>
  );
}
