import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutGrid,
  Users,
  AlertTriangle,
  AlertOctagon,
  Truck,
  Calendar,
  Banknote,
  Video,
  Search,
  Briefcase,
  ScrollText,
  Radar,
  BadgeCheck,
  Megaphone,
  Users2,
  Package,
  LogOut,
  LucideIcon,
} from "lucide-react";
import { colors, radius, spacing, shadows, gradients, transitions } from "../lib/brand";
import { auth } from "../api/client";
import { closeSocket } from "../lib/socket";

interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  section?: string;
}

const navItems: NavItem[] = [
  // Ops — urgent daily surfaces. SOS is first because it's the most
  // time-sensitive surface in the whole app.
  { to: "/", label: "Dashboard", Icon: LayoutGrid, section: "Ops" },
  { to: "/sos", label: "SOS alerts", Icon: AlertOctagon, section: "Ops" },
  { to: "/withdrawals", label: "Withdrawals", Icon: Banknote, section: "Ops" },
  { to: "/complaints", label: "Complaints", Icon: AlertTriangle, section: "Ops" },
  { to: "/broadcast", label: "Broadcast", Icon: Megaphone, section: "Ops" },

  // Moderation — content + person review
  { to: "/moderation/pasop", label: "Pasop hazards", Icon: Radar, section: "Moderation" },
  { to: "/drivers", label: "Driver KYC", Icon: BadgeCheck, section: "Moderation" },
  { to: "/moderation/reels", label: "Reels", Icon: Video, section: "Moderation" },
  { to: "/moderation/lost-found", label: "Lost & found", Icon: Search, section: "Moderation" },
  { to: "/moderation/jobs", label: "Jobs", Icon: Briefcase, section: "Moderation" },

  // Directory — reference
  { to: "/users", label: "Users", Icon: Users, section: "Directory" },
  { to: "/fleet", label: "Fleet", Icon: Truck, section: "Directory" },
  { to: "/group-rides", label: "Group rides", Icon: Users2, section: "Directory" },
  { to: "/deliveries", label: "Deliveries", Icon: Package, section: "Directory" },
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
          display: "flex",
          alignItems: "center",
          gap: spacing.md,
        }}
      >
        <img
          src="/logo.svg"
          alt="Haibo!"
          width={38}
          height={38}
          style={{ flexShrink: 0, filter: "drop-shadow(0 2px 8px rgba(200, 30, 94, 0.35))" }}
        />
        <div>
          <div
            style={{
              fontFamily: "'Space Grotesk', 'Inter', sans-serif",
              fontSize: 20,
              fontWeight: 700,
              color: "#FFFFFF",
              letterSpacing: -0.3,
              lineHeight: 1,
            }}
          >
            Haibo!
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: colors.sidebarFgFaint,
              marginTop: 3,
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            Command Center
          </div>
        </div>
      </div>

      <nav
        style={{
          padding: `${spacing.md}px ${spacing.md}px`,
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {navItems.map((item, idx) => {
          const { to, label, Icon, section } = item;
          const prevSection = idx > 0 ? navItems[idx - 1].section : undefined;
          const showSectionHeader = section && section !== prevSection;
          return (
            <React.Fragment key={to}>
              {showSectionHeader ? (
                <div
                  style={{
                    padding: `${spacing.lg}px ${spacing.md}px ${spacing.xs}px`,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1.2,
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
                className="cc-nav-link"
                style={({ isActive }) => ({
                  display: "flex",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: `${spacing.sm}px ${spacing.md}px`,
                  borderRadius: radius.md,
                  textDecoration: "none",
                  background: isActive ? gradients.primary : "transparent",
                  color: isActive ? "#FFFFFF" : colors.sidebarFgDim,
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 500,
                  boxShadow: isActive ? shadows.brandSm : "none",
                  transition: transitions.medium,
                  position: "relative",
                })}
              >
                <Icon size={18} strokeWidth={2} />
                {label}
              </NavLink>
            </React.Fragment>
          );
        })}

        {/* Hover state for inactive nav links — not possible inline. */}
        <style>{`
          .cc-nav-link:hover {
            background: rgba(255, 255, 255, 0.06) !important;
            color: #FFFFFF !important;
          }
          .cc-nav-link.active:hover,
          .cc-nav-link[aria-current="page"]:hover {
            /* Active link already has the gradient — keep it */
            background: ${gradients.primary} !important;
            color: #FFFFFF !important;
          }
        `}</style>
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
