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

// ─── Partnership candidate detection ──────────────────────────────────────────
// Word-boundary matching (fixes the old substring bug where "#ad" matched inside
// "#additional" and "ambassador" matched anywhere). These flag CANDIDATES only.
const PARTNERSHIP_PATTERNS: RegExp[] = [
  // English — explicit paid partnership labels
  /\bpaid partnership\b/i,
  /\bpaid collaboration\b/i,
  /\bin collaboration with\b/i,
  /\bin partnership with\b/i,
  /\bsponsored by\b/i,
  /\bcreator partner\b/i,
  /\bbrand ambassador\b/i,
  // English hashtags
  /#ad\b/i,
  /#paidpartnership\b/i,
  /#sponsored\b/i,
  /#gifted\b/i,
  /#brandpartner\b/i,
  /#ambassador\b/i,
  // Dutch — "AD |" or "AD l" pipe/bar format (e.g. "AD | Ik maakte..." or "AD l new coffee...")
  // Must be at start of text or after whitespace to avoid matching "ad" inside words
  /(?:^|\s)AD\s*[|l]/,
  // Dutch — "advertentie ||" or "|| advertentie" (pipe-wrapped)
  /advertentie/i,
  /\|\|\s*advertentie/i,
  /advertentie\s*\|\|/i,
  // Dutch — collaboration / partnership phrases
  /\bsamenwerking\b/i,
  /\bin samenwerking met\b/i,
  /\bbetaalde samenwerking\b/i,
  /\bin opdracht van\b/i,
  // Dutch hashtags
  /#reclame\b/i,
  /#samenwerking\b/i,
  /#betaaldesamenwerking\b/i,
  /#gifted\b/i,
  // French (BE/FR market)
  /\bpartenariat\b/i,
  /\ben partenariat avec\b/i,
  /\bpublicit\u00e9\b/i,
  /#partenariat\b/i,
  /#publi\b/i,
];

function isCandidatePartnership(texts: string[]): boolean {
  const combined = texts.filter(Boolean).join(" ");
  return PARTNERSHIP_PATTERNS.some((re) => re.test(combined));
}

// ─── Types ────────────────────────────────────────────────────────────────────

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
}

export interface FlaggedAd {
  id: string;
  snapshotUrl?: string;
  /** One-line excerpt of the matched creative text, for the human confirming the count. */
  excerpt: string;
}

export interface BrandAdSnapshot {
  pageId: string;
  countryCode: string;
  periodLabel: string;
  totalAds: number;
  /** Heuristic — must be confirmed by a human before it is reported. */
  candidatePartnershipAds: number;
  /** The flagged ads so a reviewer can open each and confirm/deny the label. */
  candidateAds: FlaggedAd[];
  formatBreakdown: { video: number; image: number; carousel: number; collection: number };
  /** Deep link a reviewer opens to see this page's ads with their labels. */
  adLibraryUrl: string;
  /** Deep link to the page's branded-content (Paid Partnership) view. */
  brandedContentUrl: string;
}

export interface MetaPageResult {
  id: string;
  name: string;
  /** Primary domain seen in this page's ads (e.g. "hema.nl") — helps distinguish pages with the same name. */
  domain?: string;
  /** Number of ads found in the last 90 days — higher = more active advertiser. */
  ad_count?: number;
}

// ─── Library deep links (for manual confirmation, no token needed) ─────────────

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
  // The native library exposes branded content ("Paid Partnership") in a separate
  // section; a name search filtered to branded content is the reliable human path.
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

// ─── Date helpers ──────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// ─── Page resolution ───────────────────────────────────────────────────────────

/**
 * Find candidate Meta Pages for a brand name by de-duplicating the pages that are
 * actually running ads. Returns {id, name} only — present these to the user to
 * CONFIRM before auditing, rather than silently picking one.
 */
export async function searchMetaPages(query: string, limit = 5, countryCode = "NL"): Promise<MetaPageResult[]> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return [];

  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 90);

  const words = query.trim().split(/\s+/).filter(Boolean);
  const variations = Array.from(
    new Set(
      [query.trim(), words.length > 2 ? words.slice(0, 2).join(" ") : null]
        .filter((v): v is string => !!v && v.length >= 2)
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
        // Extract domain from ad_creative_link_captions (e.g. "hema.nl", "www.hema.nl")
        const rawCaption = (ad as MetaAdRecord & { ad_creative_link_captions?: string[] })
          .ad_creative_link_captions?.[0];
        const domain = rawCaption
          ? rawCaption.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase()
          : undefined;
        if (!existing) {
          pageMap.set(ad.page_id, { id: ad.page_id, name: ad.page_name, domain, ad_count: 1 });
        } else {
          // Increment ad count; keep first domain seen
          existing.ad_count = (existing.ad_count ?? 0) + 1;
          if (!existing.domain && domain) existing.domain = domain;
        }
      }
    } catch {
      // ignore and try next variation
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

// ─── Core: count active ads + flag partnership candidates ──────────────────────

/**
 * Count a brand's active Meta ads over the last `days` and flag partnership
 * candidates. Returns null on any API failure — the caller shows an honest error,
 * never fabricated numbers.
 */
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

      if (isCandidatePartnership(texts)) {
        candidateAds.push({
          id: ad.id,
          snapshotUrl: ad.ad_snapshot_url,
          excerpt: (texts.find(Boolean) ?? "").slice(0, 140),
        });
      }

      // Format: media_type primary; multi-body as a weak carousel/collection hint.
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
