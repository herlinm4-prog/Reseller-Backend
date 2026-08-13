require('dotenv').config();
const express = require('express');
const cors = require('cors');
const scanRoute = require('./routes/scan');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true, service: 'resellers-backend' }));
app.use('/api/scan', scanRoute);

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Resellers backend escuchando en puerto ${PORT}`);
});
