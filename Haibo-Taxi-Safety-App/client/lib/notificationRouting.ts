import type { RootStackParamList } from "@/navigation/RootStackNavigator";

// Shape mirrors the subset of NotificationRow the routing needs. Keeping
// it narrow so callers can pass either the DB row or an FCM payload that
// was just parsed from a remote-notification handler.
export type NotificationRouteInput = {
  type: string;
  data?: Record<string, any> | null;
};

// Discriminated union over valid navigation targets. A returned `screen`
// must exist in RootStackParamList or the typed navigate call will
// refuse to compile — that's the whole point of this indirection.
export type NotificationRoute = {
  [K in keyof RootStackParamList]: {
    screen: K;
    params: RootStackParamList[K];
  };
}[keyof RootStackParamList];

// Map a persisted notification (or an FCM payload) onto a stack
// destination. Returns null when the notification has no meaningful
// follow-up screen — in that case the tap handler should just mark it
// read without navigating anywhere.
//
// Precedence:
//   1. data.kind is the richest signal (set by the server for things
//      like vendor_sale where we know exactly which flow to open).
//   2. Fall back to the notification `type` column for generic cases
//      (payment → Wallet, sos → Emergency).
//   3. Default to null so unknown shapes don't blindly jump elsewhere.
export function resolveNotificationRoute(
  n: NotificationRouteInput,
): NotificationRoute | null {
  const kind = n.data?.kind;

  // Kind-specific routes — these beat the generic type switch because
  // the server sets them when it knows something more specific than the
  // type column can express.
  if (kind === "vendor_sale") {
    // Vendor sale receipts land the caller on their own vendor
    // dashboard, which includes the recent sales feed where they can
    // reconcile the incoming sale against their physical inventory.
    return { screen: "VendorOnboarding", params: undefined };
  }

  if (kind === "wallet_topup" || kind === "wallet_withdrawal") {
    return { screen: "Wallet", params: undefined };
  }

  if (kind === "package_update" && typeof n.data?.packageId === "string") {
    return { screen: "TrackPackage", params: undefined };
  }

  // Generic type-based routes — cover the "admin pushed a status update"
  // cases where we don't have a kind.
  switch (n.type) {
    case "payment":
      return { screen: "Wallet", params: undefined };
    case "sos":
      return { screen: "Emergency", params: undefined };
    case "delivery":
      return { screen: "TrackPackage", params: undefined };
    case "ride":
      // No dedicated ride detail screen yet — send them to the hub
      // where active rides surface, better than dropping the tap.
      return { screen: "Hub", params: undefined };
    case "complaint_update":
    case "system":
    default:
      // System/broadcast notifications are informational — there's
      // nothing to open, so we just mark-as-read and stay put.
      return null;
  }
}
