import express from "express";
import cors from "cors";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../shared/schema";
import { driverRoutes } from "./routes/driver";
import { communityRoutes } from "./routes/community";
import { eventRoutes } from "./routes/events";
import { walletRoutes } from "./routes/wallet";
import { locationRoutes } from "./routes/locations";
import { groupRideRoutes } from "./routes/groupRides";
import { jobRoutes } from "./routes/jobs";
import { authRoutes } from "./routes/auth";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), version: "1.0.0" });
});

// Routes
app.use("/api/auth", authRoutes(db));
app.use("/api/driver", driverRoutes(db));
app.use("/api/community", communityRoutes(db));
app.use("/api/events", eventRoutes(db));
app.use("/api/wallet", walletRoutes(db));
app.use("/api/locations", locationRoutes(db));
app.use("/api/group-rides", groupRideRoutes(db));
app.use("/api/jobs", jobRoutes(db));

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

app.listen(PORT, () => {
  console.log(`Haibo API server running on port ${PORT}`);
});

export default app;
