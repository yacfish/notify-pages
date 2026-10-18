import { createServer } from 'node:http';
import { openDb } from './db.js';
import { getPageBySlug, getPostsForPage, createPage, slugOk } from './pages.js';

const port = Number(process.env.PORT || 3000);
const dbPath = process.env.NOTIFY_DB || './data/notify-pages.sqlite';
const db = openDb(dbPath);

// Touch the schema so a bad migration fails at boot, not on the first request.
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all();

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}'));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

function renderPage(page, posts) {
  const postHtml = posts.map((p) => `
    <article>
      ${p.image_path ? `<img src="${escapeHtml(p.image_path)}" alt="" style="max-width:100%">` : ''}
      <p>${escapeHtml(p.body)}</p>
      ${p.event_date || p.venue || p.doors ? `<p><small>${escapeHtml([p.event_date, p.venue, p.doors].filter(Boolean).join(' · '))}</small></p>` : ''}
    </article>
  `).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 1rem auto; padding: 0 1rem; }
    article { border-bottom: 1px solid #ddd; padding: 1rem 0; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(page.title)}</h1>
    <p>${escapeHtml(page.city)}</p>
    <p>${escapeHtml(page.description)}</p>
  </header>
  <main>
    ${postHtml || '<p>No posts yet.</p>'}
  </main>
</body>
</html>`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    json(res, 200, { ok: true, tables: tables.map((row) => row.name) });
    return;
  }

  // Public page view — shareable URL
  const pageMatch = url.pathname.match(/^\/p\/([a-z0-9-]+)$/);
  if (req.method === 'GET' && pageMatch) {
    const page = getPageBySlug(db, pageMatch[1]);
    if (!page) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('page not found');
      return;
    }
    const posts = getPostsForPage(db, page.id);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(renderPage(page, posts));
    return;
  }

  // Temporary create endpoint. owner_id must exist in users.
  // OAuth will replace the owner_id field with a session.
  if (req.method === 'POST' && url.pathname === '/api/pages') {
    try {
      const body = await readBody(req);
      if (!slugOk(body.slug) || !body.title || !body.city || !body.owner_id) {
        json(res, 400, { error: 'slug, title, city, owner_id required; slug must match [a-z0-9-]' });
        return;
      }
      const user = db.prepare('SELECT id FROM users WHERE id = ?').get(body.owner_id);
      if (!user) {
        json(res, 400, { error: 'owner_id does not exist' });
        return;
      }
      const page = createPage(db, {
        slug: body.slug,
        ownerId: body.owner_id,
        title: body.title,
        city: body.city,
        description: body.description || '',
      });
      json(res, 201, page);
    } catch (err) {
      if (String(err).includes('UNIQUE')) {
        json(res, 409, { error: 'slug taken' });
      } else {
        json(res, 500, { error: 'create failed' });
      }
    }
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});

server.listen(port, () => {
  console.log(`notify-pages listening on http://127.0.0.1:${port} (db ${dbPath})`);
});
