import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Store, CheckCircle, Clock, TrendingUp, X } from "lucide-react";
import { admin } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/Card";
import { Table, TH, TD } from "../components/Table";
import { Badge, statusTone } from "../components/Badge";
import { Button } from "../components/Button";
import { StatusTabs, StatusTab } from "../components/StatusTabs";
import { LoadingState, ErrorState, EmptyState } from "../components/States";
import { colors, spacing, fonts, radius, shadows } from "../lib/brand";

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

interface VendorSaleRow {
  id: string;
  amount: number | string;
  message: string | null;
  status: string;
  createdAt: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
}

interface VendorDetailResponse {
  data: VendorRow & {
    reviewedBy: string | null;
    reviewedAt: string | null;
    ownerRole: string | null;
    ownerIsSuspended: boolean | null;
  };
  recentSales: VendorSaleRow[];
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VendorsPage() {
  const [status, setStatus] = useState("pending");
  const [detailId, setDetailId] = useState<string | null>(null);
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
              <tr
                key={v.id}
                onClick={() => setDetailId(v.id)}
                style={{ cursor: "pointer" }}
              >
                <TD>
                  <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
                    {v.businessImageUrl ? (
                      <img
                        src={v.businessImageUrl}
                        alt={v.businessName}
                        onError={(e) => {
                          // Broken URL — hide the img so the row doesn't show a
                          // permanently-broken image icon. A text-only card
                          // still reads fine.
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: radius.sm,
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                    ) : null}
                    <div style={{ minWidth: 0 }}>
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
                    </div>
                  </div>
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
                  {/* Stop propagation so clicking an action button
                      doesn't also open the detail drawer — the row
                      click handler lives on the parent <tr>. */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap" }}
                  >
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

      {detailId ? (
        <VendorDetailDrawer
          vendorId={detailId}
          onClose={() => setDetailId(null)}
          onStatusChange={(next) => {
            setStatusMut.mutate({ id: detailId, next });
          }}
          isMutating={setStatusMut.isPending}
        />
      ) : null}
    </div>
  );
}

// ─── Detail drawer ──────────────────────────────────────────────────────────
// Right-side slide-over that shows the full vendor record, owner details,
// and the 10 most recent sales. Fetched on open so list-view queries
// stay lean. Actions reuse the same setVendorStatus mutation from the
// parent via callback so the list row and the drawer stay in sync.

function VendorDetailDrawer({
  vendorId,
  onClose,
  onStatusChange,
  isMutating,
}: {
  vendorId: string;
  onClose: () => void;
  onStatusChange: (next: "pending" | "verified" | "suspended") => void;
  isMutating: boolean;
}) {
  const detailQ = useQuery<VendorDetailResponse>({
    queryKey: ["admin", "vendor", vendorId],
    queryFn: () => admin.getVendorDetail(vendorId),
  });

  const v = detailQ.data?.data;
  const sales = detailQ.data?.recentSales || [];

  const handleSuspend = () => {
    if (!window.confirm("Suspend this vendor? They won't be able to receive payments.")) return;
    onStatusChange("suspended");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vendor-detail-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: "calc(100vw - 32px)",
          background: colors.surface,
          boxShadow: shadows.lg,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header bar with close button */}
        <div
          style={{
            padding: `${spacing.lg}px ${spacing["2xl"]}px`,
            borderBottom: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: colors.surface,
          }}
        >
          <div
            id="vendor-detail-title"
            style={{
              fontFamily: fonts.heading,
              fontSize: 18,
              fontWeight: 700,
              color: colors.text,
            }}
          >
            Vendor details
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 6,
              borderRadius: radius.sm,
              color: colors.textSecondary,
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: spacing["2xl"],
          }}
        >
          {detailQ.isLoading ? (
            <LoadingState />
          ) : detailQ.isError || !v ? (
            <ErrorState
              error={detailQ.error}
              onRetry={() => detailQ.refetch()}
            />
          ) : (
            <>
              {/* Hero: business image + name + ref + status */}
              <div
                style={{
                  display: "flex",
                  gap: spacing.lg,
                  marginBottom: spacing["2xl"],
                }}
              >
                {v.businessImageUrl ? (
                  <img
                    src={v.businessImageUrl}
                    alt={v.businessName}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: radius.md,
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: radius.md,
                      background: colors.roseAccent,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Store size={32} color={colors.rose} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: fonts.heading,
                      fontSize: 22,
                      fontWeight: 700,
                      color: colors.text,
                      marginBottom: 4,
                    }}
                  >
                    {v.businessName}
                  </div>
                  <div
                    style={{
                      fontFamily: fonts.mono,
                      fontSize: 12,
                      fontWeight: 700,
                      color: colors.rose,
                      background: colors.roseAccent,
                      padding: "3px 8px",
                      borderRadius: radius.sm,
                      display: "inline-block",
                      marginBottom: 8,
                    }}
                  >
                    {v.vendorRef}
                  </div>
                  <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap" }}>
                    <Badge tone="neutral">{TYPE_LABEL[v.vendorType] || v.vendorType}</Badge>
                    <Badge tone={statusTone(v.status)}>{v.status}</Badge>
                  </div>
                </div>
              </div>

              {/* Facts grid */}
              <DetailFacts
                items={[
                  { label: "Rank / location", value: v.rankLocation || "—" },
                  { label: "Description", value: v.description || "—" },
                  {
                    label: "Owner",
                    value: v.ownerName
                      ? `${v.ownerName}${v.ownerPhone ? ` · ${v.ownerPhone}` : ""}`
                      : v.ownerPhone || "—",
                  },
                  {
                    label: "Account status",
                    value: v.ownerIsSuspended ? "Suspended user" : "Active user",
                  },
                  { label: "Registered", value: formatWhen(v.createdAt) },
                  { label: "Last reviewed", value: formatWhen(v.reviewedAt) },
                ]}
              />

              {/* Sales totals row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: spacing.md,
                  marginTop: spacing["2xl"],
                }}
              >
                <DetailStat
                  label="Lifetime sales"
                  value={`R${Number(v.totalSales).toLocaleString("en-ZA", {
                    minimumFractionDigits: 0,
                  })}`}
                />
                <DetailStat
                  label="Transactions"
                  value={Number(v.salesCount).toLocaleString()}
                />
              </div>

              {/* Recent sales feed */}
              <div
                style={{
                  marginTop: spacing["2xl"],
                  fontSize: 11,
                  fontWeight: 600,
                  color: colors.textSecondary,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: spacing.md,
                }}
              >
                Recent sales
              </div>
              {sales.length === 0 ? (
                <div
                  style={{
                    fontSize: 13,
                    color: colors.textTertiary,
                    padding: spacing.lg,
                    textAlign: "center",
                    background: colors.surfaceAlt,
                    borderRadius: radius.md,
                  }}
                >
                  No completed sales yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
                  {sales.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: `${spacing.sm}px ${spacing.md}px`,
                        background: colors.surfaceAlt,
                        borderRadius: radius.sm,
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {s.buyerName || s.buyerPhone || "Walk-up customer"}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: colors.textTertiary,
                            marginTop: 2,
                          }}
                        >
                          {formatWhen(s.createdAt)}
                          {s.message ? ` · ${s.message}` : ""}
                        </div>
                      </div>
                      <div
                        style={{
                          fontVariant: "tabular-nums",
                          fontWeight: 700,
                          color: colors.success,
                          marginLeft: spacing.md,
                        }}
                      >
                        +R{Number(s.amount).toLocaleString("en-ZA", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky action footer */}
        {v ? (
          <div
            style={{
              padding: spacing.lg,
              borderTop: `1px solid ${colors.border}`,
              display: "flex",
              gap: spacing.sm,
              justifyContent: "flex-end",
              background: colors.surface,
            }}
          >
            {v.status === "pending" ? (
              <>
                <Button
                  variant="danger"
                  onClick={handleSuspend}
                  disabled={isMutating}
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  onClick={() => onStatusChange("verified")}
                  disabled={isMutating}
                >
                  Verify
                </Button>
              </>
            ) : v.status === "verified" ? (
              <Button
                variant="danger"
                onClick={handleSuspend}
                disabled={isMutating}
              >
                Suspend
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => onStatusChange("verified")}
                disabled={isMutating}
              >
                Restore
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DetailFacts({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      {items.map((item) => (
        <div key={item.label}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: colors.textTertiary,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 2,
            }}
          >
            {item.label}
          </div>
          <div style={{ fontSize: 14, color: colors.text, lineHeight: 1.4 }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: spacing.md,
        background: colors.surfaceAlt,
        borderRadius: radius.md,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: colors.textTertiary,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: colors.text,
          fontVariant: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}
