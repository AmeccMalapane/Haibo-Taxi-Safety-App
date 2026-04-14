import React from "react";
import {
  ModerationQueue,
  ModerationQueueConfig,
} from "../components/ModerationQueue";
import { Badge } from "../components/Badge";
import { colors, fonts } from "../lib/brand";

interface RouteContribution {
  id: string;
  createdAt: string | null;
  status: string;
  origin: string;
  destination: string;
  taxiRankName: string | null;
  fare: number;
  currency: string | null;
  estimatedTime: string | null;
  distance: number | null;
  province: string | null;
  routeType: string | null;
  handSignal: string | null;
  handSignalDescription: string | null;
  additionalNotes: string | null;
  contributorName: string | null;
  upvotes: number | null;
  downvotes: number | null;
  originLatitude: number | null;
  originLongitude: number | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
}

const config: ModerationQueueConfig<RouteContribution> = {
  title: "Community routes",
  subtitle: "user-contributed taxi routes — fares, hand signals, and rank info",
  resource: "route-contributions",
  queryKey: "moderation:route-contributions",
  emptyHint:
    "Commuters contribute routes via the mobile app's Contribute route flow. Approved routes appear in the public directory.",
  tabs: [
    { label: "Pending", value: "pending" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
  ],
  getId: (r) => r.id,
  getStatus: (r) => r.status,
  columns: [
    {
      header: "Posted",
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
            {r.contributorName || "anonymous"}
          </div>
        </div>
      ),
    },
    {
      header: "Route",
      truncate: true,
      cell: (r) => (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
            {r.origin}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: colors.textSecondary,
              marginTop: 2,
            }}
          >
            → {r.destination}
          </div>
          {r.province ? (
            <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
              {r.province}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      header: "Rank",
      truncate: true,
      cell: (r) =>
        r.taxiRankName || (
          <span style={{ color: colors.textTertiary }}>—</span>
        ),
    },
    {
      header: "Fare",
      cell: (r) => (
        <div>
          <div
            style={{
              fontVariant: "tabular-nums",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {r.currency || "R"}
            {Number(r.fare).toFixed(0)}
          </div>
          {r.distance ? (
            <div style={{ fontSize: 11, color: colors.textTertiary }}>
              {Number(r.distance).toFixed(1)} km
            </div>
          ) : null}
        </div>
      ),
    },
    {
      header: "Signal",
      truncate: true,
      cell: (r) =>
        r.handSignal ? (
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.handSignal}</div>
            {r.handSignalDescription ? (
              <div
                style={{
                  fontSize: 11,
                  color: colors.textTertiary,
                  marginTop: 2,
                }}
              >
                {r.handSignalDescription}
              </div>
            ) : null}
          </div>
        ) : (
          <span style={{ color: colors.textTertiary }}>—</span>
        ),
    },
    {
      header: "Time",
      cell: (r) =>
        r.estimatedTime ? (
          <span style={{ fontSize: 13 }}>{r.estimatedTime}</span>
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
    {
      header: "Type",
      cell: (r) =>
        r.routeType ? <Badge>{r.routeType}</Badge> : <span>—</span>,
    },
    {
      header: "Coords",
      cell: (r) =>
        r.originLatitude && r.originLongitude ? (
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 10,
              color: colors.textTertiary,
            }}
          >
            {r.originLatitude.toFixed(3)}, {r.originLongitude.toFixed(3)}
            <br />→ {r.destinationLatitude?.toFixed(3)}, {r.destinationLongitude?.toFixed(3)}
          </span>
        ) : (
          <span style={{ color: colors.textTertiary }}>—</span>
        ),
    },
  ],
  actions: [
    {
      label: "Approve",
      variant: "primary",
      when: (r) => r.status === "pending" || r.status === "rejected",
      patch: { status: "approved" },
    },
    {
      label: "Reject",
      variant: "danger",
      when: (r) => r.status === "pending" || r.status === "approved",
      patch: { status: "rejected" },
      confirmMessage: "Reject this route? It will be hidden from the public directory.",
    },
  ],
};

export function RoutesModerationPage() {
  return <ModerationQueue config={config} />;
}
