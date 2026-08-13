const fetch = require('node-fetch');

async function lookupProduct(code) {
  const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;

  const data = await res.json();
  if (!data.items || data.items.length === 0) return null;

  const item = data.items[0];
  return {
    code,
    title: item.title || null,
    brand: item.brand || null,
    category: item.category || null,
    images: item.images || []
  };
}

module.exports = { lookupProduct };
