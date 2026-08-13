function analyzePrices(prices, costPrice) {
  if (!prices || prices.length === 0) return null;

  const sorted = [...prices].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;

  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const suggested = Math.round(median * 0.6 + avg * 0.4);

  const EBAY_FEE_RATE = 0.13;
  const ESTIMATED_SHIPPING = 6;

  let estimatedMargin = null;
  let opportunity = 'sin_costo';

  if (costPrice != null && !Number.isNaN(costPrice)) {
    estimatedMargin = +(
      suggested -
      costPrice -
      suggested * EBAY_FEE_RATE -
      ESTIMATED_SHIPPING
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
    opportunity
  };
}

module.exports = { analyzePrices };
