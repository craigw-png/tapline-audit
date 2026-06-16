/**
 * Exchange a short-lived user token for a long-lived (60-day) token.
 * Usage: node scripts/exchange-token.mjs <short_lived_token>
 */
const shortToken = process.argv[2];
if (!shortToken) { console.error("Usage: node exchange-token.mjs <short_lived_token>"); process.exit(1); }

const APP_ID = "311807625501953";
const APP_SECRET = "f3e366e277c2e6ab4c8feee777b10e68";

const url = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
url.searchParams.set("grant_type", "fb_exchange_token");
url.searchParams.set("client_id", APP_ID);
url.searchParams.set("client_secret", APP_SECRET);
url.searchParams.set("fb_exchange_token", shortToken);

const res = await fetch(url.toString());
const data = await res.json();

if (data.error) {
  console.error("Error:", JSON.stringify(data.error, null, 2));
  process.exit(1);
}

console.log("Long-lived token:", data.access_token);
console.log("Token type:", data.token_type);
console.log("Expires in (seconds):", data.expires_in);
console.log("Expires in (days):", Math.round(data.expires_in / 86400));

// Verify the new token
const debugUrl = new URL("https://graph.facebook.com/v21.0/debug_token");
debugUrl.searchParams.set("input_token", data.access_token);
debugUrl.searchParams.set("access_token", `${APP_ID}|${APP_SECRET}`);
const debugRes = await fetch(debugUrl.toString());
const debugData = await debugRes.json();
if (debugData.data) {
  const exp = debugData.data.expires_at ? new Date(debugData.data.expires_at * 1000).toISOString() : "never";
  console.log("\nToken debug:");
  console.log("  Valid:", debugData.data.is_valid);
  console.log("  Expires:", exp);
  console.log("  Scopes:", debugData.data.scopes?.join(", "));
}
