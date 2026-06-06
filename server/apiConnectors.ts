/**
 * API Connectors — Tapline
 *
 * Meta Ads Library API and TikTok Commercial Content API connectors.
 * Each connector attempts the live API first, then falls back to mock data
 * if the API is unavailable (pending verification, rate limited, or in error).
 */

import type { AdDataSnapshot } from "../drizzle/schema";
import { getMockAdData } from "./mockData";

// ─── Meta Ads Library API ─────────────────────────────────────────────────────

interface MetaAdsAPIConfig {
  accessToken: string;
  pageId: string;
  period: string; // "YYYY-MM"
}

interface MetaAdRecord {
  id: string;
  page_id: string;
  ad_creative_bodies?: string[];
  ad_creative_link_captions?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_snapshot_url?: string;
  bylines?: string; // creator partnership indicator
  currency?: string;
  estimated_audience_size?: { lower_bound: number; upper_bound: number };
  impressions?: { lower_bound: string; upper_bound: string };
  spend?: { lower_bound: string; upper_bound: string };
}

/**
 * Fetch ads from the Meta Ads Library API for a given page.
 * Returns null if the API is unavailable (triggers mock fallback).
 */
export async function fetchMetaAds(config: MetaAdsAPIConfig): Promise<AdDataSnapshot | null> {
  const token = process.env.META_ACCESS_TOKEN ?? config.accessToken;
  if (!token) {
    console.log("[Meta API] No access token configured — using mock data");
    return null;
  }

  try {
    const [year, month] = config.period.split("-").map(Number);
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;

    const params = new URLSearchParams({
      access_token: token,
      search_type: "PAGE",
      search_page_ids: config.pageId,
      ad_active_status: "ALL",
      ad_delivery_date_min: startDate,
      ad_delivery_date_max: endDate,
      fields: "id,page_id,ad_creative_bodies,bylines,ad_delivery_start_time,ad_delivery_stop_time,impressions,spend",
      limit: "500",
    });

    const response = await fetch(
      `https://graph.facebook.com/v19.0/ads_archive?${params.toString()}`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const errorCode = errorBody?.error?.code;

      // Error 2332002 = identity verification pending
      if (errorCode === 2332002) {
        console.log("[Meta API] Identity verification pending (error 2332002) — using mock data");
        return null;
      }

      console.warn("[Meta API] API error:", errorBody?.error?.message ?? response.status);
      return null;
    }

    const data = await response.json();
    const ads: MetaAdRecord[] = data.data ?? [];

    if (ads.length === 0) {
      console.log("[Meta API] No ads returned for page", config.pageId);
      return buildMetaSnapshot(ads);
    }

    return buildMetaSnapshot(ads);
  } catch (error) {
    console.warn("[Meta API] Request failed:", error);
    return null;
  }
}

function buildMetaSnapshot(ads: MetaAdRecord[]): AdDataSnapshot {
  let partnershipAds = 0;
  let spendMin = 0;
  let spendMax = 0;
  let impressionsMin = 0;
  let impressionsMax = 0;
  const formatBreakdown = { video: 0, image: 0, carousel: 0, collection: 0 };
  const durations: number[] = [];

  for (const ad of ads) {
    // Partnership detection via bylines field
    if (ad.bylines && ad.bylines.trim().length > 0) {
      partnershipAds++;
    }

    // Spend aggregation
    if (ad.spend) {
      spendMin += parseInt(ad.spend.lower_bound ?? "0", 10);
      spendMax += parseInt(ad.spend.upper_bound ?? "0", 10);
    }

    // Impressions aggregation
    if (ad.impressions) {
      impressionsMin += parseInt(ad.impressions.lower_bound ?? "0", 10);
      impressionsMax += parseInt(ad.impressions.upper_bound ?? "0", 10);
    }

    // Duration calculation
    if (ad.ad_delivery_start_time) {
      const start = new Date(ad.ad_delivery_start_time).getTime();
      const end = ad.ad_delivery_stop_time
        ? new Date(ad.ad_delivery_stop_time).getTime()
        : Date.now();
      const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
      durations.push(days);
    }

    // Format detection (heuristic based on creative bodies count)
    const bodyCount = ad.ad_creative_bodies?.length ?? 1;
    if (bodyCount > 3) {
      formatBreakdown.carousel++;
    } else {
      // Default to video/image split — video is dominant on Meta
      if (Math.random() > 0.35) {
        formatBreakdown.video++;
      } else {
        formatBreakdown.image++;
      }
    }
  }

  const avgDurationDays =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 14;

  return {
    totalAds: ads.length,
    partnershipAds,
    formatBreakdown,
    spendMin,
    spendMax,
    impressionsMin,
    impressionsMax,
    avgDurationDays,
  };
}

// ─── TikTok Commercial Content API ───────────────────────────────────────────

interface TikTokAdsAPIConfig {
  clientKey: string;
  clientSecret: string;
  searchTerm: string;
  countryCode: string;
  period: string; // "YYYY-MM"
}

/**
 * Fetch ads from the TikTok Commercial Content API.
 * Returns null if the API is unavailable (triggers mock fallback).
 */
export async function fetchTikTokAds(config: TikTokAdsAPIConfig): Promise<AdDataSnapshot | null> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY ?? config.clientKey;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET ?? config.clientSecret;

  if (!clientKey || !clientSecret) {
    console.log("[TikTok API] No credentials configured — using mock data");
    return null;
  }

  try {
    // Step 1: Get access token
    const tokenResponse = await fetch(
      "https://open.tiktokapis.com/v2/oauth/token/",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          grant_type: "client_credentials",
        }).toString(),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!tokenResponse.ok) {
      console.warn("[TikTok API] Token request failed:", tokenResponse.status);
      return null;
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.warn("[TikTok API] No access token in response");
      return null;
    }

    // Step 2: Query ads
    const [year, month] = config.period.split("-").map(Number);
    const startDate = `${year}${String(month).padStart(2, "0")}01`;
    const endDate = `${year}${String(month).padStart(2, "0")}${new Date(year, month, 0).getDate()}`;

    const queryParams = new URLSearchParams({
      fields: "id,video_info,brand_name,create_time,first_shown_date,last_shown_date,is_branded_content",
    });

    const queryResponse = await fetch(
      `https://open.tiktokapis.com/v2/research/adlib/ad/query/?${queryParams.toString()}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filters: {
            search_term: config.searchTerm,
            country_code: [config.countryCode],
            ad_published_date_range: { min: startDate, max: endDate },
          },
          max_count: 100,
          cursor: 0,
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!queryResponse.ok) {
      const errorBody = await queryResponse.json().catch(() => ({}));
      console.warn("[TikTok API] Query failed:", errorBody?.error?.message ?? queryResponse.status);
      return null;
    }

    const queryData = await queryResponse.json();

    // TikTok API returns internal_error for new accounts during activation
    if (queryData.error?.code === "internal_error") {
      console.log("[TikTok API] Internal error (new account activation pending) — using mock data");
      return null;
    }

    const ads = queryData.data?.ads ?? [];
    return buildTikTokSnapshot(ads);
  } catch (error) {
    console.warn("[TikTok API] Request failed:", error);
    return null;
  }
}

function buildTikTokSnapshot(ads: Record<string, unknown>[]): AdDataSnapshot {
  let partnershipAds = 0;
  const formatBreakdown = { video: 0, image: 0, carousel: 0, collection: 0 };
  const durations: number[] = [];

  for (const ad of ads) {
    if (ad.is_branded_content) partnershipAds++;

    // TikTok is almost entirely video
    formatBreakdown.video++;

    if (ad.first_shown_date && ad.last_shown_date) {
      const start = new Date(ad.first_shown_date as string).getTime();
      const end = new Date(ad.last_shown_date as string).getTime();
      const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
      durations.push(days);
    }
  }

  const avgDurationDays =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 10;

  return {
    totalAds: ads.length,
    partnershipAds,
    formatBreakdown,
    spendMin: 0,
    spendMax: 0,
    impressionsMin: 0,
    impressionsMax: 0,
    avgDurationDays,
  };
}

// ─── Combined Fetch with Mock Fallback ────────────────────────────────────────

/**
 * Fetch ad data for a brand from both platforms.
 * Falls back to mock data if either API is unavailable.
 */
export async function fetchBrandAdData(
  brandSlug: string,
  brandName: string,
  metaPageId: string | null | undefined,
  tiktokHandle: string | null | undefined,
  period: string
): Promise<{
  meta: AdDataSnapshot;
  tiktok: AdDataSnapshot;
  usedMockData: boolean;
}> {
  const mockData = getMockAdData(brandSlug);
  let usedMockData = false;

  // Attempt Meta API
  let meta: AdDataSnapshot | null = null;
  if (metaPageId) {
    meta = await fetchMetaAds({
      accessToken: process.env.META_ACCESS_TOKEN ?? "",
      pageId: metaPageId,
      period,
    });
  }

  if (!meta) {
    meta = mockData.meta;
    usedMockData = true;
  }

  // Attempt TikTok API
  let tiktok: AdDataSnapshot | null = null;
  const tiktokSearchTerm = tiktokHandle?.replace("@", "") ?? brandName;
  if (process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET) {
    tiktok = await fetchTikTokAds({
      clientKey: process.env.TIKTOK_CLIENT_KEY,
      clientSecret: process.env.TIKTOK_CLIENT_SECRET,
      searchTerm: tiktokSearchTerm,
      countryCode: "GB",
      period,
    });
  }

  if (!tiktok) {
    tiktok = mockData.tiktok;
    usedMockData = true;
  }

  return { meta, tiktok, usedMockData };
}
