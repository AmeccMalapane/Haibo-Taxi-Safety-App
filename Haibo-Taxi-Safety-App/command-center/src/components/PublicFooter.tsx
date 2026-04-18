import React from "react";
import { Link } from "react-router-dom";
import { colors, spacing } from "../lib/brand";
import { HaiboMark } from "./HaiboMark";

const LINK_SECTIONS = [
  {
    title: "Product",
    links: [
      { to: "/", label: "Home" },
      { to: "/community", label: "Community" },
      { to: "/events", label: "Events" },
      { to: "/jobs", label: "Jobs" },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/about", label: "About Haibo!" },
      { to: "/login", label: "Command Center" },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/privacy", label: "Privacy policy" },
      { to: "/terms", label: "Terms of service" },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer
      style={{
        background: colors.sidebarBg,
        color: "rgba(255, 255, 255, 0.72)",
        marginTop: spacing["5xl"] * 2,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: `${spacing["4xl"]}px ${spacing["2xl"]}px ${spacing["2xl"]}px`,
          display: "grid",
          gridTemplateColumns: "1.6fr repeat(3, 1fr)",
          gap: spacing["3xl"],
        }}
        className="hb-footer-grid"
      >
        {/* Brand column */}
        <div>
          <HaiboMark
            variant="landscape"
            width={180}
            alt="Haibo!"
            glow={false}
            style={{
              filter: "drop-shadow(0 6px 16px rgba(231, 35, 105, 0.28))",
            }}
          />
          <p
            style={{
              marginTop: spacing.lg,
              fontSize: 14,
              lineHeight: 1.6,
              color: "rgba(255, 255, 255, 0.62)",
              maxWidth: 360,
            }}
          >
            Safety, community, and cashless fares for South Africa's minibus taxi
            industry — built with the commuters and drivers who move 15 million
            people every day.
          </p>
        </div>

        {/* Link columns */}
        {LINK_SECTIONS.map((section) => (
          <div key={section.title}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: "rgba(255, 255, 255, 0.48)",
                marginBottom: spacing.lg,
              }}
            >
              {section.title}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
              {section.links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  style={{
                    fontSize: 14,
                    color: "rgba(255, 255, 255, 0.72)",
                    textDecoration: "none",
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          padding: `${spacing.lg}px ${spacing["2xl"]}px`,
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            gap: spacing.md,
            fontSize: 12,
            color: "rgba(255, 255, 255, 0.48)",
            flexWrap: "wrap",
          }}
        >
          <div>© {new Date().getFullYear()} Haibo! Africa. Safety is the new flex.</div>
          <div>Proudly built in Mzansi 🇿🇦</div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .hb-footer-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 540px) {
          .hb-footer-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </footer>
  );
}
