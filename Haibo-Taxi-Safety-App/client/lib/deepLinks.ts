import * as Linking from "expo-linking";
import { Platform } from "react-native";

const APP_SCHEME = "haibo-taxi";

export interface DeepLinkParams {
  screen?: string;
  id?: string;
  [key: string]: string | undefined;
}

export function createDeepLink(path: string, params?: DeepLinkParams): string {
  const baseUrl = Linking.createURL(path);
  
  if (!params || Object.keys(params).length === 0) {
    return baseUrl;
  }

  const queryParams = Object.entries(params)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value!)}`)
    .join("&");

  return `${baseUrl}?${queryParams}`;
}

export function createShareableLink(screen: string, id?: string): string {
  const webDomain = process.env.EXPO_PUBLIC_DOMAIN || "";
  const path = id ? `/${screen}/${id}` : `/${screen}`;
  
  if (Platform.OS === "web" || !webDomain) {
    return createDeepLink(path);
  }

  return `https://${webDomain}${path}`;
}

export function parseDeepLink(url: string): DeepLinkParams {
  const parsed = Linking.parse(url);

  // Split the path into [screen, id, ...rest].
  // "route/abc123" → screen: "route", id: "abc123"
  // "sos"          → screen: "sos", id: undefined
  const segments = (parsed.path || "").split("/").filter(Boolean);
  const [screen, id] = segments;

  return {
    screen: screen || undefined,
    id: id || undefined,
    ...(parsed.queryParams as Record<string, string | undefined>),
  };
}

export function createRouteLink(routeId: string): string {
  return createShareableLink("route", routeId);
}

export function createLocationLink(locationId: string): string {
  return createShareableLink("location", locationId);
}

export function createReelLink(reelId: string): string {
  return createShareableLink("reel", reelId);
}

export function createReferralLink(code: string): string {
  return createShareableLink("invite", code);
}

export function createJobLink(jobId: string): string {
  return createShareableLink("job", jobId);
}

export function createEventLink(eventId: string): string {
  return createShareableLink("event", eventId);
}

/**
 * Haibo Pay vendor link — builds a shareable URL that lands on the
 * PayVendor screen with the vendorRef pre-filled. Vendors share this
 * via WhatsApp or turn it into a printed QR sticker for their stall;
 * buyers scan with any native camera and tap through.
 */
export function createVendorPayLink(vendorRef: string): string {
  return createShareableLink("pay", vendorRef);
}

/**
 * Screen route map for deep links. Keys are the URL path segment, values are
 * the actual screen name in RootStackParamList. Screens that take a param
 * declare the target paramKey; screens that don't just navigate bare.
 *
 * NOTE: Pusha, Jobs, Events don't currently accept an ID param — the link
 * drops the user on the list and they tap through. When those screens gain
 * per-item detail routes, add paramKey here.
 */
const SCREEN_ROUTES: Record<string, { screen: string; paramKey?: string }> = {
  route: { screen: "RouteDetail", paramKey: "routeId" },
  location: { screen: "LocationDetails", paramKey: "locationId" },
  pasop: { screen: "PasopFeed" },
  reel: { screen: "Pusha" },
  invite: { screen: "Referral" },
  job: { screen: "Jobs" },
  event: { screen: "Events" },
  pay: { screen: "PayVendor", paramKey: "vendorRef" },
  sos: { screen: "Emergency" },
  home: { screen: "Main" },
  community: { screen: "Community" },
};

/**
 * Screen-name + param-key map exposed to consumers that want to use React
 * Navigation's linking config directly (see App.tsx). This is the same data
 * as SCREEN_ROUTES but keyed by screen name for reverse lookup.
 */
export function getLinkingConfig() {
  const screens: Record<string, string> = {};
  for (const [urlSegment, route] of Object.entries(SCREEN_ROUTES)) {
    screens[route.screen] = route.paramKey
      ? `${urlSegment}/:${route.paramKey}`
      : urlSegment;
  }
  return screens;
}

export async function handleIncomingLink(
  url: string,
  navigate: (screen: string, params?: any) => void
): Promise<void> {
  const params = parseDeepLink(url);

  if (!params.screen) return;

  // parseDeepLink returns the first path segment as `screen`. If the URL is
  // /route/abc123, params.screen === "route" and params.id === "abc123".
  const route = SCREEN_ROUTES[params.screen];
  if (!route) return;

  const navParams =
    route.paramKey && params.id ? { [route.paramKey]: params.id } : undefined;
  navigate(route.screen, navParams);
}

export function getAppStoreLink(): string {
  if (Platform.OS === "ios") {
    return "https://apps.apple.com/app/haibo-taxi";
  }
  return "https://play.google.com/store/apps/details?id=com.haibo.taxi";
}

export function getSmartLink(path: string, id?: string): string {
  const webDomain = process.env.EXPO_PUBLIC_DOMAIN || "";
  
  if (!webDomain) {
    return createDeepLink(`/${path}${id ? `/${id}` : ""}`);
  }

  const fullPath = id ? `/${path}/${id}` : `/${path}`;
  return `https://${webDomain}${fullPath}`;
}
