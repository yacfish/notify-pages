function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'page';
}

function uniqueSlug(db, base) {
  let slug = base;
  let n = 2;
  while (db.prepare('SELECT 1 FROM pages WHERE slug = ?').get(slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

export function createPage(db, { title, city, description = '', slug, ownerId }) {
  if (!title || !city || !ownerId) {
    const err = new Error('title, city, and owner_id are required');
    err.status = 400;
    throw err;
  }
  const owner = db.prepare('SELECT id FROM users WHERE id = ?').get(ownerId);
  if (!owner) {
    const err = new Error('owner_id does not exist');
    err.status = 400;
    throw err;
  }
  const base = slug ? slugify(slug) : slugify(title);
  const finalSlug = uniqueSlug(db, base);
  const result = db.prepare(
    'INSERT INTO pages (slug, owner_id, title, city, description) VALUES (?, ?, ?, ?, ?)'
  ).run(finalSlug, ownerId, title, city, description);
  return getPageById(db, result.lastInsertRowid);
}

export function getPageBySlug(db, slug) {
  return db.prepare('SELECT * FROM pages WHERE slug = ?').get(slug);
}

export function getPageById(db, id) {
  return db.prepare('SELECT * FROM pages WHERE id = ?').get(id);
}

export function updatePage(db, slug, fields) {
  const page = getPageBySlug(db, slug);
  if (!page) {
    const err = new Error('page not found');
    err.status = 404;
    throw err;
  }
  const allowed = ['title', 'city', 'description'];
  const updates = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(fields[key]);
    }
  }
  if (updates.length === 0) return page;
  values.push(page.id);
  db.prepare(`UPDATE pages SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return getPageById(db, page.id);
}

export function deletePage(db, slug) {
  const page = getPageBySlug(db, slug);
  if (!page) {
    const err = new Error('page not found');
    err.status = 404;
    throw err;
  }
  db.prepare('DELETE FROM pages WHERE id = ?').run(page.id);
  return { deleted: true, slug };
}

export function getPostsForPage(db, pageId, limit = 50) {
  return db.prepare(
    'SELECT id, author_id, body, image_path, event_date, venue, doors, created_at FROM posts WHERE page_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(pageId, limit);
}

export async function handlePageRoutes(req, res, db) {
  const url = new URL(req.url || '/', 'http://localhost');
  const path = url.pathname;

  // Public page view: GET /p/:slug
  if (req.method === 'GET' && path.startsWith('/p/')) {
    const slug = path.slice(3);
    const page = getPageBySlug(db, slug);
    if (!page) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'page not found' }));
      return true;
    }
    const posts = getPostsForPage(db, page.id);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ page, posts }));
    return true;
  }

  // List pages (optional, for discovery)
  if (req.method === 'GET' && path === '/pages') {
    const pages = db.prepare('SELECT id, slug, title, city, description, created_at FROM pages ORDER BY created_at DESC LIMIT 100').all();
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ pages }));
    return true;
  }

  if (req.method === 'POST' && path === '/pages') {
    const body = await readJson(req);
    const page = createPage(db, {
      title: body.title,
      city: body.city,
      description: body.description,
      slug: body.slug,
      ownerId: body.owner_id,
    });
    res.writeHead(201, { 'content-type': 'application/json' });
    res.end(JSON.stringify(page));
    return true;
  }

  const slugMatch = path.match(/^\/pages\/([^/]+)$/);
  if (slugMatch) {
    const slug = slugMatch[1];
    if (req.method === 'GET') {
      const page = getPageBySlug(db, slug);
      if (!page) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'page not found' }));
        return true;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(page));
      return true;
    }
    if (req.method === 'PUT' || req.method === 'PATCH') {
      const body = await readJson(req);
      const page = updatePage(db, slug, body);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(page));
      return true;
    }
    if (req.method === 'DELETE') {
      const result = deletePage(db, slug);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
      return true;
    }
  }

  return false;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        const err = new Error('invalid JSON');
        err.status = 400;
        reject(err);
      }
    });
    req.on('error', reject);
  });
}
