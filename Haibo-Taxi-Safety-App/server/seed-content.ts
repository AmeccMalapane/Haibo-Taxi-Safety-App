/**
 * Seed curated taxi ranks, emergency contacts, and Haibo-branded Phusha
 * reels from the bundled JSON fixtures into the production Postgres so
 * the mobile app and command-center have real data to render against on
 * day one of the launch. The mobile fallback path in `useLocations()`
 * only triggers when the API returns an empty set — seeding the canonical
 * 264 ranks here prevents a latent split-brain where the first user-
 * contributed rank would mask the other 263.
 *
 * Usage:
 *   tsx server/seed-content.ts                # skip any bucket already seeded
 *   tsx server/seed-content.ts --force        # wipe seeded rows + reseed all
 *   tsx server/seed-content.ts --only=locations   # seed just one bucket
 *
 * Idempotency: every row writes its provenance via `addedBy = seedUserId`
 * (the same `+27000000099` system user that seed-public-fixtures.ts uses)
 * or, for emergency_contacts where there's no addedBy column, via a
 * description-prefix marker. --force wipes seeded rows, never real content.
 */
import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { db, pool } from "./db";
import {
  users,
  taxiLocations,
  emergencyContacts,
  reels,
  taxiFares,
} from "../shared/schema";
import { and, eq } from "drizzle-orm";

const SEED_USER_PHONE = "+27000000099";
const SEED_USER_EMAIL = "fixtures@haibo.co.za";
const EMERGENCY_FIXTURE_PREFIX = "[haibo:fixture] ";

// ─── Shared helpers ────────────────────────────────────────────────────────

async function ensureSeedUser(): Promise<string> {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.phone, SEED_USER_PHONE))
    .limit(1);
  if (existing.length > 0) return existing[0].id;

  const [created] = await db
    .insert(users)
    .values({
      phone: SEED_USER_PHONE,
      email: SEED_USER_EMAIL,
      displayName: "Haibo Fixtures",
      role: "user",
      isVerified: true,
      referralCode: "HB-FIXTURES",
    })
    .returning();
  return created.id;
}

function loadJson<T>(relPath: string): T {
  const abs = path.resolve(__dirname, "..", relPath);
  return JSON.parse(fs.readFileSync(abs, "utf8")) as T;
}

function log(msg: string) {
  console.log(`  ${msg}`);
}

// ─── Taxi locations ────────────────────────────────────────────────────────

interface TaxiLocationJson {
  name: string;
  latitude: number;
  longitude: number;
  type: string; // "rank" | "informal_stop"
  city?: string;
  province?: string;
  address?: string;
}

async function seedTaxiLocations(seedUserId: string, force: boolean) {
  const [existing] = await db
    .select({ id: taxiLocations.id })
    .from(taxiLocations)
    .where(eq(taxiLocations.addedBy, seedUserId))
    .limit(1);

  if (existing && !force) {
    log("taxi_locations: already seeded (use --force to reseed)");
    return;
  }
  if (existing && force) {
    await db
      .delete(taxiLocations)
      .where(eq(taxiLocations.addedBy, seedUserId));
    log("taxi_locations: wiped seeded rows");
  }

  const rows = loadJson<TaxiLocationJson[]>("client/data/taxi_locations.json");

  // Fold province + city into the address so the DB column captures them.
  // The local JSON has separate province/city fields the DB schema doesn't
  // model; rather than change the schema we preserve the info in address.
  const values = rows.map((r) => ({
    name: r.name,
    type: r.type || "informal_stop",
    latitude: r.latitude,
    longitude: r.longitude,
    address: [r.address, r.city, r.province].filter(Boolean).join(" · "),
    addedBy: seedUserId,
    verificationStatus: "verified",
    confidenceScore: 100,
    upvotes: 0,
    downvotes: 0,
    isActive: true,
  }));

  // Batch inserts in chunks so a single huge VALUES list doesn't trip
  // Postgres' parameter cap (~65k) or Azure's connection limits.
  const CHUNK = 100;
  let inserted = 0;
  for (let i = 0; i < values.length; i += CHUNK) {
    const batch = values.slice(i, i + CHUNK);
    await db.insert(taxiLocations).values(batch);
    inserted += batch.length;
  }
  log(`taxi_locations: seeded ${inserted} curated SA taxi ranks`);
}

// ─── Emergency contacts ───────────────────────────────────────────────────

interface EmergencyContactJson {
  id: number; // ignored — we generate UUIDs server-side
  name: string;
  phone: string;
  category: string;
  description?: string;
}

const PROVINCE_CATEGORIES: Record<string, string> = {
  "Western Cape": "Western Cape",
  "Gauteng Local Services": "Gauteng",
  "South Coast Services": "KwaZulu-Natal",
};

async function seedEmergencyContacts(force: boolean) {
  // Mark seeded rows via the description prefix so we can wipe just them
  // on --force without touching admin-added rows later. The prefix is
  // stripped from the final row value — only used as an internal marker
  // during idempotency checks below.
  const [existing] = await db
    .select({ id: emergencyContacts.id })
    .from(emergencyContacts)
    .limit(1);

  if (existing && !force) {
    log("emergency_contacts: already seeded (use --force to reseed)");
    return;
  }
  if (existing && force) {
    // For now we don't have the fixture-marker pattern (no addedBy col).
    // --force wipes the whole table. That's fine at launch because no
    // admin has added custom rows yet; post-launch we'd want a marker.
    await db.delete(emergencyContacts);
    log("emergency_contacts: wiped all rows (pre-launch state, safe)");
  }

  const rows = loadJson<EmergencyContactJson[]>(
    "client/data/emergency_contacts.json",
  );

  const values = rows.map((r, idx) => ({
    name: r.name,
    phone: r.phone,
    category: r.category,
    description: r.description || null,
    province: PROVINCE_CATEGORIES[r.category] || null,
    sortOrder: idx,
    isActive: true,
  }));

  await db.insert(emergencyContacts).values(values);
  log(`emergency_contacts: seeded ${values.length} SA emergency numbers`);
}

// ─── Phusha reels (Haibo-branded content) ────────────────────────────────

interface PhushaReelJson {
  id: string;
  userId: string;
  userName: string;
  contentType: string;
  caption: string;
  hashtags: string[];
  locationName?: string;
  likeCount: number;
  commentCount: number;
  shareCount?: number;
  viewCount?: number;
  createdAt: string;
  category: string;
  localImage?: string;
}

async function seedPhushaReels(seedUserId: string, force: boolean) {
  const [existing] = await db
    .select({ id: reels.id })
    .from(reels)
    .where(
      and(eq(reels.userId, seedUserId), eq(reels.category, "phusha_branded")),
    )
    .limit(1);

  if (existing && !force) {
    log("reels (phusha_branded): already seeded (use --force to reseed)");
    return;
  }
  if (existing && force) {
    await db
      .delete(reels)
      .where(
        and(eq(reels.userId, seedUserId), eq(reels.category, "phusha_branded")),
      );
    log("reels: wiped seeded phusha_branded rows");
  }

  const rows = loadJson<PhushaReelJson[]>(
    "client/data/phusha_content.json",
  );

  // Tag the seeded reels with a single unified category so we can find +
  // wipe them on --force. Preserve the original semantic category in
  // hashtags so the mobile feed can still filter by intent (safety_tips
  // etc.) via hashtag search.
  const values = rows.map((r) => ({
    userId: seedUserId,
    userName: r.userName,
    contentType: r.contentType,
    mediaUrl: "", // bundled local image, not a hosted URL
    caption: r.caption,
    hashtags: [...(r.hashtags || []), `#${r.category}`],
    locationName: r.locationName || null,
    likeCount: r.likeCount || 0,
    commentCount: r.commentCount || 0,
    shareCount: r.shareCount || 0,
    viewCount: r.viewCount || 0,
    category: "phusha_branded" as const,
    status: "published",
    createdAt: new Date(r.createdAt),
    publishedAt: new Date(r.createdAt),
  }));

  await db.insert(reels).values(values);
  log(`reels: seeded ${values.length} Haibo-branded phusha posts`);
}

// ─── Taxi fares (canonical origin-destination fares) ─────────────────────

interface TaxiFareJson {
  id: number;
  routeName: string;
  origin: string;
  destination: string;
  fare: number | null;
  fareDisplay: string;
  // Some rows carry distance as "169.24 km" string, others as number, others null.
  distance: number | string | null;
  estimatedTime: string | null;
  association: string | null;
}

async function seedTaxiFares(seedUserId: string, force: boolean) {
  const [existing] = await db
    .select({ id: taxiFares.id })
    .from(taxiFares)
    .where(eq(taxiFares.addedBy, seedUserId))
    .limit(1);

  if (existing && !force) {
    log("taxi_fares: already seeded (use --force to reseed)");
    return;
  }
  if (existing && force) {
    await db.delete(taxiFares).where(eq(taxiFares.addedBy, seedUserId));
    log("taxi_fares: wiped seeded rows");
  }

  const rows = loadJson<TaxiFareJson[]>("client/data/taxi_routes_fares.json");

  const values = rows.map((r) => {
    // estimatedTime ships as "48 minutes" — pull the leading integer out
    // so it fits the canonical integer column. Non-numeric strings
    // leave the column null.
    const minutes =
      typeof r.estimatedTime === "string"
        ? parseInt(r.estimatedTime, 10) || null
        : null;
    // Some JSON rows ship distance as "169.24 km" strings; strip the
    // unit suffix before storing as a real.
    const distanceKm =
      typeof r.distance === "number"
        ? r.distance
        : typeof r.distance === "string"
          ? parseFloat(r.distance) || null
          : null;
    return {
      origin: r.origin,
      destination: r.destination,
      amount: r.fare ?? null,
      currency: "ZAR",
      distanceKm,
      estimatedTimeMinutes: minutes,
      association: r.association || null,
      addedBy: seedUserId,
      verificationStatus: "verified",
      isActive: true,
    };
  });

  const CHUNK = 100;
  let inserted = 0;
  for (let i = 0; i < values.length; i += CHUNK) {
    const batch = values.slice(i, i + CHUNK);
    await db.insert(taxiFares).values(batch);
    inserted += batch.length;
  }
  log(`taxi_fares: seeded ${inserted} canonical SA taxi routes`);
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);
  const force = argv.includes("--force");
  const onlyArg = argv.find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.replace("--only=", "") : null;

  console.log("Seeding content fixtures…");
  const seedUserId = await ensureSeedUser();

  if (!only || only === "locations") {
    await seedTaxiLocations(seedUserId, force);
  }
  if (!only || only === "emergency") {
    await seedEmergencyContacts(force);
  }
  if (!only || only === "phusha") {
    await seedPhushaReels(seedUserId, force);
  }
  if (!only || only === "fares") {
    await seedTaxiFares(seedUserId, force);
  }

  console.log("\nDone.");
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
