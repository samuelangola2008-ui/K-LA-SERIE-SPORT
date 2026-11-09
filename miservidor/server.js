
'use strict';


require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');

const app = express();

// ---------- Configuración ----------
const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';


const ROOT_DIR = path.resolve(__dirname, '..');
const INDEX_FILE = path.join(ROOT_DIR, 'index.html');


app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Solo scripts propios. Si tu index.html tiene <script> en línea,
        // pásalo a un archivo .js (recomendado) o agrega aquí "'unsafe-inline'".
        scriptSrc: ["'self'"],
        // Si usas onclick="..." en el HTML, descomenta la siguiente línea:
        // scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        // En localhost (http) no se fuerza https
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
  })
);
app.use(compression());
app.use(express.json({ limit: '10kb' }));


app.use(['/miservidor', '/node_modules'], (req, res) => send404(req, res));


app.use(
  express.static(ROOT_DIR, {
    index: false,          // la ruta "/" la maneja app.get('/') más abajo
    dotfiles: 'ignore',    // nunca servir .env, .git, etc.
    maxAge: isProd ? '7d' : 0,
    etag: true,
  })
);

-
app.get('/', (req, res) => {
  res.sendFile(INDEX_FILE);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

function sendErrorPage(res, status, fileName, fallbackText) {
  const file = path.join(ROOT_DIR, fileName);
  res.status(status);
  if (fs.existsSync(file)) return res.sendFile(file);
  return res.type('text').send(fallbackText);
}

function send404(req, res) {
  // Las rutas /api devuelven JSON; el resto, la página 404.html
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Recurso no encontrado' });
  }
  return sendErrorPage(res, 404, '404.html', '404 - Página no encontrada');
}


app.use(send404);


app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);

  if (req.path.startsWith('/api/')) {
    return res.status(err.status || 500).json({
      error: isProd ? 'Error interno del servidor' : err.message,
    });
  }
  return sendErrorPage(res, 500, '500.html', '500 - Error interno del servidor');
});

// ---------- 6) Arranque y apagado ordenado ----------
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
