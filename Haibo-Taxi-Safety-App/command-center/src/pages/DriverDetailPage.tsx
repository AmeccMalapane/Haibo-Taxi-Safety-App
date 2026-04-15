import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  User,
  CreditCard,
  Car,
  Star,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Trash2,
} from "lucide-react";
import { admin } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { StatCard, Card } from "../components/Card";
import { Badge, BadgeTone } from "../components/Badge";
import { Button } from "../components/Button";
import { LoadingState, ErrorState } from "../components/States";
import { colors, radius, shadows, spacing, fonts } from "../lib/brand";

interface DriverProfile {
  id: string;
  userId: string;
  taxiPlateNumber: string;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  insuranceNumber: string | null;
  insuranceExpiry: string | null;
  safetyRating: number | null;
  totalRatings: number | null;
  totalRides: number | null;
  acceptanceRate: number | null;
  isVerified: boolean;
  vehicleColor: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  payReferenceCode: string | null;
  currentLatitude: number | null;
  currentLongitude: number | null;
  lastLocationUpdate: string | null;
  createdAt: string | null;
}

interface DriverUser {
  id: string;
  phone: string;
  displayName: string | null;
  email: string | null;
  role: string | null;
  createdAt: string | null;
  isVerified: boolean | null;
  homeAddress: string | null;
}

interface DriverRating {
  id: string;
  driverId: string;
  userId: string;
  rideId: string | null;
  rating: number;
  review: string | null;
  createdAt: string | null;
}

interface DriverDetailResponse {
  profile: DriverProfile;
  user: DriverUser | null;
  recentRatings: DriverRating[];
}

function expiryChip(iso: string | null, label: string): React.ReactNode {
  if (!iso) {
    return (
      <Badge tone="neutral">
        {label}: not filed
      </Badge>
    );
  }
  const now = Date.now();
  const then = new Date(iso).getTime();
  const days = Math.floor((then - now) / (1000 * 60 * 60 * 24));
  const tone: BadgeTone = days < 0 ? "danger" : days < 30 ? "warning" : "success";
  const state = days < 0 ? "expired" : days < 30 ? `${days}d left` : "valid";
  return <Badge tone={tone}>{label}: {state}</Badge>;
}

function ratingTone(rating: number): BadgeTone {
  if (rating >= 4.5) return "success";
  if (rating >= 3.5) return "info";
  if (rating >= 2.5) return "warning";
  return "danger";
}

export function DriverDetailPage() {
  const { driverId } = useParams<{ driverId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const driverQ = useQuery<DriverDetailResponse>({
    queryKey: ["admin", "driver", driverId],
    queryFn: () => admin.getDriverDetail(driverId!),
    enabled: !!driverId,
  });

  const [showUnverifyModal, setShowUnverifyModal] = useState(false);
  const [unverifyReason, setUnverifyReason] = useState("");

  const verifyM = useMutation({
    mutationFn: () => admin.verifyDriver(driverId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "driver", driverId] });
      qc.invalidateQueries({ queryKey: ["admin", "drivers"] });
      toast.success("Driver verified — they can now accept commuters");
    },
    onError: (err: any) => toast.error(err?.message || "Verification failed"),
  });

  const unverifyM = useMutation({
    mutationFn: () => admin.unverifyDriver(driverId!, unverifyReason.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "driver", driverId] });
      qc.invalidateQueries({ queryKey: ["admin", "drivers"] });
      toast.success("Driver verification revoked");
      setShowUnverifyModal(false);
      setUnverifyReason("");
    },
    onError: (err: any) => toast.error(err?.message || "Revocation failed"),
  });

  // Dispute resolution — remove a single unfair rating. The server
  // recomputes safetyRating + totalRatings before responding so the
  // driver query invalidation picks up the new aggregates.
  const deleteRatingM = useMutation({
    mutationFn: (ratingId: string) => admin.deleteDriverRating(ratingId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "driver", driverId] });
      qc.invalidateQueries({ queryKey: ["admin", "drivers"] });
      toast.success("Rating removed — driver average recalculated");
    },
    onError: (err: any) => toast.error(err?.message || "Could not delete rating"),
  });

  if (driverQ.isLoading) return <LoadingState label="Loading driver profile…" />;
  if (driverQ.isError)
    return <ErrorState error={driverQ.error} onRetry={() => driverQ.refetch()} />;
  if (!driverQ.data) return null;

  const { profile, user, recentRatings } = driverQ.data;
  const rating = Number(profile.safetyRating ?? 0);
  const hasRecentLocation =
    !!profile.lastLocationUpdate &&
    Date.now() - new Date(profile.lastLocationUpdate).getTime() < 5 * 60 * 1000;

  return (
    <div>
      <PageHeader
        title={user?.displayName || user?.phone || "Driver profile"}
        subtitle={
          <span style={{ display: "inline-flex", alignItems: "center", gap: spacing.sm }}>
            <Car size={14} color={colors.textTertiary} />
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 13,
                fontWeight: 700,
                color: colors.text,
                letterSpacing: 0.5,
              }}
            >
              {profile.taxiPlateNumber}
            </span>
            {profile.isVerified ? (
              <Badge tone="success">verified</Badge>
            ) : (
              <Badge tone="warning">pending KYC</Badge>
            )}
          </span>
        }
        right={
          <div style={{ display: "flex", gap: spacing.sm }}>
            <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <ArrowLeft size={14} /> Back
              </span>
            </Button>
            {profile.isVerified ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowUnverifyModal(true)}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <XCircle size={14} /> Revoke verification
                </span>
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (
                    window.confirm(
                      `Verify ${user?.displayName || profile.taxiPlateNumber} for active driving on Haibo?`
                    )
                  ) {
                    verifyM.mutate();
                  }
                }}
                disabled={verifyM.isPending}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle size={14} /> Verify driver
                </span>
              </Button>
            )}
          </div>
        }
      />

      {/* Top stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: spacing.lg,
          marginBottom: spacing["2xl"],
        }}
      >
        <StatCard
          label="Safety rating"
          value={`★ ${rating.toFixed(1)}`}
          accent={rating >= 4 ? "success" : rating >= 3 ? "default" : "danger"}
          sub={`${profile.totalRatings || 0} reviews`}
        />
        <StatCard
          label="Total trips"
          value={profile.totalRides || 0}
          sub={`${Number(profile.acceptanceRate ?? 0).toFixed(0)}% acceptance`}
        />
        <StatCard
          label="Status"
          value={profile.isVerified ? "Verified" : "Pending"}
          accent={profile.isVerified ? "success" : "danger"}
          sub={profile.isVerified ? "accepting trips" : "cannot accept trips"}
        />
        <StatCard
          label="Live position"
          value={hasRecentLocation ? "Online" : "Offline"}
          accent={hasRecentLocation ? "success" : "default"}
          sub={
            profile.lastLocationUpdate
              ? `updated ${new Date(profile.lastLocationUpdate).toLocaleTimeString("en-ZA")}`
              : "no location yet"
          }
        />
      </div>

      {/* Two-column detail body */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: spacing.lg,
          marginBottom: spacing["2xl"],
        }}
      >
        {/* Identity */}
        <Card>
          <SectionTitle icon={<User size={16} />}>Identity</SectionTitle>
          <FactRow label="Full name" value={user?.displayName || "—"} />
          <FactRow label="Phone" value={user?.phone || "—"} mono />
          <FactRow label="Email" value={user?.email || "—"} />
          <FactRow
            label="Home address"
            value={user?.homeAddress || <em style={{ color: colors.textTertiary }}>not provided</em>}
          />
          <FactRow
            label="Account created"
            value={
              user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString("en-ZA", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "—"
            }
          />
          <FactRow
            label="User ID"
            value={profile.userId.slice(0, 16) + "…"}
            mono
          />
        </Card>

        {/* Documents + Vehicle */}
        <Card>
          <SectionTitle icon={<CreditCard size={16} />}>Documents</SectionTitle>
          <FactRow
            label="License #"
            value={profile.licenseNumber || "—"}
            mono
          />
          <div style={{ marginBottom: spacing.sm }}>
            {expiryChip(profile.licenseExpiry, "License")}
          </div>
          <FactRow
            label="Insurance #"
            value={profile.insuranceNumber || "—"}
            mono
          />
          <div style={{ marginBottom: spacing.lg }}>
            {expiryChip(profile.insuranceExpiry, "Insurance")}
          </div>

          <SectionTitle icon={<Car size={16} />}>Vehicle</SectionTitle>
          <FactRow label="Plate number" value={profile.taxiPlateNumber} mono />
          <FactRow
            label="Model"
            value={
              profile.vehicleModel
                ? `${profile.vehicleModel}${profile.vehicleYear ? ` (${profile.vehicleYear})` : ""}`
                : "—"
            }
          />
          <FactRow label="Colour" value={profile.vehicleColor || "—"} />
          <FactRow
            label="Pay reference"
            value={profile.payReferenceCode || "—"}
            mono
          />
        </Card>
      </div>

      {/* Recent ratings */}
      <div
        style={{
          marginBottom: spacing.md,
          fontFamily: fonts.heading,
          fontSize: 17,
          fontWeight: 600,
        }}
      >
        Recent ratings
      </div>
      {recentRatings.length === 0 ? (
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
          No ratings yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          {recentRatings.map((r) => (
            <div
              key={r.id}
              style={{
                background: colors.surface,
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                padding: spacing.lg,
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: spacing.lg,
                alignItems: "start",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  minWidth: 48,
                }}
              >
                <div
                  style={{
                    fontFamily: fonts.heading,
                    fontSize: 24,
                    fontWeight: 700,
                    color:
                      r.rating >= 4
                        ? colors.success
                        : r.rating >= 3
                        ? colors.text
                        : colors.danger,
                    lineHeight: 1,
                  }}
                >
                  {r.rating}
                </div>
                <Star
                  size={12}
                  color={r.rating >= 4 ? colors.success : r.rating >= 3 ? colors.text : colors.danger}
                  fill={r.rating >= 4 ? colors.success : r.rating >= 3 ? colors.text : colors.danger}
                  style={{ marginTop: 2 }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: colors.text,
                    lineHeight: 1.5,
                  }}
                >
                  {r.review || (
                    <em style={{ color: colors.textTertiary }}>no written review</em>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: colors.textTertiary,
                    marginTop: spacing.xs,
                    display: "flex",
                    alignItems: "center",
                    gap: spacing.xs,
                  }}
                >
                  <Clock size={11} />
                  {r.createdAt
                    ? new Date(r.createdAt).toLocaleString("en-ZA")
                    : "—"}
                  {r.rideId ? (
                    <>
                      <span>·</span>
                      <MapPin size={11} />
                      <span style={{ fontFamily: fonts.mono }}>
                        {r.rideId.slice(0, 8)}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
              {/* Dispute path: remove a clearly unfair rating. Recomputes
                  the driver's average server-side. */}
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      `Remove this ${r.rating}-star rating from the driver's average? This cannot be undone.`,
                    )
                  ) {
                    deleteRatingM.mutate(r.id);
                  }
                }}
                disabled={deleteRatingM.isPending}
                aria-label="Remove rating"
                title="Remove rating"
                style={{
                  background: "transparent",
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.sm,
                  padding: 8,
                  cursor: deleteRatingM.isPending ? "not-allowed" : "pointer",
                  color: colors.danger,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: deleteRatingM.isPending ? 0.5 : 1,
                  alignSelf: "start",
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Unverify reason modal */}
      {showUnverifyModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unverify-title"
          onClick={() => setShowUnverifyModal(false)}
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
              id="unverify-title"
              style={{
                margin: 0,
                fontFamily: fonts.heading,
                fontSize: 22,
                fontWeight: 700,
                color: colors.text,
                letterSpacing: -0.3,
              }}
            >
              Revoke verification?
            </h2>
            <p
              style={{
                fontSize: 13,
                color: colors.textSecondary,
                marginTop: spacing.xs,
                marginBottom: spacing.lg,
              }}
            >
              {user?.displayName || profile.taxiPlateNumber} will no longer be
              able to accept commuters through the app. They'll get a push
              notification with your reason.
            </p>

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
              Reason (optional but recommended)
            </div>
            <textarea
              value={unverifyReason}
              onChange={(e) => setUnverifyReason(e.target.value)}
              placeholder="e.g. Expired license, failed compliance check, multiple critical complaints…"
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
                marginBottom: spacing.lg,
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: spacing.sm,
              }}
            >
              <Button
                variant="secondary"
                onClick={() => setShowUnverifyModal(false)}
                disabled={unverifyM.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => unverifyM.mutate()}
                disabled={unverifyM.isPending}
              >
                Revoke verification
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Local helpers ──────────────────────────────────────────────────────────

function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.sm,
        marginBottom: spacing.md,
        fontSize: 11,
        fontWeight: 700,
        color: colors.textTertiary,
        textTransform: "uppercase",
        letterSpacing: 0.8,
      }}
    >
      <span style={{ color: colors.rose }}>{icon}</span>
      {children}
    </div>
  );
}

function FactRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: spacing.md,
        padding: `${spacing.sm}px 0`,
        borderBottom: `1px solid ${colors.border}`,
        fontSize: 13,
      }}
    >
      <div style={{ color: colors.textSecondary, flexShrink: 0 }}>{label}</div>
      <div
        style={{
          color: colors.text,
          fontWeight: 500,
          textAlign: "right",
          fontFamily: mono ? fonts.mono : "inherit",
          fontSize: mono ? 12 : 13,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}
