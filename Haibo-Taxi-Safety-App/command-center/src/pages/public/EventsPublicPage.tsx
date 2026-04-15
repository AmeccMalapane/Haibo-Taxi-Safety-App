import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Ticket,
  ArrowRight,
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
import { events as eventsApi } from "../../api/client";
import { usePageMeta } from "../../hooks/usePageMeta";

interface ServerEvent {
  id: string;
  title: string;
  description: string;
  category: string | null;
  eventDate: string;
  eventEndDate: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string;
  venue: string | null;
  province: string | null;
  ticketPrice: number | null;
  maxAttendees: number | null;
  currentAttendees: number | null;
  isFeatured: boolean | null;
  status: string | null;
}

// Server categories are: community, safety, training, meeting, celebration, other.
// Everything else falls back to "Community".
const CATEGORY_LABELS: Record<string, string> = {
  community: "Community",
  safety: "Safety",
  training: "Workshop",
  meeting: "Meeting",
  celebration: "Celebration",
  other: "Other",
};

const CATEGORY_TINT: Record<string, string> = {
  community: colors.rose,
  safety: colors.danger,
  training: colors.success,
  meeting: colors.info,
  celebration: colors.warning,
  other: colors.textSecondary,
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTimeRange(start: string | null, end: string | null): string {
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (end) return `Until ${end}`;
  return "All day";
}

function formatPrice(price: number | null): string {
  if (price == null || price <= 0) return "Free";
  return `R${Math.round(price).toLocaleString("en-ZA")}`;
}

export function EventsPublicPage() {
  usePageMeta({
    title: "Events — Haibo!",
    description:
      "Industry conferences, community meetups, and driver workshops across South Africa's minibus taxi ecosystem.",
  });
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["public", "events"],
    queryFn: () => eventsApi.list(),
    staleTime: 60_000,
  });

  const list: ServerEvent[] = (data?.data ?? []).filter(
    (e: ServerEvent) => e.status !== "cancelled" && e.status !== "completed"
  );

  return (
    <div>
      <Hero />
      <section
        style={{
          maxWidth: 980,
          margin: "0 auto",
          padding: `${spacing["4xl"]}px ${spacing["2xl"]}px ${spacing["5xl"]}px`,
          display: "flex",
          flexDirection: "column",
          gap: spacing.xl,
        }}
      >
        {isLoading ? (
          <LoadingList />
        ) : isError ? (
          <ErrorState
            message={(error as Error)?.message || "Couldn't load events."}
            onRetry={() => refetch()}
            retrying={isFetching}
          />
        ) : list.length === 0 ? (
          <EmptyState />
        ) : (
          list.map((event) => <EventCard key={event.id} event={event} />)
        )}
      </section>
      <style>{`
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
        background: colors.surfaceAlt,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <div
        style={{
          maxWidth: 980,
          margin: "0 auto",
          padding: `${spacing["5xl"]}px ${spacing["2xl"]}px ${spacing["4xl"]}px`,
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
          <Sparkles size={13} /> Events
        </div>
        <h1
          style={{
            fontFamily: fonts.heading,
            fontSize: "clamp(36px, 5vw, 54px)",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -1,
            color: colors.text,
            margin: 0,
          }}
        >
          Upcoming{" "}
          <span
            style={{
              background: gradients.primary,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            events
          </span>
          .
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: colors.textSecondary,
            marginTop: spacing.xl,
            maxWidth: 560,
          }}
        >
          Industry conferences, community meetups, and driver workshops across
          South Africa. Publicly listed so anyone in the taxi ecosystem can show up.
        </p>
      </div>
    </section>
  );
}

function EventCard({ event }: { event: ServerEvent }) {
  const [hovered, setHovered] = React.useState(false);
  const categoryKey = (event.category || "other").toLowerCase();
  const tint = CATEGORY_TINT[categoryKey] || CATEGORY_TINT.other;
  const label = CATEGORY_LABELS[categoryKey] || "Community";
  const locationText = event.venue
    ? `${event.venue}${event.location ? `, ${event.location}` : ""}`
    : event.location;
  return (
    <Link
      to={`/events/${event.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        background: colors.surface,
        border: `1px solid ${event.isFeatured ? colors.roseAccent : colors.border}`,
        borderRadius: radius.xl,
        overflow: "hidden",
        boxShadow: hovered ? shadows.lg : shadows.sm,
        transform: hovered ? "translateY(-2px)" : "none",
        transition: transitions.medium,
        textDecoration: "none",
        color: "inherit",
      }}
      className="hb-event-card"
    >
      <div
        style={{
          width: 118,
          background: colors.surfaceAlt,
          borderRight: `1px solid ${colors.border}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.lg,
          gap: spacing.xs,
          flexShrink: 0,
        }}
      >
        <Calendar size={18} color={colors.rose} />
        <div
          style={{
            fontFamily: fonts.heading,
            fontSize: 13,
            fontWeight: 700,
            textAlign: "center",
            letterSpacing: -0.2,
            color: colors.text,
          }}
        >
          {formatDate(event.eventDate)}
        </div>
      </div>

      <div style={{ flex: 1, padding: spacing["2xl"] }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: spacing.sm,
            marginBottom: spacing.sm,
          }}
        >
          <CategoryBadge label={label} tint={tint} />
          {event.isFeatured ? <CategoryBadge label="Featured" tint={colors.rose} /> : null}
        </div>
        <h3
          style={{
            fontFamily: fonts.heading,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: -0.2,
            color: colors.text,
            margin: 0,
          }}
        >
          {event.title}
        </h3>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: colors.textSecondary,
            marginTop: spacing.xs,
            marginBottom: spacing.lg,
          }}
        >
          {event.description}
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: spacing.lg,
            fontSize: 12,
            color: colors.textTertiary,
            marginBottom: spacing.lg,
          }}
        >
          <Meta Icon={Clock} label={formatTimeRange(event.startTime, event.endTime)} />
          <Meta Icon={MapPin} label={locationText} />
          <Meta
            Icon={Users}
            label={`${event.currentAttendees ?? 0}${event.maxAttendees ? `/${event.maxAttendees}` : ""} attending`}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.md,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.xs,
              fontSize: 14,
              fontWeight: 700,
              color: colors.text,
            }}
          >
            <Ticket size={16} color={colors.rose} />
            {formatPrice(event.ticketPrice)}
          </div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: spacing.xs,
              padding: `${spacing.sm}px ${spacing.lg}px`,
              borderRadius: radius.md,
              background: gradients.primary,
              color: "#FFFFFF",
              fontSize: 13,
              fontWeight: 600,
              boxShadow: shadows.brandSm,
            }}
          >
            View details <ArrowRight size={14} />
          </span>
        </div>
      </div>
      <style>{`
        @media (max-width: 620px) {
          .hb-event-card { flex-direction: column !important; }
          .hb-event-card > div:first-child {
            width: 100% !important;
            flex-direction: row !important;
            border-right: none !important;
            border-bottom: 1px solid ${colors.border} !important;
            justify-content: flex-start !important;
            gap: ${spacing.md}px !important;
          }
        }
      `}</style>
    </Link>
  );
}

function CategoryBadge({ label, tint }: { label: string; tint: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: `2px ${spacing.md}px`,
        borderRadius: radius.full,
        background: `${tint}18`,
        color: tint,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.3,
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

function Meta({ Icon, label }: { Icon: typeof Clock; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <Icon size={13} /> {label}
    </span>
  );
}

function LoadingList() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden
          style={{
            display: "flex",
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.xl,
            overflow: "hidden",
            minHeight: 180,
            opacity: 0.55,
          }}
        >
          <div
            style={{
              width: 118,
              background: colors.surfaceAlt,
              borderRight: `1px solid ${colors.border}`,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, padding: spacing["2xl"] }}>
            <Shimmer width="30%" height={10} />
            <div style={{ height: 10 }} />
            <Shimmer width="70%" height={14} />
            <div style={{ height: 8 }} />
            <Shimmer height={10} />
            <div style={{ height: 6 }} />
            <Shimmer width="85%" height={10} />
          </div>
        </div>
      ))}
    </>
  );
}

function Shimmer({
  width = "100%",
  height = 12,
}: {
  width?: number | string;
  height?: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius.xs,
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
        Couldn't load events
      </div>
      <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg }}>
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

function EmptyState() {
  return (
    <div
      style={{
        padding: `${spacing["4xl"]}px ${spacing["2xl"]}px`,
        textAlign: "center",
        color: colors.textTertiary,
        fontSize: 14,
        background: colors.surface,
        border: `1px dashed ${colors.border}`,
        borderRadius: radius.xl,
      }}
    >
      No upcoming events right now. Check back soon — we're always lining up the next one.
    </div>
  );
}
