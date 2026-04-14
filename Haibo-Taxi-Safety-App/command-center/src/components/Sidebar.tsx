import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutGrid,
  Users,
  AlertTriangle,
  Truck,
  Calendar,
  Banknote,
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
}

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", Icon: LayoutGrid },
  { to: "/withdrawals", label: "Withdrawals", Icon: Banknote },
  { to: "/complaints", label: "Complaints", Icon: AlertTriangle },
  { to: "/users", label: "Users", Icon: Users },
  { to: "/fleet", label: "Fleet", Icon: Truck },
  { to: "/events", label: "Events", Icon: Calendar },
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

      <nav style={{ padding: `${spacing.lg}px 0`, flex: 1 }}>
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: spacing.md,
              padding: `${spacing.md}px ${spacing.xl}px`,
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
        ))}
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
