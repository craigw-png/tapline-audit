const TOKEN = process.env.META_ACCESS_TOKEN;
const query = process.argv[2] || 'SwissSense';
const countryCode = process.argv[3] || 'NL';

const today = new Date();
today.setDate(today.getDate() - 1); // yesterday — Meta rejects "today" as max
const start = new Date(today);
start.setDate(start.getDate() - 90);
const fmt = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');

const params = new URLSearchParams({
  access_token: TOKEN,
  search_terms: query,
  ad_reached_countries: JSON.stringify([countryCode]),
  ad_type: 'ALL',
  ad_active_status: 'ALL',
  ad_delivery_date_min: fmt(start),
  ad_delivery_date_max: fmt(today),
  fields: 'page_id,page_name',
  limit: '50',
});

console.log(`Searching ads_archive for "${query}" in ${countryCode}...`);
const res = await fetch('https://graph.facebook.com/v21.0/ads_archive?' + params);
const data = await res.json();

if (data.error) {
  console.error('API Error:', JSON.stringify(data.error));
  process.exit(1);
}

const pageMap = new Map();
for (const ad of data.data ?? []) {
  if (!ad.page_id || !ad.page_name) continue;
  const e = pageMap.get(ad.page_id);
  if (!e) pageMap.set(ad.page_id, { id: ad.page_id, name: ad.page_name, ad_count: 1 });
  else e.ad_count++;
}

const results = [...pageMap.values()]
  .sort((a, b) => (b.ad_count ?? 0) - (a.ad_count ?? 0))
  .slice(0, 5);

console.log(`\nTotal unique pages: ${pageMap.size}`);
console.log('Top 5 candidates:', JSON.stringify(results, null, 2));
