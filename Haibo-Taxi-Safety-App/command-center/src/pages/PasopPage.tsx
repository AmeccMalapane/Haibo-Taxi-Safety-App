import React, { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ModerationQueue,
  ModerationQueueConfig,
} from "../components/ModerationQueue";
import { Badge, BadgeTone } from "../components/Badge";
import { useAdminSocket } from "../hooks/useAdminSocket";
import { colors } from "../lib/brand";

interface PasopReport {
  id: string;
  createdAt: string | null;
  status: string;
  category: string;
  latitude: number;
  longitude: number;
  description: string | null;
  reporterId: string | null;
  reporterName: string | null;
  petitionCount: number | null;
  expiresAt: string | null;
}

const CATEGORY_LABELS: Record<string, { label: string; tone: BadgeTone }> = {
  reckless_driving: { label: "Reckless", tone: "danger" },
  unsafe_vehicle: { label: "Unsafe", tone: "danger" },
  accident: { label: "Crash", tone: "danger" },
  robbery_risk: { label: "Robbery", tone: "danger" },
  roadblock: { label: "Roadblock", tone: "warning" },
  police_checkpoint: { label: "Checkpoint", tone: "warning" },
  full_taxi: { label: "Full", tone: "info" },
  rank_congestion: { label: "Congestion", tone: "info" },
};

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function timeToExpiry(iso: string | null): { label: string; tone: BadgeTone } {
  if (!iso) return { label: "—", tone: "neutral" };
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return { label: "expired", tone: "danger" };
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return { label: `${minutes}m left`, tone: "warning" };
  const hours = Math.floor(minutes / 60);
  return { label: `${hours}h left`, tone: "info" };
}

const config: ModerationQueueConfig<PasopReport> = {
  title: "Pasop hazards",
  subtitle: "community-filed hazard reports (Waze-style layer)",
  resource: "pasop",
  queryKey: "moderation:pasop",
  emptyHint:
    "Reports auto-expire between 1 and 24 hours depending on category. Hide spam reports without waiting for TTL.",
  tabs: [
    { label: "Active", value: "active" },
    { label: "Expired", value: "expired" },
    { label: "Resolved", value: "resolved" },
    { label: "Hidden", value: "hidden" },
  ],
  getId: (r) => r.id,
  getStatus: (r) => r.status,
  columns: [
    {
      header: "Reported",
      cell: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{relativeTime(r.createdAt)}</div>
          <div style={{ fontSize: 11, color: colors.textTertiary }}>
            {r.createdAt
              ? new Date(r.createdAt).toLocaleTimeString("en-ZA", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </div>
        </div>
      ),
    },
    {
      header: "Category",
      cell: (r) => {
        const meta = CATEGORY_LABELS[r.category] || {
          label: r.category,
          tone: "neutral" as BadgeTone,
        };
        return <Badge tone={meta.tone}>{meta.label}</Badge>;
      },
    },
    {
      header: "Reporter",
      cell: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {r.reporterName || (
              <span style={{ color: colors.textTertiary }}>Anonymous</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: colors.textTertiary }}>
            {r.reporterId ? r.reporterId.slice(0, 8) : "guest"}
          </div>
        </div>
      ),
    },
    {
      header: "Description",
      truncate: true,
      cell: (r) =>
        r.description || (
          <span style={{ color: colors.textTertiary }}>no description</span>
        ),
    },
    {
      header: "Location",
      cell: (r) => (
        <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11 }}>
          <div>{r.latitude.toFixed(4)}</div>
          <div style={{ color: colors.textTertiary }}>{r.longitude.toFixed(4)}</div>
        </div>
      ),
    },
    {
      header: "Petitions",
      cell: (r) => {
        const count = r.petitionCount || 0;
        const expiry = timeToExpiry(r.expiresAt);
        return (
          <div>
            <div style={{ fontVariant: "tabular-nums", fontWeight: 600 }}>
              ↑ {count}
            </div>
            <div style={{ marginTop: 2 }}>
              <Badge tone={expiry.tone}>{expiry.label}</Badge>
            </div>
          </div>
        );
      },
    },
  ],
  actions: [
    {
      label: "Hide",
      variant: "danger",
      when: (r) => r.status === "active",
      patch: { status: "hidden" },
      confirmMessage: "Hide this hazard report? Use for spam or abuse.",
    },
    {
      label: "Resolve",
      variant: "primary",
      when: (r) => r.status === "active",
      patch: { status: "resolved" },
      confirmMessage: "Mark this hazard as resolved (fixed / cleared)?",
    },
    {
      label: "Restore",
      variant: "primary",
      when: (r) => r.status === "hidden",
      patch: { status: "active" },
    },
  ],
};

export function PasopPage() {
  const qc = useQueryClient();
  const handlers = useMemo(
    () => ({
      "pasop:reported": (payload: any) => {
        qc.invalidateQueries({ queryKey: ["moderation:pasop"] });
        const meta = CATEGORY_LABELS[payload.category] || {
          label: payload.category,
        };
        toast.info(
          `New hazard report: ${meta.label}${
            payload.reporterName ? ` · ${payload.reporterName}` : ""
          }`,
          { duration: 6000 }
        );
      },
    }),
    [qc]
  );
  useAdminSocket(handlers);

  return <ModerationQueue config={config} />;
}
