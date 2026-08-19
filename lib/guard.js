// Dos protecciones para el backend público.
//
// 1. CORS con lista blanca. Antes estaba abierto a cualquier origen, así que
//    cualquiera podía apuntar su propia app a tu backend y quemarte la cuota
//    de eBay (5.000 llamadas/día) sin que tú te enteraras.
// 2. Límite por IP. Un script suelto puede hacer cientos de peticiones por
//    minuto; esto lo corta antes de que llegue a eBay.

const DEFAULT_ORIGINS = [
  'https://herlinm4-prog.github.io',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5500'
];

function allowedOrigins() {
  // ALLOWED_ORIGINS en Render permite añadir tu dominio propio el día que lo
  // compres, sin tocar el código. Separa con comas.
  const fromEnv = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_ORIGINS;
}

function buildCorsOptions() {
  const list = allowedOrigins();
  return {
    origin(origin, callback) {
      // Sin cabecera Origin son peticiones que no vienen de un navegador:
      // curl, Postman, el propio health check de Render. Se dejan pasar.
      if (!origin) return callback(null, true);
      if (list.includes(origin)) return callback(null, true);
      return callback(new Error(`Origen no permitido: ${origin}`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    maxAge: 86400
  };
}

// --- Límite por IP ----------------------------------------------------------

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 40;
const buckets = new Map();

function rateLimit(req, res, next) {
  const now = Date.now();
  const ip = req.ip || 'desconocida';

  let bucket = buckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(ip, bucket);
  }

  bucket.count++;

  // Limpieza barata: sin esto el Map crece con cada IP que haya pasado alguna
  // vez por el servidor y nunca se vacía.
  if (buckets.size > 5000) {
    for (const [key, value] of buckets) {
      if (now > value.resetAt) buckets.delete(key);
    }
  }

  if (bucket.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Demasiadas consultas seguidas. Espera un momento.',
      retryAfter
    });
  }

  return next();
}

module.exports = { buildCorsOptions, rateLimit, allowedOrigins };
