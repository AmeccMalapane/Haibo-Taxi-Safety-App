import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { admin } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Table, TH, TD } from "../components/Table";
import { Badge, BadgeTone } from "../components/Badge";
import { LoadingState, ErrorState, EmptyState } from "../components/States";
import { colors, radius, spacing, fonts } from "../lib/brand";

type VerifiedFilter = "false" | "true" | "all";

const TABS: Array<{ label: string; value: VerifiedFilter }> = [
  { label: "Pending", value: "false" },
  { label: "Verified", value: "true" },
  { label: "All", value: "all" },
];

interface DriverRow {
  id: string;
  userId: string;
  taxiPlateNumber: string;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  insuranceExpiry: string | null;
  safetyRating: number | null;
  totalRatings: number | null;
  totalRides: number | null;
  acceptanceRate: number | null;
  isVerified: boolean;
  vehicleModel: string | null;
  vehicleYear: number | null;
  vehicleColor: string | null;
  lastLocationUpdate: string | null;
  createdAt: string | null;
  userPhone: string | null;
  userDisplayName: string | null;
}

function expiryState(iso: string | null): {
  label: string;
  tone: BadgeTone;
} | null {
  if (!iso) return { label: "no date", tone: "neutral" };
  const date = new Date(iso);
  const now = Date.now();
  const diffDays = Math.floor((date.getTime() - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: "expired", tone: "danger" };
  if (diffDays < 30) return { label: `${diffDays}d left`, tone: "warning" };
  return { label: `${diffDays}d left`, tone: "success" };
}

function ratingTone(rating: number): BadgeTone {
  if (rating >= 4.5) return "success";
  if (rating >= 3.5) return "info";
  if (rating >= 2.5) return "warning";
  return "danger";
}

export function DriversPage() {
  const navigate = useNavigate();
  const [verified, setVerified] = useState<VerifiedFilter>("false");

  const driversQ = useQuery({
    queryKey: ["admin", "drivers", verified],
    queryFn: () => admin.getDrivers({ verified }),
  });

  const rows: DriverRow[] = driversQ.data?.data || [];
  const pendingCount: number = driversQ.data?.pendingCount ?? 0;

  return (
    <div>
      <PageHeader
        title="Driver KYC"
        subtitle={
          driversQ.isSuccess
            ? `${rows.length} shown · ${pendingCount} pending review`
            : "Driver verification queue"
        }
      />

      {/* Tabs */}
      <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.lg, flexWrap: "wrap" }}>
        {TABS.map((tab) => {
          const active = verified === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setVerified(tab.value)}
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
                transition: "all 0.15s",
              }}
            >
              {tab.label}
              {tab.value === "false" && pendingCount > 0 ? (
                <span
                  style={{
                    marginLeft: 6,
                    padding: "1px 7px",
                    borderRadius: radius.full,
                    background: active ? "rgba(255,255,255,0.2)" : colors.rose,
                    color: "#FFFFFF",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {pendingCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {driversQ.isError ? (
        <ErrorState error={driversQ.error} onRetry={() => driversQ.refetch()} />
      ) : driversQ.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          title={
            verified === "false"
              ? "No drivers pending verification"
              : "No drivers found"
          }
          hint={
            verified === "false"
              ? "New driver registrations appear here for KYC review."
              : undefined
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <TH>Registered</TH>
              <TH>Driver</TH>
              <TH>Plate</TH>
              <TH>Vehicle</TH>
              <TH>License</TH>
              <TH>Rating</TH>
              <TH>Stats</TH>
              <TH>Verified</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const expiry = expiryState(d.licenseExpiry);
              const rating = Number(d.safetyRating ?? 0);
              return (
                <tr
                  key={d.id}
                  onClick={() => navigate(`/admin/drivers/${d.id}`)}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = colors.surfaceAlt)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                  title="Click to review"
                >
                  <TD>
                    {d.createdAt ? new Date(d.createdAt).toLocaleDateString("en-ZA") : "—"}
                  </TD>
                  <TD>
                    <div style={{ fontWeight: 600 }}>
                      {d.userDisplayName || (
                        <span style={{ color: colors.textTertiary, fontStyle: "italic" }}>
                          no name
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: colors.textTertiary }}>
                      {d.userPhone || d.userId.slice(0, 8)}
                    </div>
                  </TD>
                  <TD>
                    <span
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                      }}
                    >
                      {d.taxiPlateNumber}
                    </span>
                  </TD>
                  <TD>
                    <div>
                      {d.vehicleModel ? (
                        <>
                          <div>{d.vehicleModel}</div>
                          <div style={{ fontSize: 11, color: colors.textTertiary }}>
                            {[d.vehicleYear, d.vehicleColor].filter(Boolean).join(" · ") || "—"}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: colors.textTertiary }}>—</span>
                      )}
                    </div>
                  </TD>
                  <TD>
                    <div style={{ fontSize: 12 }}>
                      {d.licenseNumber || (
                        <span style={{ color: colors.textTertiary }}>no number</span>
                      )}
                    </div>
                    {expiry ? (
                      <div style={{ marginTop: 2 }}>
                        <Badge tone={expiry.tone}>{expiry.label}</Badge>
                      </div>
                    ) : null}
                  </TD>
                  <TD>
                    <div
                      style={{
                        fontVariant: "tabular-nums",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Badge tone={ratingTone(rating)}>★ {rating.toFixed(1)}</Badge>
                    </div>
                    <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
                      {d.totalRatings || 0} {d.totalRatings === 1 ? "review" : "reviews"}
                    </div>
                  </TD>
                  <TD>
                    <div style={{ fontVariant: "tabular-nums", fontSize: 12 }}>
                      <div>{d.totalRides || 0} trips</div>
                      <div style={{ color: colors.textTertiary }}>
                        {Number(d.acceptanceRate ?? 0).toFixed(0)}% accept
                      </div>
                    </div>
                  </TD>
                  <TD>
                    {d.isVerified ? (
                      <Badge tone="success">verified</Badge>
                    ) : (
                      <Badge tone="warning">pending</Badge>
                    )}
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
