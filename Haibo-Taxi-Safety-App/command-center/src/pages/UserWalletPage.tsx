import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Wallet } from "lucide-react";
import { admin } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/Card";
import { Table, TH, TD } from "../components/Table";
import { Badge, BadgeTone, statusTone } from "../components/Badge";
import { Button } from "../components/Button";
import { LoadingState, ErrorState } from "../components/States";
import { colors, radius, shadows, spacing, fonts } from "../lib/brand";

interface WalletTxn {
  id: string;
  type: string | null;
  amount: number;
  description: string | null;
  status: string | null;
  paymentReference: string | null;
  relatedUserId: string | null;
  relatedUserPhone: string | null;
  createdAt: string | null;
}

interface WalletResponse {
  user: {
    id: string;
    phone: string;
    displayName: string | null;
    email: string | null;
    role: string | null;
    walletBalance: number | null;
    isVerified: boolean | null;
    createdAt: string | null;
  };
  transactions: WalletTxn[];
  totals: {
    depositedAllTime: number;
    withdrawnAllTime: number;
    pendingCount: number;
  };
}

const TYPE_LABELS: Record<string, { label: string; tone: BadgeTone }> = {
  topup: { label: "Top-up", tone: "success" },
  transfer_sent: { label: "Transfer out", tone: "warning" },
  transfer_received: { label: "Transfer in", tone: "success" },
  adjustment: { label: "Admin adjustment", tone: "rose" },
  refund: { label: "Refund", tone: "info" },
  fare_payment: { label: "Fare", tone: "neutral" },
};

function typeMeta(type: string | null): { label: string; tone: BadgeTone } {
  if (!type) return { label: "—", tone: "neutral" };
  return TYPE_LABELS[type] || { label: type, tone: "neutral" };
}

export function UserWalletPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const walletQ = useQuery<WalletResponse>({
    queryKey: ["admin", "user-wallet", userId],
    queryFn: () => admin.getUserWallet(userId!),
    enabled: !!userId,
  });

  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amountInput, setAmountInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");

  const adjustM = useMutation({
    mutationFn: () =>
      admin.adjustUserWallet(userId!, {
        amount: Number(amountInput),
        direction,
        reason: reasonInput.trim(),
      }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["admin", "user-wallet", userId] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(
        `Wallet ${direction}ed — new balance R${Number(data.newBalance).toFixed(2)}`
      );
      setShowAdjustModal(false);
      setAmountInput("");
      setReasonInput("");
    },
    onError: (err: any) => toast.error(err?.message || "Adjustment failed"),
  });

  if (walletQ.isLoading) return <LoadingState label="Loading wallet…" />;
  if (walletQ.isError)
    return (
      <ErrorState error={walletQ.error} onRetry={() => walletQ.refetch()} />
    );
  if (!walletQ.data) return null;

  const { user, transactions, totals } = walletQ.data;
  const balance = Number(user.walletBalance) || 0;
  const canSubmit =
    Number(amountInput) > 0 && reasonInput.trim().length >= 4 && !adjustM.isPending;

  return (
    <div>
      <PageHeader
        title={user.displayName || user.phone}
        subtitle={
          <span style={{ display: "inline-flex", alignItems: "center", gap: spacing.sm }}>
            <Wallet size={14} color={colors.textTertiary} />
            Haibo Pay wallet · {user.phone} · {user.role || "commuter"}
          </span>
        }
        right={
          <div style={{ display: "flex", gap: spacing.sm }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(-1)}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <ArrowLeft size={14} /> Back
              </span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setDirection("credit");
                setShowAdjustModal(true);
              }}
            >
              Adjust balance
            </Button>
          </div>
        }
      />

      {/* Stat cards — current balance featured, then lifetime totals */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: spacing.lg,
          marginBottom: spacing["2xl"],
        }}
      >
        <StatCard
          label="Current balance"
          value={`R${balance.toFixed(2)}`}
          accent="rose"
          sub={
            totals.pendingCount > 0
              ? `${totals.pendingCount} pending out-flow${totals.pendingCount === 1 ? "" : "s"}`
              : "spendable"
          }
        />
        <StatCard
          label="Deposited lifetime"
          value={`R${totals.depositedAllTime.toFixed(2)}`}
          accent="success"
        />
        <StatCard
          label="Withdrawn lifetime"
          value={`R${totals.withdrawnAllTime.toFixed(2)}`}
        />
        <StatCard
          label="Net flow"
          value={`R${(totals.depositedAllTime - totals.withdrawnAllTime).toFixed(2)}`}
          sub="deposits minus withdrawals"
        />
      </div>

      {/* Recent transactions */}
      <div
        style={{
          marginBottom: spacing.md,
          fontFamily: fonts.heading,
          fontSize: 17,
          fontWeight: 600,
        }}
      >
        Recent transactions
      </div>
      {transactions.length === 0 ? (
        <div
          style={{
            padding: spacing["2xl"],
            textAlign: "center",
            color: colors.textTertiary,
            fontSize: 14,
            background: colors.surface,
            borderRadius: radius.lg,
            border: `1px dashed ${colors.border}`,
          }}
        >
          No transactions yet.
        </div>
      ) : (
        <Table>
          <thead>
            <tr>
              <TH>Date</TH>
              <TH>Type</TH>
              <TH>Description</TH>
              <TH>Amount</TH>
              <TH>Status</TH>
              <TH>Reference</TH>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const meta = typeMeta(t.type);
              const amt = Number(t.amount);
              const isIncome = amt > 0;
              return (
                <tr key={t.id}>
                  <TD>
                    {t.createdAt ? new Date(t.createdAt).toLocaleString("en-ZA") : "—"}
                  </TD>
                  <TD>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      {isIncome ? (
                        <ArrowDownLeft size={14} color={colors.success} />
                      ) : (
                        <ArrowUpRight size={14} color={colors.rose} />
                      )}
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                  </TD>
                  <TD truncate>
                    {t.description || (
                      <span style={{ color: colors.textTertiary }}>—</span>
                    )}
                  </TD>
                  <TD>
                    <span
                      style={{
                        fontVariant: "tabular-nums",
                        fontWeight: 700,
                        color: isIncome ? colors.success : colors.rose,
                      }}
                    >
                      {isIncome ? "+" : "−"}R{Math.abs(amt).toFixed(2)}
                    </span>
                  </TD>
                  <TD>
                    <Badge tone={statusTone(t.status)}>{t.status || "—"}</Badge>
                  </TD>
                  <TD>
                    <span
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: 11,
                        color: colors.textTertiary,
                      }}
                    >
                      {t.paymentReference
                        ? t.paymentReference.slice(0, 14)
                        : t.relatedUserPhone || "—"}
                    </span>
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {/* Adjustment modal */}
      {showAdjustModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="adjust-title"
          onClick={() => setShowAdjustModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: colors.surface,
              borderRadius: radius.xl,
              padding: spacing["2xl"],
              width: 480,
              maxWidth: "calc(100vw - 32px)",
              boxShadow: shadows.lg,
            }}
          >
            <h2
              id="adjust-title"
              style={{
                margin: 0,
                fontFamily: fonts.heading,
                fontSize: 22,
                fontWeight: 700,
                color: colors.text,
                letterSpacing: -0.3,
              }}
            >
              Adjust wallet
            </h2>
            <p
              style={{
                fontSize: 13,
                color: colors.textSecondary,
                marginTop: spacing.xs,
                marginBottom: spacing.lg,
              }}
            >
              {user.displayName || user.phone} · current balance{" "}
              <strong style={{ color: colors.text, fontVariant: "tabular-nums" }}>
                R{balance.toFixed(2)}
              </strong>
            </p>

            {/* Direction toggle */}
            <div
              role="radiogroup"
              aria-label="Direction"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: spacing.sm,
                padding: 4,
                background: colors.bg,
                borderRadius: radius.full,
                marginBottom: spacing.lg,
              }}
            >
              {(["credit", "debit"] as const).map((d) => {
                const active = direction === d;
                return (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setDirection(d)}
                    style={{
                      padding: `${spacing.sm}px ${spacing.md}px`,
                      borderRadius: radius.full,
                      border: "none",
                      background: active
                        ? d === "credit"
                          ? colors.success
                          : colors.rose
                        : "transparent",
                      color: active ? "#FFFFFF" : colors.textSecondary,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: active ? shadows.sm : "none",
                      transition: "background 0.15s, color 0.15s",
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                    }}
                  >
                    {d === "credit" ? "Credit (+)" : "Debit (−)"}
                  </button>
                );
              })}
            </div>

            <FieldLabel>AMOUNT (R)</FieldLabel>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              min={0}
              step={0.01}
              style={{
                width: "100%",
                padding: `${spacing.md}px ${spacing.lg}px`,
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                fontSize: 16,
                fontFamily: "inherit",
                fontVariant: "tabular-nums",
                marginBottom: spacing.lg,
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            <FieldLabel>REASON (REQUIRED)</FieldLabel>
            <textarea
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="e.g. Refund for failed trip 2b40f — ticket #HB-4821"
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
                marginBottom: spacing.xs,
              }}
            />
            <div
              style={{
                fontSize: 11,
                color: colors.textTertiary,
                marginBottom: spacing.lg,
              }}
            >
              This reason is saved verbatim to the audit log and sent to the user as a push notification.
            </div>

            {direction === "debit" && Number(amountInput) > balance ? (
              <div
                style={{
                  padding: `${spacing.sm}px ${spacing.md}px`,
                  borderRadius: radius.md,
                  background: colors.dangerSoft,
                  color: colors.danger,
                  fontSize: 13,
                  marginBottom: spacing.lg,
                }}
              >
                Insufficient balance — debit cannot exceed R{balance.toFixed(2)}.
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: spacing.sm,
              }}
            >
              <Button
                variant="secondary"
                onClick={() => setShowAdjustModal(false)}
                disabled={adjustM.isPending}
              >
                Cancel
              </Button>
              <Button
                variant={direction === "credit" ? "primary" : "danger"}
                onClick={() => adjustM.mutate()}
                disabled={
                  !canSubmit ||
                  (direction === "debit" && Number(amountInput) > balance)
                }
              >
                {direction === "credit"
                  ? `Credit R${Number(amountInput || 0).toFixed(2)}`
                  : `Debit R${Number(amountInput || 0).toFixed(2)}`}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      {children}
    </div>
  );
}
