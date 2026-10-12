# notify-pages

Open-source PWA for local event pages (concerts, shows, meetups). A page is a public archive. Subscribing does not grant posting. Only the owner and approved publishers can post. Each subscriber picks their own Web Push policy.

Status: server skeleton, SQLite data model, and page create + public view. OAuth is next.

## Stack

- Node.js 22 (uses built-in `node:sqlite`)
- SQLite file at `./data/notify-pages.sqlite`
- Web Push and the PWA shell come later

## Run

```bash
node src/server.js
```

`GET /health` returns `{ "ok": true }` once the schema is applied.

### Pages

Create a page (temporary `owner_id` until OAuth lands):

```bash
# First create a user if needed (example)
sqlite3 ./data/notify-pages.sqlite \
  "INSERT INTO users (provider, provider_sub, email, name) VALUES ('dev', '1', 'dev@example.com', 'Dev');"

curl -X POST http://127.0.0.1:3000/api/pages \
  -H 'content-type: application/json' \
  -d '{"title":"Jazz Night","city":"Brussels","description":"Weekly jam","owner_id":1}'
```

Public view:

- HTML: `GET /p/:slug`
- JSON: `GET /api/pages/:slug` (includes recent posts)

- `PORT` defaults to 3000
- `NOTIFY_DB` defaults to `./data/notify-pages.sqlite`

## License

MIT
