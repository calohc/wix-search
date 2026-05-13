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
    const response = await fetch('https://www.wixapis.com/stores/v1/products/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.WIX_API_KEY,
        'wix-site-id': process.env.WIX_SITE_ID,
      },
      body: JSON.stringify({
        query: {
          filter: JSON.stringify({ name: { $contains: q } }),
          paging: { limit: 10 }
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Wix API error:', err);
      return res.status(500).json({ error: 'Failed to fetch products' });
    }

    const data = await response.json();
    const products = (data.products || []).map(p => ({
      id: p.id,
      name: p.name,
      price: p.price?.formatted?.price || '',
      image: p.media?.mainMedia?.image?.url || null,
      url: p.slug ? `https://www.${process.env.WIX_SITE_DOMAIN}/product-page/${p.slug}` : null,
    }));

    return res.status(200).json({ products });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
