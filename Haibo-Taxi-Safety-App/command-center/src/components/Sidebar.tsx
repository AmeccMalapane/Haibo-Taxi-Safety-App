import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutGrid,
  Users,
  AlertTriangle,
  Truck,
  Calendar,
  Banknote,
  Video,
  Search,
  Briefcase,
  ScrollText,
  LogOut,
  LucideIcon,
} from "lucide-react";
import { colors, spacing } from "../lib/brand";
import { auth } from "../api/client";
import { closeSocket } from "../lib/socket";

interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  section?: string;
}

const navItems: NavItem[] = [
  // Ops — urgent daily surfaces
  { to: "/", label: "Dashboard", Icon: LayoutGrid, section: "Ops" },
  { to: "/withdrawals", label: "Withdrawals", Icon: Banknote, section: "Ops" },
  { to: "/complaints", label: "Complaints", Icon: AlertTriangle, section: "Ops" },

  // Moderation — content review
  { to: "/moderation/reels", label: "Reels", Icon: Video, section: "Moderation" },
  { to: "/moderation/lost-found", label: "Lost & found", Icon: Search, section: "Moderation" },
  { to: "/moderation/jobs", label: "Jobs", Icon: Briefcase, section: "Moderation" },

  // Directory — reference
  { to: "/users", label: "Users", Icon: Users, section: "Directory" },
  { to: "/fleet", label: "Fleet", Icon: Truck, section: "Directory" },
  { to: "/events", label: "Events", Icon: Calendar, section: "Directory" },

  // System — who did what
  { to: "/audit-log", label: "Audit log", Icon: ScrollText, section: "System" },
];

export function Sidebar() {
  const user = auth.getUser();

  return (
    <aside
      style={{
        width: 240,
        background: colors.sidebarBg,
        color: "#FFFFFF",
        padding: `${spacing.xl}px 0`,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          padding: `0 ${spacing.xl}px ${spacing.xl}px`,
          borderBottom: `1px solid ${colors.sidebarDivider}`,
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, color: colors.rose }}>Haibo!</div>
        <div style={{ fontSize: 12, color: colors.sidebarFgFaint, marginTop: 2 }}>
          Command Center
        </div>
      </div>

      <nav style={{ padding: `${spacing.lg}px 0`, flex: 1, overflowY: "auto" }}>
        {navItems.map((item, idx) => {
          const { to, label, Icon, section } = item;
          const prevSection = idx > 0 ? navItems[idx - 1].section : undefined;
          const showSectionHeader = section && section !== prevSection;
          return (
            <React.Fragment key={to}>
              {showSectionHeader ? (
                <div
                  style={{
                    padding: `${spacing.md}px ${spacing.xl}px ${spacing.xs}px`,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    color: colors.sidebarFgFaint,
                  }}
                >
                  {section}
                </div>
              ) : null}
              <NavLink
                to={to}
                end={to === "/"}
                style={({ isActive }) => ({
                  display: "flex",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: `${spacing.sm}px ${spacing.xl}px`,
                  textDecoration: "none",
                  background: isActive ? colors.roseAccent : "transparent",
                  color: isActive ? colors.rose : colors.sidebarFgDim,
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 500,
                  borderLeft: `3px solid ${isActive ? colors.rose : "transparent"}`,
                  transition: "background 0.15s, color 0.15s",
                })}
              >
                <Icon size={18} strokeWidth={2} />
                {label}
              </NavLink>
            </React.Fragment>
          );
        })}
      </nav>

      <div
        style={{
          padding: `${spacing.lg}px ${spacing.xl}px`,
          borderTop: `1px solid ${colors.sidebarDivider}`,
        }}
      >
        <div style={{ fontSize: 13, color: colors.sidebarFgDim }}>
          {user?.displayName || user?.phone || "Admin"}
        </div>
        <div style={{ fontSize: 11, color: colors.sidebarFgFaint, marginTop: 2 }}>
          {user?.role || "—"}
        </div>
        <button
          onClick={() => {
            closeSocket();
            auth.logout();
          }}
          style={{
            marginTop: spacing.md,
            background: "transparent",
            border: "none",
            color: colors.rose,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: spacing.xs,
          }}
          aria-label="Sign out"
        >
          <LogOut size={14} strokeWidth={2} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
