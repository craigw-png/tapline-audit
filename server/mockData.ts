/**
 * Mock Data Engine — Tapline
 *
 * Simulates real API responses for demonstration and development.
 * Primary mocks: Ninja Kitchen UK, Dreame Nederland
 * Competitor mocks: KitchenAid UK, Vitamix UK, Sage Appliances UK, Roborock NL, Dyson NL, Eufy NL
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

// ─── Dreame Nederland (Primary Mock — NL smart home appliances) ───────────────
// Research basis: Meta Ad Library NL shows ~28 active Dreame ads (product-focused,
// minimal creator partnerships). TikTok @dreame_nl has only 158 followers and 6 posts
// — essentially no TikTok presence. Competitors: Roborock, Dyson, Eufy dominate NL.
// TikTok Shop NL launches June 15 2026 — major opportunity for Dreame.

export const DREAME_META_MOCK: AdDataSnapshot = {
  totalAds: 28,
  partnershipAds: 2,
  formatBreakdown: { video: 18, image: 7, carousel: 3, collection: 0 },
  spendMin: 32000,
  spendMax: 140000,
  impressionsMin: 1800000,
  impressionsMax: 7200000,
  avgDurationDays: 21,
  topAdIds: ["meta_dreame_001", "meta_dreame_002", "meta_dreame_003"],
};

export const DREAME_TIKTOK_MOCK: AdDataSnapshot = {
  totalAds: 6,
  partnershipAds: 0,
  formatBreakdown: { video: 6, image: 0, carousel: 0, collection: 0 },
  spendMin: 4000,
  spendMax: 18000,
  impressionsMin: 280000,
  impressionsMax: 950000,
  avgDurationDays: 9,
  topAdIds: ["tiktok_dreame_001"],
};

export const DREAME_CREATOR_GAP_MOCK: CreatorGapData = {
  organicCreators: [
    {
      handle: "@schoonmaakmetlisa",
      platform: "tiktok",
      followers: 312000,
      avgEngagement: 5.4,
      brandMentions: 9,
      inPaidPartnership: false,
    },
    {
      handle: "@dutchhomevlog",
      platform: "tiktok",
      followers: 187000,
      avgEngagement: 6.1,
      brandMentions: 6,
      inPaidPartnership: false,
    },
    {
      handle: "@techthuis_nl",
      platform: "tiktok",
      followers: 94000,
      avgEngagement: 7.8,
      brandMentions: 5,
      inPaidPartnership: false,
    },
    {
      handle: "@huis_en_tuin_nl",
      platform: "meta",
      followers: 143000,
      avgEngagement: 3.9,
      brandMentions: 4,
      inPaidPartnership: false,
    },
    {
      handle: "@robotstofzuigertest",
      platform: "tiktok",
      followers: 68000,
      avgEngagement: 8.2,
      brandMentions: 7,
      inPaidPartnership: false,
    },
    {
      handle: "@slimwonen_nl",
      platform: "tiktok",
      followers: 229000,
      avgEngagement: 4.7,
      brandMentions: 3,
      inPaidPartnership: false,
    },
    {
      handle: "@cleaningtips_nederland",
      platform: "meta",
      followers: 76000,
      avgEngagement: 5.2,
      brandMentions: 5,
      inPaidPartnership: false,
    },
    {
      handle: "@gadgetguru_nl",
      platform: "tiktok",
      followers: 158000,
      avgEngagement: 6.9,
      brandMentions: 4,
      inPaidPartnership: true,
    },
  ],
  paidCreators: [
    { handle: "@gadgetguru_nl", platform: "tiktok", adCount: 1 },
    { handle: "@dreame_nl_official", platform: "meta", adCount: 1 },
  ],
  gapCount: 7,
  opportunityScore: 88,
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
  // NL smart home / robot vacuum competitors
  roborock: {
    name: "Roborock NL",
    totalAds: 41,
    partnershipPct: 12,
    andromedaScore: 58,
    estimatedSpendMin: 38000,
    estimatedSpendMax: 155000,
    formatBreakdown: { video: 26, image: 10, carousel: 4, collection: 1 },
    avgDurationDays: 17,
  },
  dyson: {
    name: "Dyson NL",
    totalAds: 72,
    partnershipPct: 29,
    andromedaScore: 74,
    estimatedSpendMin: 120000,
    estimatedSpendMax: 480000,
    formatBreakdown: { video: 38, image: 22, carousel: 10, collection: 2 },
    avgDurationDays: 13,
  },
  eufy: {
    name: "Eufy NL",
    totalAds: 35,
    partnershipPct: 34,
    andromedaScore: 69,
    estimatedSpendMin: 28000,
    estimatedSpendMax: 110000,
    formatBreakdown: { video: 22, image: 9, carousel: 4, collection: 0 },
    avgDurationDays: 14,
  },
  sharkninja: {
    name: "SharkNinja NL",
    totalAds: 48,
    partnershipPct: 21,
    andromedaScore: 63,
    estimatedSpendMin: 55000,
    estimatedSpendMax: 210000,
    formatBreakdown: { video: 30, image: 12, carousel: 5, collection: 1 },
    avgDurationDays: 15,
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
  "dreame": {
    name: "Dreame Nederland",
    slug: "dreame-nederland",
    metaPageId: "dreame_nederland",
    tiktokHandle: "@dreame_nl",
    industry: "Smart Home Appliances",
    competitorSlugs: ["roborock", "dyson", "eufy"],
  },
  "dreame nederland": {
    name: "Dreame Nederland",
    slug: "dreame-nederland",
    metaPageId: "dreame_nederland",
    tiktokHandle: "@dreame_nl",
    industry: "Smart Home Appliances",
    competitorSlugs: ["roborock", "dyson", "eufy"],
  },
  "dreame nl": {
    name: "Dreame Nederland",
    slug: "dreame-nederland",
    metaPageId: "dreame_nederland",
    tiktokHandle: "@dreame_nl",
    industry: "Smart Home Appliances",
    competitorSlugs: ["roborock", "dyson", "eufy"],
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
 * Get mock ad data for a brand. Falls back to generic mock if not a known brand.
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

  if (brandSlug.includes("dreame")) {
    return {
      meta: DREAME_META_MOCK,
      tiktok: DREAME_TIKTOK_MOCK,
      creatorGap: DREAME_CREATOR_GAP_MOCK,
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
