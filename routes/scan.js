const express = require('express');
const router = express.Router();

const { runLookup } = require('../lib/lookup');
const { applyCost } = require('../lib/pricing');

router.post('/', async (req, res) => {
  try {
    const { barcode, query: manualQuery, costPrice } = req.body || {};
    if (!barcode && !manualQuery) {
      return res.status(400).json({ error: 'Falta "barcode" o "query" en el cuerpo de la petición.' });
    }

    const result = await runLookup({ barcode, query: manualQuery });

    if (!result.found) {
      return res.json({
        product: result.product,
        query: result.query,
        found: false,
        message: 'No se encontraron referencias de precio en eBay para este producto.'
      });
    }

    // El costo no se cachea nunca: cambia en cada producto y es lo único que
    // escribe el usuario. El precio de eBay sí puede venir de la caché.
    const cost = costPrice != null ? Number(costPrice) : null;
    return res.json({ ...result, ...applyCost(result, cost) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error consultando precios.', detail: err.message });
  }
});

module.exports = router;
