const fetch = require('node-fetch');

let cachedToken = null;
let tokenExpiry = 0;

async function getAppToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
    throw new Error('Faltan EBAY_CLIENT_ID / EBAY_CLIENT_SECRET en las variables de entorno');
  }

  const credentials = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`eBay OAuth falló (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function searchActiveListings(query, limit = 30) {
  const token = await getAppToken();
  const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(
    query
  )}&limit=${limit}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`eBay Browse API falló (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.itemSummaries) return [];

  // Pull everything Browse API actually gives us per listing, not just
  // price: buyingOptions (to tell auctions from Buy-It-Now), shipping cost
  // (to replace guessed shipping with a real market estimate) and condition.
  return data.itemSummaries
    .map((item) => {
      const price = parseFloat(item.price && item.price.value);
      if (Number.isNaN(price)) return null;

      const shippingOption = item.shippingOptions && item.shippingOptions[0];
      const shippingValue = shippingOption && shippingOption.shippingCost && shippingOption.shippingCost.value;
      const shipping = shippingValue != null ? parseFloat(shippingValue) : null;

      return {
        price,
        shipping: Number.isNaN(shipping) ? null : shipping,
        buyingOptions: item.buyingOptions || [],
        condition: item.condition || null
      };
    })
    .filter(Boolean);
}

module.exports = { searchActiveListings };
