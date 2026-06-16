// Mirrors the production searchMetaPages logic exactly
const TOKEN = process.env.META_ACCESS_TOKEN;
const query = process.argv[2] || 'SwissSense';
const countryCode = process.argv[3] || 'NL';
const limit = 5;

// Meta rejects today's date as ad_delivery_date_max (error 2334030) — use yesterday.
const today = new Date();
today.setDate(today.getDate() - 1);
const start = new Date(today);
start.setDate(start.getDate() - 90);
const fmt = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');

// Build search term variants: full phrase + no-space compound
const words = query.trim().split(/\s+/).filter(Boolean);
const searchTerms = [...new Set([query.trim(), words.length > 1 ? words.join('').toLowerCase() : null].filter(Boolean))];
console.log(`Search terms: ${JSON.stringify(searchTerms)}`);

const pageMap = new Map();

async function fetchAdsArchive(searchTerm) {
  const params = new URLSearchParams({
    access_token: TOKEN,
    search_terms: searchTerm,
    ad_reached_countries: JSON.stringify([countryCode]),
    ad_type: 'ALL',
    ad_active_status: 'ALL',
    ad_delivery_date_min: fmt(start),
    ad_delivery_date_max: fmt(today),
    fields: 'page_id,page_name,ad_creative_link_captions',
    limit: '50',
  });
  const res = await fetch('https://graph.facebook.com/v21.0/ads_archive?' + params);
  const data = await res.json();
  if (data.error) { console.error(`Error for "${searchTerm}":`, data.error.message); return; }
  let count = 0;
  for (const ad of data.data ?? []) {
    if (!ad.page_id || !ad.page_name) continue;
    count++;
    const existing = pageMap.get(ad.page_id);
    const rawCaption = ad.ad_creative_link_captions?.[0];
    const domain = rawCaption ? rawCaption.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase() : undefined;
    if (!existing) pageMap.set(ad.page_id, { id: ad.page_id, name: ad.page_name, domain, ad_count: 1 });
    else { existing.ad_count++; if (!existing.domain && domain) existing.domain = domain; }
  }
  console.log(`  "${searchTerm}" → ${count} ads, ${new Set(data.data?.map(a => a.page_id)).size} unique pages`);
}

await Promise.all(searchTerms.map(fetchAdsArchive));

// Score: +100 all words in name, +50 name starts with query, +1 per ad
const q = query.toLowerCase().trim();
const queryWords = q.split(/\s+/).filter(Boolean);
const score = p => {
  const n = p.name.toLowerCase();
  let s = p.ad_count ?? 0;
  if (n === q) s += 200;
  if (n.startsWith(q + ' ') || n.startsWith(q + '-')) s += 150;
  if (queryWords.every(w => n.includes(w))) s += 100;
  if (n.startsWith(q)) s += 50;
  return s;
};

const results = [...pageMap.values()].sort((a, b) => score(b) - score(a)).slice(0, limit);
console.log(`\nTotal unique pages: ${pageMap.size}`);
console.log('Top 5 candidates (with scores):');
results.forEach(p => console.log(`  [score ${score(p)}] ${p.name} (${p.id}) — ${p.ad_count} ads`));
