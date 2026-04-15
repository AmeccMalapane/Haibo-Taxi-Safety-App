import { Router, Response } from "express";
import multer from "multer";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { uploadBuffer } from "../services/storage";

const router = Router();

// Allowed MIME types per upload category. Locked to images for now;
// video uploads go through a separate endpoint if/when reels need
// them (video has different size + encoding considerations).
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

// Multer memory storage — we hand the buffer straight to the storage
// service (Azure SDK or local fs.writeFile) instead of multer writing
// to disk first. Single-file upload, 10 MB cap for images / 50 MB for
// video. Enforced at multer level so oversized requests never touch
// our handler code.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      cb(new Error("Unsupported image type. Use JPEG, PNG, or WebP."));
      return;
    }
    cb(null, true);
  },
});

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_VIDEO_TYPES.has(file.mimetype)) {
      cb(new Error("Unsupported video type. Use MP4, MOV, or WebM."));
      return;
    }
    cb(null, true);
  },
});

// POST /api/uploads/image — single-image upload. Returns { url } that
// the client stores in its form state and sends back in the next write
// (e.g. vendor_profile.businessImageUrl, reels.mediaUrl, events.imageUrl).
// ?folder= query lets callers slot uploads into semantic subdirs
// (vendor-photos/, reels/, events/, lost-found/) without needing
// separate endpoints per surface.
router.post(
  "/image",
  authMiddleware,
  imageUpload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const folder = (req.query.folder as string) || "";
      // Allowlist of folder names — prevents a caller slipping a
      // path-traversal segment through the query string.
      const allowedFolders = new Set([
        "",
        "vendor-photos",
        "reels",
        "events",
        "lost-found",
        "drivers",
        "profiles",
        "locations",
      ]);
      if (!allowedFolders.has(folder)) {
        res.status(400).json({ error: "Invalid folder" });
        return;
      }

      const result = await uploadBuffer(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        folder
      );

      res.status(201).json({
        url: result.url,
        key: result.key,
        size: result.size,
        contentType: result.contentType,
      });
    } catch (error: any) {
      console.error("Upload image error:", error);
      res.status(500).json({ error: error.message || "Upload failed" });
    }
  }
);

// POST /api/uploads/video — for reels. Separate endpoint so the image
// route can stay at 10 MB and video can get 50 MB without one leaking
// into the other.
router.post(
  "/video",
  authMiddleware,
  videoUpload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const folder = (req.query.folder as string) || "reels";
      if (folder !== "reels") {
        res.status(400).json({ error: "Invalid folder" });
        return;
      }

      const result = await uploadBuffer(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        folder
      );

      res.status(201).json({
        url: result.url,
        key: result.key,
        size: result.size,
        contentType: result.contentType,
      });
    } catch (error: any) {
      console.error("Upload video error:", error);
      res.status(500).json({ error: error.message || "Upload failed" });
    }
  }
);

// Multer errors surface as `err.code === 'LIMIT_FILE_SIZE'` etc. Convert
// them to the standard JSON error shape so clients don't get an HTML
// Express error page.
router.use((err: any, _req: any, res: Response, _next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "File too large" });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }
  if (err) {
    res.status(400).json({ error: err.message || "Upload error" });
    return;
  }
  res.status(500).json({ error: "Unknown upload error" });
});

export default router;
