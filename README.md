# notify-pages

Open-source PWA for local event pages (concerts, shows, meetups). A page is a public archive. Subscribing does not grant posting. Only the owner and approved publishers can post. Each subscriber picks their own Web Push policy.

Status: server skeleton and SQLite data model. Page CRUD is next.

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

## License

MIT
