import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  float,
  boolean,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Brand profiles — resolved Meta Page ID + TikTok handle
export const brands = mysqlTable("brands", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  metaPageId: varchar("metaPageId", { length: 64 }),
  tiktokHandle: varchar("tiktokHandle", { length: 128 }),
  industry: varchar("industry", { length: 128 }),
  logoUrl: text("logoUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Brand = typeof brands.$inferSelect;
export type InsertBrand = typeof brands.$inferInsert;

// Completed audits — one per brand+period combination
export const audits = mysqlTable("audits", {
  id: int("id").autoincrement().primaryKey(),
  shareId: varchar("shareId", { length: 32 }).notNull().unique(),
  brandId: int("brandId").notNull(),
  brandName: varchar("brandName", { length: 255 }).notNull(),
  period: varchar("period", { length: 16 }).notNull(), // e.g. "2026-05"
  platform: mysqlEnum("platform", ["meta", "tiktok", "combined"]).default("combined").notNull(),
  status: mysqlEnum("status", ["pending", "processing", "complete", "error"]).default("pending").notNull(),

  // Aggregated results
  totalAds: int("totalAds").default(0),
  partnershipAds: int("partnershipAds").default(0),
  partnershipPct: float("partnershipPct").default(0),
  estimatedSpendMin: int("estimatedSpendMin").default(0),
  estimatedSpendMax: int("estimatedSpendMax").default(0),
  estimatedImpressionsMin: int("estimatedImpressionsMin").default(0),
  estimatedImpressionsMax: int("estimatedImpressionsMax").default(0),

  // Andromeda Readiness Scores (4-dimension)
  andromedaScore: float("andromedaScore").default(0),
  /** Format Diversity Index */
  formatScore: float("formatScore").default(0),
  /** Creator Signal Score */
  partnershipScore: float("partnershipScore").default(0),
  /** Creative Freshness Score */
  durationScore: float("durationScore").default(0),
  /** Concept Concentration Score */
  conceptScore: float("conceptScore").default(0),
  /** Estimated distinct creative concepts */
  estimatedConcepts: int("estimatedConcepts").default(0),

  // Entity ID risk assessment (stored as JSON)
  entityIdRisk: json("entityIdRisk").$type<EntityIdRiskData>(),

  // Format breakdown (stored as JSON)
  formatBreakdown: json("formatBreakdown").$type<{
    video: number;
    image: number;
    carousel: number;
    collection: number;
  }>(),

  // Raw ad data snapshot
  metaAdsData: json("metaAdsData").$type<AdDataSnapshot>(),
  tiktokAdsData: json("tiktokAdsData").$type<AdDataSnapshot>(),

  // Creator gap analysis
  creatorGapData: json("creatorGapData").$type<CreatorGapData>(),

  // ─── Account-Level Metrics (only populated when client grants access) ───────
  /** Whether this audit includes first-party account data */
  hasAccountData: boolean("hasAccountData").default(false),
  /** First-Touch Incrementality score (0–100, 58+ = Growth zone) */
  ftiScore: float("ftiScore"),
  /** Click-through rate (%) — benchmark: 1.5%+ */
  ctrPct: float("ctrPct"),
  /** Thumb-stop rate: 3-sec views ÷ impressions (%) — benchmark: 25%+ */
  thumbStopRate: float("thumbStopRate"),
  /** Hold rate: 50% views ÷ impressions (%) — benchmark: 15%+ */
  holdRate: float("holdRate"),
  /** CPA delta vs brand BAU (%) — benchmark: -10% to -25% */
  cpaDeltaPct: float("cpaDeltaPct"),
  /** Meta Creative Similarity Score (0–100, <60 is healthy) */
  creativeSimilarityScore: float("creativeSimilarityScore"),
  /** Full account-level data payload */
  accountLevelData: json("accountLevelData").$type<AccountLevelData>(),

  // TikTok Shop Intelligence data (Creative Center + Affiliate API)
  tiktokShopData: json("tiktokShopData").$type<TikTokShopIntelligence>(),

  usedMockData: boolean("usedMockData").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Audit = typeof audits.$inferSelect;
export type InsertAudit = typeof audits.$inferInsert;

// Competitor mappings for an audit
export const auditCompetitors = mysqlTable("audit_competitors", {
  id: int("id").autoincrement().primaryKey(),
  auditId: int("auditId").notNull(),
  brandName: varchar("brandName", { length: 255 }).notNull(),
  metaPageId: varchar("metaPageId", { length: 64 }),
  totalAds: int("totalAds").default(0),
  partnershipPct: float("partnershipPct").default(0),
  andromedaScore: float("andromedaScore").default(0),
  estimatedSpendMin: int("estimatedSpendMin").default(0),
  estimatedSpendMax: int("estimatedSpendMax").default(0),
  usedMockData: boolean("usedMockData").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditCompetitor = typeof auditCompetitors.$inferSelect;
export type InsertAuditCompetitor = typeof auditCompetitors.$inferInsert;

/**
 * Account Access Grants — tracks which brands have given Tapline
 * read-only access to their Meta Ads Manager and/or TikTok Ads accounts.
 *
 * Access model:
 *   Meta: Brand adds audit@tapline.co as a Partner in Business Manager
 *         with "Analyst" role (view-only) on their ad account.
 *   TikTok: Brand adds audit@tapline.co as a "Viewer" in TikTok Ads Manager.
 *
 * Both grant read-only access — no ability to create, edit, or spend.
 * Access can be revoked by the brand at any time.
 */
export const accountAccess = mysqlTable("account_access", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(),
  brandName: varchar("brandName", { length: 255 }).notNull(),
  /** Contact email of the person who submitted the access request */
  contactEmail: varchar("contactEmail", { length: 320 }).notNull(),
  /** Status of the access grant */
  status: mysqlEnum("status", [
    "requested",   // brand has been sent instructions
    "pending",     // brand says they've granted access, awaiting verification
    "active",      // access confirmed and working
    "expired",     // access period ended
    "revoked",     // brand revoked access
  ]).default("requested").notNull(),
  /** Which platforms access has been granted for */
  metaAccessGranted: boolean("metaAccessGranted").default(false),
  tiktokAccessGranted: boolean("tiktokAccessGranted").default(false),
  /** Meta ad account ID (e.g. "act_123456789") */
  metaAdAccountId: varchar("metaAdAccountId", { length: 64 }),
  /** TikTok advertiser ID */
  tiktokAdvertiserId: varchar("tiktokAdvertiserId", { length: 64 }),
  /** Access expiry — default 90 days from grant */
  expiresAt: timestamp("expiresAt"),
  /** Notes from the brand or Tapline team */
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AccountAccess = typeof accountAccess.$inferSelect;
export type InsertAccountAccess = typeof accountAccess.$inferInsert;

// ─── Shared JSON Types ────────────────────────────────────────────────────────

export interface AdDataSnapshot {
  totalAds: number;
  partnershipAds: number;
  formatBreakdown: { video: number; image: number; carousel: number; collection: number };
  spendMin: number;
  spendMax: number;
  impressionsMin: number;
  impressionsMax: number;
  avgDurationDays: number;
  topAdIds?: string[];
}

export interface EntityIdRiskData {
  level: "low" | "medium" | "high" | "critical";
  label: string;
  description: string;
  adsPerConcept: number;
  suppressionRisk: boolean;
}

export interface CreatorGapData {
  organicCreators: OrganicCreator[];
  paidCreators: PaidCreator[];
  gapCount: number;
  opportunityScore: number;
}

export interface OrganicCreator {
  handle: string;
  platform: "meta" | "tiktok";
  followers: number;
  avgEngagement: number;
  brandMentions: number;
  inPaidPartnership: boolean;
}

export interface PaidCreator {
  handle: string;
  platform: "meta" | "tiktok";
  adCount: number;
}

/**
 * Account-level performance data — only available when client grants access.
 * All metrics are from Ads Manager (Meta Marketing API / TikTok Ads API).
 */
export interface AccountLevelData {
  /** First-Touch Incrementality — % of conversions from new audiences */
  ftiScore: number;
  ftiZone: "critical" | "healthy" | "growth";
  /** Click-through rate (%) */
  ctrPct: number;
  ctrVsBau: number; // delta vs brand BAU (%)
  /** Thumb-stop rate: 3-sec views ÷ impressions (%) */
  thumbStopRate: number;
  /** Hold rate: 50% views ÷ impressions (%) */
  holdRate: number;
  /** CPA delta vs brand BAU (%) — negative = better */
  cpaDeltaPct: number;
  /** Meta Creative Similarity Score (0–100) */
  creativeSimilarityScore?: number;
  /** Top creative themes by spend share */
  topCreativeThemes?: Array<{ theme: string; spendShare: number }>;
  /** Comment sentiment score (0–100) */
  commentSentiment?: number;
  /** Number of distinct creators active in the period */
  activeCreatorCount?: number;
  /** Creator tier breakdown */
  creatorTierBreakdown?: {
    nano: number;    // 1k–10k
    micro: number;   // 10k–50k
    midTier: number; // 50k–100k
    macro: number;   // 100k–500k
    mega: number;    // 500k+
  };
  /** Data freshness */
  dataAsOf: string; // ISO date
  metaAdAccountId?: string;
  tiktokAdvertiserId?: string;
}

/**
 * TikTok Shop Intelligence data — populated from the TikTok Creative Center
 * (unofficial endpoints, same data the TikTok web UI uses) and, once TikTok
 * Shop Partner status is approved, from the official Affiliate API.
 *
 * Data is scoped to the brand's primary product category and country (default: GB).
 */
export interface TikTokShopIntelligence {
  /** ISO date the data was fetched */
  dataAsOf: string;
  /** Whether this is mock/demo data or live from the API */
  isMock: boolean;
  /** Product category used for the category-level queries */
  category: string;
  /** Country code (default: GB) */
  country: string;

  /** Top creators driving GMV in this brand's category */
  topCreatorsByGmv: TikTokShopCreator[];

  /** Trending products in this brand's category */
  trendingProducts: TikTokShopProduct[];

  /** Top-performing Shop videos in this brand's category */
  topShopVideos: TikTokShopVideo[];

  /** Brand's own TikTok Shop presence (if available) */
  brandShopPresence?: {
    hasShop: boolean;
    totalProducts?: number;
    activeAffiliates?: number;
    estimatedMonthlyGmv?: string;
    openCollaboration: boolean;
  };

  /** Competitor TikTok Shop presence */
  competitorShopData?: TikTokShopCompetitor[];

  /** Category-level benchmarks */
  categoryBenchmarks: {
    avgCreatorGmv: string;
    avgConversionRate: number;
    avgCommissionRate: number;
    topCreatorFollowerRange: string;
    dominantContentType: "video" | "live" | "mixed";
  };
}

export interface TikTokShopCreator {
  handle: string;
  displayName: string;
  followers: number;
  /** Estimated monthly GMV in GBP */
  estimatedGmv: string;
  /** Number of products actively promoted */
  activeProducts: number;
  /** Average engagement rate (%) */
  avgEngagement: number;
  /** Creator tier */
  tier: "nano" | "micro" | "mid" | "macro" | "mega";
  /** Whether this creator is already partnered with the audited brand */
  isPartnerOfBrand: boolean;
  /** Primary content niche */
  niche: string;
  /** Audience demographics */
  audienceDemographics?: {
    primaryGender: "female" | "male" | "mixed";
    primaryAgeRange: string;
    topCountry: string;
  };
}

export interface TikTokShopProduct {
  productId: string;
  productName: string;
  category: string;
  /** Estimated monthly sales volume */
  estimatedMonthlySales: number;
  /** Price in GBP */
  price: number;
  /** Commission rate (%) */
  commissionRate: number;
  /** Number of active creator affiliates */
  activeAffiliates: number;
  /** Sales velocity trend */
  trend: "rising" | "stable" | "declining";
  /** Whether this is a competitor product */
  isCompetitorProduct: boolean;
  competitorBrand?: string;
}

export interface TikTokShopVideo {
  videoId: string;
  creatorHandle: string;
  creatorFollowers: number;
  /** Estimated GMV driven by this video */
  estimatedGmv: string;
  views: number;
  likes: number;
  /** Conversion rate (%) */
  conversionRate: number;
  /** Video hook type */
  hookType: "demo" | "testimonial" | "unboxing" | "tutorial" | "lifestyle" | "ugc";
  /** Duration in seconds */
  durationSeconds: number;
  /** Whether this video uses a product from the audited brand or competitor */
  brandType: "target" | "competitor" | "category";
}

export interface TikTokShopCompetitor {
  brandName: string;
  hasShop: boolean;
  totalProducts?: number;
  activeAffiliates?: number;
  estimatedMonthlyGmv?: string;
  openCollaboration: boolean;
  topCreatorCount?: number;
}
