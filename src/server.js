import { createServer } from 'node:http';
import { openDb } from './db.js';
import * as pages from './pages.js';

const port = Number(process.env.PORT || 3000);
const dbPath = process.env.NOTIFY_DB || './data/notify-pages.sqlite';
const db = openDb(dbPath);

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function html(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function renderPage(page, posts) {
  const postList = posts.length
    ? posts.map(p => `
      <article>
        ${p.event_date ? `<p><strong>${escapeHtml(p.event_date)}</strong>${p.venue ? ' · ' + escapeHtml(p.venue) : ''}</p>` : ''}
        <p>${escapeHtml(p.body)}</p>
        ${p.image_path ? `<img src="${escapeHtml(p.image_path)}" alt="">` : ''}
      </article>`).join('')
    : '<p>No posts yet.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; }
    article { border-top: 1px solid #ddd; padding: 1rem 0; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(page.title)}</h1>
    <p>${escapeHtml(page.city)}</p>
    <p>${escapeHtml(page.description)}</p>
  </header>
  <section>
    <h2>Posts</h2>
    ${postList}
  </section>
  <footer><p><a href="/">All pages</a></p></footer>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const path = url.pathname;

  // Health
  if (req.method === 'GET' && path === '/health') {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all();
    return json(res, 200, { ok: true, tables: tables.map(r => r.name) });
  }

  // List pages (API + simple HTML index)
  if (req.method === 'GET' && (path === '/' || path === '/api/pages')) {
    const list = pages.listPages(db);
    if (path === '/api/pages') return json(res, 200, list);
    const items = list.map(p =>
      `<li><a href="/p/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a> — ${escapeHtml(p.city)}</li>`
    ).join('') || '<li>No pages yet.</li>';
    return html(res, 200, `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>notify-pages</title></head>
<body><h1>Pages</h1><ul>${items}</ul>
<p>POST /api/pages with JSON {title, city, description} to create one.</p></body></html>`);
  }

  // Public page view
  const pageMatch = path.match(/^\/p\/([a-z0-9-]+)$/);
  if (req.method === 'GET' && pageMatch) {
    const page = pages.getPageBySlug(db, pageMatch[1]);
    if (!page) return html(res, 404, '<h1>Page not found</h1>');
    const posts = pages.listPosts(db, page.id);
    return html(res, 200, renderPage(page, posts));
  }

  // API: get one page
  const apiPageMatch = path.match(/^\/api\/pages\/([a-z0-9-]+)$/);
  if (req.method === 'GET' && apiPageMatch) {
    const page = pages.getPageBySlug(db, apiPageMatch[1]);
    if (!page) return json(res, 404, { error: 'not found' });
    const posts = pages.listPosts(db, page.id);
    return json(res, 200, { ...page, posts });
  }

  // Create page
  if (req.method === 'POST' && path === '/api/pages') {
    const body = await readBody(req);
    if (!body.title || !body.city) {
      return json(res, 400, { error: 'title and city required' });
    }
    try {
      const page = pages.createPage(db, body);
      return json(res, 201, page);
    } catch (err) {
      return json(res, err.status || 500, { error: err.message });
    }
  }

  // Update page
  if (req.method === 'PUT' && apiPageMatch) {
    const body = await readBody(req);
    const page = pages.updatePage(db, apiPageMatch[1], body);
    if (!page) return json(res, 404, { error: 'not found' });
    return json(res, 200, page);
  }

  // Delete page
  if (req.method === 'DELETE' && apiPageMatch) {
    const ok = pages.deletePage(db, apiPageMatch[1]);
    return json(res, ok ? 204 : 404, ok ? null : { error: 'not found' });
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});

server.listen(port, () => {
  console.log(`notify-pages listening on http://127.0.0.1:${port} (db ${dbPath})`);
});
