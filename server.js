require('dotenv').config();
const express = require('express');
const cors = require('cors');

const scanRoute = require('./routes/scan');
const watchRoute = require('./routes/watch');
const cache = require('./lib/cache');
const { buildCorsOptions, rateLimit } = require('./lib/guard');

const app = express();

// Render corre detrás de un proxy: sin esto, req.ip sería la del proxy y el
// límite por IP contaría a todos los usuarios como si fueran uno solo.
app.set('trust proxy', 1);

app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: '256kb' }));

app.get('/health', (req, res) =>
  res.json({ ok: true, service: 'resellers-backend', cache: cache.stats() })
);

app.use('/api/scan', rateLimit, scanRoute);
app.use('/api/watch', rateLimit, watchRoute);

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// Un origen bloqueado por CORS llega aquí como error. Sin este manejador
// Express respondería un HTML de error 500 y el frontend vería algo confuso.
app.use((err, req, res, next) => {
  if (err && /Origen no permitido/.test(err.message)) {
    return res.status(403).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'Error interno.', detail: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Resellers backend escuchando en puerto ${PORT}`);
});
