// Caché en memoria con expiración.
//
// Sin esto, cada escaneo pega a eBay y a UPCitemdb. Dos personas escaneando
// el mismo producto en la misma tienda gastan dos llamadas de tu cuota diaria
// de eBay (5.000/día) para recibir exactamente la misma respuesta. Y la
// vigilancia de precios de "Guardados" dispara varias consultas seguidas.
//
// Vive en la memoria del proceso: si Render reinicia el servicio, la caché
// arranca vacía. Eso está bien — es un acelerador, no una base de datos.

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutos
const MAX_ENTRIES = 2000;

const store = new Map();
let hits = 0;
let misses = 0;

function get(key) {
  const entry = store.get(key);
  if (!entry) {
    misses++;
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    misses++;
    return null;
  }
  hits++;
  // Se reinserta para que el orden del Map refleje uso reciente: así el
  // recorte de abajo descarta primero lo que nadie ha vuelto a pedir.
  store.delete(key);
  store.set(key, entry);
  return entry.value;
}

function set(key, value, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });

  // Techo duro de memoria: Render Free da 512 MB y el proceso no puede
  // crecer sin límite solo porque la gente escanea mucho.
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }
}

function stats() {
  const total = hits + misses;
  return {
    entries: store.size,
    hits,
    misses,
    hitRate: total ? +((hits / total) * 100).toFixed(1) : 0
  };
}

function clear() {
  store.clear();
  hits = 0;
  misses = 0;
}

module.exports = { get, set, stats, clear, DEFAULT_TTL_MS };
