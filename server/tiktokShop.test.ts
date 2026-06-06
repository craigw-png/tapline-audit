import { describe, expect, it, vi } from "vitest";
import { fetchTikTokShopIntelligence } from "./tiktokShopConnector";

// Mock fetch to avoid real network calls in tests
vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network unavailable")));

describe("fetchTikTokShopIntelligence", () => {
  it("returns mock data when live API is unavailable", async () => {
    const result = await fetchTikTokShopIntelligence("Ninja Kitchen UK", [], "GB");
    expect(result).toBeDefined();
    expect(result.isMock).toBe(true);
    expect(result.country).toBe("GB");
  });

  it("returns correct category for Ninja Kitchen UK", async () => {
    const result = await fetchTikTokShopIntelligence("Ninja Kitchen UK", [], "GB");
    expect(result.category).toMatch(/kitchen|appliance|home/i);
  });

  it("returns top creators with required fields", async () => {
    const result = await fetchTikTokShopIntelligence("Ninja Kitchen UK", [], "GB");
    expect(result.topCreatorsByGmv.length).toBeGreaterThan(0);
    const creator = result.topCreatorsByGmv[0];
    expect(creator).toHaveProperty("handle");
    expect(creator).toHaveProperty("niche");
    expect(creator).toHaveProperty("followers");
    expect(creator).toHaveProperty("avgEngagement");
    expect(creator).toHaveProperty("estimatedGmv");
    expect(creator).toHaveProperty("tier");
    expect(creator).toHaveProperty("isPartnerOfBrand");
    expect(["nano", "micro", "mid", "macro", "mega"]).toContain(creator.tier);
  });

  it("returns trending products with required fields", async () => {
    const result = await fetchTikTokShopIntelligence("Ninja Kitchen UK", [], "GB");
    expect(result.trendingProducts.length).toBeGreaterThan(0);
    const product = result.trendingProducts[0];
    expect(product).toHaveProperty("productId");
    expect(product).toHaveProperty("productName");
    expect(product).toHaveProperty("commissionRate");
    expect(product).toHaveProperty("trend");
    expect(["rising", "stable", "declining"]).toContain(product.trend);
  });

  it("returns top shop videos with required fields", async () => {
    const result = await fetchTikTokShopIntelligence("Ninja Kitchen UK", [], "GB");
    expect(result.topShopVideos.length).toBeGreaterThan(0);
    const video = result.topShopVideos[0];
    expect(video).toHaveProperty("videoId");
    expect(video).toHaveProperty("creatorHandle");
    expect(video).toHaveProperty("views");
    expect(video).toHaveProperty("conversionRate");
    expect(video).toHaveProperty("estimatedGmv");
    expect(["target", "competitor", "category"]).toContain(video.brandType);
  });

  it("returns category benchmarks", async () => {
    const result = await fetchTikTokShopIntelligence("Ninja Kitchen UK", [], "GB");
    expect(result.categoryBenchmarks).toHaveProperty("avgCreatorGmv");
    expect(result.categoryBenchmarks).toHaveProperty("avgConversionRate");
    expect(result.categoryBenchmarks).toHaveProperty("avgCommissionRate");
    expect(result.categoryBenchmarks.avgConversionRate).toBeGreaterThan(0);
  });

  it("includes brand shop presence data", async () => {
    const result = await fetchTikTokShopIntelligence("Ninja Kitchen UK", [], "GB");
    expect(result.brandShopPresence).toBeDefined();
    expect(result.brandShopPresence).toHaveProperty("hasShop");
  });

  it("marks untapped creators correctly — Ninja Kitchen has some not yet partnered", async () => {
    const result = await fetchTikTokShopIntelligence("Ninja Kitchen UK", [], "GB");
    const untapped = result.topCreatorsByGmv.filter((c) => !c.isPartnerOfBrand);
    expect(untapped.length).toBeGreaterThan(0);
  });

  it("returns a dataAsOf date string", async () => {
    const result = await fetchTikTokShopIntelligence("Ninja Kitchen UK", [], "GB");
    expect(result.dataAsOf).toBeTruthy();
    expect(typeof result.dataAsOf).toBe("string");
  });

  it("falls back gracefully for unknown brands", async () => {
    const result = await fetchTikTokShopIntelligence("UnknownBrandXYZ123", [], "GB");
    expect(result).toBeDefined();
    expect(result.isMock).toBe(true);
    expect(result.topCreatorsByGmv.length).toBeGreaterThan(0);
  });
});
