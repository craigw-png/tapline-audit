/**
 * Direct Meta API test — run with:
 *   node scripts/test-meta-api.mjs
 * from the project root (where .env is loaded by the dev server).
 * We read the token from process.env.META_ACCESS_TOKEN.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Manually parse .env since we can't use dotenv in a plain .mjs script
try {
  const envPath = resolve(process.cwd(), ".env");
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* .env may not exist in production */ }

const TOKEN = process.env.META_ACCESS_TOKEN;
if (!TOKEN) { console.error("META_ACCESS_TOKEN not set"); process.exit(1); }

const BASE = "https://graph.facebook.com/v21.0";

async function run() {
  // ── Test 1: /pages/search ──────────────────────────────────────────────────
  console.log("\n=== TEST 1: /pages/search?q=Emma+Sleep ===");
  const p1 = new URLSearchParams({ access_token: TOKEN, q: "Emma Sleep", fields: "id,name", limit: "20" });
  const r1 = await fetch(`${BASE}/pages/search?${p1}`);
  console.log("HTTP status:", r1.status);
  const d1 = await r1.json();
  console.log(JSON.stringify(d1, null, 2));

  // ── Test 2: /pages/search for just "Emma" ─────────────────────────────────
  console.log("\n=== TEST 2: /pages/search?q=Emma ===");
  const p2 = new URLSearchParams({ access_token: TOKEN, q: "Emma", fields: "id,name", limit: "10" });
  const r2 = await fetch(`${BASE}/pages/search?${p2}`);
  console.log("HTTP status:", r2.status);
  const d2 = await r2.json();
  console.log(JSON.stringify(d2, null, 2));

  // ── Test 3: ads_archive with search_terms=Emma, country=NL ────────────────
  console.log("\n=== TEST 3: ads_archive search_terms=Emma, NL, last 90 days ===");
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const p3 = new URLSearchParams({
    access_token: TOKEN,
    search_terms: "Emma",
    ad_reached_countries: '["NL"]',
    ad_type: "ALL",
    ad_active_status: "ALL",
    ad_delivery_date_min: start,
    ad_delivery_date_max: today,
    fields: "page_id,page_name",
    limit: "10",
  });
  const r3 = await fetch(`${BASE}/ads_archive?${p3}`);
  console.log("HTTP status:", r3.status);
  const d3 = await r3.json();
  // Print unique pages found
  const pages = {};
  for (const ad of d3.data ?? []) {
    if (ad.page_id) pages[ad.page_id] = ad.page_name;
  }
  console.log("Unique pages found:", pages);
  if (d3.error) console.log("Error:", JSON.stringify(d3.error, null, 2));

  // ── Test 4: ads_archive with search_terms=Emma Sleep ─────────────────────
  console.log("\n=== TEST 4: ads_archive search_terms='Emma Sleep', NL, last 90 days ===");
  const p4 = new URLSearchParams({
    access_token: TOKEN,
    search_terms: "Emma Sleep",
    ad_reached_countries: '["NL"]',
    ad_type: "ALL",
    ad_active_status: "ALL",
    ad_delivery_date_min: start,
    ad_delivery_date_max: today,
    fields: "page_id,page_name",
    limit: "10",
  });
  const r4 = await fetch(`${BASE}/ads_archive?${p4}`);
  console.log("HTTP status:", r4.status);
  const d4 = await r4.json();
  const pages4 = {};
  for (const ad of d4.data ?? []) {
    if (ad.page_id) pages4[ad.page_id] = ad.page_name;
  }
  console.log("Unique pages found:", pages4);
  if (d4.error) console.log("Error:", JSON.stringify(d4.error, null, 2));
}

run().catch(console.error);
