/**
 * FareImportsPage — admin review surface for Facebook-harvested fare imports.
 *
 * Pipeline refresher:
 *   1. harvest.ts pulls posts + comments from SA taxi FB groups (via Apify).
 *   2. extractor.ts (Claude Messages API) emits structured fare/demand rows.
 *   3. canonicalize.ts runs trigram matching against taxi_locations.
 *   4. Admin lands here to approve / reject / mark-duplicate before the
 *      extracted fare writes into the public taxi_fares table.
 *
 * Design notes:
 *   - NOT using the generic ModerationQueue component — approve payload is
 *     richer than the component's simple status patch (amount override,
 *     rank override, association, distance, etc.).
 *   - Reactive moderation model: nothing is public until approved here.
 *     (Exception vs. the rest of the repo which is "post first, hide later"
 *     — fares are a ranking signal, too much noise poisons the product.)
 *   - redacted text only — the raw-text scrubber already stripped phone /
 *     email PII before harvesting. POPIA retention clock ticks on the
 *     fare_imports row itself, not on this UI.
 */
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, MessageSquare, FileText } from "lucide-react";
import { admin } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Table, TH, TD } from "../components/Table";
import { Badge, type BadgeTone } from "../components/Badge";
import { Button } from "../components/Button";
import { LoadingState, ErrorState, EmptyState } from "../components/States";
import { colors, radius, shadows, spacing } from "../lib/brand";

type StatusFilter =
  | "pending_review"
  | "orphan"
  | "approved"
  | "rejected"
  | "duplicate"
  | "pending_extraction"
  | "pending_canonicalization"
  | "all";

const STATUS_TABS: Array<{ label: string; value: StatusFilter; hint?: string }> = [
  { label: "Pending review", value: "pending_review", hint: "Both ranks matched" },
  { label: "Orphan", value: "orphan", hint: "Destination unmatched" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Duplicate", value: "duplicate" },
  { label: "All", value: "all" },
];

interface FareImportRow {
  id: string;
  source: string;
  sourcePostId: string | null;
  sourcePostUrl: string | null;
  sourceCommentId: string | null;
  sourceCommentUrl: string | null;
  postTimestamp: string | null;
  harvestedAt: string | null;
  harvesterRunId: string | null;
  rawTextRedacted: string | null;
  containsPhoneNumber: boolean;
  containsEmail: boolean;
  extractorVersion: string | null;
  extractorModel: string | null;
  originRaw: string | null;
  destinationRaw: string | null;
  fareZar: number | null;
  metroHint: string | null;
  confidence: number | null;
  evidenceQuote: string | null;
  extractionNotes: string | null;
  originRankId: string | null;
  destinationRankId: string | null;
  originMatchScore: number | null;
  destinationMatchScore: number | null;
  canonicalizationMethod: string | null;
  canonicalizedAt: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
  taxiFareId: string | null;
  originRankName: string | null;
  destinationRankName: string | null;
}

interface ApproveDraft {
  row: FareImportRow;
  amount: string;
  distanceKm: string;
  estimatedTimeMinutes: string;
  association: string;
  notes: string;
}

export function FareImportsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("pending_review");
  const [approveDraft, setApproveDraft] = useState<ApproveDraft | null>(null);
  const [rejectTarget, setRejectTarget] = useState<FareImportRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const importsQ = useQuery({
    queryKey: ["admin", "fare-imports", status],
    queryFn: () =>
      admin.getFareImports({
        status: status === "all" ? undefined : status,
        limit: 100,
      }),
  });

  const approveM = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      admin.approveFareImport(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "fare-imports"] });
      toast.success("Fare import approved — wrote new taxi_fares row");
      setApproveDraft(null);
    },
    onError: (err: any) => toast.error(err?.message || "Approve failed"),
  });

  const rejectM = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      admin.rejectFareImport(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "fare-imports"] });
      toast.success("Fare import rejected");
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (err: any) => toast.error(err?.message || "Reject failed"),
  });

  const duplicateM = useMutation({
    mutationFn: (id: string) => admin.markFareImportDuplicate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "fare-imports"] });
      toast.success("Marked as duplicate");
    },
    onError: (err: any) => toast.error(err?.message || "Mark-duplicate failed"),
  });

  const rows: FareImportRow[] = importsQ.data?.data || [];
  const counts: Record<string, number> = importsQ.data?.counts || {};

  const openApproveDrawer = (row: FareImportRow) => {
    setApproveDraft({
      row,
      amount: row.fareZar != null ? String(row.fareZar) : "",
      distanceKm: "",
      estimatedTimeMinutes: "",
      association: "",
      notes: "",
    });
  };

  const submitApprove = () => {
    if (!approveDraft) return;
    const payload: any = {
      notes: approveDraft.notes.trim() || null,
    };
    if (approveDraft.amount.trim()) {
      const n = Number(approveDraft.amount);
      if (!Number.isFinite(n) || n <= 0) {
        toast.error("Amount must be a positive number");
        return;
      }
      payload.amount = n;
    }
    if (approveDraft.distanceKm.trim()) {
      const n = Number(approveDraft.distanceKm);
      if (!Number.isFinite(n) || n <= 0) {
        toast.error("Distance must be a positive number");
        return;
      }
      payload.distanceKm = n;
    }
    if (approveDraft.estimatedTimeMinutes.trim()) {
      const n = Number(approveDraft.estimatedTimeMinutes);
      if (!Number.isFinite(n) || n <= 0) {
        toast.error("ETA must be a positive integer");
        return;
      }
      payload.estimatedTimeMinutes = Math.round(n);
    }
    if (approveDraft.association.trim()) {
      payload.association = approveDraft.association.trim();
    }
    approveM.mutate({ id: approveDraft.row.id, payload });
  };

  const headerSubtitle = importsQ.isSuccess
    ? `${rows.length} row${rows.length === 1 ? "" : "s"} · ` +
      Object.entries(counts)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ")
    : undefined;

  return (
    <div>
      <PageHeader
        title="Fare imports"
        subtitle={
          <>
            <div>Facebook-harvested taxi fares awaiting admin review. Approve to write a taxi_fares row; reject to discard.</div>
            {headerSubtitle ? (
              <div style={{ marginTop: spacing.xs, fontSize: 12, color: colors.textTertiary }}>
                {headerSubtitle}
              </div>
            ) : null}
          </>
        }
      />

      <div
        style={{
          display: "flex",
          gap: spacing.sm,
          marginBottom: spacing.lg,
          flexWrap: "wrap",
        }}
      >
        {STATUS_TABS.map((tab) => {
          const active = status === tab.value;
          const count = tab.value === "all" ? undefined : counts[tab.value];
          return (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              aria-pressed={active}
              title={tab.hint}
              style={{
                padding: `${spacing.sm}px ${spacing.lg}px`,
                borderRadius: radius.full,
                border: `1px solid ${active ? colors.rose : colors.border}`,
                background: active ? colors.rose : colors.surface,
                color: active ? "#FFFFFF" : colors.text,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              {tab.label}
              {count != null ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: radius.full,
                    background: active ? "rgba(255,255,255,0.2)" : colors.roseFaint,
                    color: active ? "#FFFFFF" : colors.rose,
                  }}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {importsQ.isError ? (
        <ErrorState error={importsQ.error} onRetry={() => importsQ.refetch()} />
      ) : importsQ.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          title={`No ${status === "all" ? "" : status.replace("_", " ") + " "}fare imports`}
          hint="Run scripts/fare-sync/harvest.ts to pull fresh posts, then canonicalize.ts to match them to ranks."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <TH>Route</TH>
              <TH>Fare</TH>
              <TH>Confidence</TH>
              <TH>Evidence</TH>
              <TH>Source</TH>
              <TH>Harvested</TH>
              <TH>Status</TH>
              <TH>Actions</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const canApprove =
                r.status === "pending_review" || r.status === "orphan";
              const isOrphan = r.status === "orphan";
              return (
                <tr key={r.id}>
                  <TD>
                    <div style={{ fontWeight: 600 }}>
                      {r.originRankName || r.originRaw || "—"}
                      <span style={{ color: colors.textTertiary, margin: "0 6px" }}>→</span>
                      {r.destinationRankName || r.destinationRaw || "—"}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: colors.textTertiary,
                        marginTop: 2,
                      }}
                    >
                      {r.metroHint ? <Badge tone="info">{r.metroHint}</Badge> : null}
                      {isOrphan ? (
                        <span style={{ marginLeft: 4 }}>
                          <Badge tone="warning">orphan</Badge>
                        </span>
                      ) : null}
                      {r.originMatchScore != null || r.destinationMatchScore != null ? (
                        <span style={{ marginLeft: 4 }}>
                          match:{" "}
                          {r.originMatchScore != null
                            ? (r.originMatchScore * 100).toFixed(0) + "%"
                            : "—"}{" "}
                          /{" "}
                          {r.destinationMatchScore != null
                            ? (r.destinationMatchScore * 100).toFixed(0) + "%"
                            : "—"}
                        </span>
                      ) : null}
                    </div>
                  </TD>
                  <TD>
                    <div style={{ fontWeight: 700, fontVariant: "tabular-nums" }}>
                      {r.fareZar != null ? `R${Number(r.fareZar).toFixed(2)}` : "—"}
                    </div>
                  </TD>
                  <TD>
                    {r.confidence != null ? (
                      <Badge
                        tone={
                          r.confidence >= 0.8
                            ? "success"
                            : r.confidence >= 0.5
                              ? "warning"
                              : "danger"
                        }
                      >
                        {(r.confidence * 100).toFixed(0)}%
                      </Badge>
                    ) : (
                      <span style={{ color: colors.textTertiary }}>—</span>
                    )}
                  </TD>
                  <TD truncate>
                    {r.evidenceQuote ? (
                      <div
                        title={r.evidenceQuote}
                        style={{
                          fontSize: 12,
                          color: colors.textSecondary,
                          fontStyle: "italic",
                          maxWidth: 240,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        “{r.evidenceQuote}”
                      </div>
                    ) : (
                      <span style={{ color: colors.textTertiary }}>—</span>
                    )}
                  </TD>
                  <TD>
                    <div style={{ display: "flex", gap: spacing.xs, alignItems: "center" }}>
                      {r.sourcePostUrl ? (
                        <a
                          href={r.sourcePostUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Original Facebook post"
                          style={{
                            color: colors.rose,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 2,
                            fontSize: 12,
                          }}
                        >
                          <FileText size={13} />
                          post
                        </a>
                      ) : null}
                      {r.sourceCommentUrl ? (
                        <a
                          href={r.sourceCommentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Comment where the fare was answered"
                          style={{
                            color: colors.rose,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 2,
                            fontSize: 12,
                          }}
                        >
                          <MessageSquare size={13} />
                          comment
                        </a>
                      ) : null}
                      {!r.sourcePostUrl && !r.sourceCommentUrl ? (
                        <span style={{ color: colors.textTertiary, fontSize: 12 }}>
                          {r.source}
                        </span>
                      ) : null}
                    </div>
                  </TD>
                  <TD>
                    {r.harvestedAt
                      ? new Date(r.harvestedAt).toLocaleString("en-ZA", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                  </TD>
                  <TD>
                    <Badge tone={fareImportStatusTone(r.status)}>{r.status}</Badge>
                    {r.rejectionReason ? (
                      <div
                        style={{
                          fontSize: 11,
                          color: colors.textTertiary,
                          marginTop: 2,
                          maxWidth: 180,
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
                    {canApprove ? (
                      <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap" }}>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => openApproveDrawer(r)}
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
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => duplicateM.mutate(r.id)}
                          disabled={duplicateM.isPending}
                          title="Mark as duplicate of an existing approved fare"
                        >
                          Dupe
                        </Button>
                      </div>
                    ) : r.taxiFareId ? (
                      <span
                        style={{
                          fontSize: 11,
                          color: colors.textTertiary,
                          fontFamily: "ui-monospace, Menlo, monospace",
                        }}
                        title={`taxi_fares.id = ${r.taxiFareId}`}
                      >
                        #{r.taxiFareId.slice(0, 8)}
                      </span>
                    ) : null}
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {/* ─── Approve drawer ──────────────────────────────────────────── */}
      {approveDraft ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setApproveDraft(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: colors.surface,
              borderRadius: radius.xl,
              padding: spacing["2xl"],
              width: 560,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: shadows.lg,
            }}
          >
            <h2
              id="approve-title"
              style={{ margin: 0, fontSize: 20, fontWeight: 700, color: colors.text }}
            >
              Approve fare import
            </h2>
            <p
              style={{
                color: colors.textSecondary,
                fontSize: 13,
                marginTop: spacing.xs,
              }}
            >
              Will write a new taxi_fares row from{" "}
              <strong>{approveDraft.row.originRankName || approveDraft.row.originRaw}</strong>{" "}
              →{" "}
              <strong>
                {approveDraft.row.destinationRankName || approveDraft.row.destinationRaw}
              </strong>
              .
            </p>

            {approveDraft.row.evidenceQuote ? (
              <div
                style={{
                  background: colors.roseFaint,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  marginTop: spacing.md,
                  fontSize: 13,
                  fontStyle: "italic",
                  color: colors.text,
                }}
              >
                “{approveDraft.row.evidenceQuote}”
              </div>
            ) : null}

            {approveDraft.row.rawTextRedacted ? (
              <details
                style={{
                  marginTop: spacing.md,
                  fontSize: 12,
                  color: colors.textSecondary,
                }}
              >
                <summary
                  style={{ cursor: "pointer", fontWeight: 600, color: colors.rose }}
                >
                  Redacted source text
                </summary>
                <div
                  style={{
                    marginTop: spacing.sm,
                    whiteSpace: "pre-wrap",
                    background: colors.surfaceAlt,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    maxHeight: 240,
                    overflowY: "auto",
                  }}
                >
                  {approveDraft.row.rawTextRedacted}
                </div>
              </details>
            ) : null}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: spacing.md,
                marginTop: spacing.lg,
              }}
            >
              <Field label="AMOUNT (ZAR)">
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={approveDraft.amount}
                  onChange={(e) =>
                    setApproveDraft({ ...approveDraft, amount: e.target.value })
                  }
                  placeholder={
                    approveDraft.row.fareZar != null
                      ? String(approveDraft.row.fareZar)
                      : "e.g. 25.00"
                  }
                  style={inputStyle}
                />
              </Field>
              <Field label="DISTANCE (KM, OPTIONAL)">
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={approveDraft.distanceKm}
                  onChange={(e) =>
                    setApproveDraft({ ...approveDraft, distanceKm: e.target.value })
                  }
                  placeholder="e.g. 12.4"
                  style={inputStyle}
                />
              </Field>
              <Field label="ETA (MIN, OPTIONAL)">
                <input
                  type="number"
                  step="1"
                  min={0}
                  value={approveDraft.estimatedTimeMinutes}
                  onChange={(e) =>
                    setApproveDraft({
                      ...approveDraft,
                      estimatedTimeMinutes: e.target.value,
                    })
                  }
                  placeholder="e.g. 25"
                  style={inputStyle}
                />
              </Field>
              <Field label="ASSOCIATION (OPTIONAL)">
                <input
                  type="text"
                  value={approveDraft.association}
                  onChange={(e) =>
                    setApproveDraft({ ...approveDraft, association: e.target.value })
                  }
                  placeholder="e.g. SANTACO"
                  style={inputStyle}
                />
              </Field>
            </div>

            <Field label="REVIEWER NOTES (OPTIONAL)">
              <textarea
                value={approveDraft.notes}
                onChange={(e) =>
                  setApproveDraft({ ...approveDraft, notes: e.target.value })
                }
                rows={2}
                placeholder="Lands on fare_imports.review_notes for audit."
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </Field>

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
                onClick={() => setApproveDraft(null)}
                disabled={approveM.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={submitApprove}
                disabled={approveM.isPending}
              >
                Approve &amp; write fare
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── Reject dialog ──────────────────────────────────────────── */}
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
            <h2
              id="reject-title"
              style={{ margin: 0, fontSize: 20, fontWeight: 700, color: colors.text }}
            >
              Reject fare import
            </h2>
            <p
              style={{
                color: colors.textSecondary,
                fontSize: 13,
                marginTop: spacing.xs,
              }}
            >
              Reason lands in the audit log and on the row itself.
            </p>

            <Field label="REASON">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Extractor hallucination, not a real route, duplicate of …"
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </Field>

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
                  rejectM.mutate({
                    id: rejectTarget.id,
                    reason: rejectReason.trim(),
                  })
                }
                disabled={rejectM.isPending || rejectReason.trim().length < 3}
              >
                Reject
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Inline helpers (keep page self-contained) ────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: `${spacing.md}px ${spacing.lg}px`,
  borderRadius: radius.md,
  border: `1px solid ${colors.border}`,
  background: colors.surface,
  color: colors.text,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

function fareImportStatusTone(status: string): BadgeTone {
  switch (status) {
    case "approved":
      return "success";
    case "pending_review":
      return "warning";
    case "orphan":
      return "warning";
    case "rejected":
      return "danger";
    case "duplicate":
      return "info";
    case "superseded":
      return "neutral";
    case "pending_extraction":
    case "pending_canonicalization":
      return "neutral";
    default:
      return "neutral";
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginTop: spacing.md }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.6,
          color: colors.textSecondary,
          marginBottom: spacing.xs,
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}
