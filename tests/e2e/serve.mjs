// A tiny web server for the end-to-end tests. It serves the exported site in out/ roughly the way
// an S3 website does: /folder/ gives folder/index.html, /folder redirects to /folder/, and an
// unknown address gives 404.html with a 404 status. It answers /config.json itself, so the tests
// do not depend on a file in your checkout.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../out');
const port = Number(process.env.PORT ?? 4173);
const config = JSON.stringify({ apiBaseUrl: 'https://e2e-api.example.test', environment: 'e2e' });

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

async function isFile(file) {
  return stat(file).then(
    (s) => s.isFile(),
    () => false,
  );
}
async function isDirectory(file) {
  return stat(file).then(
    (s) => s.isDirectory(),
    () => false,
  );
}

async function send(res, status, file) {
  const body = await readFile(file);
  res.writeHead(status, {
    'Content-Type': types[path.extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  res.end(body);
}

createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    if (pathname === '/config.json') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(config);
      return;
    }

    const target = path.join(root, decodeURIComponent(pathname));
    if (!target.startsWith(root)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    if (pathname.endsWith('/') && (await isFile(path.join(target, 'index.html')))) {
      return send(res, 200, path.join(target, 'index.html'));
    }
    if (!pathname.endsWith('/') && (await isFile(target))) return send(res, 200, target);
    if (!pathname.endsWith('/') && (await isDirectory(target))) {
      res.writeHead(302, { Location: `${pathname}/` }).end();
      return;
    }
    return send(res, 404, path.join(root, '404.html'));
  } catch {
    res.writeHead(500).end('Server error');
  }
}).listen(port, () => process.stdout.write(`E2E server on http://localhost:${port}\n`));
