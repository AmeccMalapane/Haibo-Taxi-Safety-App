import React from "react";
import {
  ModerationQueue,
  ModerationQueueConfig,
} from "../components/ModerationQueue";
import { Badge } from "../components/Badge";
import { colors } from "../lib/brand";

interface LostFoundItem {
  id: string;
  createdAt: string | null;
  status: string;
  type: string;
  category: string;
  title: string;
  description: string;
  contactName: string;
  contactPhone: string;
  routeOrigin: string | null;
  routeDestination: string | null;
  reward: number | null;
}

const config: ModerationQueueConfig<LostFoundItem> = {
  title: "Lost & found",
  subtitle: "user-reported lost and found items",
  resource: "lost-found",
  queryKey: "moderation:lost-found",
  emptyHint: "Items can be hidden when they're duplicates, spam, or resolved off-platform.",
  tabs: [
    { label: "Active", value: "active" },
    { label: "Claimed", value: "claimed" },
    { label: "Hidden", value: "hidden" },
  ],
  getId: (i) => i.id,
  getStatus: (i) => i.status,
  columns: [
    {
      header: "Posted",
      cell: (i) =>
        i.createdAt ? new Date(i.createdAt).toLocaleDateString("en-ZA") : "—",
    },
    {
      header: "Type",
      cell: (i) => (
        <Badge tone={i.type === "lost" ? "warning" : "success"}>
          {i.type}
        </Badge>
      ),
    },
    {
      header: "Item",
      truncate: true,
      cell: (i) => (
        <div>
          <div style={{ fontWeight: 600 }}>{i.title}</div>
          <div style={{ fontSize: 11, color: colors.textTertiary }}>{i.category}</div>
        </div>
      ),
    },
    {
      header: "Description",
      truncate: true,
      cell: (i) => i.description,
    },
    {
      header: "Contact",
      cell: (i) => (
        <div>
          <div style={{ fontWeight: 600 }}>{i.contactName}</div>
          <div style={{ fontSize: 11, color: colors.textTertiary }}>{i.contactPhone}</div>
        </div>
      ),
    },
    {
      header: "Route",
      truncate: true,
      cell: (i) =>
        i.routeOrigin && i.routeDestination ? (
          `${i.routeOrigin} → ${i.routeDestination}`
        ) : (
          <span style={{ color: colors.textTertiary }}>—</span>
        ),
    },
    {
      header: "Reward",
      cell: (i) =>
        i.reward ? (
          <span style={{ fontVariant: "tabular-nums", fontWeight: 600 }}>
            R{Number(i.reward).toFixed(0)}
          </span>
        ) : (
          <span style={{ color: colors.textTertiary }}>—</span>
        ),
    },
  ],
  actions: [
    {
      label: "Hide",
      variant: "danger",
      when: (i) => i.status === "active",
      patch: { status: "hidden" },
      confirmMessage: "Hide this listing? (use for spam or duplicates)",
    },
    {
      label: "Restore",
      variant: "primary",
      when: (i) => i.status === "hidden",
      patch: { status: "active" },
    },
  ],
};

export function LostFoundModerationPage() {
  return <ModerationQueue config={config} />;
}
