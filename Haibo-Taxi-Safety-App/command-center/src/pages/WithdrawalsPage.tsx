import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { admin } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Table, TH, TD } from "../components/Table";
import { Badge, statusTone } from "../components/Badge";
import { Button } from "../components/Button";
import { LoadingState, ErrorState, EmptyState } from "../components/States";
import { useAdminSocket } from "../hooks/useAdminSocket";
import { colors, radius, shadows, spacing } from "../lib/brand";

type StatusFilter = "pending" | "approved" | "rejected" | "";

const STATUS_TABS: Array<{ label: string; value: StatusFilter }> = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "All", value: "" },
];

interface WithdrawalRow {
  id: string;
  userId: string;
  amount: number;
  status: string;
  bankCode: string;
  accountNumber: string;
  accountName: string | null;
  narration: string | null;
  requestedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectionReason: string | null;
  requires2FA: boolean;
  userPhone: string | null;
  userDisplayName: string | null;
}

export function WithdrawalsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [rejectTarget, setRejectTarget] = useState<WithdrawalRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const withdrawalsQ = useQuery({
    queryKey: ["admin", "withdrawals", status],
    queryFn: () => admin.getWithdrawals(status || undefined),
  });

  const approveM = useMutation({
    mutationFn: (id: string) => admin.approveWithdrawal(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
      qc.invalidateQueries({ queryKey: ["admin", "system-metrics"] });
      toast.success(`Withdrawal ${id.slice(0, 8)} approved`);
    },
    onError: (err: any) => toast.error(err?.message || "Approve failed"),
  });

  const rejectM = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      admin.rejectWithdrawal(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
      qc.invalidateQueries({ queryKey: ["admin", "system-metrics"] });
      toast.success("Withdrawal rejected — user refunded");
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (err: any) => toast.error(err?.message || "Reject failed"),
  });

  // Realtime: when /api/wallet/withdraw fires emitToAdmins("withdrawal:requested")
  // the queue should light up without a refetch tap. Memoize the handler so
  // useAdminSocket doesn't churn the subscription on every render.
  const handlers = useMemo(
    () => ({
      "withdrawal:requested": (payload: any) => {
        qc.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
        toast.info(
          `New withdrawal: R${Number(payload.amount).toFixed(2)} from ${
            payload.userPhone || "unknown"
          }`
        );
      },
    }),
    [qc]
  );
  useAdminSocket(handlers);

  const rows: WithdrawalRow[] = withdrawalsQ.data?.data || [];
  const totalPending = rows
    .filter((r) => r.status === "pending")
    .reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <div>
      <PageHeader
        title="Withdrawals"
        subtitle={
          withdrawalsQ.isSuccess
            ? `${rows.length} ${status || "total"} · R${totalPending.toFixed(2)} pending value`
            : undefined
        }
      />

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
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {withdrawalsQ.isError ? (
        <ErrorState error={withdrawalsQ.error} onRetry={() => withdrawalsQ.refetch()} />
      ) : withdrawalsQ.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          title={
            status === "pending"
              ? "No pending withdrawals"
              : `No ${status || ""} withdrawals`
          }
          hint="The queue lights up in realtime when users submit new requests."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <TH>Requested</TH>
              <TH>User</TH>
              <TH>Amount</TH>
              <TH>Bank</TH>
              <TH>Account</TH>
              <TH>Status</TH>
              <TH>Actions</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isPending = r.status === "pending";
              return (
                <tr key={r.id}>
                  <TD>
                    {r.requestedAt ? new Date(r.requestedAt).toLocaleString("en-ZA") : "—"}
                  </TD>
                  <TD>
                    <div style={{ fontWeight: 600 }}>{r.userDisplayName || "—"}</div>
                    <div style={{ fontSize: 12, color: colors.textTertiary }}>
                      {r.userPhone || r.userId.slice(0, 8)}
                    </div>
                  </TD>
                  <TD>
                    <div style={{ fontWeight: 700, fontVariant: "tabular-nums" }}>
                      R{Number(r.amount).toFixed(2)}
                    </div>
                    {r.requires2FA ? (
                      <div style={{ marginTop: 2 }}>
                        <Badge tone="warning">2FA</Badge>
                      </div>
                    ) : null}
                  </TD>
                  <TD>{r.bankCode}</TD>
                  <TD truncate>
                    <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13 }}>
                      •••{r.accountNumber.slice(-4)}
                    </div>
                    {r.accountName ? (
                      <div style={{ fontSize: 12, color: colors.textTertiary }}>{r.accountName}</div>
                    ) : null}
                  </TD>
                  <TD>
                    <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                    {r.rejectionReason ? (
                      <div
                        style={{
                          fontSize: 11,
                          color: colors.textTertiary,
                          marginTop: 2,
                          maxWidth: 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={r.rejectionReason}
                      >
                        {r.rejectionReason}
                      </div>
                    ) : null}
                  </TD>
                  <TD>
                    {isPending ? (
                      <div style={{ display: "flex", gap: spacing.sm }}>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => approveM.mutate(r.id)}
                          disabled={approveM.isPending}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setRejectTarget(r)}
                          disabled={rejectM.isPending}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {rejectTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setRejectTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: colors.surface,
              borderRadius: radius.xl,
              padding: spacing["2xl"],
              width: 460,
              boxShadow: shadows.lg,
            }}
          >
            <h2 id="reject-title" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: colors.text }}>
              Reject withdrawal
            </h2>
            <p style={{ color: colors.textSecondary, fontSize: 13, marginTop: spacing.xs }}>
              Rejecting will refund R{Number(rejectTarget.amount).toFixed(2)} to{" "}
              {rejectTarget.userDisplayName || rejectTarget.userPhone || "the user"}.
            </p>

            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: colors.textSecondary,
                marginTop: spacing.lg,
                marginBottom: spacing.xs,
              }}
            >
              REASON
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Fraud check failed, bank details invalid, …"
              rows={3}
              style={{
                width: "100%",
                padding: `${spacing.md}px ${spacing.lg}px`,
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                fontSize: 14,
                fontFamily: "inherit",
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: spacing.sm,
                marginTop: spacing.lg,
              }}
            >
              <Button
                variant="secondary"
                onClick={() => {
                  setRejectTarget(null);
                  setRejectReason("");
                }}
                disabled={rejectM.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() =>
                  rejectM.mutate({ id: rejectTarget.id, reason: rejectReason.trim() })
                }
                disabled={rejectM.isPending || !rejectReason.trim()}
              >
                Reject &amp; refund
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
