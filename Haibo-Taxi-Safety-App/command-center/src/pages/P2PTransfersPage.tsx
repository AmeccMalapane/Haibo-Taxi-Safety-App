import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { admin } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/Card";
import { Table, TH, TD } from "../components/Table";
import { Badge, statusTone } from "../components/Badge";
import { LoadingState, ErrorState, EmptyState } from "../components/States";
import { StatusTabs, StatusTab } from "../components/StatusTabs";
import { colors, spacing, fonts } from "../lib/brand";

interface P2PTransfer {
  id: string;
  senderId: string;
  recipientId: string | null;
  recipientPhone: string | null;
  recipientUsername: string | null;
  amount: number;
  message: string | null;
  status: string;
  createdAt: string | null;
  senderPhone: string | null;
  senderName: string | null;
  recipientResolvedPhone: string | null;
  recipientResolvedName: string | null;
}

export function P2PTransfersPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("completed");

  const transfersQ = useQuery({
    queryKey: ["admin", "p2p-transfers", status],
    queryFn: () => admin.getP2PTransfers({ status: status || undefined }),
  });

  const rows: P2PTransfer[] = transfersQ.data?.data || [];
  const counts: Record<string, number> = transfersQ.data?.counts || {};
  const totalVolume: number = transfersQ.data?.totalVolumeCompleted || 0;

  const tabs: StatusTab[] = useMemo(
    () => [
      { label: "Completed", value: "completed", count: counts.completed },
      { label: "Pending", value: "pending", count: counts.pending },
      { label: "Rejected", value: "rejected", count: counts.rejected },
    ],
    [counts]
  );

  return (
    <div>
      <PageHeader
        title="Peer transfers"
        subtitle="Send-money history across the wallet network"
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
          label="Lifetime volume"
          value={`R${totalVolume.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`}
          accent="rose"
          sub="completed transfers"
        />
        <StatCard
          label="Completed"
          value={(counts.completed || 0).toLocaleString()}
          accent="success"
        />
        <StatCard
          label="Pending"
          value={(counts.pending || 0).toLocaleString()}
          accent={counts.pending ? "danger" : "default"}
          sub={counts.pending ? "needs attention" : "all clear"}
        />
        <StatCard
          label="Rejected"
          value={(counts.rejected || 0).toLocaleString()}
        />
      </div>

      <StatusTabs tabs={tabs} active={status} onChange={setStatus} />

      {transfersQ.isError ? (
        <ErrorState error={transfersQ.error} onRetry={() => transfersQ.refetch()} />
      ) : transfersQ.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          title={`No ${status} transfers`}
          hint="Users send peer transfers from the Haibo Pay wallet's Send action."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <TH>Date</TH>
              <TH>Sender</TH>
              <TH>{"\u00A0"}</TH>
              <TH>Recipient</TH>
              <TH>Amount</TH>
              <TH>Message</TH>
              <TH>Status</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <TD>
                  <div style={{ fontSize: 12 }}>
                    {t.createdAt
                      ? new Date(t.createdAt).toLocaleDateString("en-ZA", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </div>
                  <div style={{ fontSize: 11, color: colors.textTertiary }}>
                    {t.createdAt
                      ? new Date(t.createdAt).toLocaleTimeString("en-ZA", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </div>
                </TD>
                <TD>
                  <div
                    onClick={() => navigate(`/users/${t.senderId}/wallet`)}
                    style={{
                      cursor: "pointer",
                      display: "inline-block",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {t.senderName || (
                        <span style={{ color: colors.textTertiary, fontStyle: "italic" }}>
                          —
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: colors.textTertiary }}>
                      {t.senderPhone || t.senderId.slice(0, 8)}
                    </div>
                  </div>
                </TD>
                <TD>
                  <ArrowRight size={14} color={colors.textTertiary} />
                </TD>
                <TD>
                  {t.recipientId ? (
                    <div
                      onClick={() => navigate(`/users/${t.recipientId}/wallet`)}
                      style={{ cursor: "pointer", display: "inline-block" }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                    >
                      <div style={{ fontWeight: 600 }}>
                        {t.recipientResolvedName || (
                          <span style={{ color: colors.textTertiary, fontStyle: "italic" }}>
                            —
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: colors.textTertiary }}>
                        {t.recipientResolvedPhone || t.recipientPhone || t.recipientId.slice(0, 8)}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          color: colors.textTertiary,
                          fontStyle: "italic",
                        }}
                      >
                        non-user
                      </div>
                      <div style={{ fontSize: 11, color: colors.textTertiary }}>
                        {t.recipientPhone || t.recipientUsername || "—"}
                      </div>
                    </div>
                  )}
                </TD>
                <TD>
                  <span
                    style={{
                      fontVariant: "tabular-nums",
                      fontWeight: 700,
                      fontSize: 14,
                      color: colors.rose,
                    }}
                  >
                    R{Number(t.amount).toFixed(2)}
                  </span>
                </TD>
                <TD truncate>
                  {t.message ? (
                    <span
                      style={{
                        fontSize: 12,
                        color: colors.textSecondary,
                        fontStyle: "italic",
                      }}
                    >
                      "{t.message}"
                    </span>
                  ) : (
                    <span style={{ color: colors.textTertiary }}>—</span>
                  )}
                </TD>
                <TD>
                  <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                </TD>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
