export interface FormatBreakdown {
  video: number;
  image: number;
  carousel: number;
  collection: number;
}

export interface AdDataSnapshot {
  totalAds: number;
  partnershipAds: number;
  formatBreakdown: FormatBreakdown;
  spendMin: number;
  spendMax: number;
  impressionsMin: number;
  impressionsMax: number;
  avgDurationDays: number;
  topAdIds?: string[];
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

export interface CreatorGapData {
  organicCreators: OrganicCreator[];
  paidCreators: PaidCreator[];
  gapCount: number;
  opportunityScore: number;
}

export interface AuditCompetitor {
  id: number;
  auditId: number;
  brandName: string;
  metaPageId: string | null;
  totalAds: number | null;
  partnershipPct: number | null;
  andromedaScore: number | null;
  estimatedSpendMin: number | null;
  estimatedSpendMax: number | null;
  usedMockData: boolean | null;
  createdAt: Date;
}

// ─── TikTok Shop Intelligence Types ─────────────────────────────────────────

export interface TikTokShopCreatorFE {
  handle: string;
  niche: string;
  followers: number;
  avgEngagement: number;
  estimatedGmv: string;
  tier: "nano" | "micro" | "mid" | "macro" | "mega";
  isPartnerOfBrand: boolean;
  contentStyle: string;
}

export interface TikTokShopProductFE {
  productId: string;
  productName: string;
  category: string;
  price: number;
  commissionRate: number;
  estimatedMonthlySales: number;
  activeAffiliates: number;
  trend: "rising" | "stable" | "declining";
  isCompetitorProduct: boolean;
  competitorBrand?: string;
}

export interface TikTokShopVideoFE {
  videoId: string;
  creatorHandle: string;
  creatorFollowers: number;
  views: number;
  conversionRate: number;
  estimatedGmv: string;
  hookType: string;
  durationSeconds: number;
  brandType: "target" | "competitor" | "category";
}

export interface TikTokShopPresenceFE {
  hasShop: boolean;
  totalProducts?: number;
  activeAffiliates?: number;
  estimatedMonthlyGmv?: string;
  openCollaboration?: boolean;
}

export interface TikTokShopIntelligenceData {
  category: string;
  country: string;
  dataAsOf: string;
  isMock: boolean;
  topCreatorsByGmv: TikTokShopCreatorFE[];
  trendingProducts: TikTokShopProductFE[];
  topShopVideos: TikTokShopVideoFE[];
  brandShopPresence?: TikTokShopPresenceFE;
  competitorShopData?: (TikTokShopPresenceFE & { brandName: string })[];
  categoryBenchmarks: {
    avgCreatorGmv: string;
    avgConversionRate: number;
    avgCommissionRate: number;
    topCreatorFollowerRange: string;
  };
}

// ─── SimilarWeb Halo Effect Types ──────────────────────────────────────────

export interface ChannelMix {
  direct: number;
  organicSearch: number;
  paidSearch: number;
  social: number;
  referral: number;
  display: number;
  email: number;
}

export interface ChannelMixTrendPoint extends ChannelMix {
  month: string;
}

export interface MonthlyVisitPoint {
  month: string;
  visits: number;
}

export interface CaptureGap {
  detected: boolean;
  severity: "high" | "medium" | "none";
  socialTrafficPct: number;
  captureRate: number;
  diagnosis: string;
  recommendation: string;
}

export interface CompetitorTrafficPoint {
  brandName: string;
  domain: string;
  latestMonthlyVisits: number;
  socialTrafficPct: number;
}

export interface SimilarWebData {
  domain: string;
  dataAsOf: string;
  isMock: boolean;
  confidenceTier: "high" | "medium" | "low";
  confidenceNote: string;
  latestMonthlyVisits: number;
  globalRank: number | null;
  bounceRate: number | null;
  channelMix: ChannelMix | null;
  channelMixTrend: ChannelMixTrendPoint[] | null;
  monthlyVisitsTrend: MonthlyVisitPoint[] | null;
  captureGap: CaptureGap | null;
  competitorComparison: CompetitorTrafficPoint[] | null;
}

export interface Audit {
  id: number;
  shareId: string;
  brandId: number;
  brandName: string;
  period: string;
  platform: "meta" | "tiktok" | "combined";
  status: "pending" | "processing" | "complete" | "error";
  totalAds: number | null;
  partnershipAds: number | null;
  partnershipPct: number | null;
  estimatedSpendMin: number | null;
  estimatedSpendMax: number | null;
  estimatedImpressionsMin: number | null;
  estimatedImpressionsMax: number | null;

  // ─── Andromeda Readiness Score (4 dimensions) ──────────────────────────────
  andromedaScore: number | null;
  /** Format Diversity Index — structural variety across video, image, carousel, collection */
  formatScore: number | null;
  /** Creator Signal Score — % of ads featuring creator partnerships (benchmark: 30%+) */
  partnershipScore: number | null;
  /** Creative Freshness Score — ad flight duration and rotation */
  durationScore: number | null;
  /** Volume-to-Concept Ratio — structural concept diversity vs ad volume */
  conceptScore: number | null;
  /** Estimated number of structurally distinct creative concepts */
  estimatedConcepts: number | null;
  /** Entity ID collapse risk: "critical" | "high" | "medium" | "low" */
  entityIdRisk: "critical" | "high" | "medium" | "low" | null;

  // ─── Format & Platform Data ────────────────────────────────────────────────
  formatBreakdown: FormatBreakdown | null;
  metaAdsData: AdDataSnapshot | null;
  tiktokAdsData: AdDataSnapshot | null;
  creatorGapData: CreatorGapData | null;
  tiktokShopData: TikTokShopIntelligenceData | null;
  usedMockData: boolean | null;

  // ─── Account-Level Metrics (requires access grant) ────────────────────────
  hasAccountData: boolean | null;
  /** First-Touch Incrementality score (benchmark: 58%+) */
  ftiScore: number | null;
  /** CTR delta vs brand BAU (target: 13–20% above) */
  ctrPct: number | null;
  /** 3-second video view rate (benchmark: 25%+) */
  thumbStopRate: number | null;
  /** 50% video view rate (benchmark: 15%+) */
  holdRate: number | null;
  /** CPA delta vs brand BAU (target: 10–25% lower, so negative is good) */
  cpaDeltaPct: number | null;
  /** Meta's own creative similarity score (risk threshold: 60%) */
  creativeSimilarityScore: number | null;

  // ─── SimilarWeb Halo Effect ──────────────────────────────────────────────────
  brandDomain: string | null;
  similarwebData: SimilarWebData | null;

  createdAt: Date;
  updatedAt: Date;
}
