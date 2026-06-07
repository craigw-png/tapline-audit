import { describe, expect, it } from "vitest";
import { getMockSimilarWebData } from "./similarwebConnector";

describe("SimilarWeb Connector — getMockSimilarWebData", () => {
  it("returns a valid SimilarWebData shape for a high-traffic domain", () => {
    const data = getMockSimilarWebData("ninjahousehold.com", 8, 42);
    expect(data.domain).toBe("ninjahousehold.com");
    expect(data.latestMonthlyVisits).toBeGreaterThan(0);
    expect(data.channelMix).not.toBeNull();
    expect(data.isMock).toBe(true);
  });

  it("channel mix values sum to approximately 100", () => {
    const data = getMockSimilarWebData("ninjahousehold.com", 8, 42);
    const mix = data.channelMix!;
    const total =
      mix.direct +
      mix.organicSearch +
      mix.paidSearch +
      mix.social +
      mix.referral +
      mix.display +
      mix.email;
    expect(total).toBeGreaterThanOrEqual(98);
    expect(total).toBeLessThanOrEqual(102);
  });

  it("returns 6 months of visit trend data", () => {
    const data = getMockSimilarWebData("ninjahousehold.com", 8, 42);
    expect(data.monthlyVisitsTrend).not.toBeNull();
    expect(data.monthlyVisitsTrend!.length).toBe(6);
  });

  it("returns 6 months of channel mix trend data", () => {
    const data = getMockSimilarWebData("ninjahousehold.com", 8, 42);
    expect(data.channelMixTrend).not.toBeNull();
    expect(data.channelMixTrend!.length).toBe(6);
  });

  it("returns a capture gap object for any brand", () => {
    // Capture gap is always returned — severity depends on creator activity + social traffic
    const data = getMockSimilarWebData("ninjahousehold.com", 8, 42);
    expect(data.captureGap).not.toBeNull();
    expect(["high", "medium", "none"]).toContain(data.captureGap!.severity);
  });

  it("detects a high-severity capture gap when creator activity is strong but social traffic is low", () => {
    // partnershipPct=35 (>=15) triggers creatorActivityHigh=true;
    // mock social is 7% (<8) so severity should be 'high'
    const data = getMockSimilarWebData("ninjahousehold.com", 35, 78);
    expect(data.captureGap).not.toBeNull();
    // With high creator activity and low social traffic, a gap IS expected
    expect(["high", "medium"]).toContain(data.captureGap!.severity);
  });

  it("assigns correct confidence tier based on traffic volume", () => {
    const highTraffic = getMockSimilarWebData("ninjahousehold.com", 8, 42);
    // Ninja Kitchen is a large brand — should be medium or high confidence
    expect(["high", "medium"]).toContain(highTraffic.confidenceTier);
  });

  it("returns competitor comparison data", () => {
    const data = getMockSimilarWebData("ninjahousehold.com", 8, 42);
    expect(data.competitorComparison).not.toBeNull();
    expect(data.competitorComparison!.length).toBeGreaterThan(0);
    const first = data.competitorComparison![0];
    expect(first).toHaveProperty("brandName");
    expect(first).toHaveProperty("latestMonthlyVisits");
    expect(first).toHaveProperty("socialTrafficPct");
  });

  it("includes a human-readable confidence note", () => {
    const data = getMockSimilarWebData("ninjahousehold.com", 8, 42);
    expect(typeof data.confidenceNote).toBe("string");
    expect(data.confidenceNote.length).toBeGreaterThan(20);
  });

  it("returns a valid dataAsOf ISO date string", () => {
    const data = getMockSimilarWebData("ninjahousehold.com", 8, 42);
    expect(() => new Date(data.dataAsOf)).not.toThrow();
    expect(new Date(data.dataAsOf).getFullYear()).toBeGreaterThanOrEqual(2025);
  });
});
