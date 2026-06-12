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
    // Cap endDate at today — Meta API rejects future dates (error 2334030)
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const rawEndDate = `${year}-${String(month).padStart(2, "0")}-${daysInMonth}`;
    const endDate = rawEndDate > todayStr ? todayStr : rawEndDate;

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
 * Search for Meta Pages by brand name using the Ads Archive endpoint.
 * The /pages/search Graph API requires pages_read_engagement permission which
 * our token doesn't have. Instead we search the Ads Archive and deduplicate
 * by page_id — this gives us real pages that are actually running ads.
 *
 * Tries multiple keyword variations to maximise recall:
 *   1. Exact brand name
 *   2. First word only (e.g. "Emma" from "Emma Sleep NL")
 *   3. First two words (e.g. "Emma Sleep")
 */
export async function searchMetaPages(
  query: string,
  limit = 5
): Promise<MetaPageResult[]> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return [];

  // Build search term variations to maximise recall
  const words = query.trim().split(/\s+/).filter(Boolean);
  const variations = Array.from(new Set([
    query.trim(),
    words.slice(0, 2).join(" "),  // first two words
    words[0],                      // first word only
  ].filter((v) => v.length >= 2)));

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  // Search last 90 days
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 90);
  const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;

  const pageMap = new Map<string, MetaPageResult>(); // page_id → result

  for (const term of variations) {
    if (pageMap.size >= limit) break;
    try {
      const params = new URLSearchParams({
        access_token: token,
        search_terms: term,
        ad_reached_countries: '["NL","GB","DE","FR","US"]',
        ad_type: "ALL",
        ad_active_status: "ALL",
        ad_delivery_date_min: startStr,
        ad_delivery_date_max: todayStr,
        fields: "page_id,page_name",
        limit: "50",
      });

      const response = await fetch(
        `${META_BASE_URL}/ads_archive?${params.toString()}`,
        { signal: AbortSignal.timeout(12000) }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.warn("[Meta Page Search] Ads Archive error:", err?.error?.message ?? response.status);
        continue;
      }

      const data: { data?: Array<{ page_id?: string; page_name?: string }> } = await response.json();
      for (const ad of data.data ?? []) {
        if (ad.page_id && ad.page_name && !pageMap.has(ad.page_id)) {
          pageMap.set(ad.page_id, {
            id: ad.page_id,
            name: ad.page_name,
          });
        }
      }
    } catch (error) {
      console.warn(`[Meta Page Search] Request failed for "${term}":`, error);
    }
  }

  // Score pages by name relevance to the query
  // Higher score = better match
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 1 && w !== "nl" && w !== "uk" && w !== "de" && w !== "fr" && w !== "us");
  const queryLower = queryWords.join(" ");

  function scoreMatch(pageName: string): number {
    const nameLower = pageName.toLowerCase();
    let score = 0;
    // Exact match (ignoring country suffixes)
    if (nameLower === queryLower) score += 100;
    // Name contains all query words
    const allWords = queryWords.every((w) => nameLower.includes(w));
    if (allWords) score += 50;
    // Name contains first query word
    if (queryWords[0] && nameLower.includes(queryWords[0])) score += 20;
    // Name starts with first query word
    if (queryWords[0] && nameLower.startsWith(queryWords[0])) score += 10;
    return score;
  }

  const results = Array.from(pageMap.values()).sort((a, b) => scoreMatch(b.name) - scoreMatch(a.name));

  console.log(`[Meta Page Search] Found ${results.length} candidate pages for "${query}", top: ${results[0]?.name ?? "none"}`);
  return results.slice(0, limit);
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

// ─── TikTok Research API (Ad Library) ────────────────────────────────────────
//
// TikTok's Research API uses a two-step flow:
//   1. POST /v2/research/adlib/advertiser/query/ — find advertiser business IDs by name
//   2. POST /v2/research/adlib/ad/query/         — fetch ads by business ID
//
// Field names use dot-notation: ad.id, ad.status, ad.first_shown_date, etc.
// The ad/query endpoint is known to return intermittent 500 errors (TikTok server bug).
// We retry up to 3 times with exponential backoff before falling back to mock data.
//
// Token: client_credentials grant, expires in 7200s (2 hours).
// We cache the token in memory and refresh when expired.

interface TikTokTokenCache {
  token: string;
  expiresAt: number; // Unix ms
}

let _tiktokTokenCache: TikTokTokenCache | null = null;

async function getTikTokToken(clientKey: string, clientSecret: string): Promise<string | null> {
  // Return cached token if still valid (with 60s buffer)
  if (_tiktokTokenCache && Date.now() < _tiktokTokenCache.expiresAt - 60_000) {
    return _tiktokTokenCache.token;
  }

  try {
    const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }).toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn("[TikTok API] Token request failed:", response.status);
      return null;
    }

    const data = await response.json();
    const token = data.access_token as string | undefined;
    const expiresIn = (data.expires_in as number | undefined) ?? 7200;

    if (!token) {
      console.warn("[TikTok API] No access_token in token response");
      return null;
    }

    _tiktokTokenCache = { token, expiresAt: Date.now() + expiresIn * 1000 };
    console.log(`[TikTok API] Token refreshed, expires in ${expiresIn}s`);
    return token;
  } catch (err) {
    console.warn("[TikTok API] Token fetch error:", err);
    return null;
  }
}

/**
 * Search for TikTok advertisers by brand name.
 * Returns a list of { business_id, business_name } objects.
 * Uses fields=business_id,business_name (flat, not dot-notation for this endpoint).
 */
export async function searchTikTokAdvertisers(
  brandName: string,
  token: string
): Promise<Array<{ business_id: number; business_name: string }>> {
  try {
    const response = await fetch(
      "https://open.tiktokapis.com/v2/research/adlib/advertiser/query/?fields=business_id,business_name",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ search_term: brandName, max_count: 10 }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      console.warn("[TikTok API] Advertiser search failed:", response.status);
      return [];
    }

    const data = await response.json();
    if (data.error?.code !== "ok" && data.error?.code !== undefined && data.error?.code !== "") {
      console.warn("[TikTok API] Advertiser search error:", data.error?.message);
      return [];
    }

    return (data.data?.advertisers ?? []) as Array<{ business_id: number; business_name: string }>;
  } catch (err) {
    console.warn("[TikTok API] Advertiser search exception:", err);
    return [];
  }
}

/**
 * Query ads for a specific advertiser business ID.
 * Retries up to maxRetries times on 500 errors (known TikTok API intermittent bug).
 * Returns the raw ads array or null on persistent failure.
 */
async function queryTikTokAds(
  businessId: number,
  token: string,
  dateRange: { min: string; max: string },
  maxRetries = 3
): Promise<Array<Record<string, unknown>> | null> {
  const fields = [
    "ad.id",
    "ad.status",
    "ad.first_shown_date",
    "ad.last_shown_date",
    "ad.reach",
    "ad.videos",
    "ad.image_urls",
    "advertiser.business_id",
    "advertiser.business_name",
  ].join(",");

  const url = `https://open.tiktokapis.com/v2/research/adlib/ad/query/?fields=${encodeURIComponent(fields)}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filters: {
            ad_published_date_range: dateRange,
            advertiser_business_ids: [businessId],
          },
          max_count: 50,
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (response.status === 500) {
        const body = await response.json().catch(() => ({}));
        console.warn(
          `[TikTok API] Ad query 500 error (attempt ${attempt}/${maxRetries}):`,
          body?.error?.message ?? "internal_error"
        );
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
          continue;
        }
        return null;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        console.warn("[TikTok API] Ad query error:", body?.error?.message ?? response.status);
        return null;
      }

      const data = await response.json();
      if (data.error?.code === "ok" || !data.error?.code) {
        const ads = data.data?.ads ?? [];
        console.log(`[TikTok API] Fetched ${ads.length} ads for business ID ${businessId}`);
        return ads as Array<Record<string, unknown>>;
      }

      console.warn("[TikTok API] Ad query returned error:", data.error?.message);
      return null;
    } catch (err) {
      console.warn(`[TikTok API] Ad query exception (attempt ${attempt}):`, err);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  return null;
}

interface TikTokAdsAPIConfig {
  clientKey: string;
  clientSecret: string;
  searchTerm: string;
  countryCode: string;
  period: string; // "YYYY-MM"
}

/**
 * Fetch ads from the TikTok Research API (Ad Library).
 * Two-step flow: find advertiser business IDs, then query their ads.
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
    // Step 1: Get access token (cached)
    const accessToken = await getTikTokToken(clientKey, clientSecret);
    if (!accessToken) return null;

    // Step 2: Find advertiser business IDs for the brand name
    const advertisers = await searchTikTokAdvertisers(config.searchTerm, accessToken);
    if (advertisers.length === 0) {
      console.log(`[TikTok API] No advertisers found for "${config.searchTerm}" — using mock data`);
      return null;
    }

    // Use the first (best) match
    const primaryAdvertiser = advertisers[0];
    console.log(
      `[TikTok API] Found advertiser: ${primaryAdvertiser.business_name} (ID: ${primaryAdvertiser.business_id})`
    );

    // Step 3: Build date range (YYYYMMDD format, max must be before today)
    const [year, month] = config.period.split("-").map(Number);
    const startDate = `${year}${String(month).padStart(2, "0")}01`;
    const today = new Date();
    const periodEnd = new Date(year, month, 0); // last day of the month
    // Use the earlier of: last day of period or yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const effectiveEnd = periodEnd < yesterday ? periodEnd : yesterday;
    const endDate = `${effectiveEnd.getFullYear()}${String(effectiveEnd.getMonth() + 1).padStart(2, "0")}${String(effectiveEnd.getDate()).padStart(2, "0")}`;

    // Step 4: Query ads with retry logic
    const ads = await queryTikTokAds(
      primaryAdvertiser.business_id,
      accessToken,
      { min: startDate, max: endDate }
    );

    if (ads === null) {
      console.log(`[TikTok API] Ad query failed after retries — using mock data`);
      return null;
    }

    if (ads.length === 0) {
      console.log(`[TikTok API] No ads found for ${primaryAdvertiser.business_name} in period ${config.period}`);
      // Return empty snapshot rather than null (real data, just no ads)
      return buildTikTokSnapshot([]);
    }

    return buildTikTokSnapshot(ads);
  } catch (error) {
    console.warn("[TikTok API] Request failed:", error);
    return null;
  }
}

function buildTikTokSnapshot(ads: Array<Record<string, unknown>>): AdDataSnapshot {
  let partnershipAds = 0;
  const formatBreakdown = { video: 0, image: 0, carousel: 0, collection: 0 };
  const durations: number[] = [];

  for (const ad of ads) {
    // In the Research API, ad data is nested under "ad" key
    const adData = (ad.ad as Record<string, unknown> | undefined) ?? ad;
    const advertiserData = (ad.advertiser as Record<string, unknown> | undefined) ?? {};

    // Partnership detection: check if the ad has videos (creator content) vs image_urls (brand content)
    // The Research API doesn't have an is_branded_content field in adlib.basic scope
    // We use presence of videos as a proxy for creator-style content
    const hasVideos = Array.isArray(adData.videos) && (adData.videos as unknown[]).length > 0;
    const hasImages = Array.isArray(adData.image_urls) && (adData.image_urls as unknown[]).length > 0;

    if (hasVideos) {
      formatBreakdown.video++;
    } else if (hasImages) {
      formatBreakdown.image++;
    } else {
      formatBreakdown.video++; // default: TikTok is predominantly video
    }

    // Duration calculation from first_shown_date and last_shown_date (YYYYMMDD integers)
    const firstShown = adData.first_shown_date as number | undefined;
    const lastShown = adData.last_shown_date as number | undefined;
    if (firstShown && lastShown) {
      const parseDate = (d: number) => {
        const s = String(d);
        return new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)).getTime();
      };
      const days = Math.max(1, Math.round((parseDate(lastShown) - parseDate(firstShown)) / (1000 * 60 * 60 * 24)));
      durations.push(days);
    }

    void advertiserData; // used for logging only
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
  metaIsMock: boolean;
  tiktokIsMock: boolean;
  resolvedMetaPageId?: string | null;
  rawMetaAds?: MetaAdRecord[];
}> {
  const mockData = getMockAdData(brandSlug);
  let usedMockData = false;
  let resolvedMetaPageId: string | null | undefined = metaPageId;

  // ── Meta Ads Library ───────────────────────────────────────────────────────
  let meta: AdDataSnapshot | null = null;
  let rawMetaAds: MetaAdRecord[] | undefined;
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
      rawMetaAds = result.rawAds;
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

  const metaIsMock = meta === mockData.meta;
  const tiktokIsMock = tiktok === mockData.tiktok;
  return { meta, tiktok, usedMockData, metaIsMock, tiktokIsMock, resolvedMetaPageId, rawMetaAds };
}
