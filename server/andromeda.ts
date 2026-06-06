/**
 * Andromeda Algorithm — Tapline's proprietary creative diversity scoring engine.
 *
 * Scores a brand's ad portfolio across four dimensions, each named to reflect
 * what Meta's Andromeda retrieval engine actually rewards:
 *
 *   1. Format Diversity Index   — mix of ad formats (video, image, carousel, collection)
 *   2. Creator Signal Score     — % of ads featuring creator partnerships (target: 30%+)
 *   3. Creative Freshness Score — ad fatigue risk based on average flight duration
 *   4. Concept Concentration    — volume-to-concept ratio; flags Entity ID collapse risk
 *
 * Each sub-score is 0–100. The overall Andromeda Readiness Score is a weighted average.
 * Weights: Format 25% | Creator Signal 40% | Freshness 15% | Concept 20%
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
  /** Optional: number of estimated distinct creative concepts (from account-level data or heuristic) */
  estimatedConcepts?: number;
  /** Optional: Meta Creative Similarity Score (0–100, from Ads Manager) */
  creativeSimilarityScore?: number;
}

export interface EntityIdRisk {
  level: "low" | "medium" | "high" | "critical";
  label: string;
  description: string;
  adsPerConcept: number;
  suppressionRisk: boolean;
}

export interface AndromedaResult {
  /** Overall Andromeda Readiness Score (0–100) */
  andromedaScore: number;
  /** Format Diversity Index: how spread the creative formats are */
  formatScore: number;
  /** Creator Signal Score: partnership % vs 30% benchmark */
  partnershipScore: number;
  /** Creative Freshness Score: ad flight length as fatigue proxy */
  durationScore: number;
  /** Concept Concentration Score: volume-to-concept ratio */
  conceptScore: number;
  partnershipPct: number;
  grade: "A" | "B" | "C" | "D" | "F";
  insights: string[];
  entityIdRisk: EntityIdRisk;
  /** Estimated number of distinct creative concepts */
  estimatedConcepts: number;
}

const PARTNERSHIP_TARGET = 0.3; // 30% benchmark
const CONCEPT_TARGET = 30; // 30+ distinct concepts/month is the playbook benchmark
const SIMILARITY_SUPPRESSION_THRESHOLD = 60; // ~60% similarity triggers Entity ID collapse

// ─── Sub-score Calculators ────────────────────────────────────────────────────

/**
 * Format Diversity Index: measures how diversified the creative formats are.
 * Uses normalised Shannon entropy across the four format types.
 * A perfectly even split across all 4 formats = 100.
 */
function calcFormatDiversityIndex(
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
  const maxEntropy = Math.log2(4);
  const normalised = entropy / maxEntropy;

  // Penalise if only 1 format used — single-format = no diversity
  const diversityBonus =
    nonZero.length >= 3 ? 1.0 : nonZero.length === 2 ? 0.8 : 0.5;

  return Math.round(Math.min(100, normalised * 100 * diversityBonus));
}

/**
 * Creator Signal Score: measures creator partnership investment.
 * 30%+ = 100. Linear scale below 30%.
 * This directly maps to the Andromeda engine's preference for diverse creator identities
 * (each creator = a new Entity ID = a new node in the retrieval index).
 */
function calcCreatorSignalScore(partnershipAds: number, totalAds: number): number {
  if (totalAds === 0) return 0;
  const pct = partnershipAds / totalAds;
  if (pct >= PARTNERSHIP_TARGET) return 100;
  return Math.round((pct / PARTNERSHIP_TARGET) * 100);
}

/**
 * Creative Freshness Score: measures creative fatigue risk.
 * Ideal range: 7–21 days. Longer = fatigue risk (lower score).
 * Very short (<3 days) = testing/churn risk (moderate penalty).
 */
function calcCreativeFreshnessScore(avgDurationDays: number): number {
  if (avgDurationDays <= 0) return 50;
  if (avgDurationDays < 3) return 60;
  if (avgDurationDays <= 7) return 85;
  if (avgDurationDays <= 14) return 100;
  if (avgDurationDays <= 21) return 90;
  if (avgDurationDays <= 30) return 70;
  if (avgDurationDays <= 45) return 50;
  if (avgDurationDays <= 60) return 30;
  return 10;
}

/**
 * Concept Concentration Score: estimates how many structurally distinct creative
 * concepts a brand is running relative to its total ad volume.
 *
 * The playbook benchmark is 30+ distinct concepts/month. When a brand has high ad
 * volume but few distinct concepts, Andromeda collapses near-duplicates into a single
 * Entity ID — so 50 cosmetic variants of one idea get one auction ticket, not 50.
 *
 * Estimation heuristic (without account-level data):
 *   - If estimatedConcepts is provided (from account access), use it directly.
 *   - Otherwise, estimate from ad volume: assume ~1 concept per 3–5 ads as a baseline,
 *     with diminishing returns at high volumes (more ads = more likely to be variants).
 */
function calcConceptConcentrationScore(
  totalAds: number,
  estimatedConcepts?: number
): { score: number; concepts: number } {
  if (totalAds === 0) return { score: 0, concepts: 0 };

  let concepts: number;
  if (estimatedConcepts !== undefined && estimatedConcepts > 0) {
    concepts = estimatedConcepts;
  } else {
    // Heuristic: estimate distinct concepts from ad volume
    // Small volumes: ~1 concept per 2 ads
    // Medium volumes: ~1 concept per 4 ads (more variants)
    // Large volumes: ~1 concept per 6 ads (heavy variant testing)
    if (totalAds <= 10) {
      concepts = Math.max(1, Math.round(totalAds * 0.5));
    } else if (totalAds <= 30) {
      concepts = Math.max(2, Math.round(totalAds * 0.35));
    } else if (totalAds <= 60) {
      concepts = Math.max(3, Math.round(totalAds * 0.25));
    } else {
      concepts = Math.max(5, Math.round(totalAds * 0.15));
    }
  }

  // Score: 30+ concepts = 100, linear below
  const score =
    concepts >= CONCEPT_TARGET
      ? 100
      : Math.round((concepts / CONCEPT_TARGET) * 100);

  return { score, concepts };
}

/**
 * Entity ID Risk Assessment: evaluates the risk that Meta is collapsing
 * near-duplicate ads into a single Entity ID, throttling reach.
 *
 * Risk factors:
 *   - High ads-per-concept ratio (many variants of few ideas)
 *   - High creative similarity score (from Ads Manager, if available)
 *   - Single-format dominance (all video, no structural variety)
 */
function calcEntityIdRisk(
  totalAds: number,
  estimatedConcepts: number,
  formatBreakdown: AndromedaInput["formatBreakdown"],
  creativeSimilarityScore?: number
): EntityIdRisk {
  const adsPerConcept = estimatedConcepts > 0 ? totalAds / estimatedConcepts : totalAds;

  // Check creative similarity score if available (from Ads Manager)
  const similarityRisk =
    creativeSimilarityScore !== undefined &&
    creativeSimilarityScore >= SIMILARITY_SUPPRESSION_THRESHOLD;

  // Check format concentration
  const formats = Object.values(formatBreakdown);
  const maxFormat = Math.max(...formats);
  const formatConcentration = totalAds > 0 ? maxFormat / totalAds : 1;
  const singleFormatDominant = formatConcentration > 0.85;

  // Determine risk level
  let level: EntityIdRisk["level"];
  let label: string;
  let description: string;

  if (similarityRisk || adsPerConcept >= 12) {
    level = "critical";
    label = "Critical — Entity ID Collapse Likely";
    description = `With ~${Math.round(adsPerConcept)} ads per concept${similarityRisk ? ` and a Creative Similarity Score above ${SIMILARITY_SUPPRESSION_THRESHOLD}%` : ""}, Meta is almost certainly collapsing near-duplicate ads into single Entity IDs. Your ad volume is not translating into reach — you are competing against yourself in the auction.`;
  } else if (adsPerConcept >= 7 || singleFormatDominant) {
    level = "high";
    label = "High — Suppression Risk";
    description = `~${Math.round(adsPerConcept)} ads per concept suggests heavy variant testing of a small number of ideas. Andromeda may be grouping similar assets, limiting how many distinct audience pockets your ads can reach.`;
  } else if (adsPerConcept >= 4) {
    level = "medium";
    label = "Medium — Monitor Closely";
    description = `~${Math.round(adsPerConcept)} ads per concept is within a manageable range but warrants attention. Ensure variants are structurally different (new persona, hook style, or copy angle) rather than cosmetic edits.`;
  } else {
    level = "low";
    label = "Low — Healthy Concept Diversity";
    description = `~${Math.round(adsPerConcept)} ads per concept indicates a healthy spread of structurally distinct creative ideas, each earning its own Entity ID and auction slot.`;
  }

  return {
    level,
    label,
    description,
    adsPerConcept: Math.round(adsPerConcept * 10) / 10,
    suppressionRisk: level === "critical" || level === "high",
  };
}

/**
 * Grade the overall Andromeda Readiness Score.
 */
function calcGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

/**
 * Generate human-readable insights based on sub-scores and Entity ID risk.
 */
function generateInsights(
  result: Omit<AndromedaResult, "insights">,
  input: AndromedaInput
): string[] {
  const insights: string[] = [];

  // Creator Signal — highest weight, most impactful
  if (result.partnershipPct < 0.1) {
    insights.push(
      `Only ${(result.partnershipPct * 100).toFixed(1)}% of ads feature creator partnerships — well below the 30% benchmark. Each creator is a distinct Entity ID in Andromeda's index; without them, the brand is competing for reach with a single identity.`
    );
  } else if (result.partnershipPct < PARTNERSHIP_TARGET) {
    insights.push(
      `Creator Signal Score: ${(result.partnershipPct * 100).toFixed(1)}% partnership ads, short of the 30% Andromeda benchmark. Closing this gap unlocks new audience pockets the brand's own identity cannot reach.`
    );
  } else {
    insights.push(
      `Strong Creator Signal at ${(result.partnershipPct * 100).toFixed(1)}% — above the 30% benchmark. Focus on diversifying creator tiers (60% core / 30% adjacent / 10% exploratory) to maximise Entity ID spread.`
    );
  }

  // Entity ID risk — critical flag
  if (result.entityIdRisk.suppressionRisk) {
    insights.push(
      `Entity ID Collapse Risk (${result.entityIdRisk.label}): ${result.entityIdRisk.description}`
    );
  }

  // Format Diversity
  if (result.formatScore < 50) {
    insights.push(
      "Format Diversity Index is low — creative formats are heavily concentrated. Diversifying into video, carousel, and collection formats gives Andromeda more structural variety to route to different audiences."
    );
  } else if (result.formatScore < 75) {
    insights.push(
      "Good format variety, but there is room to expand into underused formats. Each distinct format combination can register as a new creative signal."
    );
  }

  // Creative Freshness
  if (input.avgDurationDays > 30) {
    insights.push(
      `Creative Freshness Score is low — average ad flight of ${input.avgDurationDays} days signals fatigue risk. The 70/20/10 refresh model (70% proven scale, 20% iteration, 10% exploration) recommends refreshing the exploratory 10% every 3–4 weeks.`
    );
  }

  // Concept Concentration
  if (result.conceptScore < 50) {
    insights.push(
      `Concept Concentration is high — estimated ${result.estimatedConcepts} distinct concepts across ${input.totalAds} ads. The Andromeda benchmark is 30+ distinct concepts per month. Structural variety (new persona, hook style, copy angle) — not cosmetic edits — is what earns new Entity IDs.`
    );
  }

  // Overall
  if (result.andromedaScore < 40) {
    insights.push(
      "The overall Andromeda Readiness Score indicates significant room for improvement. A structured creator partnership programme addressing all four dimensions would have the highest impact on paid reach and CPA efficiency."
    );
  }

  return insights;
}

/**
 * Main scoring function — Andromeda Readiness Score.
 */
export function scoreAndromeda(input: AndromedaInput): AndromedaResult {
  const formatScore = calcFormatDiversityIndex(input.formatBreakdown, input.totalAds);
  const partnershipScore = calcCreatorSignalScore(input.partnershipAds, input.totalAds);
  const durationScore = calcCreativeFreshnessScore(input.avgDurationDays);
  const { score: conceptScore, concepts: estimatedConcepts } = calcConceptConcentrationScore(
    input.totalAds,
    input.estimatedConcepts
  );

  // Weighted average: Creator Signal 40% | Concept 20% | Format 25% | Freshness 15%
  const andromedaScore = Math.round(
    partnershipScore * 0.4 +
    conceptScore * 0.2 +
    formatScore * 0.25 +
    durationScore * 0.15
  );

  const partnershipPct =
    input.totalAds > 0 ? input.partnershipAds / input.totalAds : 0;
  const grade = calcGrade(andromedaScore);

  const entityIdRisk = calcEntityIdRisk(
    input.totalAds,
    estimatedConcepts,
    input.formatBreakdown,
    input.creativeSimilarityScore
  );

  const partial: Omit<AndromedaResult, "insights"> = {
    andromedaScore,
    formatScore,
    partnershipScore,
    durationScore,
    conceptScore,
    partnershipPct,
    grade,
    entityIdRisk,
    estimatedConcepts,
  };

  const insights = generateInsights(partial, input);

  return { ...partial, insights };
}
