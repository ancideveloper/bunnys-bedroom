// Tiny no-cache static dev server: node serve.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || process.env.PORT || 8080);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};

http.createServer((req, res) => {
  // Dev-only helper used by the test suite: POST /__shot/<name>.png with a data URL body saves ./screenshots/<name>.png
  if (req.method === "POST" && req.url.startsWith("/__shot/")) {
    const name = path.basename(decodeURIComponent(req.url.slice(8))).replace(/[^A-Za-z0-9_.-]/g, "_");
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      fs.mkdirSync(path.join(root, "screenshots"), { recursive: true });
      fs.writeFileSync(path.join(root, "screenshots", name), Buffer.from(body.split(",")[1] || "", "base64"));
      res.writeHead(200).end("ok");
    });
    return;
  }
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(root, p));
  if (!file.startsWith(root)) { res.writeHead(403).end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Cache-Control': 'no-store' }).end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, max-age=0',
    });
    res.end(data);
  });
}).listen(port, () => console.log(`Bunny's Bedroom: http://localhost:${port}/`));
