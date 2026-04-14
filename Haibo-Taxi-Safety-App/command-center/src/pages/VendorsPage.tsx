import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, Store, CheckCircle, Clock, Ban, TrendingUp } from "lucide-react";
import { admin } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/Card";
import { Table, TH, TD } from "../components/Table";
import { Badge, statusTone } from "../components/Badge";
import { Button } from "../components/Button";
import { StatusTabs, StatusTab } from "../components/StatusTabs";
import { LoadingState, ErrorState, EmptyState } from "../components/States";
import { colors, spacing, fonts, radius } from "../lib/brand";

interface VendorRow {
  id: string;
  userId: string;
  vendorType: "taxi_vendor" | "hawker" | "accessories";
  businessName: string;
  rankLocation: string | null;
  description: string | null;
  businessImageUrl: string | null;
  vendorRef: string;
  status: "pending" | "verified" | "suspended";
  salesCount: number;
  totalSales: number;
  createdAt: string | null;
  updatedAt: string | null;
  ownerPhone: string | null;
  ownerName: string | null;
}

interface VendorsResponse {
  data: VendorRow[];
  counts: Record<string, number>;
  totals: { totalSales: number; totalTxns: number };
  pendingCount: number;
}

const TYPE_LABEL: Record<VendorRow["vendorType"], string> = {
  taxi_vendor: "Rank vendor",
  hawker: "Hawker",
  accessories: "Accessories",
};

export function VendorsPage() {
  const [status, setStatus] = useState("pending");
  const queryClient = useQueryClient();

  const vendorsQ = useQuery<VendorsResponse>({
    queryKey: ["admin", "vendors", status],
    queryFn: () => admin.getVendors({ status }),
  });

  const setStatusMut = useMutation({
    mutationFn: ({
      id,
      next,
    }: {
      id: string;
      next: "pending" | "verified" | "suspended";
    }) => admin.setVendorStatus(id, next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "vendors"] });
    },
  });

  const rows: VendorRow[] = vendorsQ.data?.data || [];
  const counts = vendorsQ.data?.counts || {};
  const totals = vendorsQ.data?.totals || { totalSales: 0, totalTxns: 0 };

  const tabs: StatusTab[] = useMemo(
    () => [
      { label: "Pending", value: "pending", count: counts.pending },
      { label: "Verified", value: "verified", count: counts.verified },
      { label: "Suspended", value: "suspended", count: counts.suspended },
    ],
    [counts]
  );

  const handleVerify = (id: string) => {
    setStatusMut.mutate({ id, next: "verified" });
  };
  const handleSuspend = (id: string) => {
    if (!window.confirm("Suspend this vendor? They won't be able to receive payments.")) return;
    setStatusMut.mutate({ id, next: "suspended" });
  };
  const handleRestore = (id: string) => {
    setStatusMut.mutate({ id, next: "verified" });
  };

  return (
    <div>
      <PageHeader
        title="Haibo Vault vendors"
        subtitle="Rank vendors, hawkers, and accessory sellers — review, verify, suspend"
      />

      {/* Summary stat row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: spacing.lg,
          marginBottom: spacing["2xl"],
        }}
      >
        <StatCard
          label="Total vendors"
          value={(
            (counts.pending || 0) +
            (counts.verified || 0) +
            (counts.suspended || 0)
          ).toLocaleString()}
          Icon={Store}
          accent="rose"
        />
        <StatCard
          label="Pending review"
          value={(counts.pending || 0).toLocaleString()}
          Icon={Clock}
          accent={counts.pending ? "danger" : "default"}
          sub={counts.pending ? "needs attention" : "all clear"}
        />
        <StatCard
          label="Verified"
          value={(counts.verified || 0).toLocaleString()}
          Icon={CheckCircle}
          accent="success"
        />
        <StatCard
          label="Lifetime sales"
          value={`R${totals.totalSales.toLocaleString("en-ZA", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}`}
          Icon={TrendingUp}
          sub={`${totals.totalTxns.toLocaleString()} transactions`}
        />
      </div>

      <StatusTabs tabs={tabs} active={status} onChange={setStatus} />

      {vendorsQ.isError ? (
        <ErrorState error={vendorsQ.error} onRetry={() => vendorsQ.refetch()} />
      ) : vendorsQ.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          title={`No ${status} vendors`}
          hint={
            status === "pending"
              ? "New vendor signups appear here for review before they join the public directory."
              : "Vendors register from the mobile app's Wallet screen."
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <TH>Business</TH>
              <TH>Type</TH>
              <TH>Ref code</TH>
              <TH>Location</TH>
              <TH>Owner</TH>
              <TH>Sales</TH>
              <TH>Status</TH>
              <TH>Actions</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id}>
                <TD>
                  <div style={{ fontWeight: 700 }}>{v.businessName}</div>
                  {v.description ? (
                    <div
                      style={{
                        fontSize: 11,
                        color: colors.textTertiary,
                        marginTop: 2,
                        maxWidth: 260,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={v.description}
                    >
                      {v.description}
                    </div>
                  ) : null}
                </TD>
                <TD>
                  <Badge tone="neutral">{TYPE_LABEL[v.vendorType] || v.vendorType}</Badge>
                </TD>
                <TD>
                  <span
                    style={{
                      fontFamily: fonts.mono,
                      fontSize: 12,
                      fontWeight: 700,
                      color: colors.rose,
                      letterSpacing: 0.5,
                      background: colors.roseAccent,
                      padding: `3px 8px`,
                      borderRadius: radius.sm,
                    }}
                  >
                    {v.vendorRef}
                  </span>
                </TD>
                <TD>
                  {v.rankLocation || (
                    <span style={{ color: colors.textTertiary }}>—</span>
                  )}
                </TD>
                <TD>
                  <div style={{ fontWeight: 600 }}>
                    {v.ownerName || (
                      <span
                        style={{
                          color: colors.textTertiary,
                          fontStyle: "italic",
                        }}
                      >
                        no name
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: colors.textTertiary }}>
                    {v.ownerPhone || v.userId.slice(0, 8)}
                  </div>
                </TD>
                <TD>
                  <div
                    style={{
                      fontVariant: "tabular-nums",
                      fontWeight: 700,
                    }}
                  >
                    R{Number(v.totalSales).toLocaleString("en-ZA", {
                      minimumFractionDigits: 0,
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: colors.textTertiary }}>
                    {v.salesCount} {v.salesCount === 1 ? "sale" : "sales"}
                  </div>
                </TD>
                <TD>
                  <Badge tone={statusTone(v.status)}>{v.status}</Badge>
                </TD>
                <TD>
                  <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap" }}>
                    {v.status === "pending" ? (
                      <>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleVerify(v.id)}
                          disabled={setStatusMut.isPending}
                        >
                          Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleSuspend(v.id)}
                          disabled={setStatusMut.isPending}
                        >
                          Reject
                        </Button>
                      </>
                    ) : v.status === "verified" ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleSuspend(v.id)}
                        disabled={setStatusMut.isPending}
                      >
                        Suspend
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleRestore(v.id)}
                        disabled={setStatusMut.isPending}
                      >
                        Restore
                      </Button>
                    )}
                  </div>
                </TD>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
