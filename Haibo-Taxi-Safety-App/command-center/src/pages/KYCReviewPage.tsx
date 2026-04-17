import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { admin } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Badge, BadgeTone } from "../components/Badge";
import { Button } from "../components/Button";
import { LoadingState, ErrorState, EmptyState } from "../components/States";
import { colors, radius, shadows, spacing } from "../lib/brand";

// Admin KYC review queue — unified owner + vendor pipeline.
//
// Why a card grid instead of a table: documents need to be visible at a
// glance, and a table row is too cramped for 3 thumbnails + metadata.
// Each card shows who submitted, what role, the doc thumbnails, and the
// approve/reject CTAs. Clicking a thumbnail opens a lightbox so the
// reviewer can read small print on an ID.

type RoleFilter = "all" | "owner" | "vendor";
type StatusFilter = "pending" | "verified" | "rejected" | "all";

const ROLE_TABS: Array<{ label: string; value: RoleFilter }> = [
  { label: "All roles", value: "all" },
  { label: "Owners", value: "owner" },
  { label: "Vendors", value: "vendor" },
];

const STATUS_TABS: Array<{ label: string; value: StatusFilter }> = [
  { label: "Pending", value: "pending" },
  { label: "Verified", value: "verified" },
  { label: "Rejected", value: "rejected" },
  { label: "All", value: "all" },
];

interface KYCSubmission {
  role: "owner" | "vendor";
  profileId: string;
  userId: string;
  displayName: string | null;
  phone: string | null;
  kycStatus: string;
  kycDocuments: {
    idDocumentUrl?: string;
    proofOfAddressUrl?: string;
    companyRegDocUrl?: string;
    uploadedAt?: string;
  } | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  extra: {
    companyName?: string;
    businessName?: string;
    vendorType?: string;
    vendorRef?: string;
  };
}

function kycStatusTone(status: string): BadgeTone {
  if (status === "verified") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected" || status === "suspended") return "danger";
  return "neutral";
}

export function KYCReviewPage() {
  const qc = useQueryClient();
  const [role, setRole] = useState<RoleFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [rejectTarget, setRejectTarget] = useState<KYCSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const kycQ = useQuery({
    queryKey: ["admin", "kyc", role, status],
    queryFn: () =>
      admin.getKYCSubmissions({
        role: role === "all" ? undefined : role,
        status,
      }),
  });

  const approveM = useMutation({
    mutationFn: (target: KYCSubmission) =>
      admin.approveKYC(target.role, target.profileId),
    onSuccess: (_data, target) => {
      qc.invalidateQueries({ queryKey: ["admin", "kyc"] });
      toast.success(
        `${target.role === "owner" ? "Owner" : "Vendor"} verified: ${
          target.displayName || target.phone || target.userId.slice(0, 8)
        }`,
      );
    },
    onError: (err: any) => toast.error(err?.message || "Approve failed"),
  });

  const rejectM = useMutation({
    mutationFn: ({
      target,
      reason,
    }: {
      target: KYCSubmission;
      reason: string;
    }) => admin.rejectKYC(target.role, target.profileId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "kyc"] });
      toast.success("Rejection recorded — user notified to re-upload");
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (err: any) => toast.error(err?.message || "Reject failed"),
  });

  const items: KYCSubmission[] = kycQ.data?.data || [];

  const counts = useMemo(() => {
    let owners = 0;
    let vendors = 0;
    for (const item of items) {
      if (item.role === "owner") owners += 1;
      else vendors += 1;
    }
    return { owners, vendors };
  }, [items]);

  return (
    <div>
      <PageHeader
        title="Identity KYC"
        subtitle={
          kycQ.isSuccess
            ? `${items.length} ${status} · ${counts.owners} owner${
                counts.owners === 1 ? "" : "s"
              } · ${counts.vendors} vendor${counts.vendors === 1 ? "" : "s"}`
            : "Review submitted documents and unlock withdrawals"
        }
      />

      <div
        style={{
          display: "flex",
          gap: spacing.lg,
          marginBottom: spacing.lg,
          flexWrap: "wrap",
        }}
      >
        <FilterGroup
          label="ROLE"
          tabs={ROLE_TABS}
          active={role}
          onChange={(v) => setRole(v as RoleFilter)}
        />
        <FilterGroup
          label="STATUS"
          tabs={STATUS_TABS}
          active={status}
          onChange={(v) => setStatus(v as StatusFilter)}
        />
      </div>

      {kycQ.isError ? (
        <ErrorState error={kycQ.error} onRetry={() => kycQ.refetch()} />
      ) : kycQ.isLoading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState
          title={
            status === "pending"
              ? "Inbox zero — no pending KYC"
              : `No ${status} submissions`
          }
          hint="New submissions arrive whenever a user completes the mobile KYC upload flow."
        />
      ) : (
        <div
          style={{
            display: "grid",
            gap: spacing.lg,
            gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))",
          }}
        >
          {items.map((item) => (
            <SubmissionCard
              key={`${item.role}:${item.profileId}`}
              item={item}
              approving={approveM.isPending}
              rejecting={rejectM.isPending}
              onApprove={() => approveM.mutate(item)}
              onReject={() => setRejectTarget(item)}
              onOpenDocument={(url) => setLightboxUrl(url)}
            />
          ))}
        </div>
      )}

      {rejectTarget ? (
        <RejectDialog
          target={rejectTarget}
          reason={rejectReason}
          setReason={setRejectReason}
          pending={rejectM.isPending}
          onCancel={() => {
            setRejectTarget(null);
            setRejectReason("");
          }}
          onConfirm={() =>
            rejectM.mutate({
              target: rejectTarget,
              reason: rejectReason.trim(),
            })
          }
        />
      ) : null}

      {lightboxUrl ? (
        <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      ) : null}
    </div>
  );
}

// ─── FilterGroup ─────────────────────────────────────────────────────────
function FilterGroup({
  label,
  tabs,
  active,
  onChange,
}: {
  label: string;
  tabs: Array<{ label: string; value: string }>;
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 1.4,
          color: colors.textTertiary,
          marginBottom: spacing.xs,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
        {tabs.map((tab) => {
          const on = active === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => onChange(tab.value)}
              aria-pressed={on}
              style={{
                padding: `${spacing.sm}px ${spacing.lg}px`,
                borderRadius: radius.full,
                border: `1px solid ${on ? colors.rose : colors.border}`,
                background: on ? colors.rose : colors.surface,
                color: on ? "#FFFFFF" : colors.text,
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
    </div>
  );
}

// ─── SubmissionCard ──────────────────────────────────────────────────────
function SubmissionCard({
  item,
  approving,
  rejecting,
  onApprove,
  onReject,
  onOpenDocument,
}: {
  item: KYCSubmission;
  approving: boolean;
  rejecting: boolean;
  onApprove: () => void;
  onReject: () => void;
  onOpenDocument: (url: string) => void;
}) {
  const docs = item.kycDocuments || {};
  const actionable = item.kycStatus === "pending";
  const subtitle =
    item.role === "owner"
      ? item.extra.companyName || "Fleet owner"
      : item.extra.businessName
        ? `${item.extra.businessName} · ${item.extra.vendorType || "vendor"}`
        : "Vendor";

  return (
    <div
      style={{
        background: colors.surface,
        borderRadius: radius.lg,
        border: `1px solid ${colors.border}`,
        padding: spacing.lg,
        display: "flex",
        flexDirection: "column",
        gap: spacing.md,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.sm,
              marginBottom: 2,
            }}
          >
            <Badge tone={item.role === "owner" ? "info" : "rose"}>
              {item.role}
            </Badge>
            <Badge tone={kycStatusTone(item.kycStatus)}>{item.kycStatus}</Badge>
          </div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 16,
              color: colors.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.displayName || item.phone || item.userId.slice(0, 8)}
          </div>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
            {subtitle}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: colors.textTertiary }}>
          {item.submittedAt ? (
            <>
              <div style={{ fontWeight: 600 }}>Submitted</div>
              <div>{new Date(item.submittedAt).toLocaleString("en-ZA")}</div>
            </>
          ) : null}
        </div>
      </div>

      {/* Document thumbnails */}
      <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
        <DocTile
          label="ID"
          url={docs.idDocumentUrl}
          onOpen={onOpenDocument}
          required
        />
        <DocTile
          label="Address"
          url={docs.proofOfAddressUrl}
          onOpen={onOpenDocument}
        />
        <DocTile
          label={item.role === "owner" ? "Company" : "Business"}
          url={docs.companyRegDocUrl}
          onOpen={onOpenDocument}
        />
      </div>

      {item.rejectionReason ? (
        <div
          style={{
            padding: `${spacing.sm}px ${spacing.md}px`,
            background: colors.danger + "12",
            border: `1px solid ${colors.danger}33`,
            borderRadius: radius.md,
            fontSize: 12,
            color: colors.text,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              color: colors.danger,
              marginBottom: 2,
              fontSize: 10,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            Last rejection
          </div>
          {item.rejectionReason}
        </div>
      ) : null}

      {actionable ? (
        <div style={{ display: "flex", gap: spacing.sm, justifyContent: "flex-end" }}>
          <Button
            size="sm"
            variant="danger"
            onClick={onReject}
            disabled={approving || rejecting}
          >
            Reject
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={onApprove}
            disabled={approving || rejecting || !docs.idDocumentUrl}
          >
            Approve
          </Button>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: colors.textTertiary, textAlign: "right" }}>
          {item.reviewedAt
            ? `Reviewed ${new Date(item.reviewedAt).toLocaleString("en-ZA")}`
            : "No action required"}
        </div>
      )}
    </div>
  );
}

// ─── DocTile ─────────────────────────────────────────────────────────────
function DocTile({
  label,
  url,
  onOpen,
  required = false,
}: {
  label: string;
  url?: string;
  onOpen: (url: string) => void;
  required?: boolean;
}) {
  if (!url) {
    return (
      <div
        style={{
          width: 104,
          height: 104,
          borderRadius: radius.md,
          border: `1px dashed ${colors.border}`,
          background: colors.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 4,
          flex: "1 1 104px",
          maxWidth: 160,
        }}
      >
        <div style={{ fontSize: 10, color: colors.textTertiary, letterSpacing: 0.6 }}>
          {label.toUpperCase()}
        </div>
        <div style={{ fontSize: 10, color: colors.textTertiary }}>
          {required ? "missing" : "—"}
        </div>
      </div>
    );
  }
  return (
    <button
      onClick={() => onOpen(url)}
      style={{
        width: 104,
        height: 104,
        borderRadius: radius.md,
        border: `1px solid ${colors.border}`,
        padding: 0,
        overflow: "hidden",
        cursor: "pointer",
        background: colors.bg,
        flex: "1 1 104px",
        maxWidth: 160,
        position: "relative",
      }}
      title={`Open ${label}`}
      aria-label={`Open ${label} document`}
    >
      <img
        src={url}
        alt={label}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "4px 6px",
          background: "rgba(0,0,0,0.55)",
          color: "#FFFFFF",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          textAlign: "left",
        }}
      >
        {label}
      </div>
    </button>
  );
}

// ─── RejectDialog ────────────────────────────────────────────────────────
function RejectDialog({
  target,
  reason,
  setReason,
  pending,
  onCancel,
  onConfirm,
}: {
  target: KYCSubmission;
  reason: string;
  setReason: (v: string) => void;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="kyc-reject-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.surface,
          borderRadius: radius.xl,
          padding: spacing["2xl"],
          width: 480,
          boxShadow: shadows.lg,
        }}
      >
        <h2
          id="kyc-reject-title"
          style={{ margin: 0, fontSize: 20, fontWeight: 700, color: colors.text }}
        >
          Reject {target.role} KYC
        </h2>
        <p
          style={{
            color: colors.textSecondary,
            fontSize: 13,
            marginTop: spacing.xs,
          }}
        >
          {target.displayName || target.phone || target.userId.slice(0, 8)} will
          be notified with the reason below and asked to re-upload.
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
          REASON (required)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="ID photo blurry, proof of address expired, name doesn't match…"
          rows={3}
          autoFocus
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
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={pending || !reason.trim()}
          >
            Reject &amp; notify
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Lightbox ────────────────────────────────────────────────────────────
function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Document preview"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: spacing.xl,
        cursor: "zoom-out",
      }}
    >
      <img
        src={url}
        alt="Document"
        style={{
          maxWidth: "90vw",
          maxHeight: "90vh",
          objectFit: "contain",
          borderRadius: radius.md,
          boxShadow: shadows.lg,
        }}
      />
    </div>
  );
}
