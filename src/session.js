const COOKIE = 'notify_uid';

export function userIdFromRequest(req) {
  const header = req.headers.cookie || '';
  const match = header.match(/(?:^|;\s*)notify_uid=(\d+)/);
  return match ? Number(match[1]) : null;
}

export function setUserCookie(res, userId) {
  res.setHeader(
    'set-cookie',
    `${COOKIE}=${userId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`
  );
}

export function clearUserCookie(res) {
  res.setHeader('set-cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

// Temporary until Google/Apple OAuth. Only used when ALLOW_DEV_LOGIN=1.
export function devLogin(db, { email, name }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim() || cleanEmail;
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { error: 'email is required', status: 400 };
  }
  const existing = db.prepare(
    "SELECT id FROM users WHERE provider = 'dev' AND provider_sub = ?"
  ).get(cleanEmail);
  if (existing) return { userId: existing.id, name: cleanName };
  const result = db.prepare(
    "INSERT INTO users (provider, provider_sub, email, name) VALUES ('dev', ?, ?, ?)"
  ).run(cleanEmail, cleanEmail, cleanName);
  return { userId: Number(result.lastInsertRowid), name: cleanName };
}
