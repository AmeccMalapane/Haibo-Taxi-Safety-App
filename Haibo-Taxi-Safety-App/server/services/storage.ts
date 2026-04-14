import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { BlobServiceClient, BlockBlobClient } from "@azure/storage-blob";

// Storage abstraction: Azure Blob Storage in production, local disk in
// dev. Switches automatically on the presence of AZURE_STORAGE_CONNECTION_STRING.
//
// Contract: uploadImage(buffer, originalName, contentType) → publicUrl.
// The returned URL is:
//   - Azure: https://<account>.blob.core.windows.net/<container>/<key>
//   - Local: ${PUBLIC_API_BASE_URL | API host}/uploads/<key>
//
// Container / local dir is lazily provisioned on first upload so the
// server doesn't refuse to boot when upload isn't configured yet.

const AZURE_CONN = process.env.AZURE_STORAGE_CONNECTION_STRING;
const AZURE_CONTAINER = process.env.AZURE_STORAGE_CONTAINER || "haibo-uploads";

// Local fallback directory — relative to the server cwd, NOT the project
// root. Served by express.static in server/index.ts.
const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "uploads");
const LOCAL_URL_PREFIX = "/uploads";

let azureClient: BlobServiceClient | null = null;
let azureContainerEnsured = false;
let localDirEnsured = false;

function useAzure(): boolean {
  return !!AZURE_CONN;
}

function getAzureClient(): BlobServiceClient {
  if (!azureClient) {
    azureClient = BlobServiceClient.fromConnectionString(AZURE_CONN!);
  }
  return azureClient;
}

async function ensureAzureContainer(): Promise<void> {
  if (azureContainerEnsured) return;
  const client = getAzureClient();
  const container = client.getContainerClient(AZURE_CONTAINER);
  // "blob" = public read on individual blobs, private list. Lets us
  // serve public image URLs without SAS tokens while still preventing
  // enumeration.
  await container.createIfNotExists({ access: "blob" });
  azureContainerEnsured = true;
}

async function ensureLocalDir(): Promise<void> {
  if (localDirEnsured) return;
  await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  localDirEnsured = true;
}

function randomKey(originalName: string): string {
  // <timestamp>-<random>-<sanitized-name> keeps filenames uniquely
  // identifiable in the blob container while preserving a readable
  // suffix for debugging. Strip anything that isn't a-zA-Z0-9_.- from
  // the original name so blob keys can't be poisoned with path segments.
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(6).toString("hex");
  const safeName = (originalName || "file")
    .replace(/[^a-zA-Z0-9_.-]/g, "_")
    .slice(-40);
  return `${ts}-${rand}-${safeName}`;
}

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  contentType: string;
}

/**
 * Upload a buffer to the configured storage backend.
 * @param buffer - raw file bytes
 * @param originalName - client-provided filename (for key generation)
 * @param contentType - MIME type from multer / fallback to application/octet-stream
 * @param folder - optional subfolder (e.g. "vendor-photos", "reels")
 */
export async function uploadBuffer(
  buffer: Buffer,
  originalName: string,
  contentType: string,
  folder: string = ""
): Promise<UploadResult> {
  const key = folder ? `${folder}/${randomKey(originalName)}` : randomKey(originalName);

  if (useAzure()) {
    await ensureAzureContainer();
    const client = getAzureClient();
    const container = client.getContainerClient(AZURE_CONTAINER);
    const blockBlob: BlockBlobClient = container.getBlockBlobClient(key);
    await blockBlob.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: contentType,
        // 1-year cache; if we need to invalidate we'll rename the key.
        blobCacheControl: "public, max-age=31536000, immutable",
      },
    });
    return {
      url: blockBlob.url,
      key,
      size: buffer.length,
      contentType,
    };
  }

  // Local fallback
  await ensureLocalDir();
  const subdir = folder ? path.join(LOCAL_UPLOAD_DIR, folder) : LOCAL_UPLOAD_DIR;
  if (folder) await fs.mkdir(subdir, { recursive: true });
  const filePath = path.join(subdir, path.basename(key));
  await fs.writeFile(filePath, buffer);

  // Return URL relative to the host — client reads getApiUrl() and
  // prepends it. This avoids pinning to a hostname the server doesn't
  // know at boot.
  const url = `${LOCAL_URL_PREFIX}/${key}`;
  return { url, key, size: buffer.length, contentType };
}

export function getLocalUploadDir(): string {
  return LOCAL_UPLOAD_DIR;
}

export function getLocalUrlPrefix(): string {
  return LOCAL_URL_PREFIX;
}

export function isAzureConfigured(): boolean {
  return useAzure();
}
