import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { admin, healthCheck } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/Card";
import { Table, TH, TD } from "../components/Table";
import { Badge, severityTone, statusTone } from "../components/Badge";
import { LoadingState, ErrorState, EmptyState } from "../components/States";
import { useAdminSocket } from "../hooks/useAdminSocket";
import { colors, spacing } from "../lib/brand";

export function DashboardPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const metricsQ = useQuery({
    queryKey: ["admin", "system-metrics"],
    queryFn: () => admin.getSystemMetrics(),
  });
  const complianceQ = useQuery({
    queryKey: ["admin", "compliance"],
    queryFn: () => admin.getComplianceMetrics(),
  });
  const healthQ = useQuery({
    queryKey: ["health"],
    queryFn: () => healthCheck(),
    refetchInterval: 30_000,
  });
  // Pull just the unresolved count — limit=1 keeps the payload tiny since
  // the dashboard only cares about the badge, not the row data.
  const sosQ = useQuery({
    queryKey: ["admin", "sos-alerts", "unresolved-count"],
    queryFn: () => admin.getSOSAlerts({ status: "unresolved", limit: 1 }),
    refetchInterval: 20_000,
  });
  // Pending driver KYC count — limit=1 keeps the payload tiny; we only
  // need pendingCount from the response for the badge.
  const driversQ = useQuery({
    queryKey: ["admin", "drivers", "pending-count"],
    queryFn: () => admin.getDrivers({ verified: "false", limit: 1 }),
  });

  // Realtime: SOS alerts page the operator with a hard toast; complaint:new
  // and withdrawal:requested invalidate the metrics query so the dashboard
  // badge counts update without a manual refetch.
  const handlers = useMemo(
    () => ({
      "sos:alert": (payload: any) => {
        qc.invalidateQueries({ queryKey: ["admin", "sos-alerts"] });
        toast.error(
          `🚨 SOS from ${payload.phone || payload.userId || "unknown"}`,
          {
            description: payload.message || "Emergency triggered",
            duration: 15_000,
            action: {
              label: "View",
              onClick: () => navigate("/admin/sos"),
            },
          }
        );
      },
      "complaint:new": (payload: any) => {
        qc.invalidateQueries({ queryKey: ["admin", "system-metrics"] });
        qc.invalidateQueries({ queryKey: ["complaints"] });
        toast.info(`New complaint: ${payload.category || "general"}`);
      },
      "withdrawal:requested": (payload: any) => {
        qc.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
        toast.info(
          `New withdrawal: R${Number(payload.amount).toFixed(2)}`
        );
      },
      "pasop:reported": (payload: any) => {
        qc.invalidateQueries({ queryKey: ["moderation:pasop"] });
        toast.info(
          `New hazard report: ${payload.category || "unknown"}${
            payload.reporterName ? ` · ${payload.reporterName}` : ""
          }`
        );
      },
    }),
    [qc, navigate]
  );
  useAdminSocket(handlers);

  const anyError = metricsQ.error || complianceQ.error || healthQ.error;
  const anyLoading = metricsQ.isLoading || complianceQ.isLoading || healthQ.isLoading;

  const metrics = metricsQ.data;
  const compliance = complianceQ.data;
  const health = healthQ.data;

  const statusText =
    health?.status === "healthy"
      ? `API healthy — DB ${health.database || "ok"}`
      : health
      ? `API ${health.status || "unknown"} — DB ${health.database || "unknown"}`
      : "Checking backend…";

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={
          <span style={{ display: "inline-flex", alignItems: "center", gap: spacing.xs }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: health?.status === "healthy" ? colors.success : colors.danger,
                display: "inline-block",
              }}
            />
            {statusText}
          </span>
        }
      />

      {anyError && !metrics ? (
        <ErrorState error={anyError} onRetry={() => metricsQ.refetch()} />
      ) : anyLoading && !metrics ? (
        <LoadingState label="Loading dashboard metrics…" />
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: spacing.lg,
              marginBottom: spacing["2xl"],
            }}
          >
            <StatCard
              label="Active SOS alerts"
              value={sosQ.data?.unresolvedCount ?? 0}
              accent={(sosQ.data?.unresolvedCount ?? 0) > 0 ? "danger" : "success"}
              sub={
                (sosQ.data?.unresolvedCount ?? 0) > 0
                  ? "needs response"
                  : "all clear"
              }
            />
            <StatCard label="Total users" value={metrics?.totalUsers ?? 0} />
            <StatCard label="Active vehicles" value={metrics?.activeVehicles ?? 0} />
            <StatCard
              label="Registered drivers"
              value={metrics?.totalDrivers ?? 0}
              sub={
                (driversQ.data?.pendingCount ?? 0) > 0
                  ? `${driversQ.data.pendingCount} pending KYC`
                  : "all verified"
              }
            />
            <StatCard
              label="Pending complaints"
              value={metrics?.pendingComplaints ?? 0}
              accent={(metrics?.pendingComplaints ?? 0) > 0 ? "danger" : "success"}
            />
            <StatCard label="Total events" value={metrics?.totalEvents ?? 0} />
            <StatCard label="Group rides" value={metrics?.totalRides ?? 0} />
            <StatCard label="Deliveries" value={metrics?.totalDeliveries ?? 0} />
            <StatCard
              label="Compliance rate"
              value={`${compliance?.overallRate ?? 0}%`}
              accent="rose"
            />
          </div>

          <div style={{ marginBottom: spacing.md, fontSize: 16, fontWeight: 600 }}>
            Recent complaints
          </div>
          {metrics?.recentComplaints?.length ? (
            <Table>
              <thead>
                <tr>
                  <TH>Category</TH>
                  <TH>Severity</TH>
                  <TH>Description</TH>
                  <TH>Status</TH>
                </tr>
              </thead>
              <tbody>
                {metrics.recentComplaints.slice(0, 5).map((c: any) => (
                  <tr key={c.id}>
                    <TD>{c.category}</TD>
                    <TD>
                      <Badge tone={severityTone(c.severity)}>{c.severity}</Badge>
                    </TD>
                    <TD truncate>{c.description}</TD>
                    <TD>
                      <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                    </TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="No recent complaints" hint="Quiet is good." />
          )}
        </>
      )}
    </div>
  );
}
