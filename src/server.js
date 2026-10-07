import { createServer } from 'node:http';
import { openDb } from './db.js';

const port = Number(process.env.PORT || 3000);
const dbPath = process.env.NOTIFY_DB || './data/notify-pages.sqlite';
const db = openDb(dbPath);

// Touch the schema so a bad migration fails at boot, not on the first request.
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all();

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, tables: tables.map((row) => row.name) }));
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});

server.listen(port, () => {
  console.log(`notify-pages listening on http://127.0.0.1:${port} (db ${dbPath})`);
});
