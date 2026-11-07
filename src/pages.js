import { randomBytes } from 'node:crypto';

// Slug helper: lowercase, alphanum + hyphens, max 60 chars.
export function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || randomBytes(4).toString('hex');
}

// Temporary until OAuth. Creates a local user if none exist so pages can have an owner.
export function ensureBootstrapUser(db) {
  const existing = db.prepare('SELECT id FROM users LIMIT 1').get();
  if (existing) return existing.id;
  const info = db.prepare(
    "INSERT INTO users (provider, provider_sub, name) VALUES ('local', 'bootstrap', 'Bootstrap')"
  ).run();
  return info.lastInsertRowid;
}

export function createPage(db, { title, city, description, slug }) {
  const ownerId = ensureBootstrapUser(db);
  const finalSlug = slug ? slugify(slug) : slugify(title);
  try {
    const info = db.prepare(
      `INSERT INTO pages (slug, owner_id, title, city, description)
       VALUES (?, ?, ?, ?, ?)`
    ).run(finalSlug, ownerId, title, city, description || '');
    return getPageById(db, info.lastInsertRowid);
  } catch (err) {
    if (String(err).includes('UNIQUE')) {
      const err2 = new Error('slug already taken');
      err2.status = 409;
      throw err2;
    }
    throw err;
  }
}

export function getPageBySlug(db, slug) {
  return db.prepare(
    `SELECT p.*, u.name AS owner_name
     FROM pages p
     JOIN users u ON u.id = p.owner_id
     WHERE p.slug = ?`
  ).get(slug);
}

export function getPageById(db, id) {
  return db.prepare(
    `SELECT p.*, u.name AS owner_name
     FROM pages p
     JOIN users u ON u.id = p.owner_id
     WHERE p.id = ?`
  ).get(id);
}

export function listPages(db) {
  return db.prepare(
    `SELECT p.slug, p.title, p.city, p.description, p.created_at, u.name AS owner_name
     FROM pages p
     JOIN users u ON u.id = p.owner_id
     ORDER BY p.created_at DESC`
  ).all();
}

export function updatePage(db, slug, fields) {
  const page = getPageBySlug(db, slug);
  if (!page) return null;
  const title = fields.title ?? page.title;
  const city = fields.city ?? page.city;
  const description = fields.description ?? page.description;
  db.prepare(
    `UPDATE pages SET title = ?, city = ?, description = ? WHERE slug = ?`
  ).run(title, city, description, slug);
  return getPageBySlug(db, slug);
}

export function deletePage(db, slug) {
  const info = db.prepare('DELETE FROM pages WHERE slug = ?').run(slug);
  return info.changes > 0;
}

export function listPosts(db, pageId) {
  return db.prepare(
    `SELECT id, body, image_path, event_date, venue, doors, created_at
     FROM posts
     WHERE page_id = ?
     ORDER BY created_at DESC`
  ).all(pageId);
}
