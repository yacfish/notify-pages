export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.45; color: #1a1a1a; }
    a { color: #0b57d0; }
    label { display: block; margin-top: 0.8rem; font-size: 0.9rem; }
    input, textarea { width: 100%; box-sizing: border-box; padding: 0.45rem; font: inherit; }
    button { margin-top: 1rem; padding: 0.45rem 0.8rem; font: inherit; }
    .meta { color: #444; }
    .post { border-top: 1px solid #ddd; padding: 1rem 0; }
    .error { color: #8a1f1f; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

export function renderHome({ user, allowDevLogin, error }) {
  const who = user
    ? `<p class="meta">Signed in as ${escapeHtml(user.name || user.email)} · <a href="/logout">log out</a></p>`
    : '<p class="meta">Not signed in. Creating a page needs an owner.</p>';
  const login = !user && allowDevLogin
    ? `<form method="post" action="/api/dev/login">
        <h2>Dev sign-in</h2>
        <p class="meta">Temporary stand-in until Google/Apple OAuth. Off unless ALLOW_DEV_LOGIN=1.</p>
        <label>Name <input name="name" required></label>
        <label>Email <input name="email" type="email" required></label>
        <button type="submit">Sign in</button>
      </form>`
    : '';
  const create = user
    ? `<form method="post" action="/api/pages">
        <h2>New page</h2>
        <label>Title <input name="title" required></label>
        <label>City <input name="city" required></label>
        <label>Description <textarea name="description" rows="3"></textarea></label>
        <label>Slug (optional) <input name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*"></label>
        <button type="submit">Create page</button>
      </form>`
    : '';
  const err = error ? `<p class="error">${escapeHtml(error)}</p>` : '';
  return layout('notify-pages', `<h1>notify-pages</h1>
<p>A public page for local events. Subscribing does not grant posting.</p>
${who}${err}${login}${create}`);
}

export function renderPage(page, posts, { canEdit }) {
  const items = posts.length
    ? posts.map((post) => {
      const bits = [
        post.event_date ? `Date ${escapeHtml(post.event_date)}` : '',
        post.venue ? `Venue ${escapeHtml(post.venue)}` : '',
        post.doors ? `Doors ${escapeHtml(post.doors)}` : '',
      ].filter(Boolean).join(' · ');
      const image = post.image_path
        ? `<p><img src="${escapeHtml(post.image_path)}" alt="" style="max-width:100%"></p>`
        : '';
      return `<article class="post">
        <p class="meta">${escapeHtml(post.author_name || 'publisher')} · ${escapeHtml(post.created_at)}</p>
        ${bits ? `<p class="meta">${bits}</p>` : ''}
        ${image}
        <p>${escapeHtml(post.body)}</p>
      </article>`;
    }).join('')
    : '<p class="meta">No posts yet. Approved publishers will show up here.</p>';
  const edit = canEdit
    ? `<form method="post" action="/api/pages/${escapeHtml(page.slug)}/edit">
        <h2>Edit page</h2>
        <label>Title <input name="title" value="${escapeHtml(page.title)}" required></label>
        <label>City <input name="city" value="${escapeHtml(page.city)}" required></label>
        <label>Description <textarea name="description" rows="3">${escapeHtml(page.description)}</textarea></label>
        <button type="submit">Save</button>
      </form>
      <form method="post" action="/api/pages/${escapeHtml(page.slug)}/delete">
        <button type="submit">Delete page</button>
      </form>`
    : '';
  return layout(page.title, `<p><a href="/">notify-pages</a></p>
<h1>${escapeHtml(page.title)}</h1>
<p class="meta">${escapeHtml(page.city)} · kept by ${escapeHtml(page.owner_name || 'owner')}</p>
<p>${escapeHtml(page.description)}</p>
<p class="meta">Share <code>/p/${escapeHtml(page.slug)}</code></p>
${items}
${edit}`);
}

export function renderNotFound() {
  return layout('Not found', '<h1>Page not found</h1><p><a href="/">Home</a></p>');
}
