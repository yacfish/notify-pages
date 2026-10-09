import { createServer } from 'node:http';
import { openDb } from './db.js';
import { createPage, deletePage, getPageBySlug, listPosts, updatePage } from './pages.js';
import { clearUserCookie, devLogin, setUserCookie, userIdFromRequest } from './session.js';
import { renderHome, renderNotFound, renderPage } from './html.js';

const port = Number(process.env.PORT || 3000);
const dbPath = process.env.NOTIFY_DB || './data/notify-pages.sqlite';
const allowDevLogin = process.env.ALLOW_DEV_LOGIN === '1';
const db = openDb(dbPath);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all();

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': type });
  res.end(body);
}

function sendJson(res, status, value) {
  send(res, status, JSON.stringify(value), 'application/json; charset=utf-8');
}

function currentUser(req) {
  const id = userIdFromRequest(req);
  if (!id) return null;
  return db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(id);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseBody(raw, contentType) {
  if (!raw) return {};
  if ((contentType || '').includes('application/json')) return JSON.parse(raw);
  return Object.fromEntries(new URLSearchParams(raw));
}

function wantsHtml(req) {
  const accept = req.headers.accept || '';
  return accept.includes('text/html') && !accept.includes('application/json');
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const path = url.pathname;

  if (req.method === 'GET' && path === '/health') {
    sendJson(res, 200, { ok: true, tables: tables.map((row) => row.name) });
    return;
  }

  if (req.method === 'GET' && path === '/') {
    send(res, 200, renderHome({ user: currentUser(req), allowDevLogin }), 'text/html; charset=utf-8');
    return;
  }

  if (req.method === 'GET' && path === '/logout') {
    clearUserCookie(res);
    res.writeHead(302, { location: '/' });
    res.end();
    return;
  }

  const publicPage = path.match(/^\/p\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (req.method === 'GET' && publicPage) {
    const page = getPageBySlug(db, publicPage[1]);
    if (!page) {
      send(res, 404, renderNotFound(), 'text/html; charset=utf-8');
      return;
    }
    const user = currentUser(req);
    send(res, 200, renderPage(page, listPosts(db, page.id), {
      canEdit: Boolean(user && user.id === page.owner_id),
    }), 'text/html; charset=utf-8');
    return;
  }

  const apiPage = path.match(/^\/api\/pages\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (req.method === 'GET' && apiPage) {
    const page = getPageBySlug(db, apiPage[1]);
    if (!page) {
      sendJson(res, 404, { error: 'page not found' });
      return;
    }
    sendJson(res, 200, { page, posts: listPosts(db, page.id) });
    return;
  }

  if (req.method === 'POST' && path === '/api/dev/login') {
    if (!allowDevLogin) {
      sendJson(res, 404, { error: 'dev login is disabled' });
      return;
    }
    try {
      const body = parseBody(await readBody(req), req.headers['content-type']);
      const result = devLogin(db, body);
      if (result.error) {
        sendJson(res, result.status, { error: result.error });
        return;
      }
      setUserCookie(res, result.userId);
      if (wantsHtml(req) || (req.headers['content-type'] || '').includes('application/x-www-form-urlencoded')) {
        res.writeHead(302, { location: '/' });
        res.end();
        return;
      }
      sendJson(res, 200, { id: result.userId, name: result.name });
    } catch {
      sendJson(res, 400, { error: 'invalid body' });
    }
    return;
  }

  if (req.method === 'POST' && path === '/api/pages') {
    const user = currentUser(req);
    if (!user) {
      sendJson(res, 401, { error: 'sign in required' });
      return;
    }
    try {
      const body = parseBody(await readBody(req), req.headers['content-type']);
      const result = createPage(db, { ...body, ownerId: user.id });
      if (result.error) {
        sendJson(res, result.status, { error: result.error });
        return;
      }
      if ((req.headers['content-type'] || '').includes('application/x-www-form-urlencoded')) {
        res.writeHead(302, { location: `/p/${result.page.slug}` });
        res.end();
        return;
      }
      sendJson(res, 201, { page: result.page });
    } catch {
      sendJson(res, 400, { error: 'invalid body' });
    }
    return;
  }

  const editPage = path.match(/^\/api\/pages\/([a-z0-9]+(?:-[a-z0-9]+)*)\/edit$/);
  if (req.method === 'POST' && editPage) {
    const user = currentUser(req);
    if (!user) {
      sendJson(res, 401, { error: 'sign in required' });
      return;
    }
    try {
      const body = parseBody(await readBody(req), req.headers['content-type']);
      const result = updatePage(db, editPage[1], user.id, body);
      if (result.error) {
        sendJson(res, result.status, { error: result.error });
        return;
      }
      if ((req.headers['content-type'] || '').includes('application/x-www-form-urlencoded')) {
        res.writeHead(302, { location: `/p/${result.page.slug}` });
        res.end();
        return;
      }
      sendJson(res, 200, { page: result.page });
    } catch {
      sendJson(res, 400, { error: 'invalid body' });
    }
    return;
  }

  if ((req.method === 'PATCH' || req.method === 'PUT') && apiPage) {
    const user = currentUser(req);
    if (!user) {
      sendJson(res, 401, { error: 'sign in required' });
      return;
    }
    try {
      const body = parseBody(await readBody(req), req.headers['content-type']);
      const result = updatePage(db, apiPage[1], user.id, body);
      if (result.error) {
        sendJson(res, result.status, { error: result.error });
        return;
      }
      sendJson(res, 200, { page: result.page });
    } catch {
      sendJson(res, 400, { error: 'invalid body' });
    }
    return;
  }

  const deletePath = path.match(/^\/api\/pages\/([a-z0-9]+(?:-[a-z0-9]+)*)\/delete$/);
  if ((req.method === 'POST' && deletePath) || (req.method === 'DELETE' && apiPage)) {
    const slug = (deletePath || apiPage)[1];
    const user = currentUser(req);
    if (!user) {
      sendJson(res, 401, { error: 'sign in required' });
      return;
    }
    const result = deletePage(db, slug, user.id);
    if (result.error) {
      sendJson(res, result.status, { error: result.error });
      return;
    }
    if (req.method === 'POST') {
      res.writeHead(302, { location: '/' });
      res.end();
      return;
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  send(res, 404, 'not found');
});

server.listen(port, () => {
  console.log(`notify-pages listening on http://127.0.0.1:${port} (db ${dbPath})`);
});
