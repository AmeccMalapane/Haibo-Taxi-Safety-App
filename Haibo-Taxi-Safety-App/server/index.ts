import dotenv from "dotenv";
dotenv.config();

import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import { pool } from "./db";
import { apiRateLimit } from "./middleware/rateLimit";
import { initFirebase } from "./services/firebase";
import { initRealtime } from "./services/realtime";

// Import routes
import authRoutes from "./routes/auth";
import taxiRoutes from "./routes/taxis";
import driverRoutes from "./routes/drivers";
import locationRoutes from "./routes/locations";
import communityRoutes from "./routes/community";
import eventRoutes from "./routes/events";
import walletRoutes from "./routes/wallet";
import deliveryRoutes from "./routes/deliveries";
import rideRoutes from "./routes/rides";
import miscRoutes from "./routes/misc";
import adminRoutes from "./routes/admin";
import notificationRoutes from "./routes/notifications";
import paystackRoutes from "./routes/paystack";

const app = express();
const PORT = parseInt(process.env.PORT || "8080", 10);

// --- Global Middleware ---
app.use(helmet({ contentSecurityPolicy: false }));

const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : isProduction
    ? []
    : ["http://localhost:8081", "http://localhost:19006"];

app.use(cors({
  origin: (origin, callback) => {
    // No-origin requests are mobile apps / native clients / curl — always allow.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    if (isProduction) {
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    }
    // Development: permissive so Expo web / LAN debugging works.
    return callback(null, true);
  },
  credentials: true,
}));

app.use(compression());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Apply global rate limit to all /api routes
app.use("/api", apiRateLimit);

// --- Health checks (no rate limit) ---
app.get("/", (req, res) => {
  res.json({
    name: "Haibo Taxi Safety API",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", async (req, res) => {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    res.json({ status: "healthy", database: "connected", timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(503).json({ status: "unhealthy", database: "disconnected", error: error.message });
  }
});

// --- API Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/taxis", taxiRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/deliveries", deliveryRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api", miscRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/paystack", paystackRoutes);

// --- 404 handler ---
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found", path: req.path });
});

// --- Global error handler ---
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// --- Graceful shutdown ---
process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  await pool.end();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received. Shutting down gracefully...");
  await pool.end();
  process.exit(0);
});

// --- Initialize Firebase for push notifications ---
initFirebase();

// --- Create HTTP server + Socket.IO ---
const httpServer = http.createServer(app);
const io = initRealtime(httpServer);

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Haibo API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`WebSocket: Socket.IO active on /socket.io`);
  if (!process.env.JWT_SECRET) {
    console.warn("WARNING: JWT_SECRET not set. Using insecure fallback.");
  }
  if (!process.env.DATABASE_URL) {
    console.warn("WARNING: DATABASE_URL not set.");
  }
});

export default app;
