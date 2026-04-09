/**
 * Servidor HTTP local para servir os assets do SDK @identy/identy-face
 *
 * O SDK Identy é um pacote web-only (jQuery, canvas, WASM) que precisa ser
 * carregado dentro de uma WebView via <script> tag. Como é um pacote privado
 * (JFrog), não pode ser servido de CDNs públicos.
 *
 * Este servidor serve os arquivos do dist/ do SDK para que a WebView possa
 * carregá-los via http://localhost:PORT/identy-face.js
 *
 * Uso:
 *   node scripts/sdk-server.js [port]
 *
 * Default port: 9876
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2] || process.env.SDK_SERVER_PORT || '9876', 10);
const SDK_DIR = path.resolve(__dirname, '..', 'node_modules', '@identy', 'identy-face', 'dist');

const MIME_TYPES = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.html': 'text/html',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  // CORS headers — WebView in RN needs cross-origin access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health' || req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', sdk: '@identy/identy-face', port: PORT }));
    return;
  }

  // Resolve file path — strip query string
  const urlPath = (req.url || '/').split('?')[0];
  let filePath = path.join(SDK_DIR, urlPath === '/' ? 'identy-face.js' : urlPath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(SDK_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Try with /assets/ prefix for WASM files and workers
      const altPath = path.join(SDK_DIR, 'assets', urlPath);
      if (fs.existsSync(altPath) && fs.statSync(altPath).isFile()) {
        filePath = altPath;
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Not found: ${urlPath}`);
        return;
      }
    }

    const mimeType = getMimeType(filePath);
    const stream = fs.createReadStream(filePath);

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=3600',
    });

    stream.pipe(res);
    stream.on('error', () => {
      res.writeHead(500);
      res.end('Internal error');
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SDK Server] Serving @identy/identy-face dist from: ${SDK_DIR}`);
  console.log(`[SDK Server] Listening on http://0.0.0.0:${PORT}`);
  console.log(`[SDK Server] Health check: http://localhost:${PORT}/health`);
  console.log(`[SDK Server] SDK JS: http://localhost:${PORT}/identy-face.js`);
  console.log(`[SDK Server] SDK CSS: http://localhost:${PORT}/identy-face-style.css`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[SDK Server] Port ${PORT} in use, trying ${PORT + 1}...`);
    server.listen(PORT + 1, '0.0.0.0');
  } else {
    console.error('[SDK Server] Error:', err);
  }
});
