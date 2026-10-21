# notify-pages

Open-source PWA for local event pages (concerts, shows, meetups). A page is a public archive. Subscribing does not grant posting. Only the owner and approved publishers can post. Each subscriber picks their own Web Push policy.

Status: page create and public view. OAuth login is next.

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

## Page API

Create a page (owner_id is temporary until OAuth):

```bash
curl -X POST http://127.0.0.1:3000/api/pages \
  -H 'content-type: application/json' \
  -d '{"title":"Friday Jazz","city":"Brussels","description":"Weekly","owner_id":1}'
```

Public JSON: `GET /api/pages/:slug`

Public HTML: `GET /p/:slug`

## License

MIT
