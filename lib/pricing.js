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

  const prices = usedItems.map((i) => i.price);
  const sorted = [...prices].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;

  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const suggested = Math.round(median * 0.6 + avg * 0.4);

  // Real shipping cost from comparable listings beats a flat guess — this is
  // what buyers are actually seeing charged for this kind of item right now.
  const shippingSamples = usedItems
    .map((i) => i.shipping)
    .filter((s) => s != null && !Number.isNaN(s));
  const avgShipping = shippingSamples.length
    ? +(shippingSamples.reduce((sum, s) => sum + s, 0) / shippingSamples.length).toFixed(2)
    : null;

  const EBAY_FEE_RATE = 0.13;
  const FALLBACK_SHIPPING = 6;
  const shippingUsed = avgShipping != null ? avgShipping : FALLBACK_SHIPPING;

  let estimatedMargin = null;
  let opportunity = 'sin_costo';

  if (costPrice != null && !Number.isNaN(costPrice)) {
    estimatedMargin = +(
      suggested -
      costPrice -
      suggested * EBAY_FEE_RATE -
      shippingUsed
    ).toFixed(2);

    const sellerCount = prices.length;
    if (estimatedMargin <= 0) opportunity = 'no_recomendado';
    else if (estimatedMargin > 15 && sellerCount <= 10) opportunity = 'especial';
    else if (estimatedMargin > 5) opportunity = 'buena';
    else opportunity = 'normal';
  }

  return {
    min: +min.toFixed(2),
    avg: +avg.toFixed(2),
    max: +max.toFixed(2),
    median: +median.toFixed(2),
    suggested,
    referenceCount: prices.length,
    estimatedMargin,
    opportunity,
    avgShipping,
    shippingSource: avgShipping != null ? 'real_comps' : 'fallback_estimate',
    listingMix: usingFixedPriceOnly ? 'fixed_price_only' : 'mixed_incl_auctions'
  };
}

module.exports = { analyzePrices };
