/**
 * Seed demo events, jobs, and community posts so the public Command Center
 * pages (/events, /jobs, /community) have something to render against a
 * fresh/dev database.
 *
 * Usage:
 *   tsx server/seed-public-fixtures.ts         # skip if fixtures already exist
 *   tsx server/seed-public-fixtures.ts --force # wipe existing fixtures + reseed
 *
 * Idempotency: every row is tagged with FIXTURE_MARKER in a field the real
 * API doesn't filter on (tags/hashtags/postedBy), so re-running doesn't
 * create duplicates and --force only wipes seeded rows, never real content.
 */
import dotenv from "dotenv";
dotenv.config();

import { db, pool } from "./db";
import { events, jobs, reels, users } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

const FIXTURE_MARKER = "haibo:fixture";
const SEED_USER_PHONE = "+27000000099";

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
      email: "fixtures@haibo.co.za",
      displayName: "Haibo Fixtures",
      role: "user",
      isVerified: true,
      referralCode: "HB-FIXTURES",
    })
    .returning();
  return created.id;
}

async function clearFixtures(userId: string) {
  // Events + jobs are tagged via postedBy = seed user.
  // Reels are tagged via userId = seed user.
  await db.delete(events).where(eq(events.postedBy, userId));
  await db.delete(jobs).where(eq(jobs.postedBy, userId));
  await db.delete(reels).where(eq(reels.userId, userId));
}

async function alreadySeeded(userId: string): Promise<boolean> {
  const [existing] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(eq(events.postedBy, userId));
  return (existing?.count ?? 0) > 0;
}

function daysFromNow(days: number, hour = 9, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function seedEvents(userId: string) {
  const rows = [
    {
      title: "Taxi Industry Safety Summit 2026",
      description:
        "Annual gathering of taxi industry stakeholders to discuss safety innovations, regulatory updates, and the future of public transport in South Africa.",
      category: "safety",
      eventDate: daysFromNow(14, 9),
      startTime: "09:00",
      endTime: "17:00",
      location: "Johannesburg",
      venue: "Sandton Convention Centre",
      province: "Gauteng",
      organizer: "Haibo! Africa",
      ticketPrice: 0,
      maxAttendees: 500,
      currentAttendees: 218,
      isFeatured: true,
      tags: [FIXTURE_MARKER],
    },
    {
      title: "Haibo Pay Driver Workshop",
      description:
        "Hands-on workshop teaching drivers how to use Haibo Pay for cashless fare collection. Includes device setup and troubleshooting.",
      category: "training",
      eventDate: daysFromNow(21, 10),
      startTime: "10:00",
      endTime: "14:00",
      location: "Soweto",
      venue: "Bara Taxi Rank",
      province: "Gauteng",
      organizer: "Haibo! Africa",
      ticketPrice: 0,
      maxAttendees: 150,
      currentAttendees: 74,
      tags: [FIXTURE_MARKER],
    },
    {
      title: "Community Safety Walk — Alexandra",
      description:
        "Join the community for a safety awareness walk through Alex's main taxi routes. Meet local drivers and learn about safety features.",
      category: "community",
      eventDate: daysFromNow(27, 7),
      startTime: "07:00",
      endTime: "10:00",
      location: "Alexandra",
      venue: "Pan Africa Mall",
      province: "Gauteng",
      organizer: "Alex Community Forum",
      ticketPrice: 0,
      maxAttendees: 200,
      currentAttendees: 58,
      tags: [FIXTURE_MARKER],
    },
    {
      title: "Fleet Owner Networking Dinner",
      description:
        "Exclusive networking event for fleet owners and association leaders. Discuss fleet management strategies and Haibo Command Center features.",
      category: "meeting",
      eventDate: daysFromNow(35, 18),
      startTime: "18:00",
      endTime: "22:00",
      location: "Sandton",
      venue: "The Maslow Hotel",
      province: "Gauteng",
      organizer: "Haibo! Africa",
      ticketPrice: 350,
      maxAttendees: 100,
      currentAttendees: 42,
      isFeatured: true,
      tags: [FIXTURE_MARKER],
    },
    {
      title: "Taxi Route Mapping Hackathon",
      description:
        "Help map South Africa's informal taxi routes using GPS data. Prizes for the most comprehensive route submissions.",
      category: "community",
      eventDate: daysFromNow(44, 8),
      startTime: "08:00",
      endTime: "20:00",
      location: "Braamfontein",
      venue: "Tshimologong Precinct",
      province: "Gauteng",
      organizer: "Haibo! × Tshimologong",
      ticketPrice: 0,
      maxAttendees: 80,
      currentAttendees: 31,
      tags: [FIXTURE_MARKER],
    },
  ];

  for (const row of rows) {
    await db.insert(events).values({
      ...row,
      postedBy: userId,
      status: "upcoming",
    });
  }
  console.log(`  ✓ Seeded ${rows.length} events`);
}

async function seedJobs(userId: string) {
  const rows = [
    {
      title: "Minibus taxi driver",
      company: "Gauteng Taxi Association",
      description:
        "Experienced driver needed for the Soweto–Sandton route. Valid PDP required. Must have a clean driving record and knowledge of Johannesburg routes.",
      requirements:
        "Valid PDP\n3+ years driving experience\nClean driving record\nKnowledge of JHB routes",
      jobType: "full-time",
      category: "driver",
      location: "Johannesburg",
      province: "Gauteng",
      salary: "R8,000 – R15,000 / month",
      salaryMin: 8000,
      salaryMax: 15000,
      experienceLevel: "intermediate",
      licenseRequired: "PrDP",
      isVerified: true,
    },
    {
      title: "Fleet manager",
      company: "Haibo Technologies",
      description:
        "Manage a fleet of 50+ taxis using the Haibo Command Center. Oversee driver compliance, route optimization, and vehicle maintenance scheduling.",
      requirements:
        "Fleet management experience\nTech-savvy\nLeadership skills\nTransport industry knowledge",
      jobType: "full-time",
      category: "admin",
      location: "Cape Town",
      province: "Western Cape",
      salary: "R25,000 – R35,000 / month",
      salaryMin: 25000,
      salaryMax: 35000,
      experienceLevel: "senior",
      isVerified: true,
      isFeatured: true,
    },
    {
      title: "Rank marshal",
      company: "eThekwini Taxi Council",
      description:
        "Maintain order at the Warwick Junction taxi rank. Manage queues, assist commuters, and ensure safety protocols are followed.",
      requirements:
        "Physical fitness\nCommunication skills\nConflict resolution\nFirst aid certificate",
      jobType: "full-time",
      category: "marshal",
      location: "Durban",
      province: "KwaZulu-Natal",
      salary: "R6,000 – R9,000 / month",
      salaryMin: 6000,
      salaryMax: 9000,
      experienceLevel: "entry",
    },
    {
      title: "Mobile app developer",
      company: "Haibo Technologies",
      description:
        "React Native developer to build and maintain the Haibo! mobile app. Experience with Expo, TypeScript, and real-time features required.",
      requirements:
        "React Native / Expo\nTypeScript\n3+ years mobile dev\nReal-time systems experience",
      jobType: "contract",
      category: "other",
      location: "Remote / Johannesburg",
      province: "Gauteng",
      salary: "R45,000 – R65,000 / month",
      salaryMin: 45000,
      salaryMax: 65000,
      experienceLevel: "senior",
      isVerified: true,
    },
    {
      title: "Community safety officer",
      company: "SANTACO",
      description:
        "Monitor community safety alerts, coordinate with local authorities, and manage the Haibo! safety reporting system for the Pretoria region.",
      requirements:
        "Security background\nCommunity engagement\nReport writing\nSmartphone proficiency",
      jobType: "part-time",
      category: "security",
      location: "Pretoria",
      province: "Gauteng",
      salary: "R5,000 – R7,000 / month",
      salaryMin: 5000,
      salaryMax: 7000,
      experienceLevel: "intermediate",
    },
  ];

  for (const row of rows) {
    await db.insert(jobs).values({
      ...row,
      postedBy: userId,
      status: "active",
    });
  }
  console.log(`  ✓ Seeded ${rows.length} jobs`);
}

async function seedCommunityPosts(userId: string) {
  const rows = [
    {
      userName: "Thabo Mokoena",
      caption:
        "Heads up! N1 South is backed up from Buccleuch to Midrand. Take the R55 instead.",
      hashtags: [FIXTURE_MARKER, "#Haibo", "#JoziTraffic", "#RoadAlert"],
      likeCount: 24,
      commentCount: 8,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      userName: "Nomsa Khumalo",
      caption:
        "Shoutout to driver GP 456-789 for the safe ride from Soweto to Sandton this morning. Always on time!",
      hashtags: [FIXTURE_MARKER, "#HaiboApp", "#SafeRides", "#Shoutout"],
      likeCount: 45,
      commentCount: 12,
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    },
    {
      userName: "Sipho Dlamini",
      caption:
        "Lost my backpack in a taxi from Park Station to Alex. Black JanSport with a laptop inside. Please help!",
      hashtags: [FIXTURE_MARKER, "#haiboafrica", "#LostAndFound"],
      likeCount: 18,
      commentCount: 31,
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    },
    {
      userName: "Lerato Phiri",
      caption:
        "The new Haibo Pay feature is a game changer! No more scrambling for change. Just tap and go.",
      hashtags: [FIXTURE_MARKER, "#Haibo", "#CashlessTaxi"],
      likeCount: 67,
      commentCount: 15,
      createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    },
    {
      userName: "Mandla Zulu",
      caption:
        "Road closure on M2 highway due to construction. Expect delays near Kaserne interchange. Plan alternative routes.",
      hashtags: [FIXTURE_MARKER, "#haiboafrica", "#RoadAlert", "#Closure"],
      likeCount: 33,
      commentCount: 9,
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    },
    {
      userName: "Ayanda Ndlovu",
      caption:
        "Looking for a reliable school run driver from Diepkloof to Braamfontein. Mon–Fri, 6:30am. DM me!",
      hashtags: [FIXTURE_MARKER, "#Haiboapp", "#SchoolRun"],
      likeCount: 12,
      commentCount: 22,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  ];

  for (const row of rows) {
    await db.insert(reels).values({
      userId,
      userName: row.userName,
      contentType: "text",
      mediaUrl: "",
      caption: row.caption,
      hashtags: row.hashtags,
      category: "community",
      likeCount: row.likeCount,
      commentCount: row.commentCount,
      status: "published",
      createdAt: row.createdAt,
      publishedAt: row.publishedAt,
    });
  }
  console.log(`  ✓ Seeded ${rows.length} community posts`);
}

async function main() {
  const force = process.argv.includes("--force");
  const seedUserId = await ensureSeedUser();

  if (await alreadySeeded(seedUserId)) {
    if (!force) {
      console.log(
        "Public fixtures already exist. Use --force to wipe and reseed."
      );
      await pool.end();
      return;
    }
    console.log("Wiping existing fixtures…");
    await clearFixtures(seedUserId);
  }

  console.log("Seeding public fixtures…");
  await seedEvents(seedUserId);
  await seedJobs(seedUserId);
  await seedCommunityPosts(seedUserId);
  console.log("\nDone. Visit /events, /jobs, /community to verify.");

  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
