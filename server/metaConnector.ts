/**
 * Humanz Meta connector — the only data source in v1.
 *
 * What it does:
 *   1. fetchBrandAdSnapshot — counts a brand's ACTIVE Meta ads in a country/date
 *      window (the reliable denominator) and returns candidate partnership ads.
 *   2. resolveMetaPageId / searchMetaPages — turn a brand name into a Page ID,
 *      with a confirm step so you never audit the wrong page.
 *   3. buildAdLibraryUrl / buildBrandedContentUrl — deep links a human opens to
 *      confirm the partnership count from the visible Paid Partnership labels.
 *
 * What it deliberately does NOT do:
 *   - No TikTok. The TikTok Commercial Content API is gated to non-commercial
 *     researchers; a commercial agency cannot access it. Removed entirely.
 *   - No silent fallback to fabricated mock data. On failure it returns null and
 *     the caller surfaces an honest error/empty state. (Demo mode, if wanted, is
 *     a separate explicitly-labelled path — never a silent substitution.)
 *   - No "is this a partnership ad" assertion from the paid API. It returns a
 *     CANDIDATE count (keyword heuristic) that a person must confirm.
 *
 * Access notes (set up before launch):
 *   - Requires a Meta developer app with the Ad Library API product, ads_read via
 *     App Review, and Meta Business Verification. Use a SYSTEM USER token in
 *     production (process.env.META_ACCESS_TOKEN), not a personal user token.
 *   - Coverage is strongest for EU/UK pages post-DSA. Default country here is NL.
 */

const META_GRAPH_VERSION = "v21.0";
const META_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const PUBLIC_LIBRARY_BASE = "https://www.facebook.com/ads/library";

// ─── Partnership candidate detection ──────────────────────────────────────────────
// Word-boundary matching (fixes the old substring bug where "#ad" matched inside
// "#additional" and "ambassador" matched anywhere). These flag CANDIDATES only.
const PARTNERSHIP_PATTERNS: RegExp[] = [
  /\bpaid partnership\b/i,
  /\bpaid collaboration\b/i,
  /\bin collaboration with\b/i,
  /\bin partnership with\b/i,
  /\bsponsored by\b/i,
  /\bcreator partner\b/i,
  /\bbrand ambassador\b/i,
  /#ad\b/i,
  /#paidpartnership\b/i,
  /#sponsored\b/i,
  /#gifted\b/i,
  /#brandpartner\b/i,
  /#ambassador\b/i,
  /(?:^|\s)AD\s*[|l]/,
  /advertentie/i,
  /\|\|\s*advertentie/i,
  /advertentie\s*\|\|/i,
  /\bsamenwerking\b/i,
  /\bin samenwerking met\b/i,
  /\bbetaalde samenwerking\b/i,
  /\bin opdracht van\b/i,
  /#reclame\b/i,
  /#samenwerking\b/i,
  /#betaaldesamenwerking\b/i,
  /#gifted\b/i,
  /\bpartenariat\b/i,
  /\ben partenariat avec\b/i,
  /\bpublicité\b/i,
  /#partenariat\b/i,
  /#publi\b/i,
  // German
  /\bwerbung\b/i,
  /\banzeige\b/i,
  /\bkooperation\b/i,
  /\bin kooperation mit\b/i,
  /\bin zusammenarbeit mit\b/i,
  /#werbung\b/i,
  /#anzeige\b/i,
  /#kooperation\b/i,
  /#unbezahlte_werbung\b/i,
  /#bezahlte_kooperation\b/i,
];

// ─── Option A: Creator-boosted signals ────────────────────────────────────────
// These appear in the BRAND's own ads when they boost a creator's organic post
// or run an influencer-style campaign from their own page.
const CREATOR_BOOST_PATTERNS: RegExp[] = [
  /\blink in bio\b/i,
  /\bin meiner bio\b/i,
  /\bin my bio\b/i,
  /\bin de bio\b/i,
  /\blink in mijn bio\b/i,
  /\bcode\s+[A-Z0-9]{3,}/,       // discount code like "Code DEDFHMF"
  /\buse code\b/i,
  /\bpromo code\b/i,
  /\baffiliate\b/i,
  /\bprovision\b/i,              // German: commission
  /\bempfehlungslink\b/i,        // German: referral link
  /\bempfehlungscode\b/i,        // German: referral code
  /\bswipe up\b/i,
  /\bcheck my bio\b/i,
  /\bcheck the link in bio\b/i,
];

function isBoostedCreatorAd(texts: string[]): boolean {
  const combined = texts.filter(Boolean).join(" ");
  return CREATOR_BOOST_PATTERNS.some((re) => re.test(combined));
}

function isCandidatePartnership(texts: string[]): boolean {
  const combined = texts.filter(Boolean).join(" ");
  return PARTNERSHIP_PATTERNS.some((re) => re.test(combined));
}

export interface MetaAdRecord {
  id: string;
  page_id?: string;
  page_name?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_captions?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_snapshot_url?: string;
  media_type?: "IMAGE" | "VIDEO" | "MEME" | "NONE";
  publisher_platforms?: string[];
  /** Non-empty when Meta has registered a Paid Partnership label on this ad (the creator's name). */
  byline?: string;
}

export type PartnershipSource = "byline" | "text_signal" | "boosted_creator" | "creator_mention";

export interface FlaggedAd {
  id: string;
  snapshotUrl?: string;
  excerpt: string;
  partnershipSource?: PartnershipSource;
  /** For creator_mention ads: the creator's page name */
  creatorPageName?: string;
}

export interface BrandAdSnapshot {
  pageId: string;
  countryCode: string;
  periodLabel: string;
  totalAds: number;
  candidatePartnershipAds: number;
  candidateAds: FlaggedAd[];
  formatBreakdown: { video: number; image: number; carousel: number; collection: number };
  adLibraryUrl: string;
  brandedContentUrl: string;
}

export interface MetaPageResult {
  id: string;
  name: string;
  domain?: string;
  ad_count?: number;
}

export function buildAdLibraryUrl(pageId: string, countryCode = "NL"): string {
  const params = new URLSearchParams({
    active_status: "active",
    ad_type: "all",
    country: countryCode,
    view_all_page_id: pageId,
    search_type: "page",
    media_type: "all",
  });
  return `${PUBLIC_LIBRARY_BASE}/?${params.toString()}`;
}

export function buildBrandedContentUrl(brandName: string, countryCode = "NL"): string {
  const params = new URLSearchParams({
    active_status: "active",
    ad_type: "branded_content",
    country: countryCode,
    q: brandName,
    search_type: "keyword_unordered",
    media_type: "all",
  });
  return `${PUBLIC_LIBRARY_BASE}/?${params.toString()}`;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export async function searchMetaPages(query: string, limit = 5, countryCode = "NL"): Promise<MetaPageResult[]> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return [];

  // Meta rejects today's date as ad_delivery_date_max (error 2334030) — use yesterday.
  const today = new Date();
  today.setDate(today.getDate() - 1);
  const start = new Date(today);
  start.setDate(start.getDate() - 90);

  // Build search term variants:
  //   1. Full phrase: "Emma Sleep"
  //   2. No-space compound: "emmasleep" — catches hashtags like #emmasleep in ad copy
  // Run both in parallel and merge results.
  const words = query.trim().split(/\s+/).filter(Boolean);
  const searchTerms = Array.from(
    new Set([query.trim(), words.length > 1 ? words.join("").toLowerCase() : null].filter((v): v is string => !!v))
  );

  const pageMap = new Map<string, MetaPageResult>();

  async function fetchAdsArchive(searchTerm: string): Promise<void> {
    try {
      const params = new URLSearchParams({
        access_token: token!,
        search_terms: searchTerm,
        ad_reached_countries: JSON.stringify([countryCode]),
        ad_type: "ALL",
        ad_active_status: "ALL",
        ad_delivery_date_min: isoDate(start),
        ad_delivery_date_max: isoDate(today),
        fields: "page_id,page_name,ad_creative_link_captions",
        limit: "50",
      });
      const res = await fetch(`${META_BASE_URL}/ads_archive?${params.toString()}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return;
      const data: { data?: Array<{ page_id?: string; page_name?: string; ad_creative_link_captions?: string[] }> } = await res.json();
      for (const ad of data.data ?? []) {
        if (!ad.page_id || !ad.page_name) continue;
        const existing = pageMap.get(ad.page_id);
        const rawCaption = ad.ad_creative_link_captions?.[0];
        const domain = rawCaption
          ? rawCaption.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase()
          : undefined;
        if (!existing) {
          pageMap.set(ad.page_id, { id: ad.page_id, name: ad.page_name, domain, ad_count: 1 });
        } else {
          existing.ad_count = (existing.ad_count ?? 0) + 1;
          if (!existing.domain && domain) existing.domain = domain;
        }
      }
    } catch {
      // ignore — try next term
    }
  }

  // Run all search term variants in parallel
  await Promise.all(searchTerms.map(fetchAdsArchive));

  // Score each candidate:
  //   +200 if page_name exactly equals the query (case-insensitive)
  //   +100 if page_name contains ALL words from the query
  //   +50  if page_name starts with the query
  //   +1   per ad in ad_count
  // Exact match wins over partial matches (e.g. "Dreame" beats "DreameShort").
  const q = query.toLowerCase().trim();
  const queryWords = q.split(/\s+/).filter(Boolean);
  const scoreCandidate = (p: MetaPageResult): number => {
    const n = p.name.toLowerCase();
    let s = p.ad_count ?? 0;
    if (n === q) s += 200;                                          // exact: "dreame"
    if (n.startsWith(q + " ") || n.startsWith(q + "-")) s += 150; // whole-word prefix: "dreame nederland", "dreame-lite"
    if (queryWords.every((w) => n.includes(w))) s += 100;          // all words present
    if (n.startsWith(q)) s += 50;                                  // prefix (catches "dreame" in "dreamenl")
    return s;
  };

  return Array.from(pageMap.values())
    .sort((a, b) => scoreCandidate(b) - scoreCandidate(a))
    .slice(0, limit);
}

export async function resolveMetaPageId(brandName: string): Promise<string | null> {
  const pages = await searchMetaPages(brandName, 1);
  return pages[0]?.id ?? null;
}

export async function fetchBrandAdSnapshot(params: {
  pageId: string;
  countryCode?: string;
  days?: number;
}): Promise<BrandAdSnapshot | null> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    console.warn("[Meta] No META_ACCESS_TOKEN configured — cannot run a live audit.");
    return null;
  }

  const countryCode = params.countryCode ?? "NL";
  const days = params.days ?? 30;
  // Meta rejects today's date as ad_delivery_date_max (error 2334030) — use yesterday.
  const today = new Date();
  today.setDate(today.getDate() - 1);
  const start = new Date(today);
  start.setDate(start.getDate() - days);
  const periodLabel = `the last ${days} days`;

  try {
    // ── Pass 1: Brand's own ads (search_page_ids) ──────────────────────────────
    const allAds: MetaAdRecord[] = [];
    let nextUrl: string | null = `${META_BASE_URL}/ads_archive?${new URLSearchParams({
      access_token: token,
      search_page_ids: params.pageId,
      ad_active_status: "ACTIVE",
      ad_type: "ALL",
      ad_reached_countries: `["${countryCode}"]`,
      ad_delivery_date_min: isoDate(start),
      ad_delivery_date_max: isoDate(today),
      fields: [
        "id",
        "page_id",
        "page_name",
        "ad_creative_bodies",
        "ad_creative_link_titles",
        "ad_creative_link_captions",
        "ad_delivery_start_time",
        "ad_delivery_stop_time",
        "ad_snapshot_url",
        "media_type",
        "publisher_platforms",
        "byline",
      ].join(","),
      limit: "250",
    }).toString()}`;

    let pageCount = 0;
    while (nextUrl && pageCount < 8) {
      const res: Response = await fetch(nextUrl, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) {
        const body: { error?: { code?: number; message?: string } } = await res
          .json()
          .catch(() => ({}));
        console.warn(`[Meta] ads_archive error ${body?.error?.code}: ${body?.error?.message ?? res.status}`);
        return null;
      }
      const data: { data?: MetaAdRecord[]; paging?: { next?: string } } = await res.json();
      const batch = data.data ?? [];
      allAds.push(...batch);
      nextUrl = data.paging?.next ?? null;
      pageCount++;
      if (batch.length < 250) break;
    }

    const pageName = allAds[0]?.page_name ?? "";

    // ── Pass 2 (Option B): Creator-run ads mentioning the brand ────────────────
    // Search ads_archive by brand name as search_terms. Collect ads from OTHER
    // pages (creator pages) that mention the brand in their copy. These are
    // creator-run partnership ads that don't appear under the brand's page_id.
    const brandNameForSearch = pageName || params.pageId;
    const creatorMentionAds: MetaAdRecord[] = [];
    if (brandNameForSearch) {
      // Use the first word of the brand name as the search term (more results)
      const searchWord = brandNameForSearch.split(/\s+/)[0];
      try {
        const creatorParams = new URLSearchParams({
          access_token: token,
          search_terms: searchWord,
          ad_reached_countries: `["${countryCode}"]`,
          ad_active_status: "ALL",
          ad_delivery_date_min: isoDate(start),
          ad_delivery_date_max: isoDate(today),
          fields: [
            "id",
            "page_id",
            "page_name",
            "ad_creative_bodies",
            "ad_creative_link_titles",
            "ad_creative_link_captions",
            "ad_snapshot_url",
            "byline",
          ].join(","),
          limit: "100",
        });
        const creatorRes = await fetch(`${META_BASE_URL}/ads_archive?${creatorParams.toString()}`, {
          signal: AbortSignal.timeout(15000),
        });
        if (creatorRes.ok) {
          const creatorData: { data?: MetaAdRecord[] } = await creatorRes.json();
          for (const ad of creatorData.data ?? []) {
            // Only include ads from OTHER pages (not the brand's own page)
            if (ad.page_id && ad.page_id !== params.pageId) {
              creatorMentionAds.push(ad);
            }
          }
        }
      } catch {
        // Option B is best-effort — don't fail the whole audit
      }
    }

    // ── Classify and deduplicate ───────────────────────────────────────────────
    const seenIds = new Set<string>();
    const formatBreakdown = { video: 0, image: 0, carousel: 0, collection: 0 };
    const candidateAds: FlaggedAd[] = [];

    // Pass 1: brand's own ads
    for (const ad of allAds) {
      const bodies = ad.ad_creative_bodies ?? [];
      const titles = ad.ad_creative_link_titles ?? [];
      const captions = ad.ad_creative_link_captions ?? [];
      const texts = [...bodies, ...titles, ...captions];

      // byline is the official Paid Partnership signal from Meta.
      const hasByline = !!ad.byline?.trim();
      const hasTextSignal = isCandidatePartnership(texts);
      const hasBoostedSignal = isBoostedCreatorAd(texts);

      if (hasByline || hasTextSignal || hasBoostedSignal) {
        seenIds.add(ad.id);
        const source: PartnershipSource = hasByline
          ? "byline"
          : hasTextSignal
          ? "text_signal"
          : "boosted_creator";
        const excerpt = hasByline
          ? `Paid Partnership with ${ad.byline}`
          : (texts.find(Boolean) ?? "").slice(0, 140);
        candidateAds.push({ id: ad.id, snapshotUrl: ad.ad_snapshot_url, excerpt, partnershipSource: source });
      }

      if (bodies.length > 4 || captions.length > 4) formatBreakdown.collection++;
      else if (bodies.length > 2 || captions.length > 2) formatBreakdown.carousel++;
      else if (ad.media_type === "VIDEO") formatBreakdown.video++;
      else if (ad.media_type === "IMAGE" || ad.media_type === "MEME") formatBreakdown.image++;
      else formatBreakdown.video++;
    }

    // Pass 2: creator-run ads mentioning the brand (Option B)
    for (const ad of creatorMentionAds) {
      if (seenIds.has(ad.id)) continue; // already flagged
      const bodies = ad.ad_creative_bodies ?? [];
      const titles = ad.ad_creative_link_titles ?? [];
      const captions = ad.ad_creative_link_captions ?? [];
      const texts = [...bodies, ...titles, ...captions];

      // For creator-run ads, require at least one partnership signal OR a boosted signal
      // to avoid false positives from drama apps that happen to mention the brand name.
      const hasByline = !!ad.byline?.trim();
      const hasTextSignal = isCandidatePartnership(texts);
      const hasBoostedSignal = isBoostedCreatorAd(texts);

      if (hasByline || hasTextSignal || hasBoostedSignal) {
        seenIds.add(ad.id);
        const source: PartnershipSource = hasByline ? "byline" : hasTextSignal ? "text_signal" : "creator_mention";
        const excerpt = hasByline
          ? `Paid Partnership with ${ad.byline}`
          : (texts.find(Boolean) ?? "").slice(0, 140);
        candidateAds.push({
          id: ad.id,
          snapshotUrl: ad.ad_snapshot_url,
          excerpt,
          partnershipSource: source,
          creatorPageName: ad.page_name,
        });
      }
    }

    return {
      pageId: params.pageId,
      countryCode,
      periodLabel,
      totalAds: allAds.length,
      candidatePartnershipAds: candidateAds.length,
      candidateAds,
      formatBreakdown,
      adLibraryUrl: buildAdLibraryUrl(params.pageId, countryCode),
      brandedContentUrl: buildBrandedContentUrl(pageName, countryCode),
    };
  } catch (error) {
    console.warn("[Meta] fetchBrandAdSnapshot failed:", error);
    return null;
  }
}
