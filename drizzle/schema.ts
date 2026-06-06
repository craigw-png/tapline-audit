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
  // Andromeda scores
  andromedaScore: float("andromedaScore").default(0),
  formatScore: float("formatScore").default(0),
  partnershipScore: float("partnershipScore").default(0),
  durationScore: float("durationScore").default(0),
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

// Shared JSON types
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
