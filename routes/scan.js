const express = require('express');
const router = express.Router();

const { lookupProduct } = require('../services/upcLookup');
const { searchActiveListings } = require('../services/ebayBrowse');
const { getSoldPrices } = require('../services/soldDataProvider');
const { analyzePrices } = require('../lib/pricing');

router.post('/', async (req, res) => {
  try {
    const { barcode, costPrice } = req.body || {};
    if (!barcode) {
      return res.status(400).json({ error: 'Falta "barcode" en el cuerpo de la petición.' });
    }

    const product = await lookupProduct(barcode);
    const query = product && product.title ? `${product.brand || ''} ${product.title}`.trim() : barcode;

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
