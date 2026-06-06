/**
 * Andromeda Algorithm — Tapline's proprietary creative diversity scoring engine.
 *
 * Scores a brand's ad portfolio across three dimensions:
 *   1. Format Score      — diversity of ad formats (video, image, carousel, collection)
 *   2. Partnership Score — % of ads featuring creator partnerships (target: 30%+)
 *   3. Duration Score    — ad fatigue risk based on average flight duration
 *
 * Each sub-score is 0–100. The overall Andromeda Score is a weighted average.
 */

export interface AndromedaInput {
  totalAds: number;
  partnershipAds: number;
  formatBreakdown: {
    video: number;
    image: number;
    carousel: number;
    collection: number;
  };
  avgDurationDays: number;
}

export interface AndromedaResult {
  andromedaScore: number;
  formatScore: number;
  partnershipScore: number;
  durationScore: number;
  partnershipPct: number;
  grade: "A" | "B" | "C" | "D" | "F";
  insights: string[];
}

const PARTNERSHIP_TARGET = 0.3; // 30% benchmark

/**
 * Format Score: measures how diversified the creative formats are.
 * Uses a normalised entropy calculation across the four format types.
 * A perfectly even split across all 4 formats = 100.
 */
function calcFormatScore(
  breakdown: AndromedaInput["formatBreakdown"],
  total: number
): number {
  if (total === 0) return 0;
  const formats = [
    breakdown.video,
    breakdown.image,
    breakdown.carousel,
    breakdown.collection,
  ];
  const nonZero = formats.filter((f) => f > 0);
  if (nonZero.length === 0) return 0;

  // Shannon entropy normalised to [0, 1]
  let entropy = 0;
  for (const count of formats) {
    if (count === 0) continue;
    const p = count / total;
    entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(4); // max entropy with 4 categories
  const normalised = entropy / maxEntropy;

  // Penalise if only 1 format used
  const diversityBonus = nonZero.length >= 3 ? 1.0 : nonZero.length === 2 ? 0.8 : 0.5;

  return Math.round(Math.min(100, normalised * 100 * diversityBonus));
}

/**
 * Partnership Score: measures creator partnership investment.
 * 30%+ = 100. Linear scale below 30%.
 */
function calcPartnershipScore(partnershipAds: number, totalAds: number): number {
  if (totalAds === 0) return 0;
  const pct = partnershipAds / totalAds;
  if (pct >= PARTNERSHIP_TARGET) return 100;
  return Math.round((pct / PARTNERSHIP_TARGET) * 100);
}

/**
 * Duration Score: measures creative freshness / fatigue risk.
 * Ideal range: 7–21 days. Longer = fatigue risk (lower score).
 * Very short (<3 days) = testing/churn risk (moderate penalty).
 */
function calcDurationScore(avgDurationDays: number): number {
  if (avgDurationDays <= 0) return 50; // unknown
  if (avgDurationDays < 3) return 60; // too short — testing churn
  if (avgDurationDays <= 7) return 85; // short, fresh
  if (avgDurationDays <= 14) return 100; // ideal
  if (avgDurationDays <= 21) return 90; // good
  if (avgDurationDays <= 30) return 70; // getting stale
  if (avgDurationDays <= 45) return 50; // stale
  if (avgDurationDays <= 60) return 30; // high fatigue risk
  return 10; // very high fatigue risk
}

/**
 * Grade the overall Andromeda Score.
 */
function calcGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

/**
 * Generate human-readable insights based on sub-scores.
 */
function generateInsights(
  result: Omit<AndromedaResult, "insights">,
  input: AndromedaInput
): string[] {
  const insights: string[] = [];

  if (result.partnershipPct < 0.1) {
    insights.push(
      `Only ${(result.partnershipPct * 100).toFixed(1)}% of ads feature creator partnerships — well below the 30% benchmark. This is the single biggest opportunity.`
    );
  } else if (result.partnershipPct < PARTNERSHIP_TARGET) {
    insights.push(
      `Partnership ads are at ${(result.partnershipPct * 100).toFixed(1)}%, short of the 30% Andromeda benchmark. Closing this gap could significantly improve reach and authenticity.`
    );
  } else {
    insights.push(
      `Strong creator partnership investment at ${(result.partnershipPct * 100).toFixed(1)}% — above the 30% benchmark. Focus on diversifying creator tiers.`
    );
  }

  if (result.formatScore < 50) {
    insights.push(
      "Creative formats are heavily concentrated — diversifying into video, carousel, and collection formats will improve algorithm performance."
    );
  } else if (result.formatScore < 75) {
    insights.push(
      "Good format variety, but there is room to expand into underused formats for broader audience reach."
    );
  }

  if (input.avgDurationDays > 30) {
    insights.push(
      `Average ad flight of ${input.avgDurationDays} days signals creative fatigue risk. Refreshing creatives more frequently is recommended.`
    );
  }

  if (result.andromedaScore < 40) {
    insights.push(
      "The overall Andromeda Score indicates significant room for improvement across all three dimensions. A structured creator partnership programme would have the highest impact."
    );
  }

  return insights;
}

/**
 * Main scoring function.
 */
export function scoreAndromeda(input: AndromedaInput): AndromedaResult {
  const formatScore = calcFormatScore(input.formatBreakdown, input.totalAds);
  const partnershipScore = calcPartnershipScore(input.partnershipAds, input.totalAds);
  const durationScore = calcDurationScore(input.avgDurationDays);

  // Weighted average: partnership is most important (50%), format (30%), duration (20%)
  const andromedaScore = Math.round(
    formatScore * 0.3 + partnershipScore * 0.5 + durationScore * 0.2
  );

  const partnershipPct =
    input.totalAds > 0 ? input.partnershipAds / input.totalAds : 0;
  const grade = calcGrade(andromedaScore);

  const partial = { andromedaScore, formatScore, partnershipScore, durationScore, partnershipPct, grade };
  const insights = generateInsights(partial, input);

  return { ...partial, insights };
}
