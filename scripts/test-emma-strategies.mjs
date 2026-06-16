const TOKEN = process.env.META_ACCESS_TOKEN;

const today = new Date(); today.setDate(today.getDate() - 1);
const fmt = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');

async function searchAds(searchTerms, days, countryCode = 'NL') {
  const start = new Date(today); start.setDate(start.getDate() - days);
  const params = new URLSearchParams({
    access_token: TOKEN,
    search_terms: searchTerms,
    ad_reached_countries: JSON.stringify([countryCode]),
    ad_type: 'ALL',
    ad_active_status: 'ALL',
    ad_delivery_date_min: fmt(start),
    ad_delivery_date_max: fmt(today),
    fields: 'page_id,page_name',
    limit: '50',
  });
  const res = await fetch('https://graph.facebook.com/v21.0/ads_archive?' + params);
  const data = await res.json();
  if (data.error) return { error: data.error.message };
  const pages = new Map();
  for (const ad of data.data ?? []) {
    if (!ad.page_id || !ad.page_name) continue;
    const e = pages.get(ad.page_id);
    if (!e) pages.set(ad.page_id, { id: ad.page_id, name: ad.page_name, count: 1 });
    else e.count++;
  }
  return [...pages.values()].sort((a,b) => b.count - a.count);
}

console.log('=== Strategy 1: "Emma Sleep" 90 days ===');
console.log(JSON.stringify(await searchAds('Emma Sleep', 90), null, 2));

console.log('\n=== Strategy 2: "Emma Sleep" 365 days ===');
const r2 = await searchAds('Emma Sleep', 365);
console.log(JSON.stringify(r2.slice(0,5), null, 2));

console.log('\n=== Strategy 3: "emmasleep" (no space) 90 days ===');
console.log(JSON.stringify(await searchAds('emmasleep', 90), null, 2));

console.log('\n=== Strategy 4: "Emma matras" 90 days ===');
console.log(JSON.stringify(await searchAds('Emma matras', 90), null, 2));
