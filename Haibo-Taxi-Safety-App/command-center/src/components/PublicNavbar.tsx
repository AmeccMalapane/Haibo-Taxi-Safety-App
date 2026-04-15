import React, { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { Menu, X, LogIn, LayoutDashboard } from "lucide-react";
import {
  colors,
  radius,
  spacing,
  shadows,
  gradients,
  transitions,
  fonts,
} from "../lib/brand";
import { auth } from "../api/client";
import { ThemeToggle } from "./ThemeToggle";

const NAV_LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/community", label: "Community" },
  { to: "/events", label: "Events" },
  { to: "/jobs", label: "Jobs" },
  { to: "/about", label: "About" },
];

export function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAuthed = auth.isAuthenticated();
  const user = auth.getUser();
  const isAdmin = user?.role === "admin";

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        // Frosted glass overlay on top of whatever the current theme's
        // background is — works for both light and dark because the
        // backdrop filter blurs whatever sits behind it.
        background: "color-mix(in oklab, var(--background) 80%, transparent)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <nav
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: `0 ${spacing["2xl"]}px`,
          height: 68,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.xl,
        }}
      >
        {/* Brand */}
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing.md,
            textDecoration: "none",
          }}
        >
          <img
            src="/logo.svg"
            alt="Haibo!"
            width={36}
            height={36}
            style={{ filter: "drop-shadow(0 4px 12px rgba(200, 30, 94, 0.28))" }}
          />
          <span
            style={{
              fontFamily: fonts.heading,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: -0.4,
              color: colors.text,
            }}
          >
            Haibo<span style={{ color: colors.rose }}>!</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div
          className="hb-public-links"
          style={{ display: "flex", alignItems: "center", gap: 4 }}
        >
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              style={({ isActive }) => ({
                padding: `${spacing.sm}px ${spacing.lg}px`,
                borderRadius: radius.sm,
                textDecoration: "none",
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? colors.rose : colors.textSecondary,
                background: isActive ? colors.roseFaint : "transparent",
                transition: transitions.color,
              })}
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hb-public-cta" style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
          <ThemeToggle />
          {isAuthed && isAdmin ? (
            <Link
              to="/admin"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: spacing.xs,
                padding: `${spacing.sm}px ${spacing.lg}px`,
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.text,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                transition: transitions.medium,
              }}
            >
              <LayoutDashboard size={15} />
              Command Center
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: spacing.xs,
                  padding: `${spacing.sm}px ${spacing.lg}px`,
                  borderRadius: radius.md,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface,
                  color: colors.text,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                  transition: transitions.medium,
                }}
              >
                <LogIn size={15} />
                Sign in
              </Link>
              <a
                href="#download"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: `${spacing.sm}px ${spacing.lg}px`,
                  borderRadius: radius.md,
                  background: gradients.primary,
                  color: "#FFFFFF",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                  boxShadow: shadows.brandSm,
                  transition: transitions.medium,
                }}
              >
                Get the app
              </a>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="hb-public-toggle"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          style={{
            display: "none",
            background: "transparent",
            border: "none",
            padding: spacing.sm,
            borderRadius: radius.sm,
            cursor: "pointer",
            color: colors.text,
          }}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen ? (
        <div
          style={{
            borderTop: `1px solid ${colors.border}`,
            background: colors.surface,
            padding: `${spacing.md}px ${spacing["2xl"]}px ${spacing.xl}px`,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={() => setMobileOpen(false)}
              style={({ isActive }) => ({
                display: "block",
                padding: `${spacing.md}px ${spacing.lg}px`,
                borderRadius: radius.sm,
                textDecoration: "none",
                fontSize: 15,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? colors.rose : colors.text,
                background: isActive ? colors.roseFaint : "transparent",
              })}
            >
              {link.label}
            </NavLink>
          ))}
          <div
            style={{
              display: "flex",
              gap: spacing.md,
              marginTop: spacing.md,
              paddingTop: spacing.md,
              borderTop: `1px solid ${colors.border}`,
            }}
          >
            {isAuthed && isAdmin ? (
              <Link
                to="/admin"
                onClick={() => setMobileOpen(false)}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: `${spacing.md}px`,
                  borderRadius: radius.md,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface,
                  color: colors.text,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Command Center
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: `${spacing.md}px`,
                    borderRadius: radius.md,
                    border: `1px solid ${colors.border}`,
                    background: colors.surface,
                    color: colors.text,
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Sign in
                </Link>
                <a
                  href="#download"
                  onClick={() => setMobileOpen(false)}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: `${spacing.md}px`,
                    borderRadius: radius.md,
                    background: gradients.primary,
                    color: "#FFFFFF",
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: "none",
                    boxShadow: shadows.brandSm,
                  }}
                >
                  Get the app
                </a>
              </>
            )}
          </div>
        </div>
      ) : null}

      <style>{`
        @media (max-width: 840px) {
          .hb-public-links,
          .hb-public-cta {
            display: none !important;
          }
          .hb-public-toggle {
            display: inline-flex !important;
          }
        }
      `}</style>
    </header>
  );
}
