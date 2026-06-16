import { config } from "dotenv";
config();

const TOKEN = process.env.META_ACCESS_TOKEN;
const META_BASE = "https://graph.facebook.com/v21.0";

const today = new Date();
today.setDate(today.getDate() - 1);
const start = new Date(today);
start.setDate(start.getDate() - 90);
const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Search for Dreame ads in DE with limit 100
const params = new URLSearchParams({
  access_token: TOKEN,
  search_terms: "Dreame",
  ad_reached_countries: JSON.stringify(["DE"]),
  ad_active_status: "ALL",
  ad_delivery_date_min: isoDate(start),
  ad_delivery_date_max: isoDate(today),
  fields: "id,page_id,page_name,byline,ad_creative_bodies",
  limit: "100",
});

const res = await fetch(`${META_BASE}/ads_archive?${params}`);
const data = await res.json();
const ads = data.data ?? [];
console.log("Total ads returned (limit 100):", ads.length);

// Check for Empfehlungsfuchs or Tutich
const partnerAds = ads.filter(
  (a) =>
    a.page_name?.toLowerCase().includes("empfehlungsfuchs") ||
    a.page_name?.toLowerCase().includes("tutich")
);
console.log("Empfehlungsfuchs/Tutich ads:", partnerAds.length);

// Check all unique pages
const pages = new Map();
for (const ad of ads) pages.set(ad.page_id, ad.page_name);
console.log("Unique pages:", pages.size);
for (const [id, name] of pages) console.log(" ", name, "(" + id + ")");

// Check pagination cursor
console.log("\nHas next page:", !!data.paging?.next);

// Also check if any ad bodies contain partnership keywords
const partnerKeywords = ["werbung", "anzeige", "kooperation", "gesponsert", "in zusammenarbeit", "ad ", "#ad", "sponsored", "paid partnership"];
const bodyMatches = ads.filter((a) => {
  const body = (a.ad_creative_bodies?.[0] ?? "").toLowerCase();
  return partnerKeywords.some((kw) => body.includes(kw));
});
console.log("\nAds with partnership keywords in body:", bodyMatches.length);
for (const ad of bodyMatches.slice(0, 5)) {
  console.log("  page:", ad.page_name);
  console.log("  body:", (ad.ad_creative_bodies?.[0] ?? "").slice(0, 120));
}
