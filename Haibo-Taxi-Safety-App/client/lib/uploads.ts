import { Platform } from "react-native";
import { getApiUrl } from "@/lib/query-client";
import { getCurrentToken } from "@/contexts/AuthContext";

// Thin client for /api/uploads/*. Takes an expo-image-picker file URI
// (file://... on native, blob://... on web), wraps it in FormData, and
// POSTs to the server. Returns the public URL that downstream writes
// (vendor_profile.businessImageUrl, reels.mediaUrl, events.imageUrl)
// should store.
//
// Handles two URL shapes from the server:
//   - Azure Blob:     https://<acct>.blob.core.windows.net/<...>
//   - Local dev disk: /uploads/<...> — absolute-path-relative to the
//                     API host. We rewrite these to full URLs using
//                     getApiUrl() so the mobile client can render them
//                     with <Image source={{ uri }}>.

export type UploadFolder =
  | "vendor-photos"
  | "reels"
  | "events"
  | "lost-found"
  | "drivers"
  | "profiles"
  | "locations"
  | "ratings";

export interface UploadedFile {
  url: string;
  key: string;
  size: number;
  contentType: string;
}

interface UploadOptions {
  folder?: UploadFolder;
  /** "image" (default) or "video" — picks the matching server endpoint */
  kind?: "image" | "video";
  /** Optional filename override; otherwise inferred from the URI. */
  name?: string;
}

/**
 * Upload a file from a local URI to /api/uploads/image (or /video).
 * @throws Error on network / server rejection.
 */
export async function uploadFromUri(
  uri: string,
  opts: UploadOptions = {}
): Promise<UploadedFile> {
  const baseUrl = getApiUrl();
  if (!baseUrl) {
    throw new Error("API is not configured. Please set EXPO_PUBLIC_DOMAIN.");
  }

  const kind = opts.kind || "image";
  const endpoint = kind === "video" ? "api/uploads/video" : "api/uploads/image";

  // Infer MIME type + name from the URI. expo-image-picker URIs look
  // like file:///.../IMG_1234.HEIC on iOS or content://media/... on
  // Android — the extension isn't always reliable, so we fall back to
  // image/jpeg which is what expo-image-picker re-encodes to when
  // `quality < 1`.
  const guessedName = opts.name || uri.split("/").pop()?.split("?")[0] || "upload";
  const ext = guessedName.includes(".") ? guessedName.split(".").pop()?.toLowerCase() : "";
  const inferredType =
    kind === "video"
      ? ext === "mov"
        ? "video/quicktime"
        : ext === "webm"
          ? "video/webm"
          : "video/mp4"
      : ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : "image/jpeg";

  const form = new FormData();
  // React Native's FormData accepts {uri, name, type} as a file part —
  // this is NOT standard web FormData but is the documented RN pattern.
  // Cast to any so the TS DOM lib doesn't reject it.
  form.append("file", {
    uri: Platform.OS === "android" ? uri : uri.replace("file://", ""),
    name: guessedName,
    type: inferredType,
  } as any);

  const qs = opts.folder ? `?folder=${encodeURIComponent(opts.folder)}` : "";
  const url = new URL(`${endpoint}${qs}`, baseUrl);

  const token = getCurrentToken();
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // NOTE: deliberately NOT setting Content-Type. React Native's
      // fetch will add the correct multipart boundary automatically,
      // and manually setting it strips the boundary and breaks multer.
    },
    body: form as any,
  });

  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  // Local-dev URLs come back as "/uploads/xxx" — rewrite to an absolute
  // URL against the API host so <Image> can render them.
  const resolvedUrl =
    data.url && data.url.startsWith("/")
      ? new URL(data.url, baseUrl).toString()
      : data.url;

  return {
    url: resolvedUrl,
    key: data.key,
    size: data.size,
    contentType: data.contentType,
  };
}
