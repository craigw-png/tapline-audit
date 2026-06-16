/**
 * Full end-to-end test of fetchBrandAdSnapshot with Option A+B
 * for Dreame Deutschland (page ID: 102842802075286, country: DE)
 */
import { config } from "dotenv";
config();

const TOKEN = process.env.META_ACCESS_TOKEN;
const META_BASE = "https://graph.facebook.com/v21.0";

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PARTNERSHIP_PATTERNS = [
  /\bpaid partnership\b/i, /\bpaid collaboration\b/i, /\bin collaboration with\b/i,
  /\bin partnership with\b/i, /\bsponsored by\b/i, /\bcreator partner\b/i,
  /\bbrand ambassador\b/i, /#ad\b/i, /#paidpartnership\b/i, /#sponsored\b/i,
  /#gifted\b/i, /#brandpartner\b/i, /#ambassador\b/i, /(?:^|\s)AD\s*[|l]/,
  /advertentie/i, /\|\|\s*advertentie/i, /advertentie\s*\|\|/i,
  /\bsamenwerking\b/i, /\bin samenwerking met\b/i, /\bbetaalde samenwerking\b/i,
  /\bin opdracht van\b/i, /#reclame\b/i, /#samenwerking\b/i, /#betaaldesamenwerking\b/i,
  /\bpartenariat\b/i, /\ben partenariat avec\b/i, /\bpublicité\b/i,
  /#partenariat\b/i, /#publi\b/i,
  // German
  /\bwerbung\b/i, /\banzeige\b/i, /\bkooperation\b/i, /\bin kooperation mit\b/i,
  /\bin zusammenarbeit mit\b/i, /#werbung\b/i, /#anzeige\b/i, /#kooperation\b/i,
  /#unbezahlte_werbung\b/i, /#bezahlte_kooperation\b/i,
];

const CREATOR_BOOST_PATTERNS = [
  /\blink in bio\b/i, /\bin meiner bio\b/i, /\bin my bio\b/i, /\bin de bio\b/i,
  /\blink in mijn bio\b/i, /\bcode\s+[A-Z0-9]{3,}/, /\buse code\b/i,
  /\bpromo code\b/i, /\baffiliate\b/i, /\bprovision\b/i, /\bempfehlungslink\b/i,
  /\bempfehlungscode\b/i, /\bswipe up\b/i, /\bcheck my bio\b/i,
  /\bcheck the link in bio\b/i,
];

function isCandidatePartnership(texts) {
  const combined = texts.filter(Boolean).join(" ");
  return PARTNERSHIP_PATTERNS.some((re) => re.test(combined));
}

function isBoostedCreatorAd(texts) {
  const combined = texts.filter(Boolean).join(" ");
  return CREATOR_BOOST_PATTERNS.some((re) => re.test(combined));
}

const PAGE_ID = "102842802075286";
const COUNTRY = "DE";
const DAYS = 90;

const today = new Date();
today.setDate(today.getDate() - 1);
const start = new Date(today);
start.setDate(start.getDate() - DAYS);

console.log("=== Pass 1: Brand's own ads ===");
const pass1Params = new URLSearchParams({
  access_token: TOKEN,
  search_page_ids: PAGE_ID,
  ad_active_status: "ACTIVE",
  ad_type: "ALL",
  ad_reached_countries: `["${COUNTRY}"]`,
  ad_delivery_date_min: isoDate(start),
  ad_delivery_date_max: isoDate(today),
  fields: "id,page_id,page_name,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_captions,ad_snapshot_url,byline",
  limit: "100",
});

const pass1Res = await fetch(`${META_BASE}/ads_archive?${pass1Params}`);
const pass1Data = await pass1Res.json();
const pass1Ads = pass1Data.data ?? [];
console.log(`Total brand ads: ${pass1Ads.length}`);

const pageName = pass1Ads[0]?.page_name ?? "Dreame Deutschland";
const seenIds = new Set();
const flagged = [];

for (const ad of pass1Ads) {
  const texts = [...(ad.ad_creative_bodies ?? []), ...(ad.ad_creative_link_titles ?? []), ...(ad.ad_creative_link_captions ?? [])];
  const hasByline = !!ad.byline?.trim();
  const hasTextSignal = isCandidatePartnership(texts);
  const hasBoostedSignal = isBoostedCreatorAd(texts);
  if (hasByline || hasTextSignal || hasBoostedSignal) {
    seenIds.add(ad.id);
    const source = hasByline ? "byline" : hasTextSignal ? "text_signal" : "boosted_creator";
    flagged.push({ id: ad.id, source, excerpt: (texts[0] ?? "").slice(0, 80), creatorPage: null });
  }
}
console.log(`Pass 1 flagged: ${flagged.length} (byline: ${flagged.filter(f=>f.source==="byline").length}, text_signal: ${flagged.filter(f=>f.source==="text_signal").length}, boosted_creator: ${flagged.filter(f=>f.source==="boosted_creator").length})`);

console.log("\n=== Pass 2: Creator-run ads mentioning the brand ===");
const searchWord = pageName.split(/\s+/)[0]; // "Dreame"
const pass2Params = new URLSearchParams({
  access_token: TOKEN,
  search_terms: searchWord,
  ad_reached_countries: `["${COUNTRY}"]`,
  ad_active_status: "ALL",
  ad_delivery_date_min: isoDate(start),
  ad_delivery_date_max: isoDate(today),
  fields: "id,page_id,page_name,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_captions,ad_snapshot_url,byline",
  limit: "100",
});

const pass2Res = await fetch(`${META_BASE}/ads_archive?${pass2Params}`);
const pass2Data = await pass2Res.json();
const pass2Ads = (pass2Data.data ?? []).filter(a => a.page_id !== PAGE_ID);
console.log(`Creator-run ads mentioning "${searchWord}": ${pass2Ads.length} (from other pages)`);

for (const ad of pass2Ads) {
  if (seenIds.has(ad.id)) continue;
  const texts = [...(ad.ad_creative_bodies ?? []), ...(ad.ad_creative_link_titles ?? []), ...(ad.ad_creative_link_captions ?? [])];
  const hasByline = !!ad.byline?.trim();
  const hasTextSignal = isCandidatePartnership(texts);
  const hasBoostedSignal = isBoostedCreatorAd(texts);
  if (hasByline || hasTextSignal || hasBoostedSignal) {
    seenIds.add(ad.id);
    const source = hasByline ? "byline" : hasTextSignal ? "text_signal" : "creator_mention";
    flagged.push({ id: ad.id, source, excerpt: (texts[0] ?? "").slice(0, 80), creatorPage: ad.page_name });
  }
}

const pass2Flagged = flagged.filter(f => f.creatorPage !== null);
console.log(`Pass 2 flagged: ${pass2Flagged.length}`);
for (const f of pass2Flagged.slice(0, 5)) {
  console.log(`  [${f.source}] ${f.creatorPage}: ${f.excerpt}`);
}

console.log(`\n=== TOTAL: ${flagged.length} partnership candidates ===`);
console.log("Sources breakdown:");
for (const src of ["byline", "text_signal", "boosted_creator", "creator_mention"]) {
  console.log(`  ${src}: ${flagged.filter(f=>f.source===src).length}`);
}
