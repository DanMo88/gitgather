/* Gitgather — vanilla JS + Supabase (no build step). */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://nlgaqedwnoemznusinoo.supabase.co';
// Publishable key: safe to ship in the browser. All access is enforced by Row Level Security.
export const SUPABASE_KEY = 'sb_publishable_UgfU-Kvs3vvZtkw96NR-Dw_Nuh_ddR7';
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  // Sign in once: the session (with its refresh token) lives in localStorage and is refreshed automatically,
  // so the installed app (PWA) and the website stay signed in across launches until the user signs out.
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storage: window.localStorage }
});

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const safeUrl = u => /^https:\/\//i.test(u || '') ? u : '';
export const fmt = n => n == null ? '–' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
export const qs = k => new URLSearchParams(location.search).get(k);
export function ago(iso) {
  if (!iso) return '';
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 45) return 'just now';
  for (const [k, l] of [[31536000, 'y'], [2592000, 'mo'], [604800, 'w'], [86400, 'd'], [3600, 'h'], [60, 'm']]) if (s >= k) return Math.floor(s / k) + l;
  return Math.floor(s) + 's';
}
export function toast(msg, bad = false) {
  const t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
}
export const repoPath = url => (url || '').replace(/^https:\/\/github\.com\//i, '').replace(/\/$/, '');
const ogImage = p => safeUrl(p.image_url) || (p.repo_url ? `https://opengraph.githubassets.com/gitgather/${repoPath(p.repo_url)}` : '');
const avatar = (u, size = 26) => `<img class="av" style="width:${size}px;height:${size}px" loading="lazy" src="${esc(safeUrl(u?.avatar_url) || 'assets/icons/icon-192.png')}" alt="">`;
const errMsg = e => (e?.message || String(e)).replace(/^.*?Slow down/, 'Slow down');

/* ---------- theme ---------- */
const currentTheme = () => localStorage.getItem('gg-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const b = $('#themeBtn'); if (b) b.textContent = t === 'dark' ? '☀️' : '🌙';
  const m = $('meta[name="theme-color"]'); if (m) m.content = t === 'dark' ? '#0b0f17' : '#f6f8fb';
}

/* ---------- auth ---------- */
export const APP_BASE = '/gitgather/';
export let me = null;      // my profile row (or null)
let providerReady = null;
async function githubEnabled() {
  if (providerReady != null) return providerReady;
  try { const r = await fetch(SUPABASE_URL + '/auth/v1/settings', { headers: { apikey: SUPABASE_KEY } }); providerReady = !!(await r.json()).external?.github; }
  catch { providerReady = true; }
  return providerReady;
}
export async function signIn() {
  if (!(await githubEnabled())) { toast('GitHub sign-in is being switched on — please try again soon.', true); return; }
  // Always come back to a page inside the app scope (/gitgather/), so the installed app reopens on return.
  const path = location.pathname.startsWith(APP_BASE) ? location.pathname + location.search : APP_BASE;
  await sb.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: location.origin + path } });
}
export async function signOut() { await sb.auth.signOut(); location.href = 'index.html'; }
export function requireMe(msg = 'Sign in with GitHub to do that.') {
  if (me) return true;
  toast(msg); return false;
}

/* ---------- layout ---------- */
export async function init(active = '') {
  applyTheme(currentTheme());
  const header = document.createElement('header');
  header.className = 'top';
  header.innerHTML = `<div class="wrap">
    <a class="brand" href="index.html"><img src="assets/logo.svg" alt="">Gitgather</a>
    <nav class="nav">
      <a href="index.html" class="hide-sm ${active === 'home' ? 'active' : ''}">Feed</a>
      <a href="index.html?tab=top" class="hide-sm ${active === 'top' ? 'active' : ''}">Top 100</a>
      <a class="keep btn sm primary" href="new.html">＋ Post</a>
      <a class="keep ico ${active === 'messages' ? 'active' : ''}" href="messages.html" title="Messages" id="navMsg" hidden>✉️<i class="badge" id="badgeMsg" hidden></i></a>
      <a class="keep ico ${active === 'notifications' ? 'active' : ''}" href="notifications.html" title="Notifications" id="navNotif" hidden>🔔<i class="badge" id="badgeNotif" hidden></i></a>
      <span id="authSlot" class="keep"></span>
      <button class="icon-btn keep" id="themeBtn" aria-label="Toggle theme"></button>
    </nav></div>`;
  document.body.prepend(header);
  const tab = document.createElement('nav');
  tab.className = 'tabbar';
  tab.innerHTML = [['index.html', 'home', '🏠', 'Feed'], ['index.html?tab=top', 'top', '🏆', 'Top 100'], ['new.html', 'new', '➕', 'Post'],
    ['messages.html', 'messages', '✉️', 'Chats'], ['notifications.html', 'notifications', '🔔', 'Alerts']]
    .map(([h, k, e, l]) => `<a href="${h}" class="${k === active ? 'active' : ''}"><span>${e}</span>${l}</a>`).join('');
  document.body.appendChild(tab);
  const footer = document.createElement('footer');
  footer.innerHTML = `<div class="wrap">
    <div><b>Gitgather</b> · The hangout for GitHub people<br><span class="small">Made by <b>Daniel Mozafari</b></span></div>
    <div class="small"><a href="https://github.com/DanMo88/gitgather">Source</a> · <a href="https://github.com/DanMo88/gitgather/blob/main/CODE_OF_CONDUCT.md">Code of Conduct</a> · <a href="settings.html">Settings</a> · <a href="#" data-install>📲 Install app</a> · <a href="https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies">GitHub AUP</a></div>
  </div>`;
  document.body.appendChild(footer);
  $('#themeBtn').onclick = () => { const t = currentTheme() === 'dark' ? 'light' : 'dark'; localStorage.setItem('gg-theme', t); applyTheme(t); };
  applyTheme(currentTheme());
  document.dispatchEvent(new Event('gg:layout'));

  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    for (let i = 0; i < 4 && !me; i++) {           // profile is created by a DB trigger on first sign-in
      const { data } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      me = data; if (!me) await new Promise(r => setTimeout(r, 600));
    }
  }
  const slot = $('#authSlot');
  if (me) {
    slot.innerHTML = `<a class="me" href="profile.html?u=${esc(me.username)}" title="Your profile">${avatar(me, 30)}</a>`;
    $('#navMsg').hidden = false; $('#navNotif').hidden = false;
    refreshBadges();
    sb.channel('me-' + me.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me.id}` }, p => {
        refreshBadges();
        const n = p.new; if (n.type === 'message' && active === 'messages') return;
        toast({ follow: '👤 New follower', like: '👍 New like', comment: '💬 New comment', star: '⭐ New star', message: '✉️ New message' }[n.type] || '🔔 New notification');
        document.dispatchEvent(new CustomEvent('gg:notification', { detail: n }));
      }).subscribe();
  } else {
    slot.innerHTML = `<button class="btn sm" id="signInBtn">Sign in</button>`;
    $('#signInBtn').onclick = signIn;
  }
  // Keep every open page/app window in sync with the stored session (sign-in/out in another tab, token refresh).
  sb.auth.onAuthStateChange((event, s) => {
    if (event === 'SIGNED_OUT' && me) location.reload();
    else if (event === 'SIGNED_IN' && !me && s?.user) location.reload();
  });
  return me;
}
export async function refreshBadges() {
  if (!me) return;
  const [{ count: n }, { count: m }] = await Promise.all([
    sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null).neq('type', 'message'),
    sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null).eq('type', 'message'),
  ]);
  const set = (el, v) => { el.hidden = !v; el.textContent = v > 99 ? '99+' : v; };
  set($('#badgeNotif'), n || 0); set($('#badgeMsg'), m || 0);
}

/* ---------- shared components ---------- */
export function emptyBox(icon, title, text, cta = '') {
  return `<div class="empty"><div class="big">${icon}</div><h3>${title}</h3><p>${text}</p>${cta}</div>`;
}
export function signInCta(text = 'Sign in with GitHub to join the conversation.') {
  return `<div class="panel signin-cta"><div><b>Join Gitgather</b><br><span class="muted small">${esc(text)}</span></div><button class="btn primary" data-signin>Sign in with GitHub</button></div>`;
}
document.addEventListener('click', e => { if (e.target.closest('[data-signin]')) { e.preventDefault(); signIn(); } });

export function card(p, rankInfo) {
  const extra = rankInfo ? `<span class="rank">#${rankInfo.rank}</span><span class="score">🔥 ${rankInfo.score}</span>` : '';
  const img = ogImage(p);
  return `<article class="card" data-post="${p.id}">
    <a href="post.html?id=${p.id}" class="shot">${img ? `<img loading="lazy" referrerpolicy="no-referrer" src="${esc(img)}" alt="" onerror="this.remove()">` : ''}<span class="mono">${esc(repoPath(p.repo_url))}</span>${extra}</a>
    <div class="body">
      <h3><a href="post.html?id=${p.id}">${esc(p.title)}</a></h3>
      ${p.body ? `<p>${esc(p.body)}</p>` : ''}
      ${p.tags?.length ? `<div class="tags">${p.tags.map(t => `<a class="tag" href="index.html?tag=${encodeURIComponent(t)}">#${esc(t)}</a>`).join('')}</div>` : ''}
    </div>
    <div class="actions">
      <button class="act ${p.liked_by_me ? 'on' : ''}" data-like="${p.id}" title="Like">👍 <b>${fmt(p.like_count)}</b></button>
      <a class="act" href="post.html?id=${p.id}#comments" title="Comments">💬 <b>${fmt(p.comment_count)}</b></a>
      <button class="act ${p.starred_by_me ? 'on' : ''}" data-star="${p.id}" title="Star in Gitgather (saves it to your stars)">✨ <b>${fmt(p.star_count)}</b></button>
      <a class="act gh" href="${esc(p.repo_url)}" target="_blank" rel="noopener" title="Star on GitHub">⭐ <b>${fmt(p.repo_stars)}</b></a>
    </div>
    <div class="foot">
      <a class="who" href="profile.html?u=${esc(p.username)}">${avatar(p)}<span>${esc(p.author_name || p.username)}<br><small>@${esc(p.username)} · ${ago(p.created_at)}</small></span></a>
      <span class="spacer"></span>
      ${me && me.id !== p.author_id ? `<button class="btn sm ${p.author_followed_by_me ? '' : 'primary-ghost'}" data-follow="${p.author_id}" data-on="${p.author_followed_by_me ? 1 : 0}">${p.author_followed_by_me ? 'Following' : '＋ Follow'}</button>` : ''}
    </div></article>`;
}

// Delegated like / star / follow handlers for any page.
document.addEventListener('click', async e => {
  const like = e.target.closest('[data-like]'), star = e.target.closest('[data-star]'), fol = e.target.closest('[data-follow]');
  if (!like && !star && !fol) return;
  e.preventDefault();
  if (!requireMe()) return;
  const btn = like || star || fol;
  btn.disabled = true;
  try {
    if (fol) {
      const id = fol.dataset.follow, on = fol.dataset.on === '1';
      const { error } = on ? await sb.from('follows').delete().match({ follower_id: me.id, following_id: id })
                           : await sb.from('follows').insert({ follower_id: me.id, following_id: id });
      if (error) throw error;
      $$(`[data-follow="${id}"]`).forEach(b => { b.dataset.on = on ? '0' : '1'; b.textContent = on ? '＋ Follow' : 'Following'; b.classList.toggle('primary-ghost', on); });
      document.dispatchEvent(new CustomEvent('gg:follow', { detail: { id, on: !on } }));
    } else {
      const table = like ? 'likes' : 'post_stars', id = Number(btn.dataset.like || btn.dataset.star), on = btn.classList.contains('on');
      const { error } = on ? await sb.from(table).delete().match({ post_id: id, user_id: me.id })
                           : await sb.from(table).insert({ post_id: id, user_id: me.id });
      if (error) throw error;
      btn.classList.toggle('on', !on);
      const b = btn.querySelector('b'); b.textContent = Math.max(0, (parseInt(b.textContent, 10) || 0) + (on ? -1 : 1));
    }
  } catch (err) { toast(errMsg(err), true); }
  btn.disabled = false;
});

// Ask the edge function to refresh cached GitHub star counts (max once per 30 min per post).
export function refreshStars(posts) {
  const stale = posts.filter(p => !p.repo_stars_updated_at || Date.now() - Date.parse(p.repo_stars_updated_at) > 30 * 60 * 1000).map(p => p.id).slice(0, 20);
  if (!stale.length) return;
  sb.functions.invoke('repo-stars', { body: { post_ids: stale } }).then(({ data }) => {
    for (const u of data?.updated || []) $$(`[data-post="${u.id}"] .act.gh b, [data-repo-stars="${u.id}"]`).forEach(el => el.textContent = fmt(u.stars));
  }).catch(() => {});
}

/* ---------- report dialog ---------- */
export function report(target_type, target_id) {
  if (!requireMe('Sign in to report.')) return;
  const d = document.createElement('dialog');
  d.className = 'dlg';
  d.innerHTML = `<form method="dialog">
    <h3>Report ${esc(target_type)}</h3>
    <p class="muted small">Reports are private and only visible to Gitgather admins.</p>
    <label>Reason<select name="reason" required>
      <option value="spam">Spam</option><option value="harassment">Harassment or hate</option>
      <option value="star_trading">Star / follow trading</option><option value="inappropriate">Inappropriate content</option>
      <option value="impersonation">Impersonation</option><option value="malware">Malware or phishing</option><option value="other">Other</option></select></label>
    <label>Details (optional)<textarea name="details" maxlength="1000" rows="3"></textarea></label>
    <div class="row-btns"><button class="btn" value="cancel">Cancel</button><button class="btn primary" value="ok">Send report</button></div>
  </form>`;
  document.body.appendChild(d); d.showModal();
  d.addEventListener('close', async () => {
    if (d.returnValue === 'ok') {
      const f = new FormData(d.querySelector('form'));
      const { error } = await sb.from('reports').insert({ reporter_id: me.id, target_type, target_id: String(target_id), reason: f.get('reason'), details: f.get('details') || null });
      toast(error ? errMsg(error) : 'Thanks — report sent to the admins.', !!error);
    }
    d.remove();
  });
}

export function confirmBox(title, text, okLabel = 'Confirm') {
  return new Promise(res => {
    const d = document.createElement('dialog'); d.className = 'dlg';
    d.innerHTML = `<form method="dialog"><h3>${esc(title)}</h3><p class="muted">${esc(text)}</p><div class="row-btns"><button class="btn" value="no">Cancel</button><button class="btn danger" value="ok">${esc(okLabel)}</button></div></form>`;
    document.body.appendChild(d); d.showModal();
    d.addEventListener('close', () => { res(d.returnValue === 'ok'); d.remove(); });
  });
}

export function userRow(u, extra = '') {
  return `<div class="urow">${avatar(u, 40)}<a href="profile.html?u=${esc(u.username)}"><b>${esc(u.name || u.username)}</b><br><small class="muted">@${esc(u.username)}</small></a><span class="spacer"></span>${extra}</div>`;
}
export { avatar, errMsg, ogImage };
