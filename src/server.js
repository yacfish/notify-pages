import { createServer } from 'node:http';
import { openDb } from './db.js';

const port = Number(process.env.PORT || 3000);
const dbPath = process.env.NOTIFY_DB || './data/notify-pages.sqlite';
const db = openDb(dbPath);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all();

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
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
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const insertPage = db.prepare(
  'INSERT INTO pages (slug, owner_id, title, city, description) VALUES (?, ?, ?, ?, ?)'
);
const getPage = db.prepare('SELECT * FROM pages WHERE slug = ?');
const listPosts = db.prepare(
  'SELECT id, body, image_path, event_date, venue, doors, created_at FROM posts WHERE page_id = ? ORDER BY created_at DESC LIMIT 50'
);

function publicPageHtml(page, posts) {
  const postItems = posts.length
    ? posts
        .map(
          (p) =>
            `<article><p>${escapeHtml(p.body)}</p>${p.event_date ? `<p>Date: ${escapeHtml(p.event_date)}</p>` : ''}${p.venue ? `<p>Venue: ${escapeHtml(p.venue)}</p>` : ''}${p.doors ? `<p>Doors: ${escapeHtml(p.doors)}</p>` : ''}</article>`
        )
        .join('')
    : '<p>No posts yet.</p>';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(page.title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:1rem auto;padding:0 1rem}article{border-bottom:1px solid #ddd;padding:1rem 0}</style>
</head>
<body>
<main>
<h1>${escapeHtml(page.title)}</h1>
<p>${escapeHtml(page.city)}</p>
<p>${escapeHtml(page.description)}</p>
<section>
${postItems}
</section>
</main>
</body>
</html>`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  if (req.method === 'GET' && path === '/health') {
    json(res, 200, { ok: true, tables: tables.map((row) => row.name) });
    return;
  }

  if (req.method === 'POST' && path === '/api/pages') {
    try {
      const body = await readBody(req);
      const slug = slugify(body.slug || body.title);
      if (!slug || !body.title || !body.city || !body.owner_id) {
        json(res, 400, { error: 'title, city, and owner_id are required; slug is optional' });
        return;
      }
      const user = db.prepare('SELECT id FROM users WHERE id = ?').get(Number(body.owner_id));
      if (!user) {
        json(res, 400, { error: 'owner_id does not exist' });
        return;
      }
      insertPage.run(slug, Number(body.owner_id), String(body.title), String(body.city), String(body.description || ''));
      const page = getPage.get(slug);
      json(res, 201, { page });
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) {
        json(res, 409, { error: 'slug already taken' });
        return;
      }
      json(res, 500, { error: 'failed to create page' });
    }
    return;
  }

  const apiMatch = path.match(/^\/api\/pages\/([^/]+)$/);
  if (req.method === 'GET' && apiMatch) {
    const page = getPage.get(apiMatch[1]);
    if (!page) {
      json(res, 404, { error: 'page not found' });
      return;
    }
    const posts = listPosts.all(page.id);
    json(res, 200, { page, posts });
    return;
  }

  const htmlMatch = path.match(/^\/p\/([^/]+)$/);
  if (req.method === 'GET' && htmlMatch) {
    const page = getPage.get(htmlMatch[1]);
    if (!page) {
      html(res, 404, '<p>Page not found</p>');
      return;
    }
    const posts = listPosts.all(page.id);
    html(res, 200, publicPageHtml(page, posts));
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});

server.listen(port, () => {
  console.log(`notify-pages listening on http://127.0.0.1:${port} (db ${dbPath})`);
});
