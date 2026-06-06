/**
 * API Connectors — Tapline
 *
 * Meta Ads Library API and TikTok Commercial Content API connectors.
 * Each connector attempts the live API first, then falls back to mock data
 * if the API is unavailable (pending verification, rate limited, or in error).
 *
 * Meta Ads Library API notes:
 * - Base URL: https://graph.facebook.com/v21.0/ads_archive
 * - Auth: User Access Token with ads_library permission
 * - Partnership detection: scan ad_creative_bodies for partnership signals
 *   (bylines field is only available for POLITICAL_AND_ISSUE_ADS)
 * - Format detection: media_type field (IMAGE, VIDEO, MEME, NONE)
 *   + ad_creative_bodies count for carousel detection
 * - Spend/impressions: available as range strings e.g. "1000-5000"
 * - Rate limit: 200 calls per hour per token (error 613)
 */

import type { AdDataSnapshot } from "../drizzle/schema";
import { getMockAdData } from "./mockData";

const META_GRAPH_VERSION = "v21.0";
const META_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

// ─── Partnership Signal Detection ─────────────────────────────────────────────

/**
 * Keywords and patterns that indicate a creator partnership ad.
 * Meta partnership ads typically include these in the ad body text.
 */
const PARTNERSHIP_SIGNALS = [
  "paid partnership",
  "paid collaboration",
  "in collaboration with",
  "gifted by",
  "gifted:",
  "#ad",
  "#paidpartnership",
  "#sponsored",
  "#gifted",
  "#brandpartner",
  "#brandambassador",
  "#collab",
  "sponsored by",
  "in partnership with",
  "ambassador",
  "creator partner",
];

function isPartnershipAd(bodies: string[]): boolean {
  const combined = bodies.join(" ").toLowerCase();
  return PARTNERSHIP_SIGNALS.some((signal) => combined.includes(signal.toLowerCase()));
}

// ─── Spend Range Parser ────────────────────────────────────────────────────────

/**
 * Parse Meta spend range strings into numeric bounds.
 * Meta returns ranges like "<1000", "1000-5000", ">1000000"
 */
function parseSpendRange(range: { lower_bound?: string; upper_bound?: string } | undefined): {
  min: number;
  max: number;
} {
  if (!range) return { min: 0, max: 0 };
  const min = parseInt(range.lower_bound ?? "0", 10) || 0;
  const max = parseInt(range.upper_bound ?? range.lower_bound ?? "0", 10) || 0;
  return { min, max };
}

function parseImpressionRange(impressionStr: string | undefined): { min: number; max: number } {
  if (!impressionStr) return { min: 0, max: 0 };
  // Meta returns strings like "<1000", "1K-5K", "5K-10K", "10K-50K", ">1M"
  const clean = impressionStr.replace(/,/g, "").trim();
  if (clean.startsWith("<")) {
    const val = parseKM(clean.slice(1));
    return { min: 0, max: val };
  }
  if (clean.startsWith(">")) {
    const val = parseKM(clean.slice(1));
    return { min: val, max: val * 2 };
  }
  const parts = clean.split("-");
  if (parts.length === 2) {
    return { min: parseKM(parts[0]), max: parseKM(parts[1]) };
  }
  const val = parseKM(clean);
  return { min: val, max: val };
}

function parseKM(s: string): number {
  const trimmed = s.trim().toUpperCase();
  if (trimmed.endsWith("M")) return parseFloat(trimmed) * 1_000_000;
  if (trimmed.endsWith("K")) return parseFloat(trimmed) * 1_000;
  return parseInt(trimmed, 10) || 0;
}

// ─── Meta Ads Library API ─────────────────────────────────────────────────────

export interface MetaAdRecord {
  id: string;
  page_id?: string;
  page_name?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_titles?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_snapshot_url?: string;
  media_type?: "IMAGE" | "VIDEO" | "MEME" | "NONE";
  impressions?: string; // range string for non-political ads
  spend?: { lower_bound?: string; upper_bound?: string };
  publisher_platforms?: string[];
}

interface MetaAdsAPIConfig {
  accessToken: string;
  pageId?: string;
  searchTerms?: string;
  period: string; // "YYYY-MM"
  countryCode?: string;
}

/**
 * Fetch ads from the Meta Ads Library API.
 * Paginates through all results (up to 1000 ads).
 * Returns null if the API is unavailable (triggers mock fallback).
 */
export async function fetchMetaAds(config: MetaAdsAPIConfig): Promise<{
  snapshot: AdDataSnapshot;
  rawAds: MetaAdRecord[];
} | null> {
  const token = process.env.META_ACCESS_TOKEN ?? config.accessToken;
  if (!token) {
    console.log("[Meta API] No access token configured — using mock data");
    return null;
  }

  try {
    const [year, month] = config.period.split("-").map(Number);
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${daysInMonth}`;

    const allAds: MetaAdRecord[] = [];
    let nextUrl: string | null = null;

    // Build initial request
    const params = new URLSearchParams({
      access_token: token,
      ad_active_status: "ALL",
      ad_delivery_date_min: startDate,
      ad_delivery_date_max: endDate,
      ad_reached_countries: `["${config.countryCode ?? "GB"}"]`,
      ad_type: "ALL",
      fields: [
        "id",
        "page_id",
        "page_name",
        "ad_creative_bodies",
        "ad_creative_link_captions",
        "ad_creative_link_titles",
        "ad_delivery_start_time",
        "ad_delivery_stop_time",
        "media_type",
        "impressions",
        "spend",
        "publisher_platforms",
      ].join(","),
      limit: "200",
    });

    // Search by page ID (preferred — exact match) or search terms (fallback)
    if (config.pageId) {
      params.set("search_page_ids", config.pageId);
    } else if (config.searchTerms) {
      params.set("search_terms", config.searchTerms);
    } else {
      console.warn("[Meta API] Neither pageId nor searchTerms provided");
      return null;
    }

    nextUrl = `${META_BASE_URL}/ads_archive?${params.toString()}`;

    // Paginate through results (max 5 pages = 1000 ads)
    let pageCount = 0;
    while (nextUrl && pageCount < 5) {
      const pageResponse: Response = await fetch(nextUrl, { signal: AbortSignal.timeout(20000) });

      if (!pageResponse.ok) {
        const errorBody: { error?: { code?: number; message?: string } } = await pageResponse.json().catch(() => ({}));
        const errorCode = errorBody?.error?.code;
        const errorMsg = errorBody?.error?.message ?? `HTTP ${pageResponse.status}`;

        // Known error codes
        if (errorCode === 2332002) {
          console.log("[Meta API] Identity verification pending (2332002) — using mock data");
          return null;
        }
        if (errorCode === 613) {
          console.warn("[Meta API] Rate limit hit (613) — using mock data");
          return null;
        }
        if (errorCode === 190) {
          console.warn("[Meta API] Invalid access token (190) — using mock data");
          return null;
        }

        console.warn(`[Meta API] Error ${errorCode}: ${errorMsg}`);
        return null;
      }

      const pageData: { data?: MetaAdRecord[]; paging?: { next?: string } } = await pageResponse.json();
      const ads: MetaAdRecord[] = pageData.data ?? [];
      allAds.push(...ads);

      // Follow pagination cursor
      nextUrl = pageData.paging?.next ?? null;
      pageCount++;

      // Stop if we got fewer than a full page (no more results)
      if (ads.length < 200) break;
    }

    console.log(`[Meta API] Fetched ${allAds.length} ads for period ${config.period}`);
    return { snapshot: buildMetaSnapshot(allAds), rawAds: allAds };
  } catch (error) {
    console.warn("[Meta API] Request failed:", error);
    return null;
  }
}

/**
 * Build an AdDataSnapshot from raw Meta ad records.
 * Uses real partnership signal detection and media_type for format breakdown.
 */
function buildMetaSnapshot(ads: MetaAdRecord[]): AdDataSnapshot {
  let partnershipAds = 0;
  let spendMin = 0;
  let spendMax = 0;
  let impressionsMin = 0;
  let impressionsMax = 0;
  const formatBreakdown = { video: 0, image: 0, carousel: 0, collection: 0 };
  const durations: number[] = [];

  for (const ad of ads) {
    // ── Partnership detection ──────────────────────────────────────────────
    // Check ad body text for partnership signals
    const bodies = ad.ad_creative_bodies ?? [];
    const captions = ad.ad_creative_link_captions ?? [];
    const titles = ad.ad_creative_link_titles ?? [];
    const allText = [...bodies, ...captions, ...titles];

    if (isPartnershipAd(allText)) {
      partnershipAds++;
    }

    // ── Format detection ───────────────────────────────────────────────────
    // Use media_type field when available (most reliable)
    // Carousel: multiple creative bodies (>2) or link captions suggest multi-card
    const bodyCount = bodies.length;
    const captionCount = captions.length;

    if (bodyCount > 2 || captionCount > 2) {
      // Multiple bodies/captions = carousel or collection
      if (bodyCount > 4 || captionCount > 4) {
        formatBreakdown.collection++;
      } else {
        formatBreakdown.carousel++;
      }
    } else if (ad.media_type === "VIDEO") {
      formatBreakdown.video++;
    } else if (ad.media_type === "IMAGE" || ad.media_type === "MEME") {
      formatBreakdown.image++;
    } else {
      // Default: video is dominant on Meta (~65% of non-political ads)
      formatBreakdown.video++;
    }

    // ── Spend ──────────────────────────────────────────────────────────────
    const spend = parseSpendRange(ad.spend);
    spendMin += spend.min;
    spendMax += spend.max;

    // ── Impressions ────────────────────────────────────────────────────────
    // impressions field is a range string for non-political ads
    if (ad.impressions) {
      const imp = parseImpressionRange(ad.impressions);
      impressionsMin += imp.min;
      impressionsMax += imp.max;
    }

    // ── Duration ──────────────────────────────────────────────────────────
    if (ad.ad_delivery_start_time) {
      const start = new Date(ad.ad_delivery_start_time).getTime();
      const end = ad.ad_delivery_stop_time
        ? new Date(ad.ad_delivery_stop_time).getTime()
        : Date.now();
      const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
      durations.push(days);
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

// ─── Meta Page Search ─────────────────────────────────────────────────────────

export interface MetaPageResult {
  id: string;
  name: string;
  category?: string;
  fan_count?: number;
  verification_status?: string;
  picture?: { data?: { url?: string } };
}

/**
 * Search for Meta Pages by name to resolve a brand to its Page ID.
 * Uses the Graph API /pages/search endpoint.
 */
export async function searchMetaPages(
  query: string,
  limit = 5
): Promise<MetaPageResult[]> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return [];

  try {
    const params = new URLSearchParams({
      access_token: token,
      q: query,
      type: "page",
      fields: "id,name,category,fan_count,verification_status,picture",
      limit: String(limit),
    });

    const response = await fetch(
      `${META_BASE_URL}/pages/search?${params.toString()}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn("[Meta Page Search] Error:", err?.error?.message ?? response.status);
      return [];
    }

    const data = await response.json();
    return (data.data ?? []) as MetaPageResult[];
  } catch (error) {
    console.warn("[Meta Page Search] Request failed:", error);
    return [];
  }
}

/**
 * Resolve a brand name to its most likely Meta Page ID.
 * Returns the best match (verified page or highest fan count).
 */
export async function resolveMetaPageId(brandName: string): Promise<string | null> {
  const pages = await searchMetaPages(brandName, 5);
  if (pages.length === 0) return null;

  // Prefer verified pages, then sort by fan count
  const sorted = pages.sort((a, b) => {
    const aVerified = a.verification_status === "blue_verified" || a.verification_status === "gray_verified" ? 1 : 0;
    const bVerified = b.verification_status === "blue_verified" || b.verification_status === "gray_verified" ? 1 : 0;
    if (aVerified !== bVerified) return bVerified - aVerified;
    return (b.fan_count ?? 0) - (a.fan_count ?? 0);
  });

  return sorted[0]?.id ?? null;
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
    const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }).toString(),
      signal: AbortSignal.timeout(10000),
    });

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
    if (queryData.error?.code === "internal_error") {
      console.log("[TikTok API] Internal error (activation pending) — using mock data");
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
    formatBreakdown.video++; // TikTok is almost entirely video

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
 * When META_ACCESS_TOKEN is set, attempts live Meta Ads Library first.
 * If the brand has no stored pageId, attempts live page resolution.
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
  resolvedMetaPageId?: string | null;
}> {
  const mockData = getMockAdData(brandSlug);
  let usedMockData = false;
  let resolvedMetaPageId: string | null | undefined = metaPageId;

  // ── Meta Ads Library ───────────────────────────────────────────────────────
  let meta: AdDataSnapshot | null = null;
  const metaToken = process.env.META_ACCESS_TOKEN;

  if (metaToken) {
    // If we don't have a page ID, try to resolve it live
    if (!resolvedMetaPageId) {
      console.log(`[Meta API] No page ID for "${brandName}" — attempting live resolution`);
      resolvedMetaPageId = await resolveMetaPageId(brandName);
      if (resolvedMetaPageId) {
        console.log(`[Meta API] Resolved "${brandName}" to page ID: ${resolvedMetaPageId}`);
      }
    }

    const result = await fetchMetaAds({
      accessToken: metaToken,
      pageId: resolvedMetaPageId ?? undefined,
      searchTerms: resolvedMetaPageId ? undefined : brandName,
      period,
      countryCode: "GB",
    });

    if (result) {
      meta = result.snapshot;
      console.log(
        `[Meta API] Live data: ${meta.totalAds} ads, ${meta.partnershipAds} partnership ads`
      );
    }
  }

  if (!meta) {
    meta = mockData.meta;
    usedMockData = true;
    console.log(`[Meta API] Using mock data for "${brandName}"`);
  }

  // ── TikTok Commercial Content API ─────────────────────────────────────────
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
    if (!metaToken) usedMockData = true; // only flag mock if both are mock
  }

  return { meta, tiktok, usedMockData, resolvedMetaPageId };
}
