const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../../dist/chrome');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpeg': 'image/jpeg' };
http.createServer(async (req, res) => {
  try {
    const name = new URL(req.url, 'http://localhost').pathname;
    const file = name === '/promo.html' ? path.join(__dirname, 'layout.html') : name === '/browser.js' ? path.join(__dirname, 'browser.js') : path.resolve(root, '.' + name);
    if (!['/promo.html', '/browser.js'].includes(name) && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(54093, '127.0.0.1', () => console.log('Promo: http://127.0.0.1:54093/promo.html?asset=feat1'));
