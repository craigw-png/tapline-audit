// Tests the fetchBrandAdSnapshot logic end-to-end
const TOKEN = process.env.META_ACCESS_TOKEN;
const pageId = process.argv[2] || '607197052710683'; // Swiss Sense NL
const countryCode = process.argv[3] || 'NL';
const days = parseInt(process.argv[4] || '30');

// Meta rejects today's date as ad_delivery_date_max (error 2334030) — use yesterday.
const today = new Date();
today.setDate(today.getDate() - 1);
const start = new Date(today);
start.setDate(start.getDate() - days);
const fmt = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');

console.log(`Fetching ads for page ${pageId} in ${countryCode} (last ${days} days, ${fmt(start)} to ${fmt(today)})...`);

const params = new URLSearchParams({
  access_token: TOKEN,
  search_page_ids: pageId,
  ad_active_status: 'ACTIVE',
  ad_type: 'ALL',
  ad_reached_countries: JSON.stringify([countryCode]),
  ad_delivery_date_min: fmt(start),
  ad_delivery_date_max: fmt(today),
  fields: 'id,page_id,page_name,ad_creative_bodies,byline,media_type',
  limit: '50',
});

const res = await fetch('https://graph.facebook.com/v21.0/ads_archive?' + params);
const data = await res.json();

if (data.error) {
  console.error('API Error:', JSON.stringify(data.error));
  process.exit(1);
}

const ads = data.data ?? [];
console.log(`\nTotal ads: ${ads.length}`);
const byline = ads.filter(a => a.byline?.trim());
const partnership = ads.filter(a => {
  const text = [...(a.ad_creative_bodies ?? [])].join(' ').toLowerCase();
  return /paid partnership|#ad\b|#sponsored|samenwerking/i.test(text);
});
console.log(`Byline (official Paid Partnership): ${byline.length}`);
console.log(`Keyword partnership signals: ${partnership.length}`);
if (byline.length) console.log('Sample byline:', byline[0].byline);
