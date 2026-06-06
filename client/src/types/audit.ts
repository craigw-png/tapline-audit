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
  andromedaScore: number | null;
  formatScore: number | null;
  partnershipScore: number | null;
  durationScore: number | null;
  formatBreakdown: FormatBreakdown | null;
  metaAdsData: AdDataSnapshot | null;
  tiktokAdsData: AdDataSnapshot | null;
  creatorGapData: CreatorGapData | null;
  usedMockData: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}
