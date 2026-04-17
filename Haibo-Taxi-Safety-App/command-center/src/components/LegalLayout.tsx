import React from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import {
  colors,
  radius,
  spacing,
  shadows,
  gradients,
  fonts,
} from "../lib/brand";
import { FadeInUp } from "../lib/motion";

/**
 * Shared chrome for long-form legal pages (privacy policy, terms of service).
 * Hero, plain-language summary, TOC, disclaimer banner, reading column.
 * Content is passed in as a typed section array so each page owns its own
 * copy without duplicating layout concerns.
 */
export interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

interface LegalLayoutProps {
  eyebrow: string;
  title: string;
  lastUpdated: string;
  plainSummary: string;
  sections: LegalSection[];
  /** Optional red-tinted callout rendered immediately after the hero. */
  criticalCallout?: React.ReactNode;
}

export function LegalLayout({
  eyebrow,
  title,
  lastUpdated,
  plainSummary,
  sections,
  criticalCallout,
}: LegalLayoutProps) {
  return (
    <div>
      <Hero
        eyebrow={eyebrow}
        title={title}
        lastUpdated={lastUpdated}
        plainSummary={plainSummary}
      />

      <section
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: `${spacing["2xl"]}px ${spacing["2xl"]}px ${spacing["4xl"]}px`,
        }}
      >
        {/* Draft disclaimer — always visible while these are pre-legal-review. */}
        <div
          role="note"
          style={{
            display: "flex",
            gap: spacing.md,
            padding: spacing.xl,
            background: colors.warningSoft,
            border: `1px solid ${colors.warning}40`,
            borderRadius: radius.lg,
            marginBottom: spacing["2xl"],
          }}
        >
          <AlertTriangle size={18} color={colors.warning} strokeWidth={2.2} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, lineHeight: 1.6, color: colors.text }}>
            <strong style={{ fontWeight: 700 }}>Draft pending legal review.</strong>{" "}
            This document is a good-faith draft intended to meet POPIA and Play
            Store requirements at launch. It will be reviewed and updated by a
            South African-qualified attorney post-launch. If you spot an issue,
            email{" "}
            <a href="mailto:support@haibo.africa" style={{ color: colors.rose, fontWeight: 600 }}>
              support@haibo.africa
            </a>
            .
          </div>
        </div>

        {criticalCallout}

        {/* Table of contents */}
        <nav
          aria-label="On this page"
          style={{
            padding: spacing.xl,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.lg,
            marginBottom: spacing["3xl"],
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: colors.textTertiary,
              marginBottom: spacing.md,
            }}
          >
            On this page
          </div>
          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: spacing.sm,
            }}
            className="hb-legal-toc"
          >
            {sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: spacing.sm,
                    fontSize: 13.5,
                    color: colors.textSecondary,
                    textDecoration: "none",
                    padding: `${spacing.xs}px 0`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: fonts.mono,
                      fontSize: 11,
                      color: colors.rose,
                      fontWeight: 600,
                      minWidth: 20,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Sections */}
        {sections.map((s, i) => (
          <section
            key={s.id}
            id={s.id}
            style={{
              marginBottom: spacing["3xl"],
              scrollMarginTop: 80,
            }}
          >
            <h2
              style={{
                fontFamily: fonts.heading,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: -0.3,
                color: colors.text,
                marginBottom: spacing.lg,
                display: "flex",
                alignItems: "baseline",
                gap: spacing.md,
              }}
            >
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 13,
                  color: colors.rose,
                  fontWeight: 600,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              {s.title}
            </h2>
            <div
              style={{
                fontSize: 15.5,
                lineHeight: 1.75,
                color: colors.textSecondary,
              }}
            >
              {s.body}
            </div>
          </section>
        ))}

        {/* Final contact strip */}
        <div
          style={{
            marginTop: spacing["4xl"],
            padding: spacing["2xl"],
            background: gradients.primary,
            color: "#FFFFFF",
            borderRadius: radius.xl,
            boxShadow: shadows.brandSm,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              opacity: 0.8,
              marginBottom: spacing.xs,
            }}
          >
            Questions?
          </div>
          <div
            style={{
              fontFamily: fonts.heading,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: -0.3,
              marginBottom: spacing.sm,
            }}
          >
            We read every email.
          </div>
          <a
            href="mailto:support@haibo.africa"
            style={{
              display: "inline-block",
              padding: `${spacing.md}px ${spacing["2xl"]}px`,
              borderRadius: radius.md,
              background: "#FFFFFF",
              color: colors.rose,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
              marginTop: spacing.md,
            }}
          >
            support@haibo.africa
          </a>
        </div>
      </section>

      <style>{`
        @media (max-width: 680px) {
          .hb-legal-toc {
            grid-template-columns: 1fr !important;
          }
        }
        html { scroll-behavior: smooth; }
      `}</style>
    </div>
  );
}

function Hero({
  eyebrow,
  title,
  lastUpdated,
  plainSummary,
}: {
  eyebrow: string;
  title: string;
  lastUpdated: string;
  plainSummary: string;
}) {
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
          top: "-18%",
          right: "-8%",
          width: 440,
          height: 440,
          borderRadius: "50%",
          background: gradients.primary,
          opacity: 0.08,
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: `${spacing["5xl"]}px ${spacing["2xl"]}px ${spacing["3xl"]}px`,
          position: "relative",
          zIndex: 1,
        }}
      >
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
            <Sparkles size={13} /> {eyebrow}
          </div>
        </FadeInUp>
        <FadeInUp delay={0.1}>
          <h1
            style={{
              fontFamily: fonts.heading,
              fontSize: "clamp(36px, 5vw, 56px)",
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1,
              color: colors.text,
              margin: 0,
            }}
          >
            {title}
          </h1>
        </FadeInUp>
        <div
          style={{
            display: "flex",
            gap: spacing.lg,
            marginTop: spacing.lg,
            flexWrap: "wrap",
            fontSize: 12,
            color: colors.textTertiary,
            fontWeight: 600,
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          <span>Last updated: {lastUpdated}</span>
          <span>·</span>
          <span>Applies to: Haibo! mobile app + command center</span>
        </div>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: colors.textSecondary,
            marginTop: spacing.xl,
            maxWidth: 700,
          }}
        >
          <strong style={{ color: colors.text, fontWeight: 600 }}>In plain language: </strong>
          {plainSummary}
        </p>
      </div>
    </section>
  );
}

/** Shared paragraph helper — consistent spacing between blocks inside `body`. */
export function P({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: `0 0 ${spacing.md}px`, fontSize: 15.5, lineHeight: 1.75 }}>{children}</p>;
}

/** Shared bulleted list helper with rose markers. */
export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: `0 0 ${spacing.md}px`,
      }}
    >
      {children}
    </ul>
  );
}

export function LI({ children }: { children: React.ReactNode }) {
  return (
    <li
      style={{
        position: "relative",
        paddingLeft: spacing.xl,
        marginBottom: spacing.sm,
        fontSize: 15.5,
        lineHeight: 1.7,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: "0.55em",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: colors.rose,
        }}
      />
      {children}
    </li>
  );
}

/** Inline emphasized term (glossary / callout style). */
export function Term({ children }: { children: React.ReactNode }) {
  return (
    <strong style={{ color: colors.text, fontWeight: 600 }}>{children}</strong>
  );
}
