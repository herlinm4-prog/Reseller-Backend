const express = require('express');
const router = express.Router();

const { lookupProduct } = require('../services/upcLookup');
const { searchActiveListings } = require('../services/ebayBrowse');
const { getSoldPrices } = require('../services/soldDataProvider');
const { analyzePrices } = require('../lib/pricing');

router.post('/', async (req, res) => {
  try {
    const { barcode, query: manualQuery, costPrice } = req.body || {};
    if (!barcode && !manualQuery) {
      return res.status(400).json({ error: 'Falta "barcode" o "query" en el cuerpo de la petición.' });
    }

    let product = null;
    let query;

    if (manualQuery && manualQuery.trim()) {
      // Manual text search (e.g. "Wrong product?" correction, or Ross/Burlington
      // items whose barcode doesn't resolve to anything useful on eBay).
      query = manualQuery.trim();
    } else {
      product = await lookupProduct(barcode);
      query = product && product.title ? `${product.brand || ''} ${product.title}`.trim() : barcode;
    }

    const soldPrices = await getSoldPrices(query);
    const usingSoldData = Array.isArray(soldPrices) && soldPrices.length > 0;

    const prices = usingSoldData ? soldPrices : await searchActiveListings(query);
    const analysis = analyzePrices(prices, costPrice != null ? Number(costPrice) : null);

    if (!analysis) {
      return res.json({
        product,
        query,
        found: false,
        message: 'No se encontraron referencias de precio en eBay para este producto.'
      });
    }

    return res.json({
      product,
      query,
      found: true,
      dataSource: usingSoldData ? 'sold_confirmed' : 'active_reference',
      confidence: usingSoldData ? 'alta' : 'media',
      ...analysis
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error consultando precios.', detail: err.message });
  }
});

module.exports = router;
