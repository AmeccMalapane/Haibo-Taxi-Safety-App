import { Feather } from "@expo/vector-icons";
import { BrandColors } from "./theme";

// Shared role metadata — used by SettingsScreen's role picker, the
// RoleSwitcherSheet on dashboard headers, and any future surface that
// needs to render a persona. Keep the Record keyed by role string so
// the type of the key is string (matches `activeRole: string | null`).
//
// Admin is deliberately absent — admins interact with Haibo via the
// command-center web app, not mobile tabs. If an admin user is on
// mobile they see the commuter tab layout.

export interface RoleMeta {
  label: string;
  shortLabel: string;
  icon: keyof typeof Feather.glyphMap;
  hint: string;
  /** Accent colour used by per-role UI chrome (dashboard headers, chips). */
  accent: string;
}

export const ROLE_META: Record<string, RoleMeta> = {
  commuter: {
    label: "Commuter",
    shortLabel: "Commuter",
    icon: "user",
    hint: "Ride taxis and explore the community",
    accent: BrandColors.primary.gradientStart,
  },
  driver: {
    label: "Driver",
    shortLabel: "Driver",
    icon: "truck",
    hint: "Accept fares and track your runs",
    accent: BrandColors.accent.teal,
  },
  owner: {
    label: "Fleet owner",
    shortLabel: "Owner",
    icon: "briefcase",
    hint: "Manage drivers and invitations",
    accent: BrandColors.accent.teal,
  },
  vendor: {
    label: "Vendor",
    shortLabel: "Vendor",
    icon: "shopping-bag",
    hint: "Accept payments and track sales",
    accent: BrandColors.accent.fuchsia,
  },
};

/**
 * Safe lookup — unknown role strings fall back to the commuter entry
 * so callers never have to null-guard the return value.
 */
export function getRoleMeta(role: string | null | undefined): RoleMeta {
  if (role && ROLE_META[role]) return ROLE_META[role];
  return ROLE_META.commuter;
}
