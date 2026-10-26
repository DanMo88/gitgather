/* Gitgather — vanilla JS, no build step. */
const GG = {
  repo: 'DanMo88/gitgather',
  repoId: 'R_kgDOVYcXDw',
  showcaseCategory: { name: 'Show and tell', slug: 'show-and-tell', id: 'DIC_kwDOVYcXD84DJsUh' },
  chatCategory: { name: 'General', id: 'DIC_kwDOVYcXD84DJsUe' },
  rooms: [
    { key: 'lobby', name: 'Lobby', emoji: '💬', number: 1, about: 'Say hi, meet people, talk about anything dev.' },
    { key: 'help', name: 'Help', emoji: '🛟', number: 2, about: 'Ask about Git, GitHub, Actions, Pages or your code.' },
    { key: 'show', name: 'Show & Tell', emoji: '🎨', number: 3, about: 'Quick demos, GIFs and works in progress.' },
  ],
  newPostUrl: 'https://github.com/DanMo88/gitgather/discussions/new?category=show-and-tell',
  welcomeUrl: 'https://github.com/DanMo88/gitgather/discussions/4',
};

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => /^https:\/\//i.test(u || '') ? u : '';
const ogImage = p => safeUrl(p.screenshot) || (p.repo ? `https://opengraph.githubassets.com/gitgather/${p.repo}` : '');
const loginOk = l => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(l || '');
const fmt = n => n == null ? '–' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
function ago(iso) {
  if (!iso) return '';
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'just now';
  const u = [[31536000, 'y'], [2592000, 'mo'], [604800, 'w'], [86400, 'd'], [3600, 'h'], [60, 'm']];
  for (const [k, l] of u) if (s >= k) return Math.floor(s / k) + l + ' ago';
}
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}

/* ---------- theme ---------- */
function currentTheme() {
  return localStorage.getItem('gg-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const b = $('#themeBtn'); if (b) b.textContent = t === 'dark' ? '☀️' : '🌙';
  const meta = $('meta[name="theme-color"]'); if (meta) meta.content = t === 'dark' ? '#0b0f17' : '#f6f8fb';
  const f = $('iframe.giscus-frame');
  if (f) f.contentWindow.postMessage({ giscus: { setConfig: { theme: giscusTheme() } } }, 'https://giscus.app');
}
const giscusTheme = () => currentTheme() === 'dark' ? 'dark_dimmed' : 'light';
applyTheme(currentTheme());

/* ---------- sign-in (giscus OAuth, session lives in localStorage) ---------- */
// giscus stores its session token in localStorage under "giscus-session" after OAuth.
// Pages with a giscus widget pick up ?giscus=... automatically.
(function captureGiscusSession() {
  const u = new URL(location.href), g = u.searchParams.get('giscus');
  if (!g) return;
  localStorage.setItem('giscus-session', JSON.stringify(g));
  u.searchParams.delete('giscus');
  history.replaceState(null, document.title, u.toString());
})();
const signedIn = () => !!localStorage.getItem('giscus-session');
function signInUrl(target) {
  const back = target || (location.origin + location.pathname.replace(/[^/]*$/, '') + 'chat.html');
  return 'https://giscus.app/api/oauth/authorize?redirect_uri=' + encodeURIComponent(back);
}

/* ---------- layout ---------- */
function layout(active) {
  const nav = [
    ['index.html', 'home', '🏠', 'Home'],
    ['index.html#top', 'top', '🏆', 'Top 100'],
    ['index.html#latest', 'latest', '✨', 'Latest'],
    ['chat.html', 'chat', '💬', 'Chat'],
  ];
  const header = document.createElement('header');
  header.className = 'top';
  header.innerHTML = `<div class="wrap">
    <a class="brand" href="index.html"><img src="assets/logo.svg" alt="">Gitgather</a>
    <nav class="nav">
      ${nav.slice(1).map(([h, k, , l]) => `<a href="${h}" class="${k === active ? 'active' : ''}">${l}</a>`).join('')}
      <a class="keep btn sm primary" href="${GG.newPostUrl}" target="_blank" rel="noopener">＋ Post</a>
      <a class="keep btn sm" id="authBtn" href="#">Sign in</a>
      <button class="icon-btn" id="themeBtn" aria-label="Toggle theme"></button>
    </nav></div>`;
  document.body.prepend(header);
  const tab = document.createElement('nav');
  tab.className = 'tabbar';
  tab.innerHTML = nav.map(([h, k, e, l]) => `<a href="${h}" class="${k === active ? 'active' : ''}"><span>${e}</span>${l}</a>`).join('')
    + `<a href="${GG.newPostUrl}" target="_blank" rel="noopener"><span>➕</span>Post</a>`;
  document.body.appendChild(tab);
  const footer = document.createElement('footer');
  footer.innerHTML = `<div class="wrap">
    <div><b>Gitgather</b> · The hangout for GitHub people<br><span class="small">Made by <b>Daniel Mozafari</b></span></div>
    <div class="small"><a href="https://github.com/${GG.repo}">Source</a> · <a href="https://github.com/${GG.repo}/blob/main/CODE_OF_CONDUCT.md">Code of Conduct</a> · <a href="https://github.com/${GG.repo}/discussions">Discussions</a> · <a href="https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies">GitHub AUP</a></div>
  </div>`;
  document.body.appendChild(footer);
  applyTheme(currentTheme());
  $('#themeBtn').onclick = () => { const t = currentTheme() === 'dark' ? 'light' : 'dark'; localStorage.setItem('gg-theme', t); applyTheme(t); };
  const a = $('#authBtn');
  const paint = () => {
    if (signedIn()) { a.textContent = 'Sign out'; a.title = 'Signed in with GitHub via giscus'; }
    else { a.textContent = 'Sign in'; a.title = 'Sign in with GitHub (via giscus)'; }
  };
  paint();
  a.onclick = e => {
    e.preventDefault();
    if (signedIn()) { localStorage.removeItem('giscus-session'); paint(); toast('Signed out'); setTimeout(() => location.reload(), 600); }
    else location.href = signInUrl(location.href.split('#')[0]);
  };
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

/* ---------- data ---------- */
async function getJSON(path) {
  const r = await fetch(path + '?t=' + Math.floor(Date.now() / 300000), { cache: 'no-cache' });
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.json();
}
async function loadData() {
  const [posts, top] = await Promise.all([getJSON('data/posts.json'), getJSON('data/top100.json')]);
  const byNum = new Map(posts.posts.map(p => [p.number, p]));
  return { posts, top, byNum };
}

/* ---------- components ---------- */
function followBtn(login, small = true) {
  return `<a class="btn ${small ? 'sm' : ''}" href="https://github.com/${esc(login)}" target="_blank" rel="noopener" title="Follow ${esc(login)} on GitHub">＋ Follow</a>`;
}
function starBtn(repo, stars, small = true) {
  if (!repo) return '';
  return `<a class="btn ${small ? 'sm' : ''}" href="https://github.com/${esc(repo)}" target="_blank" rel="noopener" title="Star ${esc(repo)} on GitHub">⭐ Star · ${fmt(stars)}</a>`;
}
function shot(p, extra = '') {
  const img = ogImage(p);
  return `<div class="shot">${img ? `<img loading="lazy" referrerpolicy="no-referrer" src="${esc(img)}" alt="" onerror="this.remove()">` : ''}
    ${img ? '' : `<span class="mono">${esc(p.repo || p.title)}</span>`}${extra}</div>`;
}
function card(p, rank, score) {
  const extra = (rank ? `<span class="rank">#${rank}</span>` : '') + (score != null ? `<span class="score">🔥 ${score}</span>` : '');
  const a = p.author;
  return `<article class="card">
    <a href="post.html?n=${p.number}" aria-label="${esc(p.title)}">${shot(p, extra)}</a>
    <div class="body">
      <h3><a href="post.html?n=${p.number}">${esc(p.title)}</a></h3>
      <p>${esc(p.description)}</p>
      ${p.tags?.length ? `<div class="tags">${p.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="meta"><span>👍 <b>${fmt(p.reactions)}</b></span><span>💬 <b>${fmt(p.comments)}</b></span><span>⭐ <b>${fmt(p.stars)}</b></span><span>${ago(p.createdAt)}</span></div>
    </div>
    <div class="foot">
      <a class="who" href="profile.html?u=${esc(a.login)}"><img loading="lazy" src="${esc(safeUrl(a.avatar))}" alt="">
        <span>${esc(a.login)}<br><small>${a.followers != null ? fmt(a.followers) + ' followers' : ''}</small></span></a>
      <span class="spacer"></span>${followBtn(a.login)}${starBtn(p.repo, p.stars)}
    </div></article>`;
}
function emptyBox(icon, title, text, cta = true) {
  return `<div class="empty"><div class="big">${icon}</div><h3>${title}</h3><p>${text}</p>
    ${cta ? `<a class="btn primary" href="${GG.newPostUrl}" target="_blank" rel="noopener">＋ Post your project</a>` : ''}</div>`;
}
function giscus(el, number, { top = false } = {}) {
  const s = document.createElement('script');
  s.src = 'https://giscus.app/client.js';
  Object.entries({
    repo: GG.repo, repoId: GG.repoId, category: GG.chatCategory.name, categoryId: GG.chatCategory.id,
    mapping: 'number', term: String(number), strict: '0', reactionsEnabled: '1', emitMetadata: '0',
    inputPosition: top ? 'top' : 'bottom', theme: giscusTheme(), lang: 'en', loading: 'lazy',
  }).forEach(([k, v]) => s.setAttribute('data-' + k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), v));
  s.crossOrigin = 'anonymous'; s.async = true;
  el.appendChild(s);
}

/* ---------- pages ---------- */
async function pageHome() {
  layout('home');
  const main = $('#main');
  let data;
  try { data = await loadData(); } catch (e) { $('#feed').innerHTML = emptyBox('⚠️', 'Could not load data', esc(e.message), false); return; }
  const { posts, top, byNum } = data;
  const people = new Set(posts.posts.map(p => p.author.login)).size;
  $('#stats').innerHTML = `
    <div class="stat"><b>${fmt(posts.count)}</b><span>projects showcased</span></div>
    <div class="stat"><b>${fmt(people)}</b><span>makers</span></div>
    <div class="stat"><b>${fmt(top.top.length)}</b><span>trending in 24h</span></div>`;
  $('#updated').textContent = posts.generatedAt ? 'Leaderboard updated ' + ago(posts.generatedAt) + ' · refreshes hourly' : 'Leaderboard refreshes hourly';
  const q = $('#q');
  const render = () => {
    const mode = location.hash === '#latest' ? 'latest' : 'top';
    document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    document.querySelectorAll('.nav a, .tabbar a').forEach(a => {
      const h = a.getAttribute('href');
      a.classList.toggle('active', h === 'index.html#' + mode);
    });
    const term = q.value.trim().toLowerCase();
    const match = p => !term || [p.title, p.description, p.repo, p.author.login, ...(p.tags || [])].join(' ').toLowerCase().includes(term);
    $('#feedTitle').textContent = mode === 'top' ? '🏆 Top 100 · 24h' : '✨ Latest';
    const feed = $('#feed');
    if (mode === 'top') {
      const rows = top.top.map(t => ({ t, p: byNum.get(t.number) })).filter(x => x.p && match(x.p));
      if (!rows.length) {
        feed.innerHTML = emptyBox('🌱', 'Nothing trending in the last 24h', 'Be the first: react to or comment on a project below, or post your own.')
          + (posts.posts.length ? `<h3 style="margin:24px 0 12px">Recently posted</h3><div class="grid">${posts.posts.filter(match).slice(0, 12).map(p => card(p)).join('')}</div>` : '');
        return;
      }
      const podium = rows.slice(0, 3), rest = rows.slice(3);
      feed.innerHTML = `<div class="grid">${podium.map(({ t, p }) => card(p, t.rank, t.score)).join('')}</div>`
        + (rest.length ? `<div class="board" style="margin-top:14px">${rest.map(({ t, p }) => `
          <div class="row"><div class="n">${t.rank}</div>
            <div><h3><a href="post.html?n=${p.number}">${esc(p.title)}</a></h3>
              <div class="meta"><a class="who" href="profile.html?u=${esc(p.author.login)}"><img src="${esc(safeUrl(p.author.avatar))}" alt="" style="width:18px;height:18px">${esc(p.author.login)}</a>
              <span>💬 ${t.last24h.comments} · 👍 ${t.last24h.reactors} · ⭐ +${t.last24h.stars} in 24h</span></div></div>
            <div class="pts">🔥 ${t.score}<small>points</small></div></div>`).join('')}</div>` : '');
    } else {
      const list = posts.posts.filter(match);
      feed.innerHTML = list.length ? `<div class="grid">${list.map(p => card(p)).join('')}</div>`
        : emptyBox('🔭', term ? 'No matches' : 'No projects yet', term ? 'Try another search.' : 'Post the very first project on Gitgather!');
    }
  };
  document.querySelectorAll('.seg button').forEach(b => b.onclick = () => { location.hash = b.dataset.mode; });
  q.oninput = render;
  addEventListener('hashchange', () => { render(); if (location.hash) $('#feedTitle').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  render();
}

async function pagePost() {
  layout('');
  const n = parseInt(new URLSearchParams(location.search).get('n'), 10);
  const box = $('#post');
  if (!n) { box.innerHTML = emptyBox('🤔', 'No post selected', 'Pick a project from the feed.', false); return; }
  let p = null, rank = null;
  try {
    const { byNum, top } = await loadData();
    p = byNum.get(n);
    rank = top.top.find(t => t.number === n);
  } catch {}
  const discUrl = `https://github.com/${GG.repo}/discussions/${n}`;
  if (!p) {
    box.innerHTML = `<div class="panel"><h1>Discussion #${n}</h1>
      <p class="note info">This post isn't in the feed yet (the index refreshes about every hour), or it isn't a Showcase post. You can still react and comment below.</p>
      <a class="btn" href="${discUrl}" target="_blank" rel="noopener">Open on GitHub ↗</a>
      <div class="giscus-wrap" id="giscus"></div></div>`;
    giscus($('#giscus'), n); return;
  }
  document.title = p.title + ' · Gitgather';
  const a = p.author;
  box.innerHTML = `<div class="post">
    <div class="panel">
      ${rank ? `<span class="pill">🔥 #${rank.rank} in Top 100 · 24h · ${rank.score} pts</span>` : ''}
      <h1>${esc(p.title)}</h1>
      <div class="meta"><a class="who" href="profile.html?u=${esc(a.login)}"><img src="${esc(safeUrl(a.avatar))}" alt="">${esc(a.login)}</a><span>${ago(p.createdAt)}</span><span>👍 ${fmt(p.reactions)}</span><span>💬 ${fmt(p.comments)}</span></div>
      ${ogImage(p) ? `<div class="hero-shot"><img referrerpolicy="no-referrer" src="${esc(ogImage(p))}" alt="Screenshot" onerror="this.parentNode.remove()"></div>` : ''}
      <div class="desc">${esc(p.description)}</div>
      ${p.tags?.length ? `<div class="tags">${p.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="giscus-wrap">
        <p class="small muted">React (👍 ❤️ 🚀 🎉 count as likes) and comment below — you sign in with GitHub. Everything here is public on <a href="${discUrl}" target="_blank" rel="noopener">discussion #${n}</a>.</p>
        <div id="giscus"></div>
      </div>
    </div>
    <aside style="display:flex;flex-direction:column;gap:14px">
      <div class="panel repo-box">
        <span class="small muted">Showcased repository</span>
        ${p.repo ? `<a class="name" href="https://github.com/${esc(p.repo)}" target="_blank" rel="noopener">${esc(p.repo)}</a>
        ${p.repoDescription ? `<span class="small muted">${esc(p.repoDescription)}</span>` : ''}
        <div class="kv"><span>⭐ <b>${fmt(p.stars)}</b> stars</span><span>+<b>${p.last24h.stars}</b> today</span>
          ${p.language ? `<span><i class="lang-dot" style="background:${esc(p.language.color || '#888')}"></i>${esc(p.language.name)}</span>` : ''}</div>
        ${starBtn(p.repo, p.stars, false)}
        <span class="small muted">Star only if you genuinely like it — star swaps are against the rules.</span>` : '<span class="muted">No repository link.</span>'}
      </div>
      <div class="panel repo-box">
        <span class="small muted">Maker</span>
        <a class="who" href="profile.html?u=${esc(a.login)}"><img src="${esc(safeUrl(a.avatar))}" alt="" style="width:40px;height:40px"><span>${esc(a.name || a.login)}<br><small>@${esc(a.login)}</small></span></a>
        <div class="kv"><span><b>${fmt(a.followers)}</b> followers</span><span><b>${fmt(a.following)}</b> following</span></div>
        <div class="acts" style="margin:0">${followBtn(a.login, false)}<a class="btn" href="profile.html?u=${esc(a.login)}">Profile</a></div>
      </div>
      <div class="panel small muted">24h activity: 💬 ${p.last24h.comments} comments · 👍 ${p.last24h.reactors} people reacted · ⭐ +${p.last24h.stars} stars<br><a href="${discUrl}" target="_blank" rel="noopener">Open on GitHub ↗</a> · <a href="https://github.com/${GG.repo}/blob/main/CODE_OF_CONDUCT.md#reporting">Report</a></div>
    </aside></div>`;
  giscus($('#giscus'), n);
}

function pageChat() {
  layout('chat');
  const key = new URLSearchParams(location.search).get('room') || 'lobby';
  const room = GG.rooms.find(r => r.key === key) || GG.rooms[0];
  document.title = room.name + ' · Gitgather chat';
  $('#rooms').innerHTML = GG.rooms.map(r => `<a class="room ${r === room ? 'on' : ''}" href="chat.html?room=${r.key}">${r.emoji} ${esc(r.name)}</a>`).join('');
  $('#roomTitle').textContent = room.emoji + ' ' + room.name;
  $('#roomAbout').textContent = room.about;
  $('#roomLink').href = `https://github.com/${GG.repo}/discussions/${room.number}`;
  giscus($('#giscus'), room.number, { top: true });
}

async function pageProfile() {
  layout('');
  const u = new URLSearchParams(location.search).get('u') || '';
  const box = $('#profile');
  if (!loginOk(u)) { box.innerHTML = emptyBox('🙈', 'No user', 'Open a profile from a post.', false); return; }
  const cached = async (path) => {
    const k = 'gg:' + path, hit = sessionStorage.getItem(k);
    if (hit) return JSON.parse(hit);
    const r = await fetch('https://api.github.com' + path, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw Object.assign(new Error(r.status === 403 || r.status === 429 ? 'GitHub API rate limit reached (60 requests/hour per visitor). Try again later.' : 'GitHub API error ' + r.status), { status: r.status });
    const j = await r.json(); sessionStorage.setItem(k, JSON.stringify(j)); return j;
  };
  let posts = [];
  try { posts = (await getJSON('data/posts.json')).posts.filter(p => p.author.login.toLowerCase() === u.toLowerCase()); } catch {}
  let user = null, repos = [], err = '';
  try { [user, repos] = await Promise.all([cached(`/users/${u}`), cached(`/users/${u}/repos?sort=pushed&per_page=12`)]); }
  catch (e) { err = e.message; if (e.status === 404) { box.innerHTML = emptyBox('🔍', 'User not found', esc(u), false); return; } }
  const fb = posts[0]?.author || {};
  user = user || { login: u, avatar_url: fb.avatar || `https://github.com/${u}.png`, name: fb.name, followers: fb.followers, following: fb.following, html_url: 'https://github.com/' + u };
  document.title = (user.name || user.login) + ' · Gitgather';
  box.innerHTML = `
    <div class="prof">
      <img class="av" src="${esc(safeUrl(user.avatar_url))}" alt="">
      <div>
        <h1>${esc(user.name || user.login)}</h1>
        <div class="muted">@${esc(user.login)}${user.location ? ' · 📍 ' + esc(user.location) : ''}</div>
        ${user.bio ? `<p>${esc(user.bio)}</p>` : ''}
        <div class="kv" style="margin-top:8px"><span><b>${fmt(user.followers)}</b> followers</span><span><b>${fmt(user.following)}</b> following</span>${user.public_repos != null ? `<span><b>${fmt(user.public_repos)}</b> repos</span>` : ''}<span><b>${posts.length}</b> Gitgather posts</span></div>
        <div class="acts">${followBtn(user.login, false)}<a class="btn" href="https://github.com/${esc(user.login)}" target="_blank" rel="noopener">GitHub profile ↗</a></div>
        <p class="small muted" style="margin-top:8px">Follow happens on GitHub — Gitgather doesn't store any follow data.</p>
      </div>
    </div>
    ${err ? `<p class="note" style="margin-top:16px">${esc(err)}</p>` : ''}
    <div class="section-head" style="margin-top:28px"><h2>🚀 Gitgather posts</h2></div>
    ${posts.length ? `<div class="grid">${posts.map(p => card(p)).join('')}</div>` : emptyBox('🌱', 'No posts yet', 'This maker hasn\'t showcased a project on Gitgather yet.', false)}
    ${repos.length ? `<div class="section-head" style="margin-top:28px"><h2>📦 Recent public repos</h2></div>
    <div class="repos">${repos.map(r => `<div class="repo"><a class="n" href="${esc(r.html_url)}" target="_blank" rel="noopener">${esc(r.name)}</a>
      <p>${esc(r.description || '')}</p><div class="kv small">${r.language ? `<span>${esc(r.language)}</span>` : ''}<span>⭐ ${fmt(r.stargazers_count)}</span><span>${ago(r.pushed_at)}</span></div></div>`).join('')}</div>` : ''}`;
}
