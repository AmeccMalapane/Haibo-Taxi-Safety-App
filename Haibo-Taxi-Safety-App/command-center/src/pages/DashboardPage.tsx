import React from "react";
import { useQuery } from "@tanstack/react-query";
import { admin, healthCheck } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/Card";
import { Table, TH, TD } from "../components/Table";
import { Badge, severityTone, statusTone } from "../components/Badge";
import { LoadingState, ErrorState, EmptyState } from "../components/States";
import { colors, spacing } from "../lib/brand";

export function DashboardPage() {
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
            <StatCard label="Total users" value={metrics?.totalUsers ?? 0} />
            <StatCard label="Active vehicles" value={metrics?.activeVehicles ?? 0} />
            <StatCard label="Registered drivers" value={metrics?.totalDrivers ?? 0} />
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
