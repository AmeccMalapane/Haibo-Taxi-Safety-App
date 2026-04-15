import React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  Users,
  Ticket,
  Globe,
  Phone,
  Mail,
  RefreshCw,
  Sparkles,
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
  organizer: string;
  organizerPhone: string | null;
  organizerEmail: string | null;
  imageUrl: string | null;
  ticketPrice: number | null;
  ticketUrl: string | null;
  maxAttendees: number | null;
  currentAttendees: number | null;
  isOnline: boolean | null;
  onlineUrl: string | null;
  isFeatured: boolean | null;
  tags: string[] | null;
  status: string | null;
}

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
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(iso: string): { day: string; month: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: "—", month: "" };
  return {
    day: d.toLocaleDateString("en-ZA", { day: "2-digit" }),
    month: d.toLocaleDateString("en-ZA", { month: "short" }).toUpperCase(),
  };
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

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ServerEvent>({
    queryKey: ["public", "events", eventId],
    queryFn: () => eventsApi.getById(eventId!),
    enabled: !!eventId,
    retry: (count, err: any) => {
      const msg = err?.message || "";
      if (msg.startsWith("404")) return false;
      return count < 2;
    },
  });

  usePageMeta({
    title: data?.title ? `${data.title} — Haibo! events` : "Event — Haibo!",
    description:
      data?.description?.slice(0, 160) ||
      "Event details on the Haibo! community hub.",
  });

  const notFound =
    isError && typeof (error as Error)?.message === "string" && (error as Error).message.startsWith("404");

  return (
    <div>
      <TopBar />
      <section
        style={{
          maxWidth: 860,
          margin: "0 auto",
          padding: `${spacing.xl}px ${spacing["2xl"]}px ${spacing["5xl"]}px`,
        }}
      >
        {isLoading ? (
          <LoadingState />
        ) : notFound ? (
          <NotFoundState />
        ) : isError ? (
          <ErrorState
            message={(error as Error)?.message || "Couldn't load this event."}
            onRetry={() => refetch()}
            retrying={isFetching}
          />
        ) : data ? (
          <EventBody event={data} />
        ) : null}
      </section>
      <style>{`
        @keyframes hb-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes hb-spin { to { transform: rotate(360deg); } }
        .hb-spin { animation: hb-spin 0.9s linear infinite; }
      `}</style>
    </div>
  );
}

function TopBar() {
  return (
    <div
      style={{
        background: colors.surfaceAlt,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <div
        style={{
          maxWidth: 860,
          margin: "0 auto",
          padding: `${spacing.lg}px ${spacing["2xl"]}px`,
        }}
      >
        <Link
          to="/events"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: spacing.xs,
            fontSize: 13,
            fontWeight: 600,
            color: colors.textSecondary,
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={14} /> All events
        </Link>
      </div>
    </div>
  );
}

function EventBody({ event }: { event: ServerEvent }) {
  const categoryKey = (event.category || "other").toLowerCase();
  const tint = CATEGORY_TINT[categoryKey] || CATEGORY_TINT.other;
  const categoryLabel = CATEGORY_LABELS[categoryKey] || "Community";
  const short = formatShortDate(event.eventDate);
  const locationText = event.venue
    ? `${event.venue}, ${event.location}`
    : event.location;
  const capacity = event.maxAttendees
    ? `${event.currentAttendees ?? 0} / ${event.maxAttendees} attending`
    : `${event.currentAttendees ?? 0} attending`;

  return (
    <article>
      {/* Hero row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: spacing["2xl"],
          marginTop: spacing["2xl"],
        }}
        className="hb-event-detail-hero"
      >
        <div
          style={{
            width: 96,
            padding: `${spacing.md}px 0`,
            borderRadius: radius.lg,
            background: colors.roseFaint,
            color: colors.rose,
            textAlign: "center",
            flexShrink: 0,
            border: `1px solid ${colors.roseAccent}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              opacity: 0.8,
            }}
          >
            {short.month}
          </div>
          <div
            style={{
              fontFamily: fonts.heading,
              fontSize: 38,
              fontWeight: 700,
              lineHeight: 1,
              marginTop: 4,
            }}
          >
            {short.day}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: spacing.sm,
              marginBottom: spacing.sm,
            }}
          >
            <Badge label={categoryLabel} tint={tint} />
            {event.isFeatured ? <Badge label="Featured" tint={colors.rose} /> : null}
            {event.isOnline ? <Badge label="Online" tint={colors.info} /> : null}
            {event.status ? <Badge label={event.status} tint={colors.textSecondary} /> : null}
          </div>
          <h1
            style={{
              fontFamily: fonts.heading,
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: -0.6,
              color: colors.text,
              margin: 0,
            }}
          >
            {event.title}
          </h1>
          <div
            style={{
              marginTop: spacing.sm,
              fontSize: 14,
              color: colors.textSecondary,
            }}
          >
            Hosted by{" "}
            <span style={{ fontWeight: 600, color: colors.text }}>{event.organizer}</span>
          </div>
        </div>
      </div>

      {/* Meta grid */}
      <div
        style={{
          marginTop: spacing["2xl"],
          padding: spacing["2xl"],
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.xl,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: spacing.xl,
          boxShadow: shadows.sm,
        }}
        className="hb-event-meta-grid"
      >
        <MetaBlock Icon={Calendar} label="Date" value={formatDate(event.eventDate)} />
        <MetaBlock
          Icon={Clock}
          label="Time"
          value={formatTimeRange(event.startTime, event.endTime)}
        />
        <MetaBlock Icon={MapPin} label="Location" value={locationText} />
        <MetaBlock Icon={Users} label="Capacity" value={capacity} />
      </div>

      {/* Description */}
      <section style={{ marginTop: spacing["3xl"] }}>
        <h2
          style={{
            fontFamily: fonts.heading,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: -0.2,
            color: colors.text,
            marginBottom: spacing.md,
          }}
        >
          About this event
        </h2>
        <p
          style={{
            fontSize: 15.5,
            lineHeight: 1.7,
            color: colors.textSecondary,
            margin: 0,
            whiteSpace: "pre-line",
          }}
        >
          {event.description}
        </p>
      </section>

      {/* Organizer contact */}
      {(event.organizerPhone || event.organizerEmail || event.onlineUrl) && (
        <section style={{ marginTop: spacing["3xl"] }}>
          <h2
            style={{
              fontFamily: fonts.heading,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: -0.2,
              color: colors.text,
              marginBottom: spacing.md,
            }}
          >
            Contact
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.sm,
            }}
          >
            {event.organizerPhone ? (
              <ContactRow Icon={Phone} label={event.organizerPhone} href={`tel:${event.organizerPhone}`} />
            ) : null}
            {event.organizerEmail ? (
              <ContactRow
                Icon={Mail}
                label={event.organizerEmail}
                href={`mailto:${event.organizerEmail}`}
              />
            ) : null}
            {event.onlineUrl ? (
              <ContactRow Icon={Globe} label={event.onlineUrl} href={event.onlineUrl} external />
            ) : null}
          </div>
        </section>
      )}

      {/* Sticky CTA */}
      <div
        style={{
          marginTop: spacing["3xl"],
          padding: spacing["2xl"],
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.xl,
          boxShadow: shadows.md,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.lg,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.md,
              background: colors.roseFaint,
              color: colors.rose,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ticket size={20} />
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                color: colors.textTertiary,
              }}
            >
              Ticket
            </div>
            <div
              style={{
                fontFamily: fonts.heading,
                fontSize: 22,
                fontWeight: 700,
                color: colors.text,
                marginTop: 2,
              }}
            >
              {formatPrice(event.ticketPrice)}
            </div>
          </div>
        </div>
        <button
          type="button"
          disabled
          title="Registration opens soon"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: spacing.xs,
            padding: `${spacing.md}px ${spacing["2xl"]}px`,
            borderRadius: radius.md,
            background: gradients.primary,
            color: "#FFFFFF",
            border: "none",
            fontSize: 14,
            fontWeight: 600,
            cursor: "not-allowed",
            opacity: 0.6,
            boxShadow: shadows.brandSm,
          }}
        >
          Register <ArrowRight size={16} />
        </button>
      </div>
      <style>{`
        @media (max-width: 720px) {
          .hb-event-detail-hero { flex-direction: column !important; }
          .hb-event-meta-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </article>
  );
}

function Badge({ label, tint }: { label: string; tint: string }) {
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

function MetaBlock({
  Icon,
  label,
  value,
}: {
  Icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: colors.textTertiary,
          marginBottom: 4,
        }}
      >
        <Icon size={12} /> {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: colors.text,
          lineHeight: 1.35,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ContactRow({
  Icon,
  label,
  href,
  external,
}: {
  Icon: typeof Phone;
  label: string;
  href: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: spacing.sm,
        padding: `${spacing.sm}px ${spacing.md}px`,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        color: colors.text,
        textDecoration: "none",
        fontSize: 13,
        fontWeight: 500,
        width: "fit-content",
        background: colors.surface,
        transition: transitions.medium,
      }}
    >
      <Icon size={14} color={colors.rose} /> {label}
    </a>
  );
}

function LoadingState() {
  return (
    <div
      aria-hidden
      style={{
        marginTop: spacing["2xl"],
        display: "flex",
        flexDirection: "column",
        gap: spacing.lg,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: spacing["2xl"],
        }}
      >
        <Shimmer size={96} />
        <div style={{ flex: 1 }}>
          <Shimmer width="30%" height={10} />
          <div style={{ height: 10 }} />
          <Shimmer width="85%" height={18} />
          <div style={{ height: 8 }} />
          <Shimmer width="40%" height={10} />
        </div>
      </div>
      <Shimmer height={120} />
      <Shimmer height={10} />
      <Shimmer width="92%" height={10} />
      <Shimmer width="80%" height={10} />
    </div>
  );
}

function Shimmer({
  width = "100%",
  height = 12,
  size,
}: {
  width?: number | string;
  height?: number;
  size?: number;
}) {
  return (
    <div
      style={{
        width: size ?? width,
        height: size ?? height,
        borderRadius: radius.md,
        background: `linear-gradient(90deg, ${colors.gray100} 0%, ${colors.gray200} 50%, ${colors.gray100} 100%)`,
        backgroundSize: "200% 100%",
        animation: "hb-shimmer 1.2s ease-in-out infinite",
      }}
    />
  );
}

function NotFoundState() {
  return (
    <div
      style={{
        marginTop: spacing["2xl"],
        padding: `${spacing["4xl"]}px ${spacing["2xl"]}px`,
        background: colors.surface,
        border: `1px dashed ${colors.border}`,
        borderRadius: radius.xl,
        textAlign: "center",
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
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          marginBottom: spacing.lg,
        }}
      >
        <Sparkles size={12} /> Not found
      </div>
      <h2
        style={{
          fontFamily: fonts.heading,
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: -0.4,
          color: colors.text,
          marginBottom: spacing.sm,
        }}
      >
        This event is no longer listed.
      </h2>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.6,
          color: colors.textSecondary,
          maxWidth: 440,
          margin: `0 auto ${spacing.xl}px`,
        }}
      >
        It may have been cancelled, completed, or moved. Check the full events
        list for what's coming up next.
      </p>
      <Link
        to="/events"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: spacing.xs,
          padding: `${spacing.md}px ${spacing.xl}px`,
          borderRadius: radius.md,
          background: gradients.primary,
          color: "#FFFFFF",
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "none",
          boxShadow: shadows.brandSm,
        }}
      >
        Browse events <ArrowRight size={15} />
      </Link>
    </div>
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
        Couldn't load this event
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
