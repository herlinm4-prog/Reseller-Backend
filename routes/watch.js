const express = require('express');
const router = express.Router();

const { runLookup } = require('../lib/lookup');
const { applyCost } = require('../lib/pricing');

const MAX_ITEMS = 20;

// Vigilancia de precios de la pestaña "Guardados".
//
// El frontend solía consultar producto por producto. Con Render Free eso son
// varios arranques en frío encadenados y el usuario se queda mirando una
// barra que no avanza. Aquí llega una sola petición con toda la lista.
//
// Los productos se procesan en secuencia a propósito, no en paralelo: eBay
// corta las ráfagas, y como casi todos van a salir de la caché la diferencia
// de tiempo real es mínima.
router.post('/', async (req, res) => {
  try {
    const { items } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Falta el arreglo "items".' });
    }
    if (items.length > MAX_ITEMS) {
      return res
        .status(400)
        .json({ error: `Máximo ${MAX_ITEMS} productos por consulta.` });
    }

    const results = [];

    for (const item of items) {
      const { id, barcode, query: manualQuery, costPrice } = item || {};

      if (!barcode && !manualQuery) {
        results.push({ id, ok: false, error: 'Sin código ni búsqueda.' });
        continue;
      }

      try {
        const result = await runLookup({ barcode, query: manualQuery });

        if (!result.found) {
          results.push({ id, ok: true, found: false, query: result.query });
          continue;
        }

        const cost = costPrice != null ? Number(costPrice) : null;
        results.push({
          id,
          ok: true,
          found: true,
          query: result.query,
          suggested: result.suggested,
          median: result.median,
          min: result.min,
          max: result.max,
          referenceCount: result.referenceCount,
          avgShipping: result.avgShipping,
          dataSource: result.dataSource,
          cached: result.cached,
          ...applyCost(result, cost)
        });
      } catch (err) {
        // Un producto que falla no debe tumbar la revisión de los otros
        // siete: se marca y se sigue.
        results.push({ id, ok: false, error: err.message });
      }
    }

    return res.json({ count: results.length, results });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: 'Error revisando precios.', detail: err.message });
  }
});

module.exports = router;
