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
  
  return {
    screen: parsed.path || undefined,
    ...parsed.queryParams,
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

export async function handleIncomingLink(
  url: string,
  navigate: (screen: string, params?: any) => void
): Promise<void> {
  const params = parseDeepLink(url);
  
  if (!params.screen) return;

  const screenRoutes: Record<string, { screen: string; paramKey?: string }> = {
    route: { screen: "RouteDetail", paramKey: "routeId" },
    location: { screen: "LocationDetails", paramKey: "locationId" },
    reel: { screen: "ReelView", paramKey: "reelId" },
    invite: { screen: "Referral", paramKey: "code" },
    job: { screen: "JobDetails", paramKey: "jobId" },
    event: { screen: "EventDetails", paramKey: "eventId" },
    sos: { screen: "Emergency" },
    home: { screen: "Home" },
    community: { screen: "Community" },
  };

  const route = screenRoutes[params.screen];
  if (route) {
    const navParams = route.paramKey && params.id 
      ? { [route.paramKey]: params.id }
      : undefined;
    navigate(route.screen, navParams);
  }
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
