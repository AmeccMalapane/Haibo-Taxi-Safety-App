import React from "react";
import {
  ModerationQueue,
  ModerationQueueConfig,
} from "../components/ModerationQueue";
import { colors } from "../lib/brand";

interface Reel {
  id: string;
  createdAt: string | null;
  status: string;
  userId: string;
  userName: string;
  caption: string | null;
  mediaUrl: string;
  thumbnailUrl: string | null;
  category: string | null;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
}

const config: ModerationQueueConfig<Reel> = {
  title: "Pusha reels",
  subtitle: "community-posted short-form content",
  resource: "reels",
  queryKey: "moderation:reels",
  emptyHint:
    "Reels appear here as users post them. Hide to remove from the public feed.",
  tabs: [
    { label: "Published", value: "published" },
    { label: "Hidden", value: "hidden" },
    { label: "Removed", value: "removed" },
  ],
  getId: (r) => r.id,
  getStatus: (r) => r.status,
  columns: [
    {
      header: "Posted",
      cell: (r) =>
        r.createdAt ? new Date(r.createdAt).toLocaleString("en-ZA") : "—",
    },
    {
      header: "User",
      cell: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.userName || "—"}</div>
          <div style={{ fontSize: 11, color: colors.textTertiary }}>
            {r.userId.slice(0, 8)}
          </div>
        </div>
      ),
    },
    {
      header: "Thumbnail",
      cell: (r) =>
        r.thumbnailUrl || r.mediaUrl ? (
          <img
            src={r.thumbnailUrl || r.mediaUrl}
            alt=""
            style={{
              width: 52,
              height: 52,
              objectFit: "cover",
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
            }}
          />
        ) : (
          <span style={{ fontSize: 12, color: colors.textTertiary }}>—</span>
        ),
    },
    {
      header: "Caption",
      truncate: true,
      cell: (r) => r.caption || <span style={{ color: colors.textTertiary }}>no caption</span>,
    },
    {
      header: "Category",
      cell: (r) => r.category || "—",
    },
    {
      header: "Engagement",
      cell: (r) => (
        <div style={{ fontVariant: "tabular-nums", fontSize: 12 }}>
          <div>♥ {r.likeCount || 0}</div>
          <div style={{ color: colors.textTertiary }}>
            💬 {r.commentCount || 0} · ↗ {r.shareCount || 0}
          </div>
        </div>
      ),
    },
  ],
  actions: [
    {
      label: "Hide",
      variant: "danger",
      when: (r) => r.status === "published",
      patch: { status: "hidden" },
      confirmMessage: "Hide this reel from the public feed?",
    },
    {
      label: "Restore",
      variant: "primary",
      when: (r) => r.status !== "published",
      patch: { status: "published" },
    },
    {
      label: "Remove",
      variant: "danger",
      when: (r) => r.status === "hidden",
      patch: { status: "removed" },
      confirmMessage: "Permanently mark this reel as removed?",
    },
  ],
};

export function ReelsModerationPage() {
  return <ModerationQueue config={config} />;
}
