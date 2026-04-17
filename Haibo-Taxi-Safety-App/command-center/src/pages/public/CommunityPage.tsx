import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Heart,
  MessageCircle,
  Share2,
  AlertTriangle,
  Clock,
  Megaphone,
  Search,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import {
  colors,
  radius,
  spacing,
  shadows,
  gradients,
  fonts,
  transitions,
} from "../../lib/brand";
import { community } from "../../api/client";
import { usePageMeta } from "../../hooks/usePageMeta";
import { StaggerIn } from "../../lib/motion";

// Post type is derived client-side from hashtags because the server stores
// reels with a fixed category set (for_you/community/safety/...) that doesn't
// map 1:1 to the community filters commuters actually care about.
type PostType = "alert" | "praise" | "lost" | "general";

interface ServerPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  caption: string | null;
  hashtags: string[] | null;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
  publishedAt: string | null;
  createdAt: string | null;
}

interface UiPost {
  id: string;
  author: string;
  avatar: string;
  time: string;
  content: string;
  tags: string[];
  likes: number;
  comments: number;
  type: PostType;
}

const FILTERS: Array<{ key: "all" | PostType; label: string }> = [
  { key: "all", label: "All posts" },
  { key: "alert", label: "Alerts" },
  { key: "praise", label: "Praise" },
  { key: "lost", label: "Lost & found" },
];

const ALERT_MARKERS = ["alert", "traffic", "delay", "closure", "protest", "road"];
const PRAISE_MARKERS = ["saferide", "saferides", "thankyou", "shoutout", "goodride", "kudos"];
const LOST_MARKERS = ["lost", "lostandfound", "found", "lostitem"];

function inferType(tags: string[]): PostType {
  const normalized = tags.map((t) => t.replace(/^#/, "").toLowerCase());
  if (normalized.some((t) => LOST_MARKERS.some((m) => t.includes(m)))) return "lost";
  if (normalized.some((t) => PRAISE_MARKERS.some((m) => t.includes(m)))) return "praise";
  if (normalized.some((t) => ALERT_MARKERS.some((m) => t.includes(m)))) return "alert";
  return "general";
}

function relativeTime(iso: string | null): string {
  if (!iso) return "just now";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "just now";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function mapPost(p: ServerPost): UiPost {
  const tags = (p.hashtags ?? []).map((t) => (t.startsWith("#") ? t : `#${t}`));
  return {
    id: p.id,
    author: p.userName || "Anonymous",
    avatar: initials(p.userName || "?"),
    time: relativeTime(p.publishedAt ?? p.createdAt),
    content: p.caption ?? "",
    tags,
    likes: p.likeCount ?? 0,
    comments: p.commentCount ?? 0,
    type: inferType(tags),
  };
}

export function CommunityPage() {
  usePageMeta({
    title: "Community — Haibo!",
    description:
      "Real-time safety alerts, praise for drivers, lost-and-found posts and stories from South Africa's minibus taxi community.",
  });
  const [filter, setFilter] = useState<"all" | PostType>("all");
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["public", "community", "posts"],
    queryFn: () => community.getPosts(),
    staleTime: 30_000,
  });

  const posts: UiPost[] = (data?.data ?? []).map(mapPost);
  const visible = filter === "all" ? posts : posts.filter((p) => p.type === filter);

  return (
    <div>
      <Hero />
      <section
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: `${spacing["4xl"]}px ${spacing["2xl"]}px ${spacing["5xl"]}px`,
        }}
      >
        <FilterBar filter={filter} onChange={setFilter} disabled={isLoading} />

        {isLoading ? (
          <LoadingGrid />
        ) : isError ? (
          <ErrorState
            message={(error as Error)?.message || "Couldn't load community posts."}
            onRetry={() => refetch()}
            retrying={isFetching}
          />
        ) : visible.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <StaggerIn
            stagger={0.06}
            duration={0.5}
            distance={16}
            style={{
              marginTop: spacing["2xl"],
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: spacing.xl,
            }}
            className="hb-community-grid"
          >
            {visible.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </StaggerIn>
        )}
      </section>
      <style>{`
        @media (max-width: 720px) {
          .hb-community-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @keyframes hb-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes hb-spin {
          to { transform: rotate(360deg); }
        }
        .hb-spin { animation: hb-spin 0.9s linear infinite; }
      `}</style>
    </div>
  );
}

function Hero() {
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        background: `
          radial-gradient(ellipse at top right, ${colors.roseAccent} 0%, transparent 55%),
          ${colors.bg}
        `,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "-20%",
          left: "-10%",
          width: 480,
          height: 480,
          borderRadius: "50%",
          background: gradients.primary,
          opacity: 0.08,
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: `${spacing["5xl"]}px ${spacing["2xl"]}px ${spacing["4xl"]}px`,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: spacing.xs,
            padding: `${spacing.xs}px ${spacing.md}px`,
            borderRadius: radius.full,
            background: colors.roseFaint,
            color: colors.rose,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            marginBottom: spacing.xl,
          }}
        >
          <Sparkles size={13} /> Community hub
        </div>
        <h1
          style={{
            fontFamily: fonts.heading,
            fontSize: "clamp(36px, 5vw, 56px)",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -1,
            color: colors.text,
            margin: 0,
          }}
        >
          Real-time updates from{" "}
          <span
            style={{
              background: gradients.primary,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            #HaiboApp
          </span>
          .
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: colors.textSecondary,
            marginTop: spacing.xl,
            maxWidth: 620,
          }}
        >
          Safety alerts, praise for drivers who go above and beyond, lost-and-found
          help, and stories from South Africa's taxi community. Powered by commuters
          on the ground.
        </p>
      </div>
    </section>
  );
}

function FilterBar({
  filter,
  onChange,
  disabled,
}: {
  filter: "all" | PostType;
  onChange: (f: "all" | PostType) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="Community filters"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: spacing.sm,
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      {FILTERS.map(({ key, label }) => {
        const active = filter === key;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            style={{
              padding: `${spacing.sm}px ${spacing.lg}px`,
              borderRadius: radius.full,
              border: `1px solid ${active ? "transparent" : colors.border}`,
              background: active ? gradients.primary : colors.surface,
              color: active ? "#FFFFFF" : colors.text,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: fonts.sans,
              boxShadow: active ? shadows.brandSm : "none",
              transition: transitions.medium,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function PostCard({ post }: { post: UiPost }) {
  const [hovered, setHovered] = useState(false);
  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.xl,
        padding: spacing["2xl"],
        boxShadow: hovered ? shadows.lg : shadows.sm,
        transform: hovered ? "translateY(-3px)" : "none",
        transition: transitions.medium,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: spacing.md,
          marginBottom: spacing.lg,
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: radius.full,
            background: gradients.primary,
            color: "#FFFFFF",
            fontFamily: fonts.heading,
            fontSize: 13,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: shadows.brandSm,
          }}
        >
          {post.avatar}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.sm,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: fonts.heading,
                fontSize: 14,
                fontWeight: 600,
                color: colors.text,
              }}
            >
              {post.author}
            </span>
            <TypeBadge type={post.type} />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.xs,
              marginTop: 2,
              fontSize: 11,
              color: colors.textTertiary,
            }}
          >
            <Clock size={11} /> {post.time}
          </div>
        </div>
      </div>

      {post.content ? (
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: colors.text,
            margin: 0,
          }}
        >
          {post.content}
        </p>
      ) : null}

      {post.tags.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: spacing.xs,
            marginTop: spacing.md,
          }}
        >
          {post.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: colors.rose,
                background: colors.roseFaint,
                padding: `${spacing.xs / 2}px ${spacing.md}px`,
                borderRadius: radius.full,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing.xl,
          marginTop: spacing.lg,
          paddingTop: spacing.md,
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <ActionButton Icon={Heart} label={String(post.likes)} />
        <ActionButton Icon={MessageCircle} label={String(post.comments)} />
        <div style={{ flex: 1 }} />
        <ActionButton Icon={Share2} label="Share" />
      </div>
    </article>
  );
}

function TypeBadge({ type }: { type: PostType }) {
  if (type === "general") return null;
  const map: Record<
    Exclude<PostType, "general">,
    { label: string; Icon: typeof AlertTriangle; tint: string }
  > = {
    alert: { label: "Alert", Icon: AlertTriangle, tint: colors.danger },
    praise: { label: "Praise", Icon: Megaphone, tint: colors.success },
    lost: { label: "Lost", Icon: Search, tint: colors.warning },
  };
  const { label, Icon, tint } = map[type];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: `2px ${spacing.sm}px`,
        borderRadius: radius.full,
        background: `${tint}18`,
        color: tint,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.3,
        textTransform: "uppercase",
      }}
    >
      <Icon size={10} strokeWidth={2.4} /> {label}
    </span>
  );
}

function ActionButton({ Icon, label }: { Icon: typeof Heart; label: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: spacing.xs,
        background: "transparent",
        border: "none",
        padding: 0,
        fontSize: 12,
        fontFamily: fonts.sans,
        fontWeight: 600,
        color: hovered ? colors.rose : colors.textTertiary,
        cursor: "pointer",
        transition: transitions.color,
      }}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function LoadingGrid() {
  return (
    <div
      style={{
        marginTop: spacing["2xl"],
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: spacing.xl,
      }}
      className="hb-community-grid"
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          aria-hidden
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.xl,
            padding: spacing["2xl"],
            minHeight: 210,
            opacity: 0.55,
          }}
        >
          <div style={{ display: "flex", gap: spacing.md, marginBottom: spacing.lg }}>
            <Shimmer size={42} round />
            <div style={{ flex: 1 }}>
              <Shimmer width="40%" height={12} />
              <div style={{ height: 6 }} />
              <Shimmer width="25%" height={10} />
            </div>
          </div>
          <Shimmer height={10} />
          <div style={{ height: 6 }} />
          <Shimmer width="85%" height={10} />
          <div style={{ height: 6 }} />
          <Shimmer width="60%" height={10} />
        </div>
      ))}
    </div>
  );
}

function Shimmer({
  width = "100%",
  height = 12,
  size,
  round,
}: {
  width?: number | string;
  height?: number;
  size?: number;
  round?: boolean;
}) {
  return (
    <div
      style={{
        width: size ?? width,
        height: size ?? height,
        borderRadius: round ? "50%" : radius.xs,
        background: `linear-gradient(90deg, ${colors.gray100} 0%, ${colors.gray200} 50%, ${colors.gray100} 100%)`,
        backgroundSize: "200% 100%",
        animation: "hb-shimmer 1.2s ease-in-out infinite",
      }}
    />
  );
}

function ErrorState({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div
      role="alert"
      style={{
        marginTop: spacing["2xl"],
        padding: spacing["2xl"],
        background: colors.dangerSoft,
        border: `1px solid ${colors.danger}33`,
        borderRadius: radius.xl,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: fonts.heading,
          fontSize: 16,
          fontWeight: 700,
          color: colors.danger,
          marginBottom: spacing.sm,
        }}
      >
        Couldn't load posts
      </div>
      <div
        style={{
          fontSize: 13,
          color: colors.textSecondary,
          marginBottom: spacing.lg,
        }}
      >
        {message}
      </div>
      <button
        onClick={onRetry}
        disabled={retrying}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: spacing.xs,
          padding: `${spacing.sm}px ${spacing.lg}px`,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          fontSize: 13,
          fontWeight: 600,
          color: colors.text,
          cursor: retrying ? "wait" : "pointer",
          fontFamily: fonts.sans,
        }}
      >
        <RefreshCw size={14} className={retrying ? "hb-spin" : ""} />
        {retrying ? "Retrying…" : "Try again"}
      </button>
    </div>
  );
}

function EmptyState({ filter }: { filter: "all" | PostType }) {
  const msg =
    filter === "all"
      ? "No community posts yet. Be the first to share what's happening on the road."
      : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} posts right now.`;
  return (
    <div
      style={{
        marginTop: spacing["2xl"],
        padding: `${spacing["4xl"]}px ${spacing["2xl"]}px`,
        textAlign: "center",
        color: colors.textTertiary,
        fontSize: 14,
        background: colors.surface,
        border: `1px dashed ${colors.border}`,
        borderRadius: radius.xl,
      }}
    >
      {msg}
    </div>
  );
}
