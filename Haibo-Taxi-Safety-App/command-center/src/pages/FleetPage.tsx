import React from "react";
import {
  ModerationQueue,
  ModerationQueueConfig,
} from "../components/ModerationQueue";
import { Badge } from "../components/Badge";
import { colors } from "../lib/brand";

interface Taxi {
  id: string;
  createdAt: string | null;
  status: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number | null;
  color: string | null;
  seatingCapacity: number | null;
  primaryRoute: string | null;
  associationId: string | null;
  ownerId: string;
  insuranceExpiry: string | null;
  operatingPermitExpiry: string | null;
  safetyRating: number | null;
  totalRatings: number | null;
  totalTrips: number | null;
  isVerified: boolean;
}

function isExpiring(iso: string | null): "ok" | "soon" | "expired" | "none" {
  if (!iso) return "none";
  const date = new Date(iso);
  const now = Date.now();
  if (date.getTime() < now) return "expired";
  if (date.getTime() - now < 30 * 24 * 60 * 60 * 1000) return "soon";
  return "ok";
}

function ExpiryBadge({ label, iso }: { label: string; iso: string | null }) {
  const state = isExpiring(iso);
  if (state === "none") return null;
  const tone = state === "expired" ? "danger" : state === "soon" ? "warning" : "success";
  return (
    <div style={{ marginBottom: 2 }}>
      <Badge tone={tone}>
        {label}: {state === "expired" ? "expired" : state === "soon" ? "<30d" : "ok"}
      </Badge>
    </div>
  );
}

const config: ModerationQueueConfig<Taxi> = {
  title: "Fleet",
  subtitle: "registered taxis — verify operators and monitor compliance",
  resource: "taxis",
  queryKey: "moderation:taxis",
  emptyHint:
    "Operators register new vehicles from the app. Verified taxis earn a badge users see in search results.",
  tabs: [
    { label: "Active", value: "active" },
    { label: "Suspended", value: "suspended" },
    { label: "Maintenance", value: "maintenance" },
    { label: "Retired", value: "retired" },
  ],
  getId: (t) => t.id,
  getStatus: (t) => t.status,
  columns: [
    {
      header: "Plate",
      cell: (t) => (
        <div>
          <div
            style={{
              fontFamily: "ui-monospace, Menlo, monospace",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
            {t.plateNumber}
          </div>
          <div style={{ fontSize: 11, color: colors.textTertiary }}>
            {t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-ZA") : "—"}
          </div>
        </div>
      ),
    },
    {
      header: "Vehicle",
      cell: (t) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {t.make} {t.model}
          </div>
          <div style={{ fontSize: 11, color: colors.textTertiary }}>
            {[t.year, t.color, t.seatingCapacity ? `${t.seatingCapacity} seats` : null]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      ),
    },
    {
      header: "Route",
      truncate: true,
      cell: (t) =>
        t.primaryRoute || (
          <span style={{ color: colors.textTertiary }}>—</span>
        ),
    },
    {
      header: "Compliance",
      cell: (t) => (
        <div>
          <ExpiryBadge label="Ins" iso={t.insuranceExpiry} />
          <ExpiryBadge label="Permit" iso={t.operatingPermitExpiry} />
          {!t.insuranceExpiry && !t.operatingPermitExpiry ? (
            <span style={{ fontSize: 11, color: colors.textTertiary }}>
              no docs filed
            </span>
          ) : null}
        </div>
      ),
    },
    {
      header: "Safety",
      cell: (t) => (
        <div style={{ fontVariant: "tabular-nums" }}>
          <div style={{ fontWeight: 600 }}>
            ★ {(t.safetyRating ?? 0).toFixed(1)}
          </div>
          <div style={{ fontSize: 11, color: colors.textTertiary }}>
            {t.totalRatings || 0} ratings · {t.totalTrips || 0} trips
          </div>
        </div>
      ),
    },
    {
      header: "Verified",
      cell: (t) =>
        t.isVerified ? <Badge tone="success">verified</Badge> : <Badge>unverified</Badge>,
    },
  ],
  actions: [
    {
      label: "Verify",
      variant: "primary",
      when: (t) => !t.isVerified,
      patch: { isVerified: true },
    },
    {
      label: "Unverify",
      variant: "secondary",
      when: (t) => t.isVerified,
      patch: { isVerified: false },
      confirmMessage: "Remove the verified badge from this taxi?",
    },
    {
      label: "Suspend",
      variant: "danger",
      when: (t) => t.status === "active",
      patch: { status: "suspended" },
      confirmMessage: "Suspend this taxi? It will be hidden from search results.",
    },
    {
      label: "Reactivate",
      variant: "primary",
      when: (t) => t.status === "suspended" || t.status === "maintenance",
      patch: { status: "active" },
    },
    {
      label: "Retire",
      variant: "danger",
      when: (t) => t.status !== "retired",
      patch: { status: "retired" },
      confirmMessage: "Permanently retire this taxi? This is hard to undo.",
    },
  ],
};

export function FleetPage() {
  return <ModerationQueue config={config} />;
}
