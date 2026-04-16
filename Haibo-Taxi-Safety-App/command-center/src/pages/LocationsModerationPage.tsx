import React from "react";
import {
  ModerationQueue,
  ModerationQueueConfig,
} from "../components/ModerationQueue";
import { Badge } from "../components/Badge";
import { colors, fonts } from "../lib/brand";

interface LocationRow {
  id: string;
  createdAt: string | null;
  status: string;
  name: string;
  type: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  description: string | null;
  capacity: number | null;
  addedBy: string | null;
  upvotes: number | null;
  downvotes: number | null;
  confidenceScore: number | null;
}

const config: ModerationQueueConfig<LocationRow> = {
  title: "Taxi ranks — review queue",
  subtitle:
    "user-submitted taxi ranks and stops waiting for admin verification",
  resource: "locations",
  queryKey: "moderation:locations",
  emptyHint:
    "Commuters add ranks via the mobile app's Add Rank button on the nearby-ranks tray. Verified ranks appear on the live map for everyone.",
  tabs: [
    { label: "Pending", value: "pending" },
    { label: "Verified", value: "verified" },
    { label: "Rejected", value: "rejected" },
  ],
  getId: (r) => r.id,
  getStatus: (r) => r.status,
  columns: [
    {
      header: "Submitted",
      cell: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {r.createdAt
              ? new Date(r.createdAt).toLocaleDateString("en-ZA", {
                  day: "numeric",
                  month: "short",
                })
              : "—"}
          </div>
          <div style={{ fontSize: 11, color: colors.textTertiary }}>
            {r.addedBy ? `by ${r.addedBy.slice(0, 8)}…` : "anonymous"}
          </div>
        </div>
      ),
    },
    {
      header: "Name",
      truncate: true,
      cell: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.name}</div>
          {r.address ? (
            <div
              style={{
                fontSize: 11,
                color: colors.textTertiary,
                marginTop: 2,
              }}
            >
              {r.address}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      header: "Type",
      cell: (r) =>
        r.type ? <Badge>{r.type.replace("_", " ")}</Badge> : <span>—</span>,
    },
    {
      header: "Coords",
      cell: (r) => (
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 11,
            color: colors.textSecondary,
          }}
        >
          {Number(r.latitude).toFixed(4)},{" "}
          {Number(r.longitude).toFixed(4)}
        </span>
      ),
    },
    {
      header: "Capacity",
      cell: (r) =>
        r.capacity != null ? (
          <span style={{ fontVariant: "tabular-nums" }}>{r.capacity}</span>
        ) : (
          <span style={{ color: colors.textTertiary }}>—</span>
        ),
    },
    {
      header: "Notes",
      truncate: true,
      cell: (r) =>
        r.description ? (
          <span style={{ fontSize: 12, color: colors.textSecondary }}>
            {r.description}
          </span>
        ) : (
          <span style={{ color: colors.textTertiary }}>—</span>
        ),
    },
    {
      header: "Votes",
      cell: (r) => (
        <div style={{ fontSize: 12, fontVariant: "tabular-nums" }}>
          <div style={{ color: colors.success, fontWeight: 600 }}>
            ↑ {r.upvotes || 0}
          </div>
          <div style={{ color: colors.textTertiary }}>
            ↓ {r.downvotes || 0}
          </div>
        </div>
      ),
    },
  ],
  actions: [
    {
      label: "Verify",
      variant: "primary",
      when: (r) => r.status === "pending" || r.status === "rejected",
      patch: { status: "verified" },
    },
    {
      label: "Reject",
      variant: "danger",
      when: (r) => r.status === "pending" || r.status === "verified",
      patch: { status: "rejected" },
      confirmMessage:
        "Reject this rank? It will be hidden from the public map until re-verified.",
    },
  ],
};

export function LocationsModerationPage() {
  return <ModerationQueue config={config} />;
}
