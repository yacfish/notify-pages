# notify-pages

Open-source PWA for local event pages (concerts, shows, meetups). A page is a public archive. Subscribing does not grant posting. Only the owner and approved publishers can post. Each subscriber picks their own Web Push policy.

Status: public page view and page create. OAuth login is next.

## Stack

- Node.js 22 (uses built-in `node:sqlite`)
- SQLite file at `./data/notify-pages.sqlite`
- Web Push and the PWA shell come later

## Run

```bash
node src/server.js
```

- `GET /health` returns `{ "ok": true }` once the schema is applied.
- `GET /p/:slug` is the public page (HTML).
- `POST /api/pages` creates a page. Body: `{ "slug": "my-show", "title": "My Show", "city": "Brussels", "description": "...", "owner_id": 1 }`.
  `owner_id` must already exist in the `users` table. Insert one with the sqlite CLI for now; OAuth will own this later.

- `PORT` defaults to 3000
- `NOTIFY_DB` defaults to `./data/notify-pages.sqlite`

## License

MIT
