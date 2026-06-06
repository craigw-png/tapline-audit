/**
 * Account-Level API Connectors — Tapline
 *
 * These connectors fetch first-party performance data from Meta Marketing API
 * and TikTok Ads API when a client has granted Tapline read-only access.
 *
 * Access model (read-only, no spend capability):
 *   Meta:   Brand adds audit@tapline.co as Partner in Business Manager
 *           with "Analyst" role on their ad account (view-only).
 *   TikTok: Brand adds audit@tapline.co as "Viewer" in TikTok Ads Manager.
 *
 * Both grants are fully revocable by the brand at any time.
 */

import type { AccountLevelData } from "../drizzle/schema";

// ─── Meta Marketing API — Account-Level Data ─────────────────────────────────

interface MetaAccountConfig {
  accessToken: string;
  adAccountId: string; // e.g. "act_123456789"
  period: string; // "YYYY-MM"
}

/**
 * Fetch account-level performance metrics from Meta Marketing API.
 * Requires ads_read permission on the client's ad account.
 * Returns null if access is unavailable.
 */
export async function fetchMetaAccountData(
  config: MetaAccountConfig
): Promise<Partial<AccountLevelData> | null> {
  const token = process.env.META_ACCESS_TOKEN ?? config.accessToken;
  if (!token || !config.adAccountId) {
    console.log("[Meta Account API] No token or account ID — skipping");
    return null;
  }

  try {
    const [year, month] = config.period.split("-").map(Number);
    const since = `${year}-${String(month).padStart(2, "0")}-01`;
    const until = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;

    // Fetch campaign-level insights
    const insightsParams = new URLSearchParams({
      access_token: token,
      time_range: JSON.stringify({ since, until }),
      fields: [
        "impressions",
        "clicks",
        "ctr",
        "actions",
        "cost_per_action_type",
        "video_3_sec_watched_actions",
        "video_p50_watched_actions",
        "reach",
        "frequency",
      ].join(","),
      level: "account",
      limit: "1",
    });

    const insightsRes = await fetch(
      `https://graph.facebook.com/v19.0/${config.adAccountId}/insights?${insightsParams}`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!insightsRes.ok) {
      const err = await insightsRes.json().catch(() => ({}));
      console.warn("[Meta Account API] Insights error:", err?.error?.message ?? insightsRes.status);
      return null;
    }

    const insightsData = await insightsRes.json();
    const row = insightsData.data?.[0];
    if (!row) return null;

    const impressions = parseInt(row.impressions ?? "0", 10);
    const clicks = parseInt(row.clicks ?? "0", 10);
    const ctrPct = parseFloat(row.ctr ?? "0");

    // 3-sec video views (thumb-stop)
    const video3sec = row.video_3_sec_watched_actions?.find(
      (a: { action_type: string; value: string }) => a.action_type === "video_view"
    );
    const thumbStopRate =
      impressions > 0 && video3sec
        ? (parseInt(video3sec.value, 10) / impressions) * 100
        : undefined;

    // 50% video views (hold rate)
    const videoP50 = row.video_p50_watched_actions?.find(
      (a: { action_type: string; value: string }) => a.action_type === "video_view"
    );
    const holdRate =
      impressions > 0 && videoP50
        ? (parseInt(videoP50.value, 10) / impressions) * 100
        : undefined;

    // CPA for purchases
    const cpaPurchase = row.cost_per_action_type?.find(
      (a: { action_type: string; value: string }) => a.action_type === "purchase"
    );
    const cpaValue = cpaPurchase ? parseFloat(cpaPurchase.value) : undefined;

    // Fetch creative similarity score from ad creative analysis
    const creativeSimilarityScore = await fetchCreativeSimilarityScore(
      token,
      config.adAccountId,
      since,
      until
    );

    // Fetch top creative themes
    const topCreativeThemes = await fetchTopCreativeThemes(
      token,
      config.adAccountId,
      since,
      until
    );

    // Estimate FTI from reach vs frequency
    // FTI proxy: high reach + low frequency = more new audiences
    const frequency = parseFloat(row.frequency ?? "1");
    const ftiEstimate = estimateFTI(frequency);

    return {
      ftiScore: ftiEstimate.score,
      ftiZone: ftiEstimate.zone,
      ctrPct,
      thumbStopRate,
      holdRate,
      cpaDeltaPct: cpaValue !== undefined ? undefined : undefined, // needs BAU baseline
      creativeSimilarityScore,
      topCreativeThemes,
      dataAsOf: new Date().toISOString().split("T")[0],
      metaAdAccountId: config.adAccountId,
    };
  } catch (error) {
    console.warn("[Meta Account API] Request failed:", error);
    return null;
  }
}

/**
 * Fetch the Creative Similarity Score from Meta Ads Manager.
 * This is available via the creative analysis endpoint.
 */
async function fetchCreativeSimilarityScore(
  token: string,
  adAccountId: string,
  since: string,
  until: string
): Promise<number | undefined> {
  try {
    const params = new URLSearchParams({
      access_token: token,
      time_range: JSON.stringify({ since, until }),
      fields: "creative_similarity_score",
      limit: "1",
    });

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${adAccountId}/creative_similarity_score?${params}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) return undefined;
    const data = await res.json();
    return data.data?.[0]?.creative_similarity_score ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fetch top creative themes by spend share from Meta Ads Manager.
 */
async function fetchTopCreativeThemes(
  token: string,
  adAccountId: string,
  since: string,
  until: string
): Promise<Array<{ theme: string; spendShare: number }> | undefined> {
  try {
    const params = new URLSearchParams({
      access_token: token,
      time_range: JSON.stringify({ since, until }),
      fields: "top_creative_themes",
      limit: "5",
    });

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${adAccountId}/creative_themes?${params}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) return undefined;
    const data = await res.json();
    return data.data?.map((t: { theme: string; spend_share: number }) => ({
      theme: t.theme,
      spendShare: t.spend_share,
    }));
  } catch {
    return undefined;
  }
}

/**
 * Estimate FTI (First-Touch Incrementality) from frequency data.
 * Low frequency = more new audiences = higher FTI proxy.
 * This is an approximation; true FTI requires Meta's Conversion Lift study.
 */
function estimateFTI(frequency: number): {
  score: number;
  zone: "critical" | "healthy" | "growth";
} {
  // frequency 1.0–1.5 = mostly new audiences (high FTI)
  // frequency 1.5–2.5 = mixed (healthy)
  // frequency 2.5+ = mostly retargeting (low FTI)
  if (frequency <= 1.3) return { score: 75, zone: "growth" };
  if (frequency <= 1.8) return { score: 60, zone: "growth" };
  if (frequency <= 2.5) return { score: 45, zone: "healthy" };
  if (frequency <= 3.5) return { score: 30, zone: "healthy" };
  return { score: 15, zone: "critical" };
}

// ─── TikTok Ads API — Account-Level Data ─────────────────────────────────────

interface TikTokAccountConfig {
  accessToken: string;
  advertiserId: string;
  period: string; // "YYYY-MM"
}

/**
 * Fetch account-level performance metrics from TikTok Ads API.
 * Requires the client to have added audit@tapline.co as a Viewer.
 * Returns null if access is unavailable.
 */
export async function fetchTikTokAccountData(
  config: TikTokAccountConfig
): Promise<Partial<AccountLevelData> | null> {
  const token = process.env.TIKTOK_ACCESS_TOKEN ?? config.accessToken;
  if (!token || !config.advertiserId) {
    console.log("[TikTok Account API] No token or advertiser ID — skipping");
    return null;
  }

  try {
    const [year, month] = config.period.split("-").map(Number);
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;

    const res = await fetch(
      "https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/",
      {
        method: "POST",
        headers: {
          "Access-Token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          advertiser_id: config.advertiserId,
          report_type: "BASIC",
          data_level: "AUCTION_ADVERTISER",
          dimensions: ["stat_time_day"],
          metrics: [
            "impressions",
            "clicks",
            "ctr",
            "video_play_actions",
            "video_watched_2s",
            "video_watched_6s",
            "reach",
            "frequency",
          ],
          start_date: startDate,
          end_date: endDate,
          page_size: 30,
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn("[TikTok Account API] Error:", err?.message ?? res.status);
      return null;
    }

    const data = await res.json();
    if (data.code !== 0) {
      console.warn("[TikTok Account API] API error code:", data.code, data.message);
      return null;
    }

    // Aggregate across days
    const rows = data.data?.list ?? [];
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalVideo2s = 0;
    let totalVideo6s = 0;

    for (const row of rows) {
      const m = row.metrics ?? {};
      totalImpressions += parseInt(m.impressions ?? "0", 10);
      totalClicks += parseInt(m.clicks ?? "0", 10);
      totalVideo2s += parseInt(m.video_watched_2s ?? "0", 10);
      totalVideo6s += parseInt(m.video_watched_6s ?? "0", 10);
    }

    const ctrPct = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    // TikTok thumb-stop proxy: 2s views ÷ impressions
    const thumbStopRate =
      totalImpressions > 0 ? (totalVideo2s / totalImpressions) * 100 : undefined;
    // TikTok hold rate proxy: 6s views ÷ impressions
    const holdRate =
      totalImpressions > 0 ? (totalVideo6s / totalImpressions) * 100 : undefined;

    return {
      ctrPct,
      thumbStopRate,
      holdRate,
      dataAsOf: new Date().toISOString().split("T")[0],
      tiktokAdvertiserId: config.advertiserId,
    };
  } catch (error) {
    console.warn("[TikTok Account API] Request failed:", error);
    return null;
  }
}

// ─── Combined Account-Level Fetch ────────────────────────────────────────────

/**
 * Fetch and merge account-level data from both platforms.
 * Meta data takes precedence for FTI and creative similarity.
 * TikTok data fills in video engagement metrics.
 */
export async function fetchAccountLevelData(params: {
  metaAdAccountId?: string | null;
  tiktokAdvertiserId?: string | null;
  metaAccessToken?: string;
  tiktokAccessToken?: string;
  period: string;
}): Promise<AccountLevelData | null> {
  const results: Partial<AccountLevelData>[] = [];

  if (params.metaAdAccountId) {
    const metaData = await fetchMetaAccountData({
      accessToken: params.metaAccessToken ?? "",
      adAccountId: params.metaAdAccountId,
      period: params.period,
    });
    if (metaData) results.push(metaData);
  }

  if (params.tiktokAdvertiserId) {
    const tiktokData = await fetchTikTokAccountData({
      accessToken: params.tiktokAccessToken ?? "",
      advertiserId: params.tiktokAdvertiserId,
      period: params.period,
    });
    if (tiktokData) results.push(tiktokData);
  }

  if (results.length === 0) return null;

  // Merge: first result wins for each field
  const merged: Record<string, unknown> = {
    ftiScore: 0,
    ftiZone: "critical" as const,
    ctrPct: 0,
    thumbStopRate: undefined,
    holdRate: undefined,
    cpaDeltaPct: undefined,
    creativeSimilarityScore: undefined,
    topCreativeThemes: undefined,
    commentSentiment: undefined,
    activeCreatorCount: undefined,
    creatorTierBreakdown: undefined,
    dataAsOf: new Date().toISOString().split("T")[0],
  };

  for (const result of results) {
    for (const [key, value] of Object.entries(result)) {
      if (value !== undefined && value !== null) {
        merged[key] = value;
      }
    }
  }

  return merged as unknown as AccountLevelData;
}
