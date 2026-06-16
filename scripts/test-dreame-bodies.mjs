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

// Fetch ALL Dreame Deutschland ads (page_id=102842802075286) with full body text
const params = new URLSearchParams({
  access_token: TOKEN,
  search_page_ids: "102842802075286",
  ad_reached_countries: JSON.stringify(["DE"]),
  ad_active_status: "ALL",
  ad_delivery_date_min: isoDate(start),
  ad_delivery_date_max: isoDate(today),
  fields: "id,page_id,page_name,byline,ad_creative_bodies,ad_creative_link_titles,ad_snapshot_url",
  limit: "100",
});

const res = await fetch(`${META_BASE}/ads_archive?${params}`);
const data = await res.json();
const ads = data.data ?? [];
console.log("Total Dreame Deutschland ads:", ads.length);

// Check for partnership keywords in bodies
const partnerKeywords = [
  "werbung", "anzeige", "kooperation", "gesponsert", "in zusammenarbeit",
  "#ad", "sponsored", "paid partnership", "in meiner bio", "link in bio",
  "code ", "rabatt", "discount", "affiliate", "provision", "empfehlung"
];

const partnerAds = [];
for (const ad of ads) {
  const body = (ad.ad_creative_bodies?.[0] ?? "").toLowerCase();
  const title = (ad.ad_creative_link_titles?.[0] ?? "").toLowerCase();
  const combined = body + " " + title;
  const matched = partnerKeywords.filter((kw) => combined.includes(kw));
  if (matched.length > 0) {
    partnerAds.push({ ad, matched });
  }
}

console.log("\nAds with partnership signals:", partnerAds.length);
for (const { ad, matched } of partnerAds.slice(0, 10)) {
  console.log("\n  ID:", ad.id);
  console.log("  byline:", ad.byline ?? "(empty)");
  console.log("  matched keywords:", matched.join(", "));
  console.log("  body:", (ad.ad_creative_bodies?.[0] ?? "").slice(0, 200));
}

// Also show ALL bodies to manually inspect
console.log("\n\n=== ALL AD BODIES ===");
for (const ad of ads) {
  const body = ad.ad_creative_bodies?.[0] ?? "(no body)";
  console.log(`\nAd ${ad.id} | byline: ${ad.byline ?? "(empty)"}`);
  console.log(body.slice(0, 150));
}
