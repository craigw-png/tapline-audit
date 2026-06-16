const TOKEN = process.env.META_ACCESS_TOKEN;
const pageId = process.argv[2] || '249220112144810';
const countryCode = process.argv[3] || 'NL';

const today = new Date(); today.setDate(today.getDate() - 1);
const start = new Date(today); start.setDate(start.getDate() - 90);
const fmt = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');

const params = new URLSearchParams({
  access_token: TOKEN,
  search_page_ids: pageId,
  ad_reached_countries: JSON.stringify([countryCode]),
  ad_type: 'ALL',
  ad_active_status: 'ALL',
  ad_delivery_date_min: fmt(start),
  ad_delivery_date_max: fmt(today),
  fields: 'page_id,page_name,ad_creative_bodies',
  limit: '5',
});

const res = await fetch('https://graph.facebook.com/v21.0/ads_archive?' + params);
const data = await res.json();
if (data.error) { console.error('Error:', JSON.stringify(data.error)); process.exit(1); }
console.log(`Page ${pageId} in ${countryCode}: ${data.data?.length ?? 0} ads found`);
if (data.data?.length) {
  console.log('First ad page_name:', data.data[0].page_name);
  console.log('First ad body:', data.data[0].ad_creative_bodies?.[0]?.slice(0, 100));
}
