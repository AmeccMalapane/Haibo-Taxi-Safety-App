import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, real, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  phone: text("phone").notNull().unique(),
  email: text("email").unique(),
  password: text("password"), // bcrypt hashed
  role: text("role").default("commuter"), // commuter, driver, owner, vendor, association, admin
  displayName: text("display_name"),
  // Public handle — shown as the author label on reels, comments, ratings
  // etc. Must be unique + lowercase + 3–20 chars, but stored nullable so
  // existing accounts keep working during the rollout. Fallback chain in
  // serverUserLabel() is handle → displayName → "user". NEVER expose phone
  // as a display label; that's a POPIA leak (identified in pre-launch audit).
  handle: text("handle").unique(),
  avatarType: text("avatar_type").default("commuter"),
  // Profile photo — uploaded via /api/uploads/image?folder=profiles
  // and stored as the returned public URL. Nullable; clients fall
  // back to avatarType-based illustrated avatars when unset.
  avatarUrl: text("avatar_url"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  homeAddress: text("home_address"),
  isVerified: boolean("is_verified").default(false),
  referralCode: text("referral_code").unique(),
  referredBy: text("referred_by"),
  referralCount: integer("referral_count").default(0),
  walletBalance: real("wallet_balance").default(0),
  // Driver-specific sub-balance: money the driver has earned from fares
  // and Hub deliveries that belongs to their linked owner. Driver can see
  // it; withdrawing settles it to the owner's bank (via withdrawal_requests
  // with balanceType='fare' and routeToUserId=ownerId). Non-driver roles
  // leave this at 0 — they only use walletBalance. Tips live here too for
  // MVP (all pooled); phase 2 will split out a tipBalance column.
  fareBalance: real("fare_balance").default(0),
  fcmToken: text("fcm_token"), // Firebase Cloud Messaging token for push notifications
  // Suspension state — when isSuspended is true, authMiddleware blocks
  // all authed API access with 403 until an admin restores the account.
  // Sticky + immutable audit fields so we can answer "who suspended who,
  // when, and why" from the users table alone.
  isSuspended: boolean("is_suspended").default(false),
  suspendedAt: timestamp("suspended_at"),
  suspendedBy: varchar("suspended_by"),
  suspensionReason: text("suspension_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
});

export const otpCodes = pgTable("otp_codes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  phone: text("phone").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false),
  attempts: integer("attempts").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  phone: true,
  displayName: true,
  avatarType: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type OtpCode = typeof otpCodes.$inferSelect;

// ============================================
// USER ROLES
// ============================================
// - commuter (default): Regular app users — rides, pays, sends packages
// - driver: Taxi drivers — collect fares into fareBalance, settle to owner
// - owner: Taxi owners — receive driver settlements, manage fleet
// - vendor: Merchants accepting Haibo Pay — revenue to own wallet/bank
// - association: Taxi association reps (legacy — kept for compat)
// - admin: Platform administrators — manage Hub, platform-fee treasury
//
// Payment routing summary:
//   commuter/owner/vendor → withdraw walletBalance → own bank
//   driver                → withdraw fareBalance → owner's bank (via linkage)
// If driver and owner are the same user (solo operator), both route to
// the same bank and UI consolidates to a single "Withdraw" CTA.
// ============================================

// ============================================
// TAXIS - Vehicle registration and management
// ============================================
export const taxis = pgTable("taxis", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").notNull(), // References users.id
  associationId: varchar("association_id"), // References associations.id
  plateNumber: text("plate_number").notNull().unique(),
  make: text("make").notNull(), // e.g., "Toyota"
  model: text("model").notNull(), // e.g., "Quantum"
  year: integer("year"),
  color: text("color"),
  seatingCapacity: integer("seating_capacity").default(15),
  status: text("status").default("active"), // active, suspended, retired, maintenance
  insuranceNumber: text("insurance_number"),
  insuranceExpiry: timestamp("insurance_expiry"),
  registrationNumber: text("registration_number"),
  registrationExpiry: timestamp("registration_expiry"),
  operatingPermitNumber: text("operating_permit_number"),
  operatingPermitExpiry: timestamp("operating_permit_expiry"),
  primaryRoute: text("primary_route"),
  safetyRating: real("safety_rating").default(5),
  totalRatings: integer("total_ratings").default(0),
  totalTrips: integer("total_trips").default(0),
  isVerified: boolean("is_verified").default(false),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTaxiSchema = createInsertSchema(taxis).omit({
  id: true,
  safetyRating: true,
  totalRatings: true,
  totalTrips: true,
  isVerified: true,
  verifiedAt: true,
  verifiedBy: true,
  createdAt: true,
  updatedAt: true,
});

export type Taxi = typeof taxis.$inferSelect;
export type InsertTaxi = z.infer<typeof insertTaxiSchema>;

// ============================================
// ASSOCIATIONS - Taxi associations/unions
// ============================================
export const associations = pgTable("associations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  registrationNumber: text("registration_number").unique(),
  region: text("region").notNull(),
  province: text("province"),
  address: text("address"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  chairpersonName: text("chairperson_name"),
  chairpersonPhone: text("chairperson_phone"),
  memberCount: integer("member_count").default(0),
  taxiCount: integer("taxi_count").default(0),
  status: text("status").default("active"), // active, suspended, dissolved
  logoUrl: text("logo_url"),
  description: text("description"),
  operatingRoutes: jsonb("operating_routes").$type<string[]>(),
  isVerified: boolean("is_verified").default(false),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAssociationSchema = createInsertSchema(associations).omit({
  id: true,
  memberCount: true,
  taxiCount: true,
  isVerified: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type Association = typeof associations.$inferSelect;
export type InsertAssociation = z.infer<typeof insertAssociationSchema>;

// ============================================
// COMPLAINTS - User complaints about taxis/drivers
// ============================================
export const complaints = pgTable("complaints", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // Complainant
  taxiPlateNumber: text("taxi_plate_number"),
  taxiId: varchar("taxi_id"), // References taxis.id if known
  driverId: varchar("driver_id"), // References users.id if driver is registered
  category: text("category").notNull(), // reckless_driving, overcharging, harassment, vehicle_condition, overcrowding, rude_behavior, safety_violation, other
  severity: text("severity").default("medium"), // low, medium, high, critical
  description: text("description").notNull(),
  incidentDate: timestamp("incident_date"),
  incidentLocation: text("incident_location"),
  incidentLatitude: real("incident_latitude"),
  incidentLongitude: real("incident_longitude"),
  routeName: text("route_name"),
  evidence: jsonb("evidence").$type<{ type: string; url: string; description?: string }[]>(),
  status: text("status").default("pending"), // pending, under_review, resolved, dismissed, escalated
  resolution: text("resolution"),
  resolvedBy: varchar("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  assignedTo: varchar("assigned_to"), // Association or admin handling the complaint
  internalNotes: text("internal_notes"),
  isAnonymous: boolean("is_anonymous").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertComplaintSchema = createInsertSchema(complaints).omit({
  id: true,
  status: true,
  resolution: true,
  resolvedBy: true,
  resolvedAt: true,
  assignedTo: true,
  internalNotes: true,
  createdAt: true,
  updatedAt: true,
});

export type Complaint = typeof complaints.$inferSelect;
export type InsertComplaint = z.infer<typeof insertComplaintSchema>;

// ============================================
// NOTIFICATIONS - Push notification records
// ============================================
export const notifications = pgTable("notifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(), // sos, delivery, ride, payment, system, complaint_update
  title: text("title").notNull(),
  body: text("body").notNull(),
  data: jsonb("data").$type<Record<string, any>>(),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Notification = typeof notifications.$inferSelect;

export const taxiLocations = pgTable("taxi_locations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull().default("informal_stop"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  address: text("address"),
  description: text("description"),
  capacity: integer("capacity"),
  opensAt: text("opens_at"),
  closesAt: text("closes_at"),
  operatingDays: jsonb("operating_days").$type<string[]>(),
  addedBy: varchar("added_by"),
  addedDate: timestamp("added_date").defaultNow(),
  verificationStatus: text("verification_status").default("pending"),
  confidenceScore: integer("confidence_score").default(50),
  upvotes: integer("upvotes").default(0),
  downvotes: integer("downvotes").default(0),
  isActive: boolean("is_active").default(true),
  routes: jsonb("routes").$type<string[]>(),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const locationImages = pgTable("location_images", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  locationId: varchar("location_id").notNull(),
  url: text("url").notNull(),
  caption: text("caption"),
  imageType: text("image_type").default("general"),
  uploadedBy: varchar("uploaded_by"),
  uploadedDate: timestamp("uploaded_date").defaultNow(),
  verified: boolean("verified").default(false),
});

export const handSignals = pgTable("hand_signals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  locationId: varchar("location_id"),
  destination: text("destination").notNull(),
  signal: text("signal").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  region: text("region"),
});

export const locationVotes = pgTable("location_votes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  locationId: varchar("location_id").notNull(),
  userId: varchar("user_id").notNull(),
  voteType: text("vote_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const locationReviews = pgTable("location_reviews", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  locationId: varchar("location_id").notNull(),
  deviceId: varchar("device_id").notNull(),
  userName: text("user_name").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTaxiLocationSchema = createInsertSchema(taxiLocations).omit({
  id: true,
  addedDate: true,
  lastUpdated: true,
  confidenceScore: true,
  upvotes: true,
  downvotes: true,
});

export const insertLocationImageSchema = createInsertSchema(locationImages).omit({
  id: true,
  uploadedDate: true,
});

export const insertHandSignalSchema = createInsertSchema(handSignals).omit({
  id: true,
});

export type TaxiLocation = typeof taxiLocations.$inferSelect;
export type InsertTaxiLocation = z.infer<typeof insertTaxiLocationSchema>;
export type LocationImage = typeof locationImages.$inferSelect;
export type InsertLocationImage = z.infer<typeof insertLocationImageSchema>;
export type HandSignal = typeof handSignals.$inferSelect;
export type InsertHandSignal = z.infer<typeof insertHandSignalSchema>;
export type LocationVote = typeof locationVotes.$inferSelect;

export const insertLocationReviewSchema = createInsertSchema(locationReviews).omit({
  id: true,
  createdAt: true,
});

export type LocationReview = typeof locationReviews.$inferSelect;
export type InsertLocationReview = z.infer<typeof insertLocationReviewSchema>;

export const reels = pgTable("reels", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  userName: text("user_name").notNull(),
  userAvatar: text("user_avatar"),
  contentType: text("content_type").notNull().default("photo"),
  mediaUrl: text("media_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  duration: integer("duration"),
  caption: text("caption"),
  hashtags: jsonb("hashtags").$type<string[]>().default([]),
  locationName: text("location_name"),
  locationId: varchar("location_id"),
  category: text("category").default("for_you"),
  likeCount: integer("like_count").default(0),
  commentCount: integer("comment_count").default(0),
  shareCount: integer("share_count").default(0),
  viewCount: integer("view_count").default(0),
  saveCount: integer("save_count").default(0),
  status: text("status").default("published"),
  createdAt: timestamp("created_at").defaultNow(),
  publishedAt: timestamp("published_at").defaultNow(),
});

export const reelLikes = pgTable("reel_likes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  reelId: varchar("reel_id").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reelComments = pgTable("reel_comments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  reelId: varchar("reel_id").notNull(),
  userId: varchar("user_id").notNull(),
  userName: text("user_name").notNull(),
  userAvatar: text("user_avatar"),
  content: text("content").notNull(),
  likeCount: integer("like_count").default(0),
  parentId: varchar("parent_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reelSounds = pgTable("reel_sounds", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  creator: text("creator"),
  audioUrl: text("audio_url").notNull(),
  duration: integer("duration"),
  category: text("category").default("general"),
  usageCount: integer("usage_count").default(0),
});

export const insertReelSchema = createInsertSchema(reels).omit({
  id: true,
  likeCount: true,
  commentCount: true,
  shareCount: true,
  viewCount: true,
  saveCount: true,
  createdAt: true,
  publishedAt: true,
});

export const insertReelCommentSchema = createInsertSchema(reelComments).omit({
  id: true,
  likeCount: true,
  createdAt: true,
});

export type Reel = typeof reels.$inferSelect;
export type InsertReel = z.infer<typeof insertReelSchema>;
export type ReelLike = typeof reelLikes.$inferSelect;
export type ReelComment = typeof reelComments.$inferSelect;
export type InsertReelComment = z.infer<typeof insertReelCommentSchema>;
export type ReelSound = typeof reelSounds.$inferSelect;

export const packages = pgTable("packages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  trackingNumber: text("tracking_number").notNull().unique(),
  status: text("status").notNull().default("pending"),
  senderName: text("sender_name").notNull(),
  senderPhone: text("sender_phone").notNull(),
  senderAddress: text("sender_address").notNull(),
  senderLatitude: real("sender_latitude"),
  senderLongitude: real("sender_longitude"),
  receiverName: text("receiver_name").notNull(),
  receiverPhone: text("receiver_phone").notNull(),
  receiverAddress: text("receiver_address").notNull(),
  receiverLatitude: real("receiver_latitude"),
  receiverLongitude: real("receiver_longitude"),
  contents: text("contents").notNull(),
  weight: real("weight"),
  dimensions: text("dimensions"),
  declaredValue: real("declared_value"),
  fare: real("fare").notNull().default(25),
  insuranceFee: real("insurance_fee").default(0),
  pickupHubId: varchar("pickup_hub_id"),
  dropoffHubId: varchar("dropoff_hub_id"),
  assignedDriverId: varchar("assigned_driver_id"),
  deviceId: varchar("device_id"),
  createdAt: timestamp("created_at").defaultNow(),
  pickedUpAt: timestamp("picked_up_at"),
  deliveredAt: timestamp("delivered_at"),
});

export const packageStatusHistory = pgTable("package_status_history", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  packageId: varchar("package_id").notNull(),
  status: text("status").notNull(),
  location: text("location"),
  notes: text("notes"),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const courierHubs = pgTable("courier_hubs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  taxiRankId: varchar("taxi_rank_id"),
  operatingHours: text("operating_hours"),
  contactPhone: text("contact_phone"),
  isActive: boolean("is_active").default(true),
});

export const insertPackageSchema = createInsertSchema(packages).omit({
  id: true,
  createdAt: true,
  pickedUpAt: true,
  deliveredAt: true,
});

export const insertPackageStatusHistorySchema = createInsertSchema(packageStatusHistory).omit({
  id: true,
  createdAt: true,
});

export const insertCourierHubSchema = createInsertSchema(courierHubs).omit({
  id: true,
});

export type Package = typeof packages.$inferSelect;
export type InsertPackage = z.infer<typeof insertPackageSchema>;
export type PackageStatusHistory = typeof packageStatusHistory.$inferSelect;
export type InsertPackageStatusHistory = z.infer<typeof insertPackageStatusHistorySchema>;
export type CourierHub = typeof courierHubs.$inferSelect;
export type InsertCourierHub = z.infer<typeof insertCourierHubSchema>;

export const lostFoundItems = pgTable("lost_found_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  type: text("type").notNull().default("lost"),
  category: text("category").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  routeOrigin: text("route_origin"),
  routeDestination: text("route_destination"),
  dateLost: timestamp("date_lost"),
  contactPhone: text("contact_phone").notNull(),
  contactName: text("contact_name").notNull(),
  reward: real("reward"),
  status: text("status").default("active"),
  deviceId: varchar("device_id"),
  claimedBy: varchar("claimed_by"),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLostFoundItemSchema = createInsertSchema(lostFoundItems).omit({
  id: true,
  createdAt: true,
  claimedAt: true,
});

export type LostFoundItem = typeof lostFoundItems.$inferSelect;
export type InsertLostFoundItem = z.infer<typeof insertLostFoundItemSchema>;

export const referralCodes = pgTable("referral_codes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull().unique(),
  code: text("code").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ReferralCode = typeof referralCodes.$inferSelect;

export const referralSignups = pgTable("referral_signups", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  referrerDeviceId: varchar("referrer_device_id").notNull(),
  referredDeviceId: varchar("referred_device_id").notNull(),
  referralCode: text("referral_code").notNull(),
  status: text("status").default("signed_up"),
  hasCompletedRide: boolean("has_completed_ride").default(false),
  rewardClaimed: boolean("reward_claimed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const referralRewards = pgTable("referral_rewards", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull(),
  rewardType: text("reward_type").notNull(),
  rewardTier: integer("reward_tier").notNull(),
  description: text("description").notNull(),
  status: text("status").default("pending"),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReferralSignupSchema = createInsertSchema(referralSignups).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertReferralRewardSchema = createInsertSchema(referralRewards).omit({
  id: true,
  createdAt: true,
  claimedAt: true,
});

export type ReferralSignup = typeof referralSignups.$inferSelect;
export type InsertReferralSignup = z.infer<typeof insertReferralSignupSchema>;
export type ReferralReward = typeof referralRewards.$inferSelect;
export type InsertReferralReward = z.infer<typeof insertReferralRewardSchema>;

export const routeContributions = pgTable("route_contributions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  origin: text("origin").notNull(),
  originLatitude: real("origin_latitude"),
  originLongitude: real("origin_longitude"),
  destination: text("destination").notNull(),
  destinationLatitude: real("destination_latitude"),
  destinationLongitude: real("destination_longitude"),
  taxiRankName: text("taxi_rank_name"),
  fare: real("fare").notNull(),
  currency: text("currency").default("ZAR"),
  estimatedTime: text("estimated_time"),
  distance: real("distance"),
  province: text("province"),
  routeType: text("route_type").default("local"),
  handSignal: text("hand_signal"),
  handSignalDescription: text("hand_signal_description"),
  additionalNotes: text("additional_notes"),
  contributorName: text("contributor_name"),
  deviceId: varchar("device_id"),
  status: text("status").default("pending"),
  upvotes: integer("upvotes").default(0),
  downvotes: integer("downvotes").default(0),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const routeContributionVotes = pgTable("route_contribution_votes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  contributionId: varchar("contribution_id").notNull(),
  deviceId: varchar("device_id").notNull(),
  voteType: text("vote_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRouteContributionSchema = createInsertSchema(routeContributions).omit({
  id: true,
  upvotes: true,
  downvotes: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
});

export type RouteContribution = typeof routeContributions.$inferSelect;
export type InsertRouteContribution = z.infer<typeof insertRouteContributionSchema>;
export type RouteContributionVote = typeof routeContributionVotes.$inferSelect;

// Jobs table for taxi industry employment opportunities
export const jobs = pgTable("jobs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  company: text("company").notNull(),
  description: text("description").notNull(),
  requirements: text("requirements"),
  jobType: text("job_type").notNull().default("full-time"), // full-time, part-time, contract, temporary
  category: text("category").notNull().default("driver"), // driver, marshal, mechanic, admin, security, other
  location: text("location").notNull(),
  province: text("province"),
  salary: text("salary"), // e.g., "R8,000 - R12,000 per month"
  salaryMin: real("salary_min"),
  salaryMax: real("salary_max"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  contactWhatsapp: text("contact_whatsapp"),
  experienceLevel: text("experience_level").default("entry"), // entry, intermediate, senior
  licenseRequired: text("license_required"), // e.g., "PrDP", "Code 10", "Code 14"
  benefits: jsonb("benefits").$type<string[]>(),
  isVerified: boolean("is_verified").default(false),
  isFeatured: boolean("is_featured").default(false),
  applicationDeadline: timestamp("application_deadline"),
  postedBy: varchar("posted_by"),
  viewCount: integer("view_count").default(0),
  applicationCount: integer("application_count").default(0),
  status: text("status").default("active"), // active, closed, expired
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  viewCount: true,
  applicationCount: true,
  createdAt: true,
  updatedAt: true,
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;

// Job applications
export const jobApplications = pgTable("job_applications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull(),
  applicantName: text("applicant_name").notNull(),
  applicantPhone: text("applicant_phone").notNull(),
  applicantEmail: text("applicant_email"),
  coverMessage: text("cover_message"),
  resumeUrl: text("resume_url"),
  deviceId: varchar("device_id"),
  status: text("status").default("pending"), // pending, reviewed, shortlisted, rejected, hired
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertJobApplicationSchema = createInsertSchema(jobApplications).omit({
  id: true,
  status: true,
  createdAt: true,
});

export type JobApplication = typeof jobApplications.$inferSelect;
export type InsertJobApplication = z.infer<typeof insertJobApplicationSchema>;

// Events table for taxi industry events
export const events = pgTable("events", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().default("community"), // community, safety, training, meeting, celebration, other
  eventDate: timestamp("event_date").notNull(),
  eventEndDate: timestamp("event_end_date"),
  startTime: text("start_time"), // e.g., "09:00"
  endTime: text("end_time"), // e.g., "17:00"
  location: text("location").notNull(),
  venue: text("venue"),
  province: text("province"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  organizer: text("organizer").notNull(),
  organizerPhone: text("organizer_phone"),
  organizerEmail: text("organizer_email"),
  imageUrl: text("image_url"),
  ticketPrice: real("ticket_price").default(0), // 0 = free
  ticketUrl: text("ticket_url"),
  maxAttendees: integer("max_attendees"),
  currentAttendees: integer("current_attendees").default(0),
  isOnline: boolean("is_online").default(false),
  onlineUrl: text("online_url"),
  isFeatured: boolean("is_featured").default(false),
  isVerified: boolean("is_verified").default(false),
  tags: jsonb("tags").$type<string[]>(),
  status: text("status").default("upcoming"), // upcoming, ongoing, completed, cancelled
  postedBy: varchar("posted_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Backs ORDER BY event_date DESC in GET /api/events list queries.
  eventDateIdx: index("idx_events_event_date").on(table.eventDate),
}));

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  currentAttendees: true,
  createdAt: true,
  updatedAt: true,
});

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

// Event RSVPs
export const eventRsvps = pgTable("event_rsvps", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull(),
  attendeeName: text("attendee_name").notNull(),
  attendeePhone: text("attendee_phone").notNull(),
  attendeeEmail: text("attendee_email"),
  ticketCount: integer("ticket_count").default(1),
  deviceId: varchar("device_id"),
  status: text("status").default("confirmed"), // confirmed, cancelled, attended
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEventRsvpSchema = createInsertSchema(eventRsvps).omit({
  id: true,
  status: true,
  createdAt: true,
});

export type EventRsvp = typeof eventRsvps.$inferSelect;
export type InsertEventRsvp = z.infer<typeof insertEventRsvpSchema>;

// City Explorer Challenge - User Progress
export const explorerProgress = pgTable("explorer_progress", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull().unique(),
  totalPoints: integer("total_points").default(0),
  currentLevel: integer("current_level").default(1), // 1, 2, or 3
  surveysCompleted: integer("surveys_completed").default(0),
  faresVerified: integer("fares_verified").default(0),
  stopsAdded: integer("stops_added").default(0),
  photosUploaded: integer("photos_uploaded").default(0),
  badges: jsonb("badges").$type<string[]>().default([]),
  hasNewRewards: boolean("has_new_rewards").default(false),
  lastSurveyDate: timestamp("last_survey_date"),
  weeklyRaffleEntries: integer("weekly_raffle_entries").default(0),
  streak: integer("streak").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type ExplorerProgress = typeof explorerProgress.$inferSelect;

// City Explorer - Fare Surveys
export const fareSurveys = pgTable("fare_surveys", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull(),
  originRankId: varchar("origin_rank_id"),
  originName: text("origin_name").notNull(),
  destinationName: text("destination_name").notNull(),
  fareAmount: real("fare_amount"),
  responseType: text("response_type").notNull(), // 'known', 'guessed', 'new_route'
  pointsEarned: integer("points_earned").default(10),
  createdAt: timestamp("created_at").defaultNow(),
});

export type FareSurvey = typeof fareSurveys.$inferSelect;

// City Explorer - Stop Contributions
export const stopContributions = pgTable("stop_contributions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull(),
  stopName: text("stop_name").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  tip: text("tip"),
  landmark: text("landmark"),
  bestTime: text("best_time"), // 'morning', 'afternoon', 'evening'
  pointsEarned: integer("points_earned").default(30),
  status: text("status").default("pending"), // pending, verified, rejected
  createdAt: timestamp("created_at").defaultNow(),
});

export type StopContribution = typeof stopContributions.$inferSelect;

// City Explorer - Photo Contributions
export const photoContributions = pgTable("photo_contributions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull(),
  locationId: varchar("location_id"),
  stopContributionId: varchar("stop_contribution_id"),
  imageUrl: text("image_url"),
  description: text("description"),
  landmark: text("landmark"),
  bestTime: text("best_time"),
  pointsEarned: integer("points_earned").default(40),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PhotoContribution = typeof photoContributions.$inferSelect;

// City Explorer - Leaderboard (weekly reset)
export const explorerLeaderboard = pgTable("explorer_leaderboard", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull(),
  displayName: text("display_name"),
  weeklyPoints: integer("weekly_points").default(0),
  weekStartDate: timestamp("week_start_date").notNull(),
  rank: integer("rank"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ExplorerLeaderboard = typeof explorerLeaderboard.$inferSelect;
// ============================================
// HAIBO PAY - WALLET & TRANSACTION SYSTEM
// ============================================

export const walletTransactions = pgTable("wallet_transactions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  // Transaction types:
  //   topup / transfer_sent / transfer_received / payment / refund — existing
  //   sponsorship_sent / sponsorship_received — existing
  //   fare_in          — passenger paid a driver for a ride (→ fareBalance)
  //   hub_delivery_in  — sender paid for a package, driver leg (→ fareBalance)
  //   vendor_revenue_in — customer paid a vendor via Haibo Pay (→ walletBalance)
  //   platform_fee_out — Haibo's 15% cut, routed to admin treasury wallet
  //   driver_settlement — driver settled fareBalance → owner's wallet
  //   withdrawal_out   — funds left a wallet via withdrawal_requests
  type: text("type").notNull(),
  amount: real("amount").notNull(),
  description: text("description"),
  status: text("status").notNull().default("completed"), // 'pending', 'completed', 'failed'
  paymentReference: text("payment_reference"), // Paystack reference
  relatedUserId: varchar("related_user_id"), // For transfers/sponsorship
  relatedUserPhone: text("related_user_phone"), // For transfers/sponsorship
  // Which sub-balance on the user's wallet this transaction affected.
  // 'wallet' = users.walletBalance (default, all legacy rows).
  // 'fare'   = users.fareBalance (driver fares + hub delivery shares).
  balanceAffected: text("balance_affected").default("wallet"),
  // Companion transaction link — when a single real-world event creates
  // multiple rows (e.g. passenger pays R50 → fare_in to driver + platform_fee_out
  // to admin), both rows share a parentTransactionId so the audit trail
  // can group them.
  parentTransactionId: varchar("parent_transaction_id"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userProfiles = pgTable("user_profiles", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  username: text("username").unique(),
  taxiPlateNumber: text("taxi_plate_number"),
  qrCode: text("qr_code"), // URL to QR code image
  bio: text("bio"),
  safetyRating: real("safety_rating").default(5),
  totalRatings: integer("total_ratings").default(0),
  isDriver: boolean("is_driver").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const p2pTransfers = pgTable("p2p_transfers", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull(),
  recipientId: varchar("recipient_id"),
  recipientPhone: text("recipient_phone"),
  recipientUsername: text("recipient_username"),
  amount: real("amount").notNull(),
  message: text("message"),
  status: text("status").notNull().default("completed"), // 'pending', 'completed', 'rejected'
  // When set, this transfer was a vendor sale (buyer scanned vendor ref).
  // Lets us classify "sale" vs "personal P2P" in reports without a second
  // table. Nullable: all existing rows stay valid as personal transfers.
  vendorRef: text("vendor_ref"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// HAIBO VAULT — VENDOR PROFILES
// ============================================
// Vendor profile is a flag/metadata layer on top of an existing user
// account, NOT a separate identity. Every vendor is a regular Haibo
// user who opted in and provided business info; the money itself
// flows through their existing wallet (users.walletBalance) and out
// through the existing withdrawal_requests pipeline.
//
// This is deliberately different from the earlier prototype (which
// had a standalone `vendors` table with its own banking columns) —
// we want commuter ↔ driver ↔ vendor payments to all ride the same
// p2pTransfers rail so the whole ecosystem feels like one wallet.

export const vendorProfiles = pgTable("vendor_profiles", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  // One profile per user. Unique so a user can't accidentally register
  // themselves twice under two vendor refs.
  userId: varchar("user_id").notNull().unique(),
  vendorType: text("vendor_type").notNull(), // 'taxi_vendor' | 'hawker' | 'accessories'
  businessName: text("business_name").notNull(),
  rankLocation: text("rank_location"),
  description: text("description"),
  businessImageUrl: text("business_image_url"),
  // Short, human-readable code the buyer types or scans (e.g. HBV-1234-XYZ9).
  // Unique so QR lookups are O(1) and collision-free.
  vendorRef: text("vendor_ref").notNull().unique(),
  status: text("status").notNull().default("pending"), // 'pending' | 'verified' | 'suspended'
  // Derived counter maintained on sale — lets the directory/CC sort
  // by popularity without an aggregate query on every page load.
  totalSales: real("total_sales").notNull().default(0),
  salesCount: integer("sales_count").notNull().default(0),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  // Payout bank — where the vendor's withdrawals land. Same inline
  // storage pattern as owner_profiles (rotation is rare, no join needed).
  bankCode: text("bank_code"),
  accountNumber: text("account_number"),
  accountName: text("account_name"),
  // Paystack subaccount code. When set, payments can be split directly
  // by Paystack (platform fee auto-retained). When null, the full amount
  // lands in the Haibo treasury and we settle via transfer later.
  paystackSubaccountCode: text("paystack_subaccount_code"),
  paystackRecipientCode: text("paystack_recipient_code"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVendorProfileSchema = createInsertSchema(vendorProfiles).omit({
  id: true,
  vendorRef: true,
  status: true,
  totalSales: true,
  salesCount: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type VendorProfile = typeof vendorProfiles.$inferSelect;
export type InsertVendorProfile = z.infer<typeof insertVendorProfileSchema>;

export const sponsorships = pgTable("sponsorships", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sponsorId: varchar("sponsor_id").notNull(),
  recipientId: varchar("recipient_id"),
  recipientPhone: text("recipient_phone"),
  type: text("type").notNull(), // 'job_interview', 'education', 'emergency', 'general'
  amount: real("amount").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"), // 'pending', 'accepted', 'rejected'
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// HAIBO HUB - PACKAGE DELIVERY SYSTEM
// ============================================

export const deliveries = pgTable("deliveries", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull(),
  driverId: varchar("driver_id"),
  driverPhone: text("driver_phone"),
  taxiPlateNumber: text("taxi_plate_number").notNull(),
  description: text("description").notNull(),
  pickupRank: text("pickup_rank").notNull(),
  dropoffRank: text("dropoff_rank").notNull(),
  amount: real("amount").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'accepted', 'in_transit', 'delivered', 'cancelled'
  paymentStatus: text("payment_status").notNull().default("pending"), // 'pending', 'completed', 'failed'
  paymentReference: text("payment_reference"),
  confirmationCode: text("confirmation_code"),
  photoVerification: text("photo_verification"), // URL to photo
  insuranceIncluded: boolean("insurance_included").default(false),
  insuranceAmount: real("insurance_amount").default(0),
  trackingUrl: text("tracking_url"),
  currentLocation: jsonb("current_location").$type<{ latitude: number; longitude: number }>(),
  createdAt: timestamp("created_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  deliveredAt: timestamp("delivered_at"),
});

export const deliveryTracking = pgTable("delivery_tracking", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  deliveryId: varchar("delivery_id").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  rank: text("rank"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// ============================================
// GROUP RIDES - COMMUNITY TRANSPORT
// ============================================

export const groupRides = pgTable("group_rides", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizerId: varchar("organizer_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  pickupLocation: text("pickup_location").notNull(),
  dropoffLocation: text("dropoff_location").notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  maxPassengers: integer("max_passengers").notNull(),
  costPerPerson: real("cost_per_person"),
  rideType: text("ride_type").notNull(), // 'scheduled', 'odd_hours', 'school_transport', 'staff_transport'
  driverId: varchar("driver_id"),
  driverPlateNumber: text("driver_plate_number"),
  driverSafetyRating: real("driver_safety_rating"),
  status: text("status").notNull().default("open"), // 'open', 'in_progress', 'completed', 'cancelled'
  paymentMethod: text("payment_method"), // 'split', 'sponsor', 'individual'
  sponsorId: varchar("sponsor_id"), // For sponsored rides
  isVerifiedDriver: boolean("is_verified_driver").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const groupRideParticipants = pgTable("group_ride_participants", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  rideId: varchar("ride_id").notNull(),
  userId: varchar("user_id").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'confirmed', 'joined', 'completed', 'cancelled'
  amountPaid: real("amount_paid"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  paymentReference: text("payment_reference"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const rideChat = pgTable("ride_chat", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  rideId: varchar("ride_id").notNull(),
  userId: varchar("user_id").notNull(),
  userName: text("user_name").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const rideTracking = pgTable("ride_tracking", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  rideId: varchar("ride_id").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const driverProfiles = pgTable("driver_profiles", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  taxiPlateNumber: text("taxi_plate_number").notNull().unique(),
  licenseNumber: text("license_number"),
  licenseExpiry: timestamp("license_expiry"),
  insuranceNumber: text("insurance_number"),
  insuranceExpiry: timestamp("insurance_expiry"),
  safetyRating: real("safety_rating").default(5),
  totalRatings: integer("total_ratings").default(0),
  totalRides: integer("total_rides").default(0),
  acceptanceRate: real("acceptance_rate").default(100),
  isVerified: boolean("is_verified").default(false),
  vehicleColor: text("vehicle_color"),
  vehicleModel: text("vehicle_model"),
  vehicleYear: integer("vehicle_year"),
  // KYC photos — captured during self-service onboarding, reviewed by
  // admins in the Driver KYC queue. All nullable so drivers can finish
  // registering with just a plate and add documents later.
  licenseImageUrl: text("license_image_url"),
  vehicleImageUrl: text("vehicle_image_url"),
  payReferenceCode: text("pay_reference_code").unique(),
  currentLatitude: real("current_latitude"),
  currentLongitude: real("current_longitude"),
  lastLocationUpdate: timestamp("last_location_update"),
  // Driver ↔ Owner linkage. Set when the driver redeems an owner-issued
  // invitation code during onboarding. All fare withdrawals route to this
  // owner's bank. Null until linked — driver can earn but not withdraw.
  // Same user can sit on both sides (solo operator): ownerId === userId.
  ownerId: varchar("owner_id"),
  // Driver's share of each fare, 0–100. 0 = all money to owner (default
  // for MVP, matches the "settle to owner" flow). Future: non-zero values
  // split the fare into the driver's walletBalance at transaction time.
  splitPercentFare: integer("split_percent_fare").default(0),
  // pending: just signed up, no owner yet — blocked from withdrawals.
  // active: linked to an owner via invitation, can earn + settle.
  // suspended: owner or admin revoked — earnings freeze pending resolution.
  linkStatus: text("link_status").default("pending"),
  linkedAt: timestamp("linked_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// OWNER PROFILES — Taxi owners (fleet operators)
// ============================================
// One row per user with role='owner'. Holds payout bank details for
// receiving driver settlements, plus optional company metadata. Separate
// from driver_profiles because the same user can hold both roles (solo
// operator) without the tables conflicting.
export const ownerProfiles = pgTable("owner_profiles", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  companyName: text("company_name"),
  // Payout bank — where driver settlements and the owner's own withdrawals
  // land. Stored denormalised (not FK'd to a separate payout_accounts table)
  // because owners rarely rotate banks and inline storage is simpler.
  bankCode: text("bank_code"),
  accountNumber: text("account_number"),
  accountName: text("account_name"),
  // Paystack subaccount code (created when the owner verifies bank details
  // server-side). Non-null = ready to receive settlements via Paystack
  // transfer API. Null = bank details entered but not yet verified.
  paystackRecipientCode: text("paystack_recipient_code"),
  // KYC — unverified | pending | verified | rejected. Driver settlements
  // can still accrue against an unverified owner, but withdrawals block
  // until verified. Separate from driver_profiles.linkStatus.
  kycStatus: text("kyc_status").default("unverified"),
  kycReviewedAt: timestamp("kyc_reviewed_at"),
  kycReviewedBy: varchar("kyc_reviewed_by"),
  kycRejectionReason: text("kyc_rejection_reason"),
  // Business ID (CK number) — optional, helps with tax compliance.
  companyRegNumber: text("company_reg_number"),
  vatNumber: text("vat_number"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOwnerProfileSchema = createInsertSchema(ownerProfiles).omit({
  id: true,
  paystackRecipientCode: true,
  kycStatus: true,
  kycReviewedAt: true,
  kycReviewedBy: true,
  kycRejectionReason: true,
  createdAt: true,
  updatedAt: true,
});

export type OwnerProfile = typeof ownerProfiles.$inferSelect;
export type InsertOwnerProfile = z.infer<typeof insertOwnerProfileSchema>;

// ============================================
// DRIVER-OWNER INVITATIONS
// ============================================
// Owner-issued codes that a driver redeems during signup to link to a
// specific owner. The owner creates N codes (one per driver they hire)
// from their dashboard; each code is single-use.
//
// Why codes (not "enter owner's phone + approve"): avoids spam-invite
// harassment vectors, and lets owners pre-provision links before the
// driver even signs up (e.g. hand a printed code to a new hire).
export const driverOwnerInvitations = pgTable("driver_owner_invitations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").notNull(),
  // Short, human-readable code — 8 chars, alphanumeric, no ambiguous
  // glyphs (0/O, 1/I/L). Format: HBO-XXXXXX. Unique globally so a driver
  // can redeem without needing to know which owner to search.
  code: text("code").notNull().unique(),
  // Optional note from the owner ("Morning shift — Sipho"). Helps the
  // owner track which invitation went to whom before it's redeemed.
  label: text("label"),
  // Who redeemed it and when. Single-use: once usedByUserId is set, the
  // code is no longer redeemable.
  usedByUserId: varchar("used_by_user_id"),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at"),
  // pending: created, awaiting redemption
  // used: redeemed by a driver, now inactive
  // revoked: owner cancelled before redemption
  // expired: passed expiresAt without redemption
  status: text("status").default("pending"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDriverOwnerInvitationSchema = createInsertSchema(driverOwnerInvitations).omit({
  id: true,
  code: true, // server-generated
  usedByUserId: true,
  usedAt: true,
  status: true,
  revokedAt: true,
  createdAt: true,
});

export type DriverOwnerInvitation = typeof driverOwnerInvitations.$inferSelect;
export type InsertDriverOwnerInvitation = z.infer<typeof insertDriverOwnerInvitationSchema>;

export const driverRatings = pgTable("driver_ratings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").notNull(),
  userId: varchar("user_id").notNull(),
  rideId: varchar("ride_id"),
  rating: integer("rating").notNull(), // 1-5
  review: text("review"),
  // URLs of photos/videos the rider attached as evidence (taxi interior,
  // driver behaviour, damage etc). JSONB array so we can grow to multiple
  // attachments without a schema change. Stored as returned by
  // /api/uploads/image — Azure blob URLs in prod, /uploads/* in dev.
  mediaUrls: jsonb("media_urls").$type<string[]>().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// TAXI DRIVERS - Link drivers to taxis
// ============================================
export const taxiDrivers = pgTable("taxi_drivers", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  taxiId: varchar("taxi_id").notNull(), // References taxis.id
  driverId: varchar("driver_id").notNull(), // References users.id
  role: text("role").notNull(), // owner, associate, substitute
  assignedAt: timestamp("assigned_at").defaultNow(),
  unassignedAt: timestamp("unassigned_at"),
  isActive: boolean("is_active").default(true),
  licenseNumber: text("license_number"),
  licenseExpiry: timestamp("license_expiry"),
});

export const insertTaxiDriverSchema = createInsertSchema(taxiDrivers).omit({
  id: true,
  assignedAt: true,
});

export type TaxiDriver = typeof taxiDrivers.$inferSelect;
export type InsertTaxiDriver = z.infer<typeof insertTaxiDriverSchema>;

// ============================================
// PAYMENT METHODS - Store user payment info
// ============================================
export const paymentMethods = pgTable("payment_methods", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(), // card, bank_account, mobile_money
  provider: text("provider").notNull(), // paystack, stripe, mtn, vodacom
  token: text("token").notNull(), // Tokenized payment info (not raw data)
  last4Digits: text("last4_digits"),
  expiryDate: text("expiry_date"),
  bankName: text("bank_name"),
  accountName: text("account_name"),
  accountNumber: text("account_number"),
  bankCode: text("bank_code"),
  isDefault: boolean("is_default").default(false),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;

// ============================================
// TRANSACTIONS - Payment ledger
// ============================================
export const transactions = pgTable("transactions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  amount: real("amount").notNull(),
  type: text("type").notNull(), // wallet_topup, ride_payment, driver_earning, p2p_transfer, withdrawal, refund
  status: text("status").notNull().default("pending"), // pending, completed, failed, refunded
  reference: text("reference").unique(),
  description: text("description"),
  paymentMethodId: varchar("payment_method_id"),
  relatedTransactionId: varchar("related_transaction_id"), // For refunds, transfers, etc.
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  failureReason: text("failure_reason"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

// ============================================
// LOCATION UPDATES - Real-time GPS tracking
// ============================================
export const locationUpdates = pgTable("location_updates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  accuracy: real("accuracy"),
  speed: real("speed"),
  heading: real("heading"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export type LocationUpdate = typeof locationUpdates.$inferSelect;

// ============================================
// WITHDRAWAL REQUESTS - Driver earnings withdrawal
// ============================================
export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // who clicked "Withdraw"
  // Where the money actually lands. For drivers withdrawing fareBalance,
  // this is the linked owner's user id. For everyone else (commuter,
  // vendor, owner, solo operators), this equals userId. Nullable for
  // backward compat with rows created before the routing column existed —
  // those rows route to userId implicitly.
  routeToUserId: varchar("route_to_user_id"),
  // Which sub-balance is being drawn down. 'wallet' = walletBalance,
  // 'fare' = fareBalance. Default 'wallet' preserves legacy semantics.
  balanceType: text("balance_type").default("wallet"),
  amount: real("amount").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, processing, completed, rejected
  bankCode: text("bank_code").notNull(),
  accountNumber: text("account_number").notNull(),
  accountName: text("account_name"),
  narration: text("narration"),
  requestedAt: timestamp("requested_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by"),
  completedAt: timestamp("completed_at"),
  rejectionReason: text("rejection_reason"),
  reference: text("reference"),
  isVerified: boolean("is_verified").default(false),
  requires2FA: boolean("requires_2fa").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequests).omit({
  id: true,
  requestedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type InsertWithdrawalRequest = z.infer<typeof insertWithdrawalRequestSchema>;

// ============================================
// SOS ALERTS - Immutable audit log of emergency triggers
// ============================================
export const sosAlerts = pgTable("sos_alerts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  // Nullable because guest SOS events (source='guest_api') have no authenticated user.
  userId: varchar("user_id"),
  phone: text("phone"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  message: text("message"),
  source: text("source").default("api"), // "api" | "websocket" | "guest_api"
  adminRecipients: integer("admin_recipients").default(0),
  smsRecipients: integer("sms_recipients").default(0),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type SosAlert = typeof sosAlerts.$inferSelect;

// ============================================
// GROUP RIDE CHATS - Real-time chat messages
// ============================================
export const groupRideChats = pgTable("group_ride_chats", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  groupRideId: varchar("group_ride_id").notNull(),
  userId: varchar("user_id").notNull(),
  message: text("message").notNull(),
  type: text("type").default("text"), // text, location, image, system
  mediaUrl: text("media_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type GroupRideChat = typeof groupRideChats.$inferSelect;

// ============================================
// PASOP REPORTS - Community-filed hazard alerts ("watch out")
// ============================================
// Waze-style hazard reporting layer for the Haibo mobile app. Each report
// has a category (reckless driving, unsafe vehicle, robbery risk, …),
// GPS coordinates, and a community "still there?" petition mechanism.
//
// Time-decay weighting in the client derives a Safe-Trip Progress Bar
// score; expired reports are filtered out client-side. The server stores
// both the absolute expiresAt timestamp AND the original status so the
// admin moderation queue can hide spam without waiting for TTL.
export const pasopReports = pgTable("pasop_reports", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // reckless_driving, unsafe_vehicle, …
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  description: text("description"),
  reporterId: varchar("reporter_id"), // nullable for guest reports
  reporterName: text("reporter_name"),
  petitionCount: integer("petition_count").default(0),
  petitioners: jsonb("petitioners").$type<string[]>().default([]),
  status: text("status").notNull().default("active"), // active | expired | resolved | hidden
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Backs the "nearby reports" query path (GET /api/pasop/reports) —
  // status filter first, then spatial filtering is a follow-up bbox on
  // lat/lng that we do in-memory until we add PostGIS.
  statusIdx: index("idx_pasop_status").on(table.status),
}));

export type PasopReport = typeof pasopReports.$inferSelect;

// ============================================
// ADMIN AUDIT LOG - Append-only record of destructive admin actions
// ============================================
// Every write performed through the admin API (approving a withdrawal,
// resolving a complaint, toggling a job feature flag) gets a row here
// so we can answer "who did what, and when" questions during incident
// reviews. The table is append-only — there is no update or delete
// route. `meta` holds the patch or body payload as JSON for context,
// truncated on the client side if needed.
export const adminAuditLog = pgTable("admin_audit_log", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id").notNull(),
  adminPhone: text("admin_phone"),
  action: text("action").notNull(), // e.g. "withdrawal.approve", "moderation.update"
  resource: text("resource").notNull(), // e.g. "withdrawal_request", "reels"
  resourceId: varchar("resource_id"),
  meta: jsonb("meta"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;

// ============================================
// EMERGENCY CONTACTS - National + regional numbers
// ============================================
// Mirrors the static reference data in client/data/emergency_contacts.json
// so admins can edit numbers via the command-center without shipping a new
// APK. The mobile app keeps the bundled JSON as an offline fallback — a
// safety app must work without network during an emergency — and refreshes
// from this table when online. `province` is null for national numbers
// (112, 10111, 10177) and filled in for regional ones (Western Cape, etc).
export const emergencyContacts = pgTable("emergency_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  province: text("province"), // null = national; "Gauteng", "Western Cape", etc.
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  categoryIdx: index("idx_emergency_contacts_category").on(table.category),
  provinceIdx: index("idx_emergency_contacts_province").on(table.province),
}));

export type EmergencyContact = typeof emergencyContacts.$inferSelect;

// ============================================
// TAXI FARES - Canonical origin-destination fares
// ============================================
// Mirrors the bundled taxi_routes_fares.json so admin can edit fares
// from the command-center and the mobile TaxiFareScreen can prefer the
// API when online (with the bundled JSON as offline fallback). Linked
// to taxi_locations by optional FK — fares often cover routes whose
// origin/destination names don't exactly match curated rank names, so
// the link is opportunistic, not required. Distinct from fare_surveys
// which captures per-trip user reports rather than canonical listings.
export const taxiFares = pgTable("taxi_fares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  originRankId: varchar("origin_rank_id"),
  destinationRankId: varchar("destination_rank_id"),
  amount: real("amount"), // nullable for "Price TBD" routes in the source data
  currency: text("currency").default("ZAR"),
  distanceKm: real("distance_km"),
  estimatedTimeMinutes: integer("estimated_time_minutes"),
  association: text("association"),
  verificationStatus: text("verification_status").default("verified"),
  addedBy: varchar("added_by"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  originIdx: index("idx_taxi_fares_origin").on(table.origin),
  destinationIdx: index("idx_taxi_fares_destination").on(table.destination),
}));

export type TaxiFare = typeof taxiFares.$inferSelect;

// ============================================
// FARE IMPORTS - External-source candidate fares awaiting review
// ============================================
// Landing zone for fares harvested from external sources (initially the
// Facebook taxi-fare community group, extensible to WhatsApp exports,
// Twitter, etc.). A row here is a *candidate* — it does NOT appear in
// the app until an admin approves it into taxi_fares.
//
// Lifecycle: the same post may produce multiple fare_imports rows as
// the extractor prompt/model improves. We version rather than mutate —
// new extraction → new row, old rows get status="superseded". Keeps a
// full audit trail without a child table (launch-sprint pragmatism).
//
// Review flow lives in command-center at /admin/fare-imports. Deliberate
// divergence from the reactive-moderation norm: fares are operational
// data, not user content — a wrong R80 fare causes rank arguments, so
// the small admin-review cost is warranted here. Once approved, the row
// either creates a new taxi_fares row or updates the existing canonical
// fare for that (origin_rank_id, destination_rank_id) pair, with
// taxi_fare_id set as back-reference for provenance.
//
// POPIA notes:
//   * raw_text_redacted has SA phone numbers + emails stripped BEFORE
//     storage. Original text never persists beyond the redaction step.
//   * raw_text_hash is sha256 of the *original* (pre-redaction) text —
//     this lets us detect edits to posts we've already seen without
//     retaining the PII.
//   * raw_text_redacted is nullable and should be nulled once status
//     reaches a terminal state (approved/rejected/duplicate) to
//     minimize retention of third-party content.
//
// FK to taxi_locations on origin_rank_id / destination_rank_id is
// opportunistic (same convention as taxi_fares above) — many community
// posts reference informal pickup points that have no rank row.
export const fareImports = pgTable("fare_imports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // --- Provenance ---
  // source: coarse origin type. "facebook_group" | "manual_upload" |
  // future "whatsapp_export" | "twitter" | etc. Kept as free text so
  // new sources don't require a schema migration.
  source: text("source").notNull(),
  // sourceRef: identifier within the source. For Facebook this is the
  // group id (e.g. "1034488700317989").
  sourceRef: text("source_ref").notNull(),
  // sourcePostId: unique post identifier within (source, source_ref).
  // The composite (source, source_ref, source_post_id, source_comment_id,
  // extractor_version) is the dedupe key — see index below.
  sourcePostId: text("source_post_id").notNull(),
  sourcePostUrl: text("source_post_url"),
  // sourceCommentId / sourceCommentUrl: for Q+A-style sources (e.g. the
  // "Where can I get a taxi to ?" Facebook group) the fare lives in a
  // *comment*, not the post body — e.g. a post "how much JHB → Monte
  // Casino?" can produce two fare_imports rows (one per answering
  // comment, "R23 at MTN" and "R20 taxis at Bree"). These fields record
  // which comment each row came from. Nullable: some future sources may
  // put the fare directly in the post, in which case the post is the
  // unit of extraction and comment_id stays null.
  sourceCommentId: text("source_comment_id"),
  sourceCommentUrl: text("source_comment_url"),
  // When the original post was authored (per the source). Distinct from
  // harvested_at, which is when *we* pulled it.
  postTimestamp: timestamp("post_timestamp"),
  harvestedAt: timestamp("harvested_at").defaultNow().notNull(),
  // Batch id linking all rows collected in the same scrape run — useful
  // for "undo this run" and for measuring harvester yield over time.
  harvesterRunId: varchar("harvester_run_id"),
  // "apify" | "playwright" | "manual" | ...
  harvesterTool: text("harvester_tool"),

  // --- Raw content (POPIA-sensitive, short retention) ---
  rawTextRedacted: text("raw_text_redacted"),
  rawTextHash: text("raw_text_hash").notNull(),
  containsPhoneNumber: boolean("contains_phone_number").default(false),
  containsEmail: boolean("contains_email").default(false),
  // "en" | "zu" | "xh" | "af" | "tsotsi" | "mixed" | null
  languageDetected: text("language_detected"),

  // --- Extraction (LLM pass output) ---
  // extractor_version: semver string for the prompt+model combo that
  // produced this row. Re-running extraction with a new version inserts
  // new rows and marks the old ones superseded; never mutate in place.
  extractorVersion: text("extractor_version").notNull(),
  // e.g. "claude-haiku-4-5"
  extractorModel: text("extractor_model"),
  extractedAt: timestamp("extracted_at"),
  originRaw: text("origin_raw"),
  destinationRaw: text("destination_raw"),
  // Nullable — community posts often say "ask at rank" / "varies" /
  // mention multiple legs without a total.
  fareZar: real("fare_zar"),
  // "JHB" | "CPT" | "DBN" | "PE" | ... — often inferred from context
  // (rank names, phrasing) rather than explicit in the post.
  metroHint: text("metro_hint"),
  // "high" | "medium" | "low" — extractor self-reported.
  confidence: text("confidence"),
  // Literal substring from the post that justifies the extraction.
  // Required at extract time so reviewers can audit without going back
  // to the original post (especially after raw_text_redacted is nulled).
  evidenceQuote: text("evidence_quote"),
  extractionNotes: text("extraction_notes"),

  // --- Canonicalization (match to taxi_locations gazetteer) ---
  canonicalizedAt: timestamp("canonicalized_at"),
  originRankId: varchar("origin_rank_id"),
  destinationRankId: varchar("destination_rank_id"),
  // 0..1 — rapidfuzz trigram score or LLM confidence, depending on method.
  originMatchScore: real("origin_match_score"),
  destinationMatchScore: real("destination_match_score"),
  // "exact" | "fuzzy" | "llm_tiebreak" | "manual"
  canonicalizationMethod: text("canonicalization_method"),

  // --- Review state machine ---
  // pending_extraction → pending_canonicalization → pending_review →
  //   approved | rejected | duplicate | superseded
  status: text("status").notNull().default("pending_extraction"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  rejectionReason: text("rejection_reason"),
  // Set once status = "approved" — points at the taxi_fares row that
  // was created or updated by this import. Back-reference for audit.
  taxiFareId: varchar("taxi_fare_id"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Dedupe lookup key: one row per (post, comment, extractor_version).
  // A single post can legitimately produce multiple rows when multiple
  // comments each answer with a different rank+fare — so the comment id
  // must be part of the dedupe tuple. Re-harvesting the same
  // post+comment under the same extractor version is a no-op;
  // re-extracting with a new version inserts new rows and supersedes
  // the old ones. For sources where the fare lives in the post body
  // (source_comment_id IS NULL), the tuple still uniquely identifies
  // the row because post_id is unique within (source, source_ref).
  sourcePostVersionIdx: index("idx_fare_imports_post_version").on(
    table.source,
    table.sourceRef,
    table.sourcePostId,
    table.sourceCommentId,
    table.extractorVersion,
  ),
  // Admin queue lookups ("give me everything pending_review").
  statusIdx: index("idx_fare_imports_status").on(table.status),
  // Time-windowed dashboards ("what did last night's run yield?").
  harvestedAtIdx: index("idx_fare_imports_harvested_at").on(table.harvestedAt),
  // Canonical-pair lookup for "is there already an approved fare for
  // this route?" during the approve step.
  canonicalPairIdx: index("idx_fare_imports_canonical_pair").on(
    table.originRankId,
    table.destinationRankId,
  ),
}));

export const insertFareImportSchema = createInsertSchema(fareImports).omit({
  id: true,
  harvestedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type FareImport = typeof fareImports.$inferSelect;
export type InsertFareImport = z.infer<typeof insertFareImportSchema>;

// --------------------------------------------
// route_demand_signals — companion to fare_imports.
//
// Every community post that asks "how much from X to Y?" or "where can
// I get a taxi to Y?" is a demand signal — useful for the city-explorer
// feature ("most-asked routes in JHB this month") even when no comment
// supplied a fare. One post → one row (keyed at post level, unlike
// fare_imports which is keyed at comment level).
//
// Intentionally has NO review state machine: demand signals are counted
// and aggregated, not individually approved. Canonicalization still
// runs — we want to map "voslorus" in the post to the canonical
// Vosloorus rank so the aggregation buckets correctly — but there's no
// human gatekeeper between extraction and use.
//
// Retention: rows may be pruned older than N months once aggregated
// counts have been rolled up into a materialized view; rawTextHash
// alone lets us dedupe future re-harvests.
// --------------------------------------------

export const routeDemandSignals = pgTable("route_demand_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // --- Provenance (mirrors fare_imports) ---
  source: text("source").notNull(),
  sourceRef: text("source_ref").notNull(),
  sourcePostId: text("source_post_id").notNull(),
  sourcePostUrl: text("source_post_url"),
  postTimestamp: timestamp("post_timestamp"),
  harvestedAt: timestamp("harvested_at").defaultNow().notNull(),
  harvesterRunId: varchar("harvester_run_id"),
  harvesterTool: text("harvester_tool"),

  // --- Raw content (shorter retention than fare_imports) ---
  rawTextRedacted: text("raw_text_redacted"),
  rawTextHash: text("raw_text_hash").notNull(),
  languageDetected: text("language_detected"),

  // --- Extraction (LLM pass output) ---
  extractorVersion: text("extractor_version").notNull(),
  extractorModel: text("extractor_model"),
  extractedAt: timestamp("extracted_at"),
  // originRaw is nullable — many posts name only the destination
  // ("where can I get a taxi to Daveyton") with origin implicit from
  // the group's JHB-centric context. Extractor leaves null rather than
  // guessing "JHB".
  originRaw: text("origin_raw"),
  // destinationRaw is NOT NULL — a demand signal without a destination
  // has no useful aggregation key, so the extractor shouldn't emit one.
  destinationRaw: text("destination_raw").notNull(),
  metroHint: text("metro_hint"),
  confidence: text("confidence"),
  // A literal substring from the post showing the route question —
  // used by city-explorer UI to display a sample quote per route.
  evidenceQuote: text("evidence_quote"),
  extractionNotes: text("extraction_notes"),

  // --- Canonicalization (match to taxi_locations gazetteer) ---
  canonicalizedAt: timestamp("canonicalized_at"),
  originRankId: varchar("origin_rank_id"),
  destinationRankId: varchar("destination_rank_id"),
  originMatchScore: real("origin_match_score"),
  destinationMatchScore: real("destination_match_score"),
  canonicalizationMethod: text("canonicalization_method"),

  // "pending_canonicalization" | "canonicalized" | "orphan"
  // (orphan = couldn't match origin or destination to the gazetteer;
  // still kept for audit but excluded from city-explorer aggregation).
  status: text("status").notNull().default("pending_canonicalization"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // One demand signal per (post, extractor_version). Re-harvesting the
  // same post under the same extractor is a no-op; re-extracting with
  // a new version inserts a fresh row.
  sourcePostVersionIdx: index("idx_rds_post_version").on(
    table.source,
    table.sourceRef,
    table.sourcePostId,
    table.extractorVersion,
  ),
  // Primary aggregation lookup: "how many demand signals for route
  // origin_rank_id -> destination_rank_id in the last 30 days?"
  canonicalPairIdx: index("idx_rds_canonical_pair").on(
    table.originRankId,
    table.destinationRankId,
  ),
  // Metro-scoped aggregation: "top-asked routes in JHB."
  metroIdx: index("idx_rds_metro").on(table.metroHint),
  // Time-windowed queries for city-explorer charts.
  harvestedAtIdx: index("idx_rds_harvested_at").on(table.harvestedAt),
}));

export const insertRouteDemandSignalSchema = createInsertSchema(
  routeDemandSignals,
).omit({
  id: true,
  harvestedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type RouteDemandSignal = typeof routeDemandSignals.$inferSelect;
export type InsertRouteDemandSignal = z.infer<
  typeof insertRouteDemandSignalSchema
>;

// ============================================
// TYPE EXPORTS
// ============================================

export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type P2pTransfer = typeof p2pTransfers.$inferSelect;
export type Sponsorship = typeof sponsorships.$inferSelect;
export type Delivery = typeof deliveries.$inferSelect;
export type DeliveryTracking = typeof deliveryTracking.$inferSelect;
export type GroupRide = typeof groupRides.$inferSelect;
export type GroupRideParticipant = typeof groupRideParticipants.$inferSelect;
export type RideChat = typeof rideChat.$inferSelect;
export type RideTracking = typeof rideTracking.$inferSelect;
export type DriverProfile = typeof driverProfiles.$inferSelect;
export type DriverRating = typeof driverRatings.$inferSelect;