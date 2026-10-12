import { createServer } from 'node:http';
import { openDb } from './db.js';

const port = Number(process.env.PORT || 3000);
const dbPath = process.env.NOTIFY_DB || './data/notify-pages.sqlite';
const db = openDb(dbPath);

// Touch the schema so a bad migration fails at boot, not on the first request.
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all();

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'page';
}

function uniqueSlug(base) {
  let slug = slugify(base);
  let n = 2;
  while (db.prepare('SELECT 1 FROM pages WHERE slug = ?').get(slug)) {
    slug = `${slugify(base)}-${n++}`;
  }
  return slug;
}

// Public page + posts. No auth required.
function getPageWithPosts(slug) {
  const page = db.prepare(`
    SELECT id, slug, owner_id, title, city, description, created_at
    FROM pages WHERE slug = ?
  `).get(slug);
  if (!page) return null;
  const posts = db.prepare(`
    SELECT id, author_id, body, image_path, event_date, venue, doors, created_at
    FROM posts WHERE page_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(page.id);
  return { page, posts };
}

function htmlEscape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPageHtml({ page, posts }) {
  const postHtml = posts.map((p) => {
    const meta = [p.event_date, p.venue, p.doors].filter(Boolean).join(' · ');
    return `<article>
      ${meta ? `<p class="meta">${htmlEscape(meta)}</p>` : ''}
      <p>${htmlEscape(p.body)}</p>
      ${p.image_path ? `<img src="${htmlEscape(p.image_path)}" alt="">` : ''}
      <small>${htmlEscape(p.created_at)}</small>
    </article>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(page.title)} — ${htmlEscape(page.city)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    .meta { color: #555; font-size: 0.9rem; }
    article { border-top: 1px solid #eee; padding: 1rem 0; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <header>
    <h1>${htmlEscape(page.title)}</h1>
    <p class="meta">${htmlEscape(page.city)}</p>
    <p>${htmlEscape(page.description)}</p>
  </header>
  <main>
    ${postHtml || '<p>No posts yet.</p>'}
  </main>
</body>
</html>`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const path = url.pathname;

  // Health
  if (req.method === 'GET' && path === '/health') {
    json(res, 200, { ok: true, tables: tables.map((row) => row.name) });
    return;
  }

  // Public HTML page view: /p/:slug
  const publicMatch = path.match(/^\/p\/([a-z0-9-]+)$/);
  if (req.method === 'GET' && publicMatch) {
    const data = getPageWithPosts(publicMatch[1]);
    if (!data) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('page not found');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(renderPageHtml(data));
    return;
  }

  // JSON public page: /api/pages/:slug
  const apiMatch = path.match(/^\/api\/pages\/([a-z0-9-]+)$/);
  if (req.method === 'GET' && apiMatch) {
    const data = getPageWithPosts(apiMatch[1]);
    if (!data) {
      json(res, 404, { error: 'not found' });
      return;
    }
    json(res, 200, data);
    return;
  }

  // Create page. owner_id is temporary — OAuth session will replace it.
  if (req.method === 'POST' && path === '/api/pages') {
    try {
      const body = await readBody(req);
      const title = String(body.title || '').trim();
      const city = String(body.city || '').trim();
      const description = String(body.description || '').trim();
      const ownerId = Number(body.owner_id);

      if (!title || !city || !Number.isInteger(ownerId) || ownerId < 1) {
        json(res, 400, { error: 'title, city, and owner_id required' });
        return;
      }

      // Ensure the owner user exists (dev convenience until OAuth).
      const user = db.prepare('SELECT id FROM users WHERE id = ?').get(ownerId);
      if (!user) {
        json(res, 400, { error: 'owner user does not exist' });
        return;
      }

      const slug = body.slug ? slugify(body.slug) : uniqueSlug(title);
      if (db.prepare('SELECT 1 FROM pages WHERE slug = ?').get(slug)) {
        json(res, 409, { error: 'slug taken' });
        return;
      }

      const info = db.prepare(`
        INSERT INTO pages (slug, owner_id, title, city, description)
        VALUES (?, ?, ?, ?, ?)
      `).run(slug, ownerId, title, city, description);

      const page = db.prepare('SELECT id, slug, owner_id, title, city, description, created_at FROM pages WHERE id = ?').get(info.lastInsertRowid);
      json(res, 201, { page });
    } catch (err) {
      json(res, 400, { error: err.message || 'bad request' });
    }
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});

server.listen(port, () => {
  console.log(`notify-pages listening on http://127.0.0.1:${port} (db ${dbPath})`);
});
