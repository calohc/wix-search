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

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function fetchPage(cursor) {
  const body = { cursorPaging: { limit: 100 } };
  if (cursor) body.cursorPaging.cursor = cursor;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch('https://www.wixapis.com/stores/v3/products/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.WIX_API_KEY,
        'wix-site-id': process.env.WIX_SITE_ID,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.text();
      console.error('Wix API error:', err);
      return null;
    }

    return await response.json();
  } catch (err) {
    clearTimeout(timeout);
    console.error('Fetch error:', err.message);
    return null;
  }
}

async function getAllProducts() {
  const now = Date.now();
  if (cache && (now - cacheTime) < CACHE_TTL) {
    console.log('Cache hit:', cache.length, 'products');
    return cache;
  }

  const products = [];
  let cursor = null;
  const MAX_PAGES = 20; // Safety cap — handles up to 2000 products

  for (let page = 1; page <= MAX_PAGES; page++) {
    console.log(`Fetching page ${page}, cursor: ${cursor ? cursor.substring(0, 20) + '...' : 'none'}`);

    const data = await fetchPage(cursor);

    if (!data) {
      console.log('Null response, stopping at page', page);
      break;
    }

    // Log full response structure on first page
    if (page === 1) {
      const { products: _p, ...rest } = data;
      console.log('Response structure (no products):', JSON.stringify(rest));
    }

    const batch = data.products || [];
    products.push(...batch.map(p => ({
      id: p.id,
      name: p.name,
      price: p.priceData?.formatted?.price || '',
      image: p.media?.mainMedia?.image?.url || null,
      url: p.slug ? `https://www.${process.env.WIX_SITE_DOMAIN}/product-page/${p.slug}` : null,
    })));

    console.log(`Page ${page}: got ${batch.length} products, total: ${products.length}`);

    if (batch.length < 100) {
      console.log('Last page reached');
      break;
    }

    // Try every known cursor location in Wix API responses
    const nextCursor =
      data.metadata?.cursors?.next ||
      data.metadata?.cursor?.next ||
      data.pagingMetadata?.cursors?.next ||
      data.pagingMetadata?.cursor ||
      data.nextCursor ||
      null;

    console.log('Next cursor found:', nextCursor ? nextCursor.substring(0, 30) + '...' : 'none');

    if (!nextCursor) {
      console.log('No next cursor, stopping');
      break;
    }

    cursor = nextCursor;
  }

  console.log('Full catalog fetched:', products.length, 'products');
  cache = products;
  cacheTime = now;
  return products;
}
