# notify-pages

Open-source PWA for local event pages (concerts, shows, meetups). A page is a public archive. Subscribing does not grant posting. Only the owner and approved publishers can post. Each subscriber picks their own Web Push policy.

Status: server skeleton, SQLite data model, and page CRUD + public view. OAuth login is next.

## Stack

- Node.js 22 (uses built-in `node:sqlite`)
- SQLite file at `./data/notify-pages.sqlite`
- Web Push and the PWA shell come later

## Run

```bash
node src/server.js
```

`GET /health` returns `{ "ok": true, "tables": [...] }` once the schema is applied.

- `PORT` defaults to 3000
- `NOTIFY_DB` defaults to `./data/notify-pages.sqlite`

## Pages

Until OAuth exists, create a user first (for testing):

```sql
INSERT INTO users (provider, provider_sub, name) VALUES ('demo', '1', 'Demo Owner');
-- note the returned id
```

Then:

- `POST /pages` with JSON `{ "title", "city", "description?", "slug?", "owner_id" }` → creates page, returns it
- `GET /p/:slug` → public page view: page + recent posts
- `GET /pages` → list recent pages
- `GET /pages/:slug` → page metadata
- `PUT /pages/:slug` or `PATCH` → update title/city/description
- `DELETE /pages/:slug` → delete page

Owner checks and posting gates come with auth and publisher approval.

## License

MIT
