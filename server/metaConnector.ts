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
];

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

export interface FlaggedAd {
  id: string;
  snapshotUrl?: string;
  excerpt: string;
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

  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 90);

  const words = query.trim().split(/\s+/).filter(Boolean);
  // Search full phrase, 2-word prefix (for long names), and first word.
  // Single-word search is safe because nameMatches() below filters by page name,
  // discarding drama-streaming apps that happen to mention "Emma" in their ad copy.
  const variations = Array.from(
    new Set(
      [
        query.trim(),
        words.length > 2 ? words.slice(0, 2).join(" ") : null,
        words.length > 1 ? words[0] : null,
      ].filter((v): v is string => !!v && v.length >= 3)
    )
  );

  const pageMap = new Map<string, MetaPageResult>();
  for (const term of variations) {
    if (pageMap.size >= limit) break;
    try {
      const params = new URLSearchParams({
        access_token: token,
        search_terms: term,
        ad_reached_countries: `["${countryCode}"]`,
        ad_type: "ALL",
        ad_active_status: "ALL",
        ad_delivery_date_min: isoDate(start),
        ad_delivery_date_max: isoDate(today),
        fields: "page_id,page_name,ad_creative_link_captions",
        limit: "50",
      });
      const res = await fetch(`${META_BASE_URL}/ads_archive?${params.toString()}`, {
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const data: { data?: Array<{ page_id?: string; page_name?: string }> } = await res.json();
      for (const ad of data.data ?? []) {
        if (!ad.page_id || !ad.page_name) continue;
        const existing = pageMap.get(ad.page_id);
        const rawCaption = (ad as MetaAdRecord & { ad_creative_link_captions?: string[] })
          .ad_creative_link_captions?.[0];
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
      // ignore and try next variation
    }
  }

  const q = query.toLowerCase().trim();
  const queryWords = q.split(/\s+/).filter((w) => w.length >= 4);
  const nameMatches = (name: string): boolean => {
    const n = name.toLowerCase();
    if (n.includes(q)) return true;
    if (queryWords.length > 0 && queryWords.some((w) => n.includes(w))) return true;
    return false;
  };

  return Array.from(pageMap.values())
    .filter((p) => nameMatches(p.name))
    .sort((a, b) => {
      const aL = a.name.toLowerCase();
      const bL = b.name.toLowerCase();
      const score = (n: string) => (n === q ? 2 : n.startsWith(q) ? 1 : 0);
      return score(bL) - score(aL);
    })
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
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - days);
  const periodLabel = `the last ${days} days`;

  try {
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

    let pages = 0;
    while (nextUrl && pages < 8) {
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
      pages++;
      if (batch.length < 250) break;
    }

    const formatBreakdown = { video: 0, image: 0, carousel: 0, collection: 0 };
    const candidateAds: FlaggedAd[] = [];

    for (const ad of allAds) {
      const bodies = ad.ad_creative_bodies ?? [];
      const titles = ad.ad_creative_link_titles ?? [];
      const captions = ad.ad_creative_link_captions ?? [];
      const texts = [...bodies, ...titles, ...captions];

      // byline is the official Paid Partnership signal from Meta.
      const hasByline = !!ad.byline?.trim();
      if (hasByline || isCandidatePartnership(texts)) {
        candidateAds.push({
          id: ad.id,
          snapshotUrl: ad.ad_snapshot_url,
          excerpt: hasByline
            ? `Paid Partnership with ${ad.byline}`
            : (texts.find(Boolean) ?? "").slice(0, 140),
        });
      }

      if (bodies.length > 4 || captions.length > 4) formatBreakdown.collection++;
      else if (bodies.length > 2 || captions.length > 2) formatBreakdown.carousel++;
      else if (ad.media_type === "VIDEO") formatBreakdown.video++;
      else if (ad.media_type === "IMAGE" || ad.media_type === "MEME") formatBreakdown.image++;
      else formatBreakdown.video++;
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
      brandedContentUrl: buildBrandedContentUrl(allAds[0]?.page_name ?? "", countryCode),
    };
  } catch (error) {
    console.warn("[Meta] fetchBrandAdSnapshot failed:", error);
    return null;
  }
}
