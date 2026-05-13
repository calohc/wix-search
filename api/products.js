export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { q } = req.query;

  if (!q || q.trim().length === 0) {
    return res.status(200).json({ products: [] });
  }

  try {
    const allProducts = await getAllProducts();
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);

    const filtered = allProducts.filter(p => {
      const name = (p.name || '').toLowerCase();
      return words.every(w => name.includes(w));
    }).slice(0, 5);

    console.log('Query:', q, '| Catalog size:', allProducts.length, '| Matches:', filtered.length);

    return res.status(200).json({ products: filtered });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// In-memory cache — persists for the lifetime of the serverless function instance
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getAllProducts() {
  const now = Date.now();
  if (cache && (now - cacheTime) < CACHE_TTL) {
    console.log('Using cached catalog:', cache.length, 'products');
    return cache;
  }

  const products = [];
  let cursor = null;

  while (true) {
    const body = { cursorPaging: { limit: 100 } };
    if (cursor) body.cursorPaging.cursor = cursor;

    const response = await fetch('https://www.wixapis.com/stores/v3/products/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.WIX_API_KEY,
        'wix-site-id': process.env.WIX_SITE_ID,
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Wix API error:', err);
      break;
    }

    const data = await response.json();
    const page = data.products || [];

    for (const p of page) {
      products.push({
        id: p.id,
        name: p.name,
        price: p.priceData?.formatted?.price || '',
        image: p.media?.mainMedia?.image?.url || null,
        url: p.slug ? `https://www.${process.env.WIX_SITE_DOMAIN}/product-page/${p.slug}` : null,
      });
    }

    const nextCursor = data.metadata?.cursors?.next;
    if (!nextCursor || page.length < 100) break;
    cursor = nextCursor;
  }

  console.log('Fetched full catalog:', products.length, 'products');
  cache = products;
  cacheTime = now;
  return products;
}
