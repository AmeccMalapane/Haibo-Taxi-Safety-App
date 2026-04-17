import React from "react";
import {
  Shield,
  Target,
  Eye,
  Heart,
  Users,
  Zap,
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
import { usePageMeta } from "../../hooks/usePageMeta";
import { StaggerIn } from "../../lib/motion";

const VALUES: Array<{ Icon: typeof Shield; title: string; desc: string }> = [
  {
    Icon: Shield,
    title: "Safety first",
    desc: "Every feature starts with one question: does this make commuters safer?",
  },
  {
    Icon: Heart,
    title: "Community driven",
    desc: "Built by South Africans, for South Africans. Our community shapes every decision.",
  },
  {
    Icon: Zap,
    title: "Innovation",
    desc: "We bring cutting-edge tech to an industry that moves 15 million people daily.",
  },
  {
    Icon: Users,
    title: "Inclusivity",
    desc: "Designed for everyone — from tech-savvy youth to drivers who prefer simplicity.",
  },
];

const MILESTONES = [
  {
    year: "2024",
    title: "The idea",
    desc: "Haibo! concept developed after deep research into SA taxi safety challenges.",
  },
  {
    year: "2025",
    title: "Beta launch",
    desc: "First version released in Gauteng with SOS, rank finder, and community features.",
  },
  {
    year: "2025",
    title: "Haibo Pay",
    desc: "Digital wallet and cashless payment system launched for drivers and commuters.",
  },
  {
    year: "2026",
    title: "Command Center",
    desc: "Fleet management dashboard launched for owners, associations, and admins.",
  },
  {
    year: "2026",
    title: "National expansion",
    desc: "Rolling out to all 9 provinces with localized features and multi-language support.",
  },
];

export function AboutPage() {
  usePageMeta({
    title: "About Haibo! — Safety for Mzansi's taxis",
    description:
      "Haibo! was born from a simple observation: South Africa's minibus taxi industry is the backbone of public transport, yet it lacks the technology infrastructure to keep commuters safe and connected.",
  });
  return (
    <div>
      <Hero />
      <MissionVision />
      <Values />
      <Timeline />
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
          right: "-10%",
          width: 460,
          height: 460,
          borderRadius: "50%",
          background: gradients.primary,
          opacity: 0.08,
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: `${spacing["5xl"] * 2}px ${spacing["2xl"]}px ${spacing["5xl"]}px`,
          position: "relative",
          zIndex: 1,
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: spacing["3xl"],
          alignItems: "center",
        }}
        className="hb-about-hero"
      >
        <div>
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
            <Sparkles size={13} /> About Haibo!
          </div>
          <h1
            style={{
              fontFamily: fonts.heading,
              fontSize: "clamp(36px, 5.2vw, 60px)",
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -1,
              color: colors.text,
              margin: 0,
            }}
          >
            Reimagining taxi safety in{" "}
            <span
              style={{
                background: gradients.primary,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Mzansi
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
            Haibo! was born from a simple observation: South Africa's minibus taxi
            industry is the backbone of public transport, yet it lacks the
            technology infrastructure to keep commuters safe and connected.
          </p>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: colors.textSecondary,
              marginTop: spacing.md,
              maxWidth: 560,
            }}
          >
            We're building the digital layer that connects commuters, drivers,
            fleet owners, and authorities — a safer, more efficient, more
            transparent ecosystem for all of South Africa.
          </p>
        </div>

        {/* Decorative emblem — avoids stock-image dependency */}
        <div
          style={{
            position: "relative",
            aspectRatio: "1 / 1",
            maxWidth: 420,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: radius["2xl"],
              background: gradients.primary,
              boxShadow: shadows.brandLg,
              transform: "rotate(-4deg)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: radius["2xl"],
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              boxShadow: shadows.lg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: spacing["3xl"],
              transform: "rotate(2deg)",
            }}
          >
            <img
              src="/logo.svg"
              alt="Haibo!"
              style={{
                width: "60%",
                filter: "drop-shadow(0 12px 32px rgba(200, 30, 94, 0.45))",
              }}
            />
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 860px) {
          .hb-about-hero {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}

function MissionVision() {
  return (
    <section
      style={{
        maxWidth: 1000,
        margin: "0 auto",
        padding: `${spacing["5xl"]}px ${spacing["2xl"]}px`,
      }}
    >
      <StaggerIn
        stagger={0.12}
        duration={0.6}
        distance={24}
        onScroll
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: spacing.xl,
        }}
        className="hb-mv-grid"
      >
        <MvCard
          Icon={Target}
          tint={colors.rose}
          eyebrow="Our mission"
          body="To make every taxi ride in South Africa safer through technology, community engagement, and data-driven insights that empower commuters, drivers, and industry stakeholders."
        />
        <MvCard
          Icon={Eye}
          tint={colors.success}
          eyebrow="Our vision"
          body="A South Africa where every commuter feels safe, every driver is supported, and the taxi industry operates with the transparency and efficiency that 15 million daily riders deserve."
        />
      </StaggerIn>
      <style>{`
        @media (max-width: 720px) {
          .hb-mv-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}

function MvCard({
  Icon,
  tint,
  eyebrow,
  body,
}: {
  Icon: typeof Target;
  tint: string;
  eyebrow: string;
  body: string;
}) {
  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderLeft: `4px solid ${tint}`,
        borderRadius: radius.xl,
        padding: spacing["2xl"],
        boxShadow: shadows.sm,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: radius.md,
          background: `${tint}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: tint,
          marginBottom: spacing.lg,
        }}
      >
        <Icon size={22} strokeWidth={2.2} />
      </div>
      <h3
        style={{
          fontFamily: fonts.heading,
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: -0.2,
          color: colors.text,
          marginBottom: spacing.sm,
        }}
      >
        {eyebrow}
      </h3>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.65,
          color: colors.textSecondary,
          margin: 0,
        }}
      >
        {body}
      </p>
    </div>
  );
}

function Values() {
  return (
    <section
      style={{
        background: colors.surfaceAlt,
        borderTop: `1px solid ${colors.border}`,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: `${spacing["5xl"]}px ${spacing["2xl"]}px`,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: spacing["3xl"] }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: colors.rose,
            }}
          >
            Values
          </div>
          <h2
            style={{
              fontFamily: fonts.heading,
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 700,
              letterSpacing: -0.6,
              marginTop: spacing.sm,
              color: colors.text,
            }}
          >
            What drives us
          </h2>
        </div>
        <StaggerIn
          stagger={0.08}
          duration={0.55}
          distance={20}
          onScroll
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: spacing.xl,
          }}
          className="hb-values-grid"
        >
          {VALUES.map(({ Icon, title, desc }) => (
            <ValueCard key={title} Icon={Icon} title={title} desc={desc} />
          ))}
        </StaggerIn>
      </div>
      <style>{`
        @media (max-width: 960px) {
          .hb-values-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 540px) {
          .hb-values-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}

function ValueCard({
  Icon,
  title,
  desc,
}: {
  Icon: typeof Shield;
  title: string;
  desc: string;
}) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.xl,
        padding: spacing["2xl"],
        textAlign: "center",
        boxShadow: hovered ? shadows.lg : shadows.sm,
        transform: hovered ? "translateY(-4px)" : "none",
        transition: transitions.medium,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: radius.lg,
          background: colors.roseFaint,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.rose,
          margin: `0 auto ${spacing.lg}px`,
        }}
      >
        <Icon size={26} strokeWidth={2.2} />
      </div>
      <h3
        style={{
          fontFamily: fonts.heading,
          fontSize: 17,
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
          fontSize: 13.5,
          lineHeight: 1.6,
          color: colors.textSecondary,
          margin: 0,
        }}
      >
        {desc}
      </p>
    </div>
  );
}

function Timeline() {
  return (
    <section
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: `${spacing["5xl"]}px ${spacing["2xl"]}px ${spacing["5xl"] * 1.4}px`,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: spacing["3xl"] }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: colors.rose,
          }}
        >
          Journey
        </div>
        <h2
          style={{
            fontFamily: fonts.heading,
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 700,
            letterSpacing: -0.6,
            marginTop: spacing.sm,
            color: colors.text,
          }}
        >
          Our timeline
        </h2>
      </div>

      <div>
        {MILESTONES.map((m, i) => {
          const last = i === MILESTONES.length - 1;
          return (
            <div
              key={`${m.year}-${m.title}`}
              style={{
                display: "flex",
                gap: spacing.xl,
                marginBottom: last ? 0 : spacing["2xl"],
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.full,
                    background: gradients.primary,
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: fonts.heading,
                    fontSize: 13,
                    fontWeight: 700,
                    boxShadow: shadows.brandSm,
                  }}
                >
                  '{m.year.slice(2)}
                </div>
                {last ? null : (
                  <div
                    style={{
                      width: 2,
                      flex: 1,
                      background: colors.roseAccent,
                      marginTop: spacing.xs,
                      minHeight: 40,
                    }}
                  />
                )}
              </div>
              <div style={{ paddingBottom: last ? 0 : spacing["2xl"], flex: 1 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: colors.rose,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                  }}
                >
                  {m.year}
                </div>
                <h3
                  style={{
                    fontFamily: fonts.heading,
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: -0.2,
                    color: colors.text,
                    marginTop: 2,
                    marginBottom: spacing.xs,
                  }}
                >
                  {m.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: colors.textSecondary,
                    margin: 0,
                  }}
                >
                  {m.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
