/**
 * Mock Data Engine — Tapline
 *
 * Simulates real API responses for demonstration and development.
 * Primary mock: Ninja Kitchen UK, May 2026 (~52 ads, ~8% partnership ads)
 * Competitor mocks: KitchenAid UK, Vitamix UK, Sage Appliances UK
 */

import type { AdDataSnapshot, CreatorGapData } from "../drizzle/schema";

// ─── Ninja Kitchen UK (Primary Mock) ─────────────────────────────────────────

export const NINJA_META_MOCK: AdDataSnapshot = {
  totalAds: 38,
  partnershipAds: 3,
  formatBreakdown: { video: 22, image: 11, carousel: 4, collection: 1 },
  spendMin: 45000,
  spendMax: 180000,
  impressionsMin: 2800000,
  impressionsMax: 9500000,
  avgDurationDays: 18,
  topAdIds: ["meta_nk_001", "meta_nk_002", "meta_nk_003"],
};

export const NINJA_TIKTOK_MOCK: AdDataSnapshot = {
  totalAds: 14,
  partnershipAds: 1,
  formatBreakdown: { video: 13, image: 1, carousel: 0, collection: 0 },
  spendMin: 12000,
  spendMax: 48000,
  impressionsMin: 850000,
  impressionsMax: 3200000,
  avgDurationDays: 12,
  topAdIds: ["tiktok_nk_001", "tiktok_nk_002"],
};

export const NINJA_CREATOR_GAP_MOCK: CreatorGapData = {
  organicCreators: [
    {
      handle: "@sophieskitchenuk",
      platform: "tiktok",
      followers: 284000,
      avgEngagement: 4.2,
      brandMentions: 7,
      inPaidPartnership: false,
    },
    {
      handle: "@ukfoodielife",
      platform: "tiktok",
      followers: 156000,
      avgEngagement: 5.8,
      brandMentions: 5,
      inPaidPartnership: false,
    },
    {
      handle: "@healthymealsprep",
      platform: "meta",
      followers: 98000,
      avgEngagement: 3.1,
      brandMentions: 4,
      inPaidPartnership: false,
    },
    {
      handle: "@britishcookingshow",
      platform: "tiktok",
      followers: 421000,
      avgEngagement: 6.3,
      brandMentions: 3,
      inPaidPartnership: true,
    },
    {
      handle: "@mealprepmike_uk",
      platform: "tiktok",
      followers: 73000,
      avgEngagement: 7.1,
      brandMentions: 6,
      inPaidPartnership: false,
    },
    {
      handle: "@thefoodlabuk",
      platform: "meta",
      followers: 210000,
      avgEngagement: 2.9,
      brandMentions: 3,
      inPaidPartnership: false,
    },
    {
      handle: "@airfryerqueen",
      platform: "tiktok",
      followers: 512000,
      avgEngagement: 8.4,
      brandMentions: 9,
      inPaidPartnership: false,
    },
    {
      handle: "@quickdinners_uk",
      platform: "tiktok",
      followers: 89000,
      avgEngagement: 5.2,
      brandMentions: 4,
      inPaidPartnership: false,
    },
  ],
  paidCreators: [
    { handle: "@britishcookingshow", platform: "tiktok", adCount: 2 },
    { handle: "@ninjafoodie_official", platform: "meta", adCount: 1 },
    { handle: "@airfryerrecipes_uk", platform: "tiktok", adCount: 1 },
  ],
  gapCount: 7,
  opportunityScore: 82,
};

// ─── Competitor Mocks ─────────────────────────────────────────────────────────

export interface CompetitorMock {
  name: string;
  totalAds: number;
  partnershipPct: number;
  andromedaScore: number;
  estimatedSpendMin: number;
  estimatedSpendMax: number;
  formatBreakdown: { video: number; image: number; carousel: number; collection: number };
  avgDurationDays: number;
}

export const COMPETITOR_MOCKS: Record<string, CompetitorMock> = {
  kitchenaid: {
    name: "KitchenAid UK",
    totalAds: 64,
    partnershipPct: 31,
    andromedaScore: 72,
    estimatedSpendMin: 85000,
    estimatedSpendMax: 320000,
    formatBreakdown: { video: 28, image: 20, carousel: 12, collection: 4 },
    avgDurationDays: 14,
  },
  vitamix: {
    name: "Vitamix UK",
    totalAds: 29,
    partnershipPct: 17,
    andromedaScore: 54,
    estimatedSpendMin: 28000,
    estimatedSpendMax: 95000,
    formatBreakdown: { video: 18, image: 8, carousel: 3, collection: 0 },
    avgDurationDays: 22,
  },
  sage: {
    name: "Sage Appliances UK",
    totalAds: 47,
    partnershipPct: 38,
    andromedaScore: 79,
    estimatedSpendMin: 62000,
    estimatedSpendMax: 240000,
    formatBreakdown: { video: 24, image: 12, carousel: 8, collection: 3 },
    avgDurationDays: 11,
  },
  delonghi: {
    name: "De'Longhi UK",
    totalAds: 55,
    partnershipPct: 22,
    andromedaScore: 61,
    estimatedSpendMin: 70000,
    estimatedSpendMax: 280000,
    formatBreakdown: { video: 30, image: 15, carousel: 8, collection: 2 },
    avgDurationDays: 16,
  },
  instantpot: {
    name: "Instant Pot UK",
    totalAds: 33,
    partnershipPct: 45,
    andromedaScore: 84,
    estimatedSpendMin: 40000,
    estimatedSpendMax: 150000,
    formatBreakdown: { video: 20, image: 7, carousel: 5, collection: 1 },
    avgDurationDays: 9,
  },
};

// ─── Brand Resolution Mocks ───────────────────────────────────────────────────

export interface BrandResolutionMock {
  name: string;
  slug: string;
  metaPageId: string;
  tiktokHandle: string;
  industry: string;
  competitorSlugs: string[];
}

export const BRAND_RESOLUTION_MOCKS: Record<string, BrandResolutionMock> = {
  "ninja kitchen": {
    name: "Ninja Kitchen UK",
    slug: "ninja-kitchen-uk",
    metaPageId: "516372968508625",
    tiktokHandle: "@ninjaukitchen",
    industry: "Kitchen Appliances",
    competitorSlugs: ["kitchenaid", "sage", "instantpot"],
  },
  "ninja": {
    name: "Ninja Kitchen UK",
    slug: "ninja-kitchen-uk",
    metaPageId: "516372968508625",
    tiktokHandle: "@ninjaukitchen",
    industry: "Kitchen Appliances",
    competitorSlugs: ["kitchenaid", "sage", "instantpot"],
  },
  "kitchenaid": {
    name: "KitchenAid UK",
    slug: "kitchenaid-uk",
    metaPageId: "123456789",
    tiktokHandle: "@kitchenaiduk",
    industry: "Kitchen Appliances",
    competitorSlugs: ["ninja-kitchen-uk", "sage", "vitamix"],
  },
  "sage": {
    name: "Sage Appliances UK",
    slug: "sage-appliances-uk",
    metaPageId: "987654321",
    tiktokHandle: "@sageappliancesuk",
    industry: "Kitchen Appliances",
    competitorSlugs: ["ninja-kitchen-uk", "kitchenaid", "delonghi"],
  },
};

/**
 * Resolve a brand name to mock data. Returns null if not found.
 */
export function resolveBrandMock(query: string): BrandResolutionMock | null {
  const key = query.toLowerCase().trim();
  // Exact match first
  if (BRAND_RESOLUTION_MOCKS[key]) return BRAND_RESOLUTION_MOCKS[key];
  // Partial match
  for (const [k, v] of Object.entries(BRAND_RESOLUTION_MOCKS)) {
    if (k.includes(key) || key.includes(k)) return v;
  }
  // Generic fallback for any brand
  return {
    name: query,
    slug: query.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    metaPageId: "",
    tiktokHandle: `@${query.toLowerCase().replace(/\s+/g, "")}`,
    industry: "Consumer Goods",
    competitorSlugs: ["kitchenaid", "sage", "vitamix"],
  };
}

/**
 * Get mock ad data for a brand. Falls back to generic mock if not Ninja.
 */
export function getMockAdData(brandSlug: string): {
  meta: AdDataSnapshot;
  tiktok: AdDataSnapshot;
  creatorGap: CreatorGapData;
} {
  if (brandSlug.includes("ninja")) {
    return {
      meta: NINJA_META_MOCK,
      tiktok: NINJA_TIKTOK_MOCK,
      creatorGap: NINJA_CREATOR_GAP_MOCK,
    };
  }

  // Generic mock for other brands
  const totalMeta = Math.floor(Math.random() * 60) + 20;
  const partnershipMeta = Math.floor(totalMeta * (Math.random() * 0.35 + 0.05));
  const totalTiktok = Math.floor(Math.random() * 25) + 5;
  const partnershipTiktok = Math.floor(totalTiktok * (Math.random() * 0.4 + 0.05));

  return {
    meta: {
      totalAds: totalMeta,
      partnershipAds: partnershipMeta,
      formatBreakdown: {
        video: Math.floor(totalMeta * 0.55),
        image: Math.floor(totalMeta * 0.3),
        carousel: Math.floor(totalMeta * 0.12),
        collection: Math.floor(totalMeta * 0.03),
      },
      spendMin: Math.floor(Math.random() * 50000) + 20000,
      spendMax: Math.floor(Math.random() * 200000) + 80000,
      impressionsMin: Math.floor(Math.random() * 2000000) + 500000,
      impressionsMax: Math.floor(Math.random() * 8000000) + 2000000,
      avgDurationDays: Math.floor(Math.random() * 20) + 8,
    },
    tiktok: {
      totalAds: totalTiktok,
      partnershipAds: partnershipTiktok,
      formatBreakdown: {
        video: totalTiktok - 1,
        image: 1,
        carousel: 0,
        collection: 0,
      },
      spendMin: Math.floor(Math.random() * 20000) + 5000,
      spendMax: Math.floor(Math.random() * 80000) + 20000,
      impressionsMin: Math.floor(Math.random() * 1000000) + 200000,
      impressionsMax: Math.floor(Math.random() * 4000000) + 1000000,
      avgDurationDays: Math.floor(Math.random() * 15) + 5,
    },
    creatorGap: NINJA_CREATOR_GAP_MOCK,
  };
}

/**
 * Get competitor mock data for a list of competitor names.
 */
export function getCompetitorMocks(names: string[]): CompetitorMock[] {
  return names.map((name) => {
    const key = name.toLowerCase().replace(/[^a-z]/g, "");
    // Try to find a matching key
    for (const [k, v] of Object.entries(COMPETITOR_MOCKS)) {
      if (key.includes(k) || k.includes(key)) return v;
    }
    // Generic competitor
    const totalAds = Math.floor(Math.random() * 50) + 15;
    const partnershipPct = Math.floor(Math.random() * 40) + 5;
    return {
      name,
      totalAds,
      partnershipPct,
      andromedaScore: Math.floor(Math.random() * 50) + 30,
      estimatedSpendMin: Math.floor(Math.random() * 40000) + 15000,
      estimatedSpendMax: Math.floor(Math.random() * 150000) + 60000,
      formatBreakdown: {
        video: Math.floor(totalAds * 0.6),
        image: Math.floor(totalAds * 0.25),
        carousel: Math.floor(totalAds * 0.12),
        collection: Math.floor(totalAds * 0.03),
      },
      avgDurationDays: Math.floor(Math.random() * 20) + 7,
    };
  });
}
