# notify-pages

Open-source PWA for local event pages (concerts, shows, meetups). A page is a public archive. Subscribing does not grant posting. Only the owner and approved publishers can post. Each subscriber picks their own Web Push policy.

Status: page create/edit/delete and the public archive view. OAuth login is next. Dev sign-in is a temporary owner cookie.

## Stack

- Node.js 22 (uses built-in `node:sqlite`)
- SQLite file at `./data/notify-pages.sqlite`
- Web Push and the PWA shell come later

## Run

```bash
ALLOW_DEV_LOGIN=1 node src/server.js
```

`GET /health` returns `{ "ok": true }` once the schema is applied.

- `PORT` defaults to 3000
- `NOTIFY_DB` defaults to `./data/notify-pages.sqlite`
- `ALLOW_DEV_LOGIN=1` enables `POST /api/dev/login` so a page can have an owner before OAuth. Leave it unset in production.

## Pages

- `GET /p/:slug` — public archive (title, city, description, posts)
- `GET /api/pages/:slug` — same data as JSON
- `POST /api/pages` — create (owner cookie). Body: `title`, `city`, `description`, optional `slug`
- `PATCH /api/pages/:slug` — owner only. Slug stays put so shared URLs do not break
- `DELETE /api/pages/:slug` — owner only

## License

MIT
