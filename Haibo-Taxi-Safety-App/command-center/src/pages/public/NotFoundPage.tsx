import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Compass, MapPin, Briefcase, Users } from "lucide-react";
import {
  colors,
  radius,
  spacing,
  shadows,
  gradients,
  fonts,
  transitions,
} from "../../lib/brand";
import { usePageMeta } from "../../hooks/usePageMeta";
import { FadeInUp, StaggerIn } from "../../lib/motion";

const SHORTCUTS: Array<{
  to: string;
  Icon: typeof MapPin;
  label: string;
  desc: string;
}> = [
  {
    to: "/",
    Icon: Compass,
    label: "Home",
    desc: "Everything Haibo! does, in one scroll.",
  },
  {
    to: "/community",
    Icon: Users,
    label: "Community",
    desc: "Live alerts and stories from the road.",
  },
  {
    to: "/events",
    Icon: MapPin,
    label: "Events",
    desc: "Upcoming industry meetups and workshops.",
  },
  {
    to: "/jobs",
    Icon: Briefcase,
    label: "Jobs",
    desc: "Open roles across the taxi industry.",
  },
];

export function NotFoundPage() {
  usePageMeta({
    title: "Page not found — Haibo!",
    description:
      "The page you were looking for doesn't exist. Head back home or explore the Haibo! community.",
  });

  return (
    <div>
      <Hero />
      <Shortcuts />
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
          top: "-22%",
          right: "-8%",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: gradients.primary,
          opacity: 0.08,
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          maxWidth: 780,
          margin: "0 auto",
          padding: `${spacing["5xl"] * 1.4}px ${spacing["2xl"]}px ${spacing["4xl"]}px`,
          position: "relative",
          zIndex: 1,
          textAlign: "center",
        }}
      >
        <FadeInUp delay={0} duration={0.8} distance={40}>
          <div
            aria-hidden
            style={{
              fontFamily: fonts.heading,
              fontSize: "clamp(112px, 22vw, 220px)",
              fontWeight: 800,
              letterSpacing: -8,
              lineHeight: 0.82,
              background: gradients.primary,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              marginBottom: spacing.xl,
            }}
          >
            404
          </div>
        </FadeInUp>
        <FadeInUp delay={0.15}>
          <h1
            style={{
              fontFamily: fonts.heading,
              fontSize: "clamp(32px, 4.5vw, 52px)",
              fontWeight: 800,
              letterSpacing: -1.0,
              lineHeight: 1.08,
              color: colors.text,
              margin: 0,
            }}
          >
            Haibo — wrong turn.
          </h1>
        </FadeInUp>
        <FadeInUp delay={0.3}>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.6,
              color: colors.textSecondary,
              marginTop: spacing.lg,
              maxWidth: 540,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            The page you were heading to doesn't exist — or it moved while you
            weren't looking. Let's get you back on route.
          </p>
        </FadeInUp>
        <StaggerIn
          stagger={0.1}
          duration={0.5}
          delay={0.4}
          style={{
            display: "flex",
            justifyContent: "center",
            gap: spacing.md,
            marginTop: spacing["2xl"],
            flexWrap: "wrap",
          }}
        >
          <Link
            to="/"
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
            Back home <ArrowRight size={16} />
          </Link>
          <Link
            to="/community"
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
            See what's happening
          </Link>
        </StaggerIn>
      </div>
    </section>
  );
}

function Shortcuts() {
  return (
    <section
      style={{
        maxWidth: 1000,
        margin: "0 auto",
        padding: `${spacing["3xl"]}px ${spacing["2xl"]}px ${spacing["5xl"] * 1.2}px`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: colors.textTertiary,
          textAlign: "center",
          marginBottom: spacing.xl,
        }}
      >
        Jump to
      </div>
      <StaggerIn
        stagger={0.08}
        duration={0.5}
        distance={16}
        onScroll
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: spacing.lg,
        }}
        className="hb-404-grid"
      >
        {SHORTCUTS.map((s) => (
          <ShortcutCard key={s.to} {...s} />
        ))}
      </StaggerIn>
      <style>{`
        @media (max-width: 720px) {
          .hb-404-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 420px) {
          .hb-404-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}

function ShortcutCard({
  to,
  Icon,
  label,
  desc,
}: {
  to: string;
  Icon: typeof MapPin;
  label: string;
  desc: string;
}) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <Link
      to={to}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        padding: spacing.xl,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.xl,
        textDecoration: "none",
        color: "inherit",
        boxShadow: hovered ? shadows.md : shadows.sm,
        transform: hovered ? "translateY(-3px)" : "none",
        transition: transitions.medium,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: radius.md,
          background: colors.roseFaint,
          color: colors.rose,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.md,
        }}
      >
        <Icon size={20} strokeWidth={2.2} />
      </div>
      <div
        style={{
          fontFamily: fonts.heading,
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: -0.2,
          color: colors.text,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 12.5,
          lineHeight: 1.5,
          color: colors.textSecondary,
        }}
      >
        {desc}
      </div>
    </Link>
  );
}
