import { describe, expect, it } from "vitest";
import { scoreAndromeda } from "./andromeda";

describe("Andromeda Algorithm", () => {
  it("scores Ninja Kitchen UK correctly (8% partnership, single format dominant)", () => {
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

    // Overall score should be low due to poor partnership score
    expect(result.andromedaScore).toBeLessThanOrEqual(50);

    // Grade should be C, D or F (50 = C boundary)
    expect(["C", "D", "F"]).toContain(result.grade);

    // Should have insights
    expect(result.insights.length).toBeGreaterThan(0);
    expect(result.insights[0]).toContain("partnership");
  });

  it("scores a brand with 35% partnership ads highly", () => {
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
  });

  it("penalises high fatigue risk (60+ day flights)", () => {
    const result = scoreAndromeda({
      totalAds: 10,
      partnershipAds: 5,
      formatBreakdown: { video: 8, image: 2, carousel: 0, collection: 0 },
      avgDurationDays: 65,
    });

    expect(result.durationScore).toBeLessThan(20);
  });

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

  it("caps partnership score at 100 when above 30%", () => {
    const result = scoreAndromeda({
      totalAds: 10,
      partnershipAds: 8, // 80%
      formatBreakdown: { video: 5, image: 3, carousel: 1, collection: 1 },
      avgDurationDays: 14,
    });

    expect(result.partnershipScore).toBe(100);
  });

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
});

describe("Andromeda Algorithm — audit creation flow", () => {
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
  });
});
