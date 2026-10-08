# notify-pages

Open-source PWA for local event pages (concerts, shows, meetups). A page is a public archive. Subscribing does not grant posting. Only the owner and approved publishers can post. Each subscriber picks their own Web Push policy.

Status: public page view and page CRUD. OAuth login is next. Writes need `ALLOW_DEV_OWNER=1` until then.

## Stack

- Node.js 22 (uses built-in `node:sqlite`)
- SQLite file at `./data/notify-pages.sqlite`
- Web Push and the PWA shell come later

## Run

```bash
node src/server.js
```

`GET /health` returns `{ "ok": true }` once the schema is applied.

- `PORT` defaults to 3000
- `NOTIFY_DB` defaults to `./data/notify-pages.sqlite`
- `ALLOW_DEV_OWNER=1` creates a local owner so `POST /api/pages` works before OAuth

## Pages

- `GET /` lists pages
- `GET /p/:slug` is the public archive (title, city, description, posts)
- `GET /api/pages` and `GET /api/pages/:slug` return JSON
- `POST /api/pages` with `{ "title", "city", "description" }` creates a page (owner only)
- `PATCH /api/pages/:slug` and `DELETE /api/pages/:slug` are owner-only

## License

MIT
