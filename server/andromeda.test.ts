import { describe, expect, it } from "vitest";
import { scoreAndromeda } from "./andromeda";

describe("Andromeda Algorithm — Andromeda Readiness Score", () => {
  // ─── Ninja Kitchen UK baseline (mock data: 52 ads, ~8% partnership) ──────────
  it("scores Ninja Kitchen UK mock data correctly", () => {
    const result = scoreAndromeda({
      totalAds: 52,
      partnershipAds: 4, // ~8%
      formatBreakdown: { video: 35, image: 12, carousel: 4, collection: 1 },
      avgDurationDays: 18,
    });

    // Partnership is 4/52 = 7.7%, well below 30% target → low partnership score
    expect(result.partnershipPct).toBeCloseTo(0.077, 2);
    expect(result.partnershipScore).toBeLessThan(30);

    // Format is somewhat diverse (4 types) → moderate format score
    expect(result.formatScore).toBeGreaterThan(30);

    // Duration 18 days is good → high duration score
    expect(result.durationScore).toBeGreaterThanOrEqual(85);

    // Concept score should be defined and positive
    expect(result.conceptScore).toBeGreaterThan(0);
    expect(result.estimatedConcepts).toBeGreaterThan(0);

    // Entity ID risk is medium for Ninja Kitchen — 4 ads/concept is borderline
    // (risk is driven by partnership %, not just volume)
    expect(["critical", "high", "medium"]).toContain(result.entityIdRisk.level);

    // Overall score should be low due to poor partnership score
    expect(result.andromedaScore).toBeLessThanOrEqual(50);

    // Grade should be C, D or F
    expect(["C", "D", "F"]).toContain(result.grade);

    // Should have insights mentioning partnership
    expect(result.insights.length).toBeGreaterThan(0);
    expect(result.insights[0]).toContain("partnership");
  });

  // ─── High-performing brand (40% partnership, diverse formats) ─────────────
  it("scores a well-diversified brand with 35% partnership ads highly", () => {
    const result = scoreAndromeda({
      totalAds: 60,
      partnershipAds: 21, // 35%
      formatBreakdown: { video: 25, image: 15, carousel: 12, collection: 8 },
      avgDurationDays: 14,
    });

    expect(result.partnershipScore).toBe(100); // above 30% target
    expect(result.formatScore).toBeGreaterThan(70); // well-diversified
    expect(result.durationScore).toBe(100); // ideal duration
    expect(result.andromedaScore).toBeGreaterThan(75);
    expect(result.grade).toBe("A");
    expect(["low", "medium"]).toContain(result.entityIdRisk.level);
  });

  // ─── Creative Freshness Score ─────────────────────────────────────────────
  it("penalises high fatigue risk (60+ day flights)", () => {
    const result = scoreAndromeda({
      totalAds: 10,
      partnershipAds: 5,
      formatBreakdown: { video: 8, image: 2, carousel: 0, collection: 0 },
      avgDurationDays: 65,
    });

    expect(result.durationScore).toBeLessThan(20);
  });

  // ─── Edge case: zero ads ──────────────────────────────────────────────────
  it("handles zero ads gracefully", () => {
    const result = scoreAndromeda({
      totalAds: 0,
      partnershipAds: 0,
      formatBreakdown: { video: 0, image: 0, carousel: 0, collection: 0 },
      avgDurationDays: 0,
    });

    expect(result.andromedaScore).toBeGreaterThanOrEqual(0);
    expect(result.partnershipPct).toBe(0);
    expect(result.grade).toBe("F");
  });

  // ─── Creator Signal Score cap ─────────────────────────────────────────────
  it("caps Creator Signal Score at 100 when above 30%", () => {
    const result = scoreAndromeda({
      totalAds: 10,
      partnershipAds: 8, // 80%
      formatBreakdown: { video: 5, image: 3, carousel: 1, collection: 1 },
      avgDurationDays: 14,
    });

    expect(result.partnershipScore).toBe(100);
  });

  // ─── Entity ID risk levels ────────────────────────────────────────────────
  it("Entity ID risk: critical for high volume with few concepts", () => {
    const result = scoreAndromeda({
      totalAds: 80,
      partnershipAds: 4, // 5% — very few creators = few distinct concepts
      formatBreakdown: { video: 70, image: 8, carousel: 2, collection: 0 },
      avgDurationDays: 45,
    });

    expect(["critical", "high"]).toContain(result.entityIdRisk.level);
    expect(result.entityIdRisk.suppressionRisk).toBe(true);
    expect(result.entityIdRisk.adsPerConcept).toBeGreaterThan(4);
  });

  it("Entity ID risk: low for well-diversified brand", () => {
    const result = scoreAndromeda({
      totalAds: 40,
      partnershipAds: 16, // 40%
      formatBreakdown: { video: 15, image: 10, carousel: 10, collection: 5 },
      avgDurationDays: 18,
    });

    expect(["low", "medium"]).toContain(result.entityIdRisk.level);
    expect(result.andromedaScore).toBeGreaterThan(60);
  });

  it("Entity ID risk: critical when Creative Similarity Score is above 60%", () => {
    const result = scoreAndromeda({
      totalAds: 30,
      partnershipAds: 9,
      formatBreakdown: { video: 20, image: 5, carousel: 3, collection: 2 },
      avgDurationDays: 20,
      creativeSimilarityScore: 75, // above 60% threshold
    });

    expect(result.entityIdRisk.level).toBe("critical");
    expect(result.entityIdRisk.suppressionRisk).toBe(true);
  });

  // ─── Insights ─────────────────────────────────────────────────────────────
  it("generates insights for low partnership brands", () => {
    const result = scoreAndromeda({
      totalAds: 50,
      partnershipAds: 2, // 4%
      formatBreakdown: { video: 40, image: 8, carousel: 2, collection: 0 },
      avgDurationDays: 20,
    });

    const hasPartnershipInsight = result.insights.some(
      (i) => i.includes("partnership") || i.includes("Partnership")
    );
    expect(hasPartnershipInsight).toBe(true);
  });

  // ─── Return shape ─────────────────────────────────────────────────────────
  it("returns all required fields with valid types", () => {
    const result = scoreAndromeda({
      totalAds: 20,
      partnershipAds: 6,
      formatBreakdown: { video: 10, image: 5, carousel: 3, collection: 2 },
      avgDurationDays: 21,
    });

    expect(typeof result.andromedaScore).toBe("number");
    expect(typeof result.formatScore).toBe("number");
    expect(typeof result.partnershipScore).toBe("number");
    expect(typeof result.durationScore).toBe("number");
    expect(typeof result.conceptScore).toBe("number");
    expect(typeof result.estimatedConcepts).toBe("number");
    expect(typeof result.entityIdRisk).toBe("object");
    expect(typeof result.entityIdRisk.level).toBe("string");
    expect(typeof result.entityIdRisk.suppressionRisk).toBe("boolean");
    expect(typeof result.partnershipPct).toBe("number");
    expect(Array.isArray(result.insights)).toBe(true);

    expect(result.andromedaScore).toBeGreaterThanOrEqual(0);
    expect(result.andromedaScore).toBeLessThanOrEqual(100);
    expect(["critical", "high", "medium", "low"]).toContain(result.entityIdRisk.level);
  });

  // ─── Determinism ─────────────────────────────────────────────────────────
  it("produces consistent scores for the same input", () => {
    const input = {
      totalAds: 52,
      partnershipAds: 4,
      formatBreakdown: { video: 35, image: 12, carousel: 4, collection: 1 },
      avgDurationDays: 18,
    };

    const result1 = scoreAndromeda(input);
    const result2 = scoreAndromeda(input);

    expect(result1.andromedaScore).toBe(result2.andromedaScore);
    expect(result1.grade).toBe(result2.grade);
    expect(result1.partnershipScore).toBe(result2.partnershipScore);
    expect(result1.conceptScore).toBe(result2.conceptScore);
    expect(result1.entityIdRisk.level).toBe(result2.entityIdRisk.level);
  });
});
