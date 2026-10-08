'use strict';

require('dotenv').config({ quiet: true });

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');

const app = express();

// ---------- Configuración (desde variables de entorno) ----------
const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---------- Middlewares de seguridad y rendimiento ----------
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        // En desarrollo (http://localhost) no forzamos https
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
  })
);
app.use(compression());
app.use(express.json({ limit: '10kb' })); // límite para evitar cuerpos enormes

// ---------- Archivos estáticos ----------
app.use(
  express.static(PUBLIC_DIR, {
    maxAge: isProd ? '7d' : 0, // caché solo en producción
    etag: true,
  })
);

// ---------- Rutas ----------
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Aquí irán tus rutas de API, por ejemplo:
// app.use('/api/products', require('./routes/products'));

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado' });
});

// ---------- Manejo centralizado de errores ----------
// (Express 5 captura automáticamente errores de handlers async)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: isProd ? 'Error interno del servidor' : err.message,
  });
});

// ---------- Arranque y apagado ordenado ----------
const server = app.listen(PORT, () => {
  console.log(`Servidor (${NODE_ENV}) en http://localhost:${PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} recibido, cerrando servidor...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref(); // forzar si tarda demasiado
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));