const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function uniqueSlug(db, base) {
  const root = base || 'page';
  let candidate = root;
  let n = 2;
  const taken = db.prepare('SELECT 1 FROM pages WHERE slug = ?');
  while (taken.get(candidate)) {
    candidate = `${root}-${n}`;
    n += 1;
  }
  return candidate;
}

export function createPage(db, { ownerId, title, city, description, slug }) {
  const cleanTitle = String(title || '').trim();
  const cleanCity = String(city || '').trim();
  const cleanDescription = String(description || '').trim();
  if (!cleanTitle || !cleanCity) {
    return { error: 'title and city are required', status: 400 };
  }
  let cleanSlug = slug ? slugify(slug) : slugify(cleanTitle);
  if (slug && !SLUG_RE.test(cleanSlug)) {
    return { error: 'slug must be lowercase letters, numbers, and hyphens', status: 400 };
  }
  if (!cleanSlug) cleanSlug = 'page';
  if (!slug) cleanSlug = uniqueSlug(db, cleanSlug);
  else if (db.prepare('SELECT 1 FROM pages WHERE slug = ?').get(cleanSlug)) {
    return { error: 'slug already taken', status: 409 };
  }
  const result = db.prepare(
    `INSERT INTO pages (slug, owner_id, title, city, description)
     VALUES (?, ?, ?, ?, ?)`
  ).run(cleanSlug, ownerId, cleanTitle, cleanCity, cleanDescription);
  return { page: getPageBySlug(db, cleanSlug), id: Number(result.lastInsertRowid) };
}

export function getPageBySlug(db, slug) {
  return db.prepare(
    `SELECT pages.id, pages.slug, pages.title, pages.city, pages.description,
            pages.owner_id, pages.created_at, users.name AS owner_name
     FROM pages
     JOIN users ON users.id = pages.owner_id
     WHERE pages.slug = ?`
  ).get(slug);
}

export function listPosts(db, pageId) {
  return db.prepare(
    `SELECT posts.id, posts.body, posts.image_path, posts.event_date,
            posts.venue, posts.doors, posts.created_at, posts.author_id,
            users.name AS author_name
     FROM posts
     JOIN users ON users.id = posts.author_id
     WHERE posts.page_id = ?
     ORDER BY posts.created_at DESC`
  ).all(pageId);
}

export function updatePage(db, slug, ownerId, fields) {
  const page = getPageBySlug(db, slug);
  if (!page) return { error: 'page not found', status: 404 };
  if (page.owner_id !== ownerId) return { error: 'only the owner can edit this page', status: 403 };
  const title = fields.title != null ? String(fields.title).trim() : page.title;
  const city = fields.city != null ? String(fields.city).trim() : page.city;
  const description = fields.description != null ? String(fields.description).trim() : page.description;
  if (!title || !city) return { error: 'title and city are required', status: 400 };
  db.prepare(
    'UPDATE pages SET title = ?, city = ?, description = ? WHERE id = ?'
  ).run(title, city, description, page.id);
  return { page: getPageBySlug(db, slug) };
}

export function deletePage(db, slug, ownerId) {
  const page = getPageBySlug(db, slug);
  if (!page) return { error: 'page not found', status: 404 };
  if (page.owner_id !== ownerId) return { error: 'only the owner can delete this page', status: 403 };
  db.prepare('DELETE FROM pages WHERE id = ?').run(page.id);
  return { ok: true };
}
