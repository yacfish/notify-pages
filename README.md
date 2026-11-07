# notify-pages

Open-source PWA for local event pages (concerts, shows, meetups). A page is a public archive. Subscribing does not grant posting. Only the owner and approved publishers can post. Each subscriber picks their own Web Push policy.

Status: page CRUD + public view. OAuth login is next.

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

## Pages

- `GET /` — simple list of pages
- `GET /p/:slug` — public page (title, city, description, posts)
- `GET /api/pages` — JSON list
- `GET /api/pages/:slug` — JSON page + posts
- `POST /api/pages` — create `{ "title": "...", "city": "...", "description": "..." }` (optional slug). Owner is a bootstrap local user until OAuth.
- `PUT /api/pages/:slug` — update title/city/description
- `DELETE /api/pages/:slug` — remove page

## License

MIT
