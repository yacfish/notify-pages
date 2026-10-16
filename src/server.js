import { createServer } from 'node:http';
import { openDb } from './db.js';

const port = Number(process.env.PORT || 3000);
const dbPath = process.env.NOTIFY_DB || './data/notify-pages.sqlite';
const db = openDb(dbPath);

// Touch the schema so a bad migration fails at boot, not on the first request.
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all();

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'page';
}

function json(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
}

function html(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  // Health
  if (req.method === 'GET' && path === '/health') {
    return json(res, 200, { ok: true, tables: tables.map((row) => row.name) });
  }

  // Public page view: GET /p/:slug
  const pageMatch = path.match(/^\/p\/([a-z0-9-]+)$/);
  if (req.method === 'GET' && pageMatch) {
    const slug = pageMatch[1];
    const page = db.prepare('SELECT * FROM pages WHERE slug = ?').get(slug);
    if (!page) {
      return html(res, 404, '<h1>Page not found</h1>');
    }
    const posts = db.prepare(`
      SELECT p.*, u.name as author_name
      FROM posts p
      JOIN users u ON u.id = p.author_id
      WHERE p.page_id = ?
      ORDER BY p.created_at DESC
    `).all(page.id);

    const postsHtml = posts.length
      ? posts.map((p) => `
        <article style="border-top:1px solid #ddd;padding:1em 0">
          <h3>${p.event_date || ''} ${p.venue ? ' @ ' + p.venue : ''}</h3>
          <p>${p.body || ''}</p>
          ${p.doors ? `<small>Doors: ${p.doors}</small>` : ''}
          <small>by ${p.author_name || 'unknown'}</small>
        </article>`).join('')
      : '<p>No posts yet.</p>';

    const body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${page.title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40em; margin: 2em auto; padding: 0 1em; }
    h1 { margin-bottom: 0.2em; }
    .meta { color: #555; }
  </style>
</head>
<body>
  <h1>${page.title}</h1>
  <p class="meta">${page.city}</p>
  <p>${page.description || ''}</p>
  <h2>Posts</h2>
  ${postsHtml}
</body>
</html>`;
    return html(res, 200, body);
  }

  // Create page: POST /pages
  // Body: { title, city, description?, slug?, owner_id }
  // owner_id is temporary until OAuth exists. Will be replaced by the logged-in user.
  if (req.method === 'POST' && path === '/pages') {
    try {
      const body = await readBody(req);
      const title = (body.title || '').trim();
      const city = (body.city || '').trim();
      const description = (body.description || '').trim();
      const ownerId = Number(body.owner_id);
      if (!title || !city || !ownerId) {
        return json(res, 400, { error: 'title, city, and owner_id are required' });
      }
      // Verify owner exists
      const owner = db.prepare('SELECT id FROM users WHERE id = ?').get(ownerId);
      if (!owner) {
        return json(res, 400, { error: 'owner_id does not exist' });
      }
      let slug = (body.slug || slugify(title)).toLowerCase();
      // Ensure unique slug
      let attempt = slug;
      let n = 1;
      while (db.prepare('SELECT 1 FROM pages WHERE slug = ?').get(attempt)) {
        attempt = `${slug}-${n++}`;
      }
      slug = attempt;
      const result = db.prepare(`
        INSERT INTO pages (slug, owner_id, title, city, description)
        VALUES (?, ?, ?, ?, ?)
      `).run(slug, ownerId, title, city, description);
      const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(result.lastInsertRowid);
      return json(res, 201, { page, url: `/p/${page.slug}` });
    } catch (err) {
      return json(res, 400, { error: err.message || 'bad request' });
    }
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});

server.listen(port, () => {
  console.log(`notify-pages listening on http://127.0.0.1:${port} (db ${dbPath})`);
});
