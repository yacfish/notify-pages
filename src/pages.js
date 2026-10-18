import { DatabaseSync } from 'node:sqlite';

/**
 * Page queries. Kept separate so the HTTP layer stays thin.
 * owner_id must reference an existing users row; OAuth will supply it later.
 */

export function getPageBySlug(db, slug) {
  return db.prepare('SELECT id, slug, owner_id, title, city, description, created_at FROM pages WHERE slug = ?').get(slug);
}

export function getPostsForPage(db, pageId) {
  return db.prepare(`
    SELECT id, author_id, body, image_path, event_date, venue, doors, created_at
    FROM posts
    WHERE page_id = ?
    ORDER BY created_at DESC
  `).all(pageId);
}

export function createPage(db, { slug, ownerId, title, city, description = '' }) {
  const result = db.prepare(`
    INSERT INTO pages (slug, owner_id, title, city, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(slug, ownerId, title, city, description);
  return getPageBySlug(db, slug);
}

export function slugOk(slug) {
  return typeof slug === 'string' && /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug);
}
