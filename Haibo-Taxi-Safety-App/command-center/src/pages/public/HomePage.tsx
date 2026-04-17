import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Shield,
  MapPin,
  CreditCard,
  Users,
  Navigation,
  AlertTriangle,
  ArrowRight,
  Zap,
  Calendar,
  Briefcase,
  Banknote,
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
import { events as eventsApi, jobs as jobsApi } from "../../api/client";
import { usePageMeta } from "../../hooks/usePageMeta";
import { FadeInUp, StaggerIn, RevealOnScroll } from "../../lib/motion";

// Lazy-load the Mapbox hero so the ~250kb mapbox-gl bundle doesn't block
// first paint for users who bounce at the fold. Falls through gracefully
// when VITE_MAPBOX_PUBLIC_TOKEN isn't set (local dev without the token).
const MapHero = React.lazy(() =>
  import("../../components/MapHero").then((m) => ({ default: m.MapHero })),
);

// Each feature gets a gradient pair from the accent palette so the grid
// reads as colorful and confident instead of single-hue. Gradients mirror
// the mobile CommunityScreen tile treatment — SOS = rose/emergency brand
// moment, Rank Finder = sky, Haibo Pay = teal, Group Rides = fuchsia,
// Route Tracking = yellow, Live Alerts = red/orange urgency.
const FEATURES: Array<{
  Icon: typeof Shield;
  title: string;
  desc: string;
  gradient: [string, string];
}> = [
  {
    Icon: Shield,
    title: "Emergency SOS",
    desc: "One-tap SOS shares your GPS location with emergency contacts and local authorities instantly.",
    gradient: [colors.haiboPink, colors.haiboPinkDark],
  },
  {
    Icon: MapPin,
    title: "Rank Finder",
    desc: "Locate the nearest taxi ranks with real-time availability, safety ratings, and fare estimates.",
    gradient: [colors.accentSky, colors.accentSkyLight],
  },
  {
    Icon: CreditCard,
    title: "Haibo Pay",
    desc: "Cashless fare payments, peer transfers, and driver earnings — all in one digital wallet.",
    gradient: [colors.accentTeal, colors.accentTealLight],
  },
  {
    Icon: Users,
    title: "Group Rides",
    desc: "Coordinate shared rides for school runs, work commutes, and community events.",
    gradient: [colors.accentFuchsia, colors.accentFuchsiaLight],
  },
  {
    Icon: Navigation,
    title: "Route Tracking",
    desc: "Real-time GPS tracking of taxi routes for safety monitoring and data-driven optimization.",
    gradient: [colors.accentYellow, colors.accentYellowLight],
  },
  {
    Icon: AlertTriangle,
    title: "Live Alerts",
    desc: "Community-powered safety alerts for road conditions, protests, and route disruptions.",
    gradient: [colors.haiboError, colors.haiboGold],
  },
];

const STATS = [
  { value: "15M+", label: "Daily commuters" },
  { value: "250K+", label: "Minibus taxis" },
  { value: "9", label: "Provinces covered" },
  { value: "24/7", label: "SOS response" },
];

export function HomePage() {
  usePageMeta({
    title: "Haibo! — Safety for South Africa's taxis",
    description:
      "SOS, rank finder, cashless fares, group rides and community alerts for the 15 million commuters who rely on South African minibus taxis every day.",
  });
  return (
    <div>
      <Hero />
      <Stats />
      <Features />
      <FeaturedRails />
      <SafetyBand />
      <DownloadCTA />
    </div>
  );
}

function Hero() {
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        background: colors.bg,
        minHeight: 640,
      }}
    >
      {/* Live Mapbox layer — sits absolutely behind the hero content on the
          right 60% of the viewport. The gradient scrim (below) fades it out
          on the left side so the headline stays legible without needing a
          solid card behind the text. */}
      <div
        className="hb-hero-map"
        style={{
          position: "absolute",
          inset: 0,
          left: "38%",
          pointerEvents: "auto",
        }}
      >
        <React.Suspense fallback={null}>
          <MapHero />
        </React.Suspense>
      </div>

      {/* Left-side scrim: opaque on the very left fading to transparent by
          ~62% width. Keeps the map visible on the right while the headline
          on the left reads on a solid background. Re-declared for dark
          theme automatically via CSS variables. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(90deg,
            var(--background) 0%,
            var(--background) 30%,
            color-mix(in oklab, var(--background) 88%, transparent) 48%,
            color-mix(in oklab, var(--background) 30%, transparent) 70%,
            transparent 100%)`,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Top-right rose glow — echoes the SOS pulse markers and ties the
          hero back to the brand gradient. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "-20%",
          right: "-10%",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: gradients.primary,
          opacity: 0.12,
          filter: "blur(90px)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: `${spacing["5xl"] * 2}px ${spacing["2xl"]}px ${spacing["5xl"] * 2}px`,
          position: "relative",
          zIndex: 3,
        }}
      >
        <div style={{ maxWidth: 620 }} className="hb-hero-copy">
        <FadeInUp delay={0}>
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
            <Zap size={13} /> Safety is the new flex
          </div>
        </FadeInUp>
        <FadeInUp delay={0.1}>
          <h1
            style={{
              fontFamily: fonts.heading,
              fontSize: "clamp(44px, 7vw, 80px)",
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -1.6,
              color: colors.text,
              maxWidth: 820,
              margin: 0,
            }}
          >
            The safety layer for{" "}
            <span
              style={{
                background: gradients.primary,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Mzansi's taxis
            </span>
            .
          </h1>
        </FadeInUp>
        <FadeInUp delay={0.25}>
          <p
            style={{
              fontFamily: fonts.sans,
              fontSize: 18,
              lineHeight: 1.6,
              color: colors.textSecondary,
              marginTop: spacing.xl,
              maxWidth: 620,
            }}
          >
            SOS, rank finder, cashless fares, group rides and community alerts — built
            with and for the 15 million commuters who rely on minibus taxis every day.
          </p>
        </FadeInUp>
        <FadeInUp delay={0.4}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: spacing.md,
              marginTop: spacing["2xl"],
            }}
          >
            <a
              href="#download"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: spacing.xs,
                padding: `${spacing.lg}px ${spacing["2xl"]}px`,
                borderRadius: radius.md,
                background: gradients.primary,
                color: "#FFFFFF",
                fontSize: 15,
                fontWeight: 600,
                textDecoration: "none",
                boxShadow: shadows.brandSm,
                transition: transitions.medium,
              }}
            >
              Get the app <ArrowRight size={16} />
            </a>
            <Link
              to="/about"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: `${spacing.lg}px ${spacing["2xl"]}px`,
                borderRadius: radius.md,
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                color: colors.text,
                fontSize: 15,
                fontWeight: 600,
                textDecoration: "none",
                transition: transitions.medium,
              }}
            >
              Our story
            </Link>
          </div>
        </FadeInUp>
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .hb-hero-map {
            left: 0 !important;
            opacity: 0.18;
          }
          .hb-hero-copy {
            max-width: 100% !important;
          }
        }
      `}</style>
    </section>
  );
}

function Stats() {
  return (
    <RevealOnScroll
      startPosition={90}
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: `0 ${spacing["2xl"]}px`,
        marginTop: -spacing["4xl"],
        position: "relative",
        zIndex: 2,
      }}
    >
      <StaggerIn
        stagger={0.1}
        duration={0.5}
        distance={12}
        onScroll
        style={{
          background: colors.surface,
          borderRadius: radius.xl,
          padding: `${spacing["2xl"]}px ${spacing.xl}px`,
          boxShadow: shadows.lg,
          border: `1px solid ${colors.border}`,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: spacing.xl,
        }}
        className="hb-stats-grid"
      >
        {STATS.map((stat) => (
          <div key={stat.label} style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: fonts.heading,
                fontSize: 34,
                fontWeight: 700,
                letterSpacing: -0.6,
                background: gradients.primary,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                lineHeight: 1,
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                marginTop: spacing.xs,
                fontSize: 12,
                fontWeight: 600,
                color: colors.textTertiary,
                letterSpacing: 0.6,
                textTransform: "uppercase",
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </StaggerIn>
      <style>{`
        @media (max-width: 720px) {
          .hb-stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </RevealOnScroll>
  );
}

function Features() {
  return (
    <section
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: `${spacing["5xl"] * 2}px ${spacing["2xl"]}px ${spacing["5xl"]}px`,
      }}
    >
      <RevealOnScroll style={{ textAlign: "center", maxWidth: 680, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: colors.rose,
          }}
        >
          What you get
        </div>
        <h2
          style={{
            fontFamily: fonts.heading,
            fontSize: "clamp(32px, 4.5vw, 52px)",
            fontWeight: 800,
            letterSpacing: -1.0,
            marginTop: spacing.sm,
            color: colors.text,
          }}
        >
          Everything you need for a safer ride.
        </h2>
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.6,
            color: colors.textSecondary,
            marginTop: spacing.md,
          }}
        >
          Six tools built for South African taxi life — from emergency response
          to cashless fares — all in one app.
        </p>
      </RevealOnScroll>

      <StaggerIn
        stagger={0.1}
        duration={0.6}
        distance={24}
        onScroll
        style={{
          marginTop: spacing["3xl"],
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: spacing.xl,
        }}
        className="hb-feat-grid"
      >
        {FEATURES.map(({ Icon, title, desc, gradient }) => (
          <FeatureCard
            key={title}
            Icon={Icon}
            title={title}
            desc={desc}
            gradient={gradient}
          />
        ))}
      </StaggerIn>
      <style>{`
        @media (max-width: 960px) {
          .hb-feat-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 600px) {
          .hb-feat-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}

function FeatureCard({
  Icon,
  title,
  desc,
  gradient,
}: {
  Icon: typeof Shield;
  title: string;
  desc: string;
  gradient: [string, string];
}) {
  const [hovered, setHovered] = React.useState(false);
  const [gradStart] = gradient;
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: colors.surface,
        // 2px border (up from 1px) — the typeui-energetic pass wants thicker
        // borders on cards for a more confident, youth-first feel. Border
        // tints toward the gradient start color on hover so the card lights
        // up in its own accent hue rather than the generic brand rose.
        border: `2px solid ${hovered ? `${gradStart}55` : colors.border}`,
        borderRadius: radius.xl,
        padding: spacing["2xl"],
        boxShadow: hovered ? `0 14px 28px ${gradStart}22` : shadows.sm,
        transform: hovered ? "translateY(-4px)" : "none",
        transition: transitions.medium,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: radius.md,
          // Gradient icon backplate mirrors the mobile CommunityScreen tiles
          // exactly — white icon floats on a solid gradient chip with a
          // subtle colored shadow for depth.
          background: `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#FFFFFF",
          marginBottom: spacing.xl,
          boxShadow: `0 6px 14px ${gradStart}33`,
        }}
      >
        <Icon size={22} strokeWidth={2.4} />
      </div>
      <h3
        style={{
          fontFamily: fonts.heading,
          fontSize: 19,
          fontWeight: 700,
          letterSpacing: -0.2,
          color: colors.text,
          marginBottom: spacing.sm,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.6,
          color: colors.textSecondary,
        }}
      >
        {desc}
      </p>
    </div>
  );
}

function SafetyBand() {
  return (
    <section
      style={{
        background: gradients.primary,
        color: "#FFFFFF",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: `${spacing["4xl"]}px ${spacing["2xl"]}px`,
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr",
          gap: spacing["3xl"],
          alignItems: "center",
        }}
        className="hb-safety-grid"
      >
        <RevealOnScroll>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              opacity: 0.75,
            }}
          >
            Community safety
          </div>
          <h2
            style={{
              fontFamily: fonts.heading,
              fontSize: "clamp(28px, 3.8vw, 44px)",
              fontWeight: 800,
              letterSpacing: -0.8,
              marginTop: spacing.sm,
              lineHeight: 1.08,
            }}
          >
            An SOS that actually reaches someone.
          </h2>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.6,
              marginTop: spacing.md,
              opacity: 0.88,
              maxWidth: 540,
            }}
          >
            Haibo!'s SOS button pings your emergency contacts, the Command Center,
            and local responders with your live GPS — plus the taxi's plate and
            route — so help knows exactly where to go.
          </p>
        </RevealOnScroll>
        <RevealOnScroll
          startPosition={90}
          distance={24}
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            borderRadius: radius.xl,
            padding: spacing["2xl"],
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.full,
                background: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: colors.rose,
                flexShrink: 0,
              }}
            >
              <Shield size={20} strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ fontSize: 13, opacity: 0.75, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 600 }}>
                Live SOS
              </div>
              <div style={{ fontFamily: fonts.heading, fontSize: 20, fontWeight: 700, marginTop: 2 }}>
                Thabo M. · GP 456-789
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: spacing.xl,
              padding: `${spacing.md}px ${spacing.lg}px`,
              borderRadius: radius.md,
              background: "rgba(0, 0, 0, 0.2)",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            N1 South · Buccleuch
            <br />
            <span style={{ opacity: 0.72 }}>Dispatched 00:08 ago · 2 responders en route</span>
          </div>
        </RevealOnScroll>
      </div>
      <style>{`
        @media (max-width: 820px) {
          .hb-safety-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}

interface FeaturedEvent {
  id: string;
  title: string;
  eventDate: string;
  startTime: string | null;
  location: string;
  venue: string | null;
  isFeatured: boolean | null;
  status: string | null;
}

interface FeaturedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  province: string | null;
  salary: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  jobType: string | null;
  createdAt: string | null;
  isVerified: boolean | null;
}

function FeaturedRails() {
  const eventsQuery = useQuery({
    queryKey: ["public", "home", "events"],
    queryFn: () => eventsApi.list(),
    staleTime: 60_000,
  });
  const jobsQuery = useQuery({
    queryKey: ["public", "home", "jobs"],
    queryFn: () => jobsApi.list(),
    staleTime: 60_000,
  });

  const events: FeaturedEvent[] = (eventsQuery.data?.data ?? [])
    .filter((e: FeaturedEvent) => e.status !== "cancelled" && e.status !== "completed")
    .slice(0, 3);
  const jobs: FeaturedJob[] = (jobsQuery.data?.data ?? []).slice(0, 3);

  // If both rails are empty and neither is loading, skip the whole section —
  // no point showing two "no content" empty states on the marketing page.
  const hideSection =
    !eventsQuery.isLoading &&
    !jobsQuery.isLoading &&
    events.length === 0 &&
    jobs.length === 0;
  if (hideSection) return null;

  return (
    <section
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: `${spacing["4xl"]}px ${spacing["2xl"]}px`,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 680, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: colors.rose,
          }}
        >
          What's happening
        </div>
        <h2
          style={{
            fontFamily: fonts.heading,
            fontSize: "clamp(26px, 3.8vw, 40px)",
            fontWeight: 700,
            letterSpacing: -0.8,
            marginTop: spacing.sm,
            color: colors.text,
          }}
        >
          Live from the community.
        </h2>
      </div>

      <div
        style={{
          marginTop: spacing["3xl"],
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: spacing["2xl"],
        }}
        className="hb-home-rails"
      >
        <Rail
          title="Upcoming events"
          Icon={Calendar}
          linkTo="/events"
          linkLabel="See all events"
          isLoading={eventsQuery.isLoading}
          isEmpty={events.length === 0}
          emptyLabel="No events lined up yet."
        >
          {events.map((e) => (
            <EventRailCard key={e.id} event={e} />
          ))}
        </Rail>
        <Rail
          title="Open jobs"
          Icon={Briefcase}
          linkTo="/jobs"
          linkLabel="See all jobs"
          isLoading={jobsQuery.isLoading}
          isEmpty={jobs.length === 0}
          emptyLabel="No roles posted right now."
        >
          {jobs.map((j) => (
            <JobRailCard key={j.id} job={j} />
          ))}
        </Rail>
      </div>
      <style>{`
        @media (max-width: 820px) {
          .hb-home-rails {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}

function Rail({
  title,
  Icon,
  linkTo,
  linkLabel,
  isLoading,
  isEmpty,
  emptyLabel,
  children,
}: {
  title: string;
  Icon: typeof Calendar;
  linkTo: string;
  linkLabel: string;
  isLoading: boolean;
  isEmpty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.md,
          marginBottom: spacing.lg,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.md,
              background: colors.roseFaint,
              color: colors.rose,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={18} strokeWidth={2.2} />
          </div>
          <h3
            style={{
              fontFamily: fonts.heading,
              fontSize: 19,
              fontWeight: 700,
              letterSpacing: -0.2,
              color: colors.text,
              margin: 0,
            }}
          >
            {title}
          </h3>
        </div>
        <Link
          to={linkTo}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 13,
            fontWeight: 600,
            color: colors.rose,
            textDecoration: "none",
          }}
        >
          {linkLabel} <ArrowRight size={14} />
        </Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
        {isLoading ? (
          <>
            <RailSkeleton />
            <RailSkeleton />
            <RailSkeleton />
          </>
        ) : isEmpty ? (
          <div
            style={{
              padding: `${spacing["2xl"]}px`,
              textAlign: "center",
              color: colors.textTertiary,
              fontSize: 13,
              background: colors.surface,
              border: `1px dashed ${colors.border}`,
              borderRadius: radius.lg,
            }}
          >
            {emptyLabel}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function EventRailCard({ event }: { event: FeaturedEvent }) {
  const [hovered, setHovered] = React.useState(false);
  const d = new Date(event.eventDate);
  const day = Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-ZA", { day: "2-digit" });
  const month = Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-ZA", { month: "short" }).toUpperCase();
  const locationText = event.venue
    ? `${event.venue}, ${event.location}`
    : event.location;
  return (
    <Link
      to={`/events/${event.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.lg,
        padding: spacing.lg,
        background: colors.surface,
        border: `1px solid ${event.isFeatured ? colors.roseAccent : colors.border}`,
        borderRadius: radius.lg,
        textDecoration: "none",
        boxShadow: hovered ? shadows.md : shadows.sm,
        transform: hovered ? "translateY(-2px)" : "none",
        transition: transitions.medium,
      }}
    >
      <div
        style={{
          width: 54,
          padding: `${spacing.sm}px 0`,
          borderRadius: radius.md,
          background: colors.roseFaint,
          color: colors.rose,
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: fonts.heading,
            fontSize: 20,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {day}
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.6,
            marginTop: 3,
          }}
        >
          {month}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: fonts.heading,
            fontSize: 14,
            fontWeight: 700,
            color: colors.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {event.title}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            marginTop: 3,
            fontSize: 11,
            color: colors.textTertiary,
          }}
        >
          <MapPin size={11} />
          <span
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {locationText}
          </span>
        </div>
      </div>
    </Link>
  );
}

function JobRailCard({ job }: { job: FeaturedJob }) {
  const [hovered, setHovered] = React.useState(false);
  const salary =
    job.salary ||
    (job.salaryMin != null && job.salaryMax != null
      ? `R${Math.round(job.salaryMin).toLocaleString("en-ZA")} – R${Math.round(job.salaryMax).toLocaleString("en-ZA")}`
      : null);
  const locationText = job.province ? `${job.location}, ${job.province}` : job.location;
  return (
    <Link
      to={`/jobs/${job.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.lg,
        padding: spacing.lg,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.lg,
        textDecoration: "none",
        boxShadow: hovered ? shadows.md : shadows.sm,
        transform: hovered ? "translateY(-2px)" : "none",
        transition: transitions.medium,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.md,
          background: gradients.primary,
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: shadows.brandSm,
        }}
      >
        <Briefcase size={18} strokeWidth={2.2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: fonts.heading,
            fontSize: 14,
            fontWeight: 700,
            color: colors.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {job.title}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing.md,
            marginTop: 3,
            fontSize: 11,
            color: colors.textTertiary,
          }}
        >
          <span
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 140,
            }}
          >
            {job.company}
          </span>
          <span>·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <MapPin size={11} /> {locationText}
          </span>
        </div>
        {salary ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              marginTop: 4,
              fontSize: 11,
              fontWeight: 600,
              color: colors.rose,
            }}
          >
            <Banknote size={11} /> {salary}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

function RailSkeleton() {
  return (
    <div
      aria-hidden
      style={{
        height: 76,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.lg,
        opacity: 0.55,
        display: "flex",
        alignItems: "center",
        padding: spacing.lg,
        gap: spacing.lg,
      }}
    >
      <div
        style={{
          width: 54,
          height: 48,
          borderRadius: radius.md,
          background: `linear-gradient(90deg, ${colors.gray100} 0%, ${colors.gray200} 50%, ${colors.gray100} 100%)`,
          backgroundSize: "200% 100%",
          animation: "hb-shimmer 1.2s ease-in-out infinite",
        }}
      />
      <div style={{ flex: 1 }}>
        <div
          style={{
            width: "65%",
            height: 12,
            borderRadius: radius.xs,
            background: `linear-gradient(90deg, ${colors.gray100} 0%, ${colors.gray200} 50%, ${colors.gray100} 100%)`,
            backgroundSize: "200% 100%",
            animation: "hb-shimmer 1.2s ease-in-out infinite",
          }}
        />
        <div style={{ height: 8 }} />
        <div
          style={{
            width: "40%",
            height: 10,
            borderRadius: radius.xs,
            background: `linear-gradient(90deg, ${colors.gray100} 0%, ${colors.gray200} 50%, ${colors.gray100} 100%)`,
            backgroundSize: "200% 100%",
            animation: "hb-shimmer 1.2s ease-in-out infinite",
          }}
        />
      </div>
      <style>{`
        @keyframes hb-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

function DownloadCTA() {
  return (
    <section
      id="download"
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: `${spacing["5xl"]}px ${spacing["2xl"]}px`,
        textAlign: "center",
      }}
    >
      <RevealOnScroll>
        <h2
          style={{
            fontFamily: fonts.heading,
            fontSize: "clamp(32px, 4.5vw, 52px)",
            fontWeight: 800,
            letterSpacing: -1.0,
            color: colors.text,
          }}
        >
          Ready to ride safer?
        </h2>
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.6,
            color: colors.textSecondary,
            marginTop: spacing.md,
            maxWidth: 540,
            margin: `${spacing.md}px auto 0`,
          }}
        >
          Download Haibo! and join the community of commuters, drivers, and fleet
          owners building a safer taxi network.
        </p>
      </RevealOnScroll>
      <StaggerIn
        stagger={0.1}
        duration={0.5}
        onScroll
        style={{
          display: "flex",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: spacing.md,
          marginTop: spacing["2xl"],
        }}
      >
        <a
          href="#"
          style={{
            padding: `${spacing.lg}px ${spacing["2xl"]}px`,
            borderRadius: radius.md,
            background: gradients.primary,
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: 600,
            textDecoration: "none",
            boxShadow: shadows.brandSm,
          }}
        >
          Download for Android
        </a>
        <a
          href="#"
          style={{
            padding: `${spacing.lg}px ${spacing["2xl"]}px`,
            borderRadius: radius.md,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            color: colors.text,
            fontSize: 15,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Download for iOS
        </a>
      </StaggerIn>
    </section>
  );
}
