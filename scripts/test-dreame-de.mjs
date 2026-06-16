/**
 * Inspect raw API response for Dreame Deutschland to understand
 * what fields are available for partnership detection.
 * 
 * Dreame Deutschland page ID: need to find it first via ads_archive search
 */
import { config } from "dotenv";
config();

const TOKEN = process.env.META_ACCESS_TOKEN;
const META_BASE = "https://graph.facebook.com/v21.0";

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const today = new Date();
today.setDate(today.getDate() - 1);
const start = new Date(today);
start.setDate(start.getDate() - 90);

// Step 1: Find Dreame Deutschland page ID
console.log("=== Step 1: Find Dreame Deutschland page ID ===");
const searchParams = new URLSearchParams({
  access_token: TOKEN,
  search_terms: "Dreame",
  ad_reached_countries: JSON.stringify(["DE"]),
  ad_active_status: "ALL",
  ad_delivery_date_min: isoDate(start),
  ad_delivery_date_max: isoDate(today),
  fields: "page_id,page_name",
  limit: "20",
});

const searchRes = await fetch(`${META_BASE}/ads_archive?${searchParams}`);
const searchData = await searchRes.json();

if (searchData.error) {
  console.error("Search error:", searchData.error);
  process.exit(1);
}

// Find Dreame Deutschland
const pages = new Map();
for (const ad of searchData.data ?? []) {
  if (!pages.has(ad.page_id)) {
    pages.set(ad.page_id, ad.page_name);
  }
}
console.log("Pages found:");
for (const [id, name] of pages) {
  console.log(`  ${id}: ${name}`);
}

// Find the Dreame Deutschland page
const dreameEntry = [...pages.entries()].find(([, name]) => 
  name?.toLowerCase().includes("dreame") && name?.toLowerCase().includes("deutsch")
);

if (!dreameEntry) {
  console.log("\nDreame Deutschland not found in search results.");
  console.log("Trying with known page IDs from the screenshots...");
  
  // The screenshots show ads from Dreame Deutschland — let's check the ad IDs
  // Library IDs from screenshots: 27209864982874910, 4270221513252371, 3612953122195789
  const knownAdIds = ["27209864982874910", "4270221513252371", "3612953122195789"];
  for (const adId of knownAdIds) {
    const adParams = new URLSearchParams({
      access_token: TOKEN,
      fields: "id,page_id,page_name,byline,ad_creative_bodies,ad_creative_link_titles,publisher_platforms",
    });
    const adRes = await fetch(`${META_BASE}/${adId}?${adParams}`);
    const adData = await adRes.json();
    console.log(`\nAd ${adId}:`, JSON.stringify(adData, null, 2));
  }
  process.exit(0);
}

const [dreamePageId, dreameName] = dreameEntry;
console.log(`\nFound: ${dreameName} (${dreamePageId})`);

// Step 2: Fetch ads for Dreame Deutschland with ALL fields
console.log("\n=== Step 2: Fetch ads with all partnership-relevant fields ===");
const adsParams = new URLSearchParams({
  access_token: TOKEN,
  search_page_ids: dreamePageId,
  ad_reached_countries: JSON.stringify(["DE"]),
  ad_active_status: "ALL",
  ad_delivery_date_min: isoDate(start),
  ad_delivery_date_max: isoDate(today),
  fields: [
    "id",
    "page_id",
    "page_name",
    "byline",
    "ad_creative_bodies",
    "ad_creative_link_titles",
    "ad_creative_link_captions",
    "ad_snapshot_url",
    "publisher_platforms",
    "ad_delivery_start_time",
  ].join(","),
  limit: "10",
});

const adsRes = await fetch(`${META_BASE}/ads_archive?${adsParams}`);
const adsData = await adsRes.json();

if (adsData.error) {
  console.error("Ads fetch error:", adsData.error);
  process.exit(1);
}

console.log(`\nTotal ads returned: ${adsData.data?.length ?? 0}`);
console.log("\nFirst 5 ads (raw):");
for (const ad of (adsData.data ?? []).slice(0, 5)) {
  console.log("\n---");
  console.log("ID:", ad.id);
  console.log("page_id:", ad.page_id);
  console.log("page_name:", ad.page_name);
  console.log("byline:", ad.byline ?? "(empty)");
  console.log("bodies:", ad.ad_creative_bodies?.slice(0, 1)?.map(b => b?.slice(0, 100)));
  console.log("link_titles:", ad.ad_creative_link_titles?.slice(0, 1));
  console.log("snapshot:", ad.ad_snapshot_url);
}
