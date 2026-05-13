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

async function getAllProducts() {
  const now = Date.now();
  if (cache && (now - cacheTime) < CACHE_TTL) {
    return cache;
  }

  const products = [];
  let cursor = null;
  let page = 1;

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
    const batch = data.products || [];
    products.push(...batch.map(p => ({
      id: p.id,
      name: p.name,
      price: p.priceData?.formatted?.price || '',
      image: p.media?.mainMedia?.image?.url || null,
      url: p.slug ? `https://www.${process.env.WIX_SITE_DOMAIN}/product-page/${p.slug}` : null,
    })));

    // Log the full pagination metadata on first page so we can see the structure
    if (page === 1) {
      console.log('Page 1 metadata:', JSON.stringify(data.metadata));
      console.log('Page 1 top-level keys:', Object.keys(data));
    }

    console.log(`Page ${page}: fetched ${batch.length}, total so far: ${products.length}`);

    // Try every known cursor location
    const nextCursor =
      data.metadata?.cursors?.next ||
      data.metadata?.cursor?.next ||
      data.pagingMetadata?.cursors?.next ||
      data.pagingMetadata?.cursor ||
      data.nextCursor ||
      null;

    if (!nextCursor || batch.length < 100) {
      console.log('Stopping pagination. nextCursor:', nextCursor, '| batch.length:', batch.length);
      break;
    }

    cursor = nextCursor;
    page++;
  }

  console.log('Fetched full catalog:', products.length, 'products');
  cache = products;
  cacheTime = now;
  return products;
}
