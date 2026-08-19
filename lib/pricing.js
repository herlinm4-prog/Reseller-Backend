// Listings for "2 Pack", "Lot of 3", "Set of 4", etc. cost more in total for
// an obvious reason — they're several units, not a pricier single unit. Left
// alone, those totals drag the whole price range up and make a single item
// look like a much better (or worse) deal than it really is. We detect the
// quantity from the title and normalize back down to a per-unit price so
// comps stay apples-to-apples with the single item the user scanned.
function detectPackQuantity(title) {
  if (!title) return 1;
  const patterns = [
    /\blot\s*of\s*(\d{1,3})\b/i,
    /\bset\s*of\s*(\d{1,3})\b/i,
    /\bbundle\s*of\s*(\d{1,3})\b/i,
    /\bpack\s*of\s*(\d{1,3})\b/i,
    /\b(\d{1,3})\s*[- ]?pack\b/i,
    /\b(\d{1,3})\s*pk\b/i,
    /\b(\d{1,3})\s*(?:ct|count)\b/i,
    /\b(\d{1,3})\s*(?:pcs|pieces|bottles|jars|units|cans)\b/i,
    /\bqty\s*[:\-]?\s*(\d{1,3})\b/i
  ];
  for (const re of patterns) {
    const match = title.match(re);
    if (match) {
      const qty = parseInt(match[1], 10);
      // Guard against false positives (model numbers, sizes, etc.) — a
      // "pack" of more than ~24 is almost never a literal per-unit multiple.
      if (qty >= 2 && qty <= 24) return qty;
    }
  }
  return 1;
}

const EBAY_FEE_RATE = 0.13;
const FALLBACK_SHIPPING = 6;

// Se separó del cálculo principal para que el margen se pueda aplicar sobre
// un análisis ya cacheado. El precio de eBay se puede reutilizar 30 minutos;
// el costo que escribe el usuario cambia en cada producto y no se cachea.
function applyCost(analysis, costPrice) {
  if (costPrice == null || Number.isNaN(costPrice)) {
    return { estimatedMargin: null, opportunity: 'sin_costo' };
  }

  const shippingUsed =
    analysis.avgShipping != null ? analysis.avgShipping : FALLBACK_SHIPPING;

  // `suggested` ya es un precio total puesto en la puerta del comprador, así
  // que si publicas con envío gratis (lo competitivo), la comisión de ~13% de
  // eBay aplica sobre ese monto completo — que es justo lo que refleja esto.
  const estimatedMargin = +(
    analysis.suggested -
    costPrice -
    analysis.suggested * EBAY_FEE_RATE -
    shippingUsed
  ).toFixed(2);

  const sellerCount = analysis.referenceCount;
  let opportunity;
  if (estimatedMargin <= 0) opportunity = 'no_recomendado';
  else if (estimatedMargin > 15 && sellerCount <= 10) opportunity = 'especial';
  else if (estimatedMargin > 5) opportunity = 'buena';
  else opportunity = 'normal';

  return { estimatedMargin, opportunity };
}

function analyzePrices(items, costPrice) {
  if (!items || items.length === 0) return null;

  // Auctions can end far below (or above) what a Buy-It-Now buyer would
  // actually pay, so they're noisy as price comps. Prefer fixed-price /
  // Best-Offer listings when we have enough of them; fall back to the full
  // set (including auctions) if the sample would otherwise be too small.
  const fixedPriceItems = items.filter(
    (i) => Array.isArray(i.buyingOptions) && i.buyingOptions.includes('FIXED_PRICE')
  );
  const usingFixedPriceOnly = fixedPriceItems.length >= 3;
  const usedItems = usingFixedPriceOnly ? fixedPriceItems : items;

  // What a buyer actually pays is price + shipping, not just the listed
  // item price — a $10 item with $8 shipping is a worse deal than a $15
  // item with free shipping, even though the item price alone looks lower.
  // We add each comp's own shipping when eBay gave us one; if a listing
  // has no shipping data, we treat it as $0 (most commonly a free-shipping
  // listing rather than a data gap). Then divide by the detected pack
  // quantity so multi-packs don't skew the single-unit price range.
  let multiPackCount = 0;
  const landedPrices = usedItems.map((i) => {
    const total = i.price + (i.shipping != null ? i.shipping : 0);
    const qty = detectPackQuantity(i.title);
    if (qty > 1) multiPackCount++;
    return total / qty;
  });
  const sorted = [...landedPrices].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = landedPrices.reduce((sum, p) => sum + p, 0) / landedPrices.length;

  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const suggested = Math.round(median * 0.6 + avg * 0.4);

  // Real shipping cost from comparable listings beats a flat guess — this is
  // what buyers are actually seeing charged for this kind of item right now.
  // Used later to estimate YOUR shipping expense, separate from the landed
  // price above (which is about what the item sells for in total).
  const shippingSamples = usedItems
    .map((i) => i.shipping)
    .filter((s) => s != null && !Number.isNaN(s));
  const avgShipping = shippingSamples.length
    ? +(shippingSamples.reduce((sum, s) => sum + s, 0) / shippingSamples.length).toFixed(2)
    : null;

  const base = {
    min: +min.toFixed(2),
    avg: +avg.toFixed(2),
    max: +max.toFixed(2),
    median: +median.toFixed(2),
    suggested,
    priceBasis: 'landed_price_per_unit',
    referenceCount: landedPrices.length,
    multiPackCount,
    avgShipping,
    shippingSource: avgShipping != null ? 'real_comps' : 'fallback_estimate',
    listingMix: usingFixedPriceOnly ? 'fixed_price_only' : 'mixed_incl_auctions'
  };

  return { ...base, ...applyCost(base, costPrice) };
}

module.exports = { analyzePrices, applyCost, detectPackQuantity };
