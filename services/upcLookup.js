// Una sola tubería de consulta, usada tanto por /api/scan como por /api/watch.
//
// Antes esta lógica vivía dentro de la ruta scan. Al moverla aquí, la
// vigilancia de precios calcula exactamente igual que un escaneo normal —
// si no, un producto guardado podría mostrar un precio distinto al que
// mostró cuando lo escaneaste, y no por un cambio real del mercado sino
// porque los dos caminos calculaban diferente.

const { lookupProduct } = require('../services/upcLookup');
const { searchActiveListings } = require('../services/ebayBrowse');
const { getSoldPrices } = require('../services/soldDataProvider');
const { analyzePrices } = require('./pricing');
const cache = require('./cache');

// El costo lo aplica el frontend sobre el precio sugerido, así que la parte
// cacheable (producto + referencias de eBay) no depende de él.
// UPCitemdb casi siempre ya trae la marca dentro del título. Pegarla otra vez
// al frente producía búsquedas como "Sony Sony WH-1000XM4", que le da a eBay
// resultados peores que el título limpio.
function buildQuery(product, barcode) {
  if (!product || !product.title) return barcode;
  const title = String(product.title).trim();
  const brand = String(product.brand || '').trim();
  if (!brand) return title;
  if (title.toLowerCase().includes(brand.toLowerCase())) return title;
  return `${brand} ${title}`;
}

async function resolveQuery({ barcode, query: manualQuery }) {
  let product = null;
  let query;

  if (manualQuery && manualQuery.trim()) {
    query = manualQuery.trim();
  } else {
    const productKey = `upc:${barcode}`;
    product = cache.get(productKey);
    if (product === null) {
      product = await lookupProduct(barcode);
      // Se cachea incluso cuando no hay resultado: un código que UPCitemdb no
      // conoce no lo va a conocer en los próximos 30 minutos tampoco.
      cache.set(productKey, product === null ? false : product);
    } else if (product === false) {
      product = null;
    }
    query = buildQuery(product, barcode);
  }

  return { product, query };
}

async function analyzeQuery(query) {
  const key = `analysis:${query.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return { ...cached, cached: true };

  const soldPrices = await getSoldPrices(query);
  const usingSoldData = Array.isArray(soldPrices) && soldPrices.length > 0;

  const prices = usingSoldData ? soldPrices : await searchActiveListings(query);
  const analysis = analyzePrices(prices, null);

  const result = analysis
    ? {
        found: true,
        dataSource: usingSoldData ? 'sold_confirmed' : 'active_reference',
        confidence: usingSoldData ? 'alta' : 'media',
        ...analysis
      }
    : { found: false };

  cache.set(key, result);
  return { ...result, cached: false };
}

async function runLookup(payload) {
  const { product, query } = await resolveQuery(payload);
  const analysis = await analyzeQuery(query);
  return { product, query, ...analysis };
}

module.exports = { runLookup, resolveQuery, analyzeQuery };
