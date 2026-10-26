import { sb, me, init, $, $$, esc, fmt, ago, qs, toast, card, emptyBox, signInCta, refreshStars, report, confirmBox,
  userRow, avatar, errMsg, ogImage, repoPath, safeUrl, refreshBadges, signIn, signOut } from './app.js';

const CARD_COLS = '*';

/* ================= FEED ================= */
export async function pageFeed() {
  const tab0 = qs('tab') || 'latest';
  await init(tab0 === 'top' ? 'top' : 'home');
  const tag = qs('tag');
  let tab = tab0;
  const hero = $('#hero');
  if (me) hero.querySelector('.cta').innerHTML = `<a class="btn primary" href="new.html">＋ Post your project</a><a class="btn" href="profile.html?u=${esc(me.username)}">👤 My profile</a><a class="btn" href="messages.html">✉️ Messages</a>`;
  const stats = await Promise.all([
    sb.from('posts').select('id', { count: 'exact', head: true }),
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('follows').select('follower_id', { count: 'exact', head: true }),
  ]);
  $('#stats').innerHTML = `<div class="stat"><b>${fmt(stats[0].count || 0)}</b><span>projects</span></div><div class="stat"><b>${fmt(stats[1].count || 0)}</b><span>makers</span></div><div class="stat"><b>${fmt(stats[2].count || 0)}</b><span>follows</span></div>`;

  const render = async () => {
    $$('.seg button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    $('#feedTitle').textContent = { latest: '✨ Latest', following: '👥 Following', top: '🏆 Top 100 · 24h' }[tab] + (tag ? ` · #${tag}` : '');
    $('#feedNote').textContent = tab === 'top' ? 'Ranked by comments (3), likes (2) and stars (2) in the last 24h, newer activity counts more.' : '';
    const feed = $('#feed');
    feed.innerHTML = `<div class="grid"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`;
    let posts = [], ranks = null;
    if (tab === 'top') {
      const { data: top, error } = await sb.rpc('top_posts_24h', { max_rows: 100 });
      if (error) { feed.innerHTML = emptyBox('⚠️', 'Could not load', esc(error.message)); return; }
      if (top.length) {
        const { data } = await sb.from('post_cards').select(CARD_COLS).in('id', top.map(t => t.id));
        const by = new Map((data || []).map(p => [p.id, p]));
        ranks = top.map((t, i) => ({ ...t, rank: i + 1, post: by.get(t.id) })).filter(r => r.post);
      }
      if (!ranks?.length) { feed.innerHTML = emptyBox('🌱', 'Nothing trending yet today', 'Like, star and comment on projects — the hottest posts of the last 24 hours show up here.', `<a class="btn primary" href="index.html">See latest posts</a>`); return; }
      const podium = ranks.slice(0, 3), rest = ranks.slice(3);
      feed.innerHTML = `<div class="grid">${podium.map(r => card(r.post, r)).join('')}</div>` + (rest.length ? `<div class="board">${rest.map(r => `
        <a class="row" href="post.html?id=${r.id}"><div class="n">${r.rank}</div>
          <div><h3>${esc(r.post.title)}</h3><div class="meta">@${esc(r.post.username)} · 💬 ${r.comments_24h} · 👍 ${r.likes_24h} · ✨ ${r.stars_24h} today</div></div>
          <div class="pts">🔥 ${r.score}<small>points</small></div></a>`).join('')}</div>` : '');
      refreshStars(podium.map(r => r.post));
      return;
    }
    let q = sb.from('post_cards').select(CARD_COLS).order('created_at', { ascending: false }).limit(60);
    if (tab === 'following') {
      if (!me) { feed.innerHTML = signInCta('Sign in to see posts from people you follow.'); return; }
      q = q.eq('author_followed_by_me', true);
    }
    if (tag) q = q.contains('tags', [tag]);
    const term = $('#q').value.trim();
    if (term) q = q.or(`title.ilike.%${term.replace(/[%,()]/g, '')}%,body.ilike.%${term.replace(/[%,()]/g, '')}%,username.ilike.%${term.replace(/[%,()]/g, '')}%`);
    const { data, error } = await q;
    if (error) { feed.innerHTML = emptyBox('⚠️', 'Could not load', esc(error.message)); return; }
    posts = data;
    if (!posts.length) {
      feed.innerHTML = tab === 'following'
        ? emptyBox('👥', 'Your following feed is empty', 'Follow makers from their profile or a post card — there is no limit.', `<a class="btn primary" href="index.html">Discover projects</a>`)
        : emptyBox('🔭', term || tag ? 'No matches' : 'No projects yet', term || tag ? 'Try another search.' : 'Be the very first to showcase a project on Gitgather!', `<a class="btn primary" href="new.html">＋ Post your project</a>`);
      return;
    }
    feed.innerHTML = `<div class="grid">${posts.map(p => card(p)).join('')}</div>`;
    refreshStars(posts);
  };
  $$('.seg button').forEach(b => b.onclick = () => { tab = b.dataset.tab; history.replaceState(null, '', '?tab=' + tab + (tag ? '&tag=' + encodeURIComponent(tag) : '')); render(); });
  let t; $('#q').oninput = () => { clearTimeout(t); t = setTimeout(() => { if (tab === 'top') tab = 'latest'; render(); }, 300); };
  render();
}

/* ================= POST ================= */
export async function pagePost() {
  await init('');
  const id = Number(qs('id'));
  const box = $('#post');
  const { data: p } = id ? await sb.from('post_cards').select('*').eq('id', id).maybeSingle() : { data: null };
  if (!p) { box.innerHTML = emptyBox('🙈', 'Post not found', 'It may have been removed, or it is from someone you blocked or who blocked you.', `<a class="btn" href="index.html">Back to the feed</a>`); return; }
  document.title = p.title + ' · Gitgather';
  const mine = me && me.id === p.author_id;
  const img = ogImage(p);
  box.innerHTML = `<div class="post">
    <div class="panel" data-post="${p.id}">
      <div class="meta"><a class="who" href="profile.html?u=${esc(p.username)}">${avatar(p, 34)}<span>${esc(p.author_name || p.username)}<br><small>@${esc(p.username)} · ${ago(p.created_at)} ago</small></span></a>
        <span class="spacer"></span>
        ${me && !mine ? `<button class="btn sm ${p.author_followed_by_me ? '' : 'primary-ghost'}" data-follow="${p.author_id}" data-on="${p.author_followed_by_me ? 1 : 0}">${p.author_followed_by_me ? 'Following' : '＋ Follow'}</button>` : ''}
        <div class="menu"><button class="icon-btn" id="moreBtn" aria-label="More">⋯</button><div class="menu-list" id="moreList" hidden>
          ${mine || me?.is_admin ? `<button data-act="delete">🗑️ Delete post</button>` : ''}
          ${!mine ? `<button data-act="report">🚩 Report post</button>` : ''}
          <button data-act="copy">🔗 Copy link</button></div></div>
      </div>
      <h1>${esc(p.title)}</h1>
      ${img ? `<a class="hero-shot" href="${esc(p.repo_url)}" target="_blank" rel="noopener"><img referrerpolicy="no-referrer" src="${esc(img)}" alt="Project image" onerror="this.parentNode.remove()"></a>` : ''}
      <div class="desc">${esc(p.body)}</div>
      ${p.tags?.length ? `<div class="tags">${p.tags.map(t => `<a class="tag" href="index.html?tag=${encodeURIComponent(t)}">#${esc(t)}</a>`).join('')}</div>` : ''}
      <div class="actions big">
        <button class="act ${p.liked_by_me ? 'on' : ''}" data-like="${p.id}">👍 Like <b>${fmt(p.like_count)}</b></button>
        <button class="act ${p.starred_by_me ? 'on' : ''}" data-star="${p.id}">✨ Star <b>${fmt(p.star_count)}</b></button>
        <a class="act gh" href="${esc(p.repo_url)}" target="_blank" rel="noopener">⭐ Star on GitHub <b data-repo-stars="${p.id}">${fmt(p.repo_stars)}</b></a>
      </div>
      <h3 id="comments">💬 Comments <span class="muted" id="cCount">${p.comment_count}</span></h3>
      <div id="cForm"></div>
      <div id="cList" class="comments"></div>
    </div>
    <aside class="side">
      <div class="panel repo-box"><span class="small muted">Repository</span>
        <a class="name" href="${esc(p.repo_url)}" target="_blank" rel="noopener">${esc(repoPath(p.repo_url))}</a>
        <div class="kv"><span>⭐ <b data-repo-stars="${p.id}">${fmt(p.repo_stars)}</b> GitHub stars</span></div>
        <a class="btn" href="${esc(p.repo_url)}" target="_blank" rel="noopener">⭐ Star on GitHub ↗</a>
        <span class="small muted">✨ Gitgather stars save a post to your profile and count for the Top 100. ⭐ GitHub stars live on GitHub.</span>
      </div>
    </aside></div>`;
  refreshStars([p]);
  $('#moreBtn').onclick = () => $('#moreList').hidden = !$('#moreList').hidden;
  $('#moreList').onclick = async e => {
    const a = e.target.closest('[data-act]')?.dataset.act; $('#moreList').hidden = true;
    if (a === 'copy') { navigator.clipboard?.writeText(location.href); toast('Link copied'); }
    if (a === 'report') report('post', p.id);
    if (a === 'delete' && await confirmBox('Delete this post?', 'This removes the post with its likes, stars and comments.', 'Delete')) {
      const { error } = await sb.from('posts').delete().eq('id', p.id);
      if (error) toast(errMsg(error), true); else location.href = 'index.html';
    }
  };
  $('#cForm').innerHTML = me ? `<form class="composer" id="cf">${avatar(me, 34)}<textarea name="body" maxlength="2000" rows="2" placeholder="Write a kind, helpful comment…" required></textarea><button class="btn primary">Send</button></form>` : signInCta('Sign in with GitHub to comment.');
  const loadComments = async () => {
    const { data } = await sb.from('comments').select('id, body, created_at, author_id, author:profiles!comments_author_id_fkey(username, name, avatar_url)').eq('post_id', p.id).order('created_at');
    $('#cCount').textContent = data?.length ?? 0;
    $('#cList').innerHTML = data?.length ? data.map(c => `<div class="comment" id="c${c.id}">${avatar(c.author, 32)}
      <div class="cbody"><div class="meta"><a href="profile.html?u=${esc(c.author.username)}"><b>${esc(c.author.name || c.author.username)}</b></a><small>@${esc(c.author.username)} · ${ago(c.created_at)}</small>
      <span class="spacer"></span>${me && (me.id === c.author_id || mine || me.is_admin) ? `<button class="link" data-del="${c.id}">Delete</button>` : ''}${me && me.id !== c.author_id ? `<button class="link" data-rep="${c.id}">Report</button>` : ''}</div>
      <div class="ctext">${esc(c.body)}</div></div></div>`).join('') : `<p class="muted">No comments yet — start the conversation!</p>`;
  };
  $('#cList').onclick = async e => {
    const del = e.target.closest('[data-del]'), rep = e.target.closest('[data-rep]');
    if (rep) report('comment', rep.dataset.rep);
    if (del && await confirmBox('Delete comment?', 'This cannot be undone.', 'Delete')) {
      const { error } = await sb.from('comments').delete().eq('id', del.dataset.del); if (error) toast(errMsg(error), true); loadComments();
    }
  };
  if (me) $('#cf').onsubmit = async e => {
    e.preventDefault(); const f = e.target, body = f.body.value.trim(); if (!body) return;
    f.querySelector('button').disabled = true;
    const { error } = await sb.from('comments').insert({ post_id: p.id, author_id: me.id, body });
    f.querySelector('button').disabled = false;
    if (error) return toast(errMsg(error), true);
    f.reset(); loadComments();
  };
  loadComments();
}

/* ================= NEW POST ================= */
export async function pageNew() {
  await init('new');
  const box = $('#newPost');
  if (!me) { box.innerHTML = signInCta('Sign in with GitHub to showcase your project.'); return; }
  const f = $('#pf'); f.hidden = false;
  const preview = () => {
    const url = f.repo.value.trim().replace(/\/$/, '');
    const ok = /^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/i.test(url);
    $('#repoHint').textContent = !url ? '' : ok ? '✓ Looks good' : 'Use a full link like https://github.com/owner/repo';
    $('#repoHint').className = 'small ' + (ok ? 'good' : 'bad');
    const img = safeUrl(f.image.value.trim()) || (ok ? `https://opengraph.githubassets.com/gitgather/${repoPath(url)}` : '');
    $('#preview').innerHTML = img ? `<img referrerpolicy="no-referrer" src="${esc(img)}" alt="" onerror="this.remove()">` : '<span class="muted">Image preview</span>';
    return ok;
  };
  f.repo.oninput = f.image.oninput = preview;
  f.repo.onblur = async () => {
    if (!preview() || f.title.value) return;
    try { const r = await fetch('https://api.github.com/repos/' + repoPath(f.repo.value.trim())); if (r.ok) { const j = await r.json(); f.title.value ||= j.name; f.body.value ||= j.description || ''; f.tags.value ||= (j.topics || []).slice(0, 6).join(', '); } } catch {}
  };
  f.onsubmit = async e => {
    e.preventDefault();
    if (!preview()) return toast('Please enter a valid GitHub repository link.', true);
    const tags = f.tags.value.split(/[,#\s]+/).map(t => t.toLowerCase().replace(/[^a-z0-9+.#_-]/g, '')).filter(Boolean).slice(0, 6);
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
    const { data, error } = await sb.from('posts').insert({
      author_id: me.id, repo_url: f.repo.value.trim().replace(/\/$/, ''), title: f.title.value.trim(), body: f.body.value.trim(),
      tags, image_url: safeUrl(f.image.value.trim()) || null,
    }).select('id').single();
    btn.disabled = false;
    if (error) return toast(errMsg(error), true);
    location.href = 'post.html?id=' + data.id;
  };
}

/* ================= PROFILE ================= */
export async function pageProfile() {
  await init('profile');
  const u = qs('u') || me?.username;
  const box = $('#profile');
  if (!u) { box.innerHTML = signInCta('Sign in to see your profile.'); return; }
  const { data: pr } = await sb.from('profile_cards').select('*').ilike('username', u.replace(/[%_]/g, '')).maybeSingle();
  if (!pr) {
    box.innerHTML = emptyBox('🔍', 'Not on Gitgather yet', `@${esc(u)} hasn't joined Gitgather.`, `<a class="btn" href="https://github.com/${esc(u)}" target="_blank" rel="noopener">View on GitHub ↗</a>`); return;
  }
  document.title = (pr.name || pr.username) + ' · Gitgather';
  box.innerHTML = '';
  const self = me && me.id === pr.id;
  const followLabel = () => pr.followed_by_me ? 'Following' : pr.follows_me ? '↩︎ Follow back' : '＋ Follow';
  const paint = () => {
    box.querySelector('.prof')?.remove();
    const head = document.createElement('div'); head.className = 'prof';
    head.innerHTML = `${avatar(pr, 120)}
      <div>
        <h1>${esc(pr.name || pr.username)} ${pr.is_admin ? '<span class="pill sm">🛡️ admin</span>' : ''}</h1>
        <div class="muted">@${esc(pr.username)} ${pr.follows_me && !self ? '<span class="pill sm">Follows you</span>' : ''}</div>
        ${pr.bio ? `<p>${esc(pr.bio)}</p>` : ''}
        ${safeUrl(pr.website) || /^http:\/\//.test(pr.website || '') ? `<a class="small" href="${esc(pr.website)}" target="_blank" rel="noopener nofollow ugc">🔗 ${esc(pr.website.replace(/^https?:\/\//, ''))}</a>` : ''}
        <div class="kv" style="margin-top:8px">
          <button class="link" data-list="followers"><b>${fmt(pr.followers_count)}</b> followers</button>
          <button class="link" data-list="following"><b>${fmt(pr.following_count)}</b> following</button>
          <span><b>${fmt(pr.posts_count)}</b> posts</span></div>
        <div class="acts">
          ${self ? `<a class="btn" href="settings.html">⚙️ Edit profile & settings</a>` : pr.blocked_by_me
            ? `<button class="btn danger" id="unblockBtn">Unblock</button>`
            : `<button class="btn ${pr.followed_by_me ? '' : 'primary'}" id="followBtn">${followLabel()}</button>
               <button class="btn" id="msgBtn">✉️ Message</button>`}
          <a class="btn" href="https://github.com/${esc(pr.username)}" target="_blank" rel="noopener">GitHub ↗</a>
          ${!self ? `<div class="menu"><button class="icon-btn" id="moreBtn" aria-label="More">⋯</button><div class="menu-list" id="moreList" hidden>
             ${pr.blocked_by_me ? '' : `<button data-act="block">⛔ Block @${esc(pr.username)}</button>`}
             <button data-act="report">🚩 Report user</button></div></div>` : ''}
        </div>
      </div>`;
    box.prepend(head);
    $('#followBtn') && ($('#followBtn').onclick = async () => {
      if (!me) return signIn();
      const on = pr.followed_by_me;
      const { error } = on ? await sb.from('follows').delete().match({ follower_id: me.id, following_id: pr.id })
                           : await sb.from('follows').insert({ follower_id: me.id, following_id: pr.id });
      if (error) return toast(errMsg(error), true);
      pr.followed_by_me = !on; pr.followers_count += on ? -1 : 1; paint();
    });
    $('#msgBtn') && ($('#msgBtn').onclick = () => me ? location.href = 'messages.html?to=' + encodeURIComponent(pr.username) : signIn());
    $('#unblockBtn') && ($('#unblockBtn').onclick = async () => {
      await sb.from('blocks').delete().match({ blocker_id: me.id, blocked_id: pr.id }); pr.blocked_by_me = false; toast('Unblocked'); location.reload();
    });
    $('#moreBtn') && ($('#moreBtn').onclick = () => $('#moreList').hidden = !$('#moreList').hidden);
    $('#moreList') && ($('#moreList').onclick = async e => {
      const a = e.target.closest('[data-act]')?.dataset.act; $('#moreList').hidden = true;
      if (a === 'report') report('user', pr.id);
      if (a === 'block') {
        if (!me) return signIn();
        if (!(await confirmBox(`Block @${pr.username}?`, 'You will no longer see each other\'s posts, comments or likes, follows between you are removed, and neither of you can message or follow the other.', 'Block'))) return;
        const { error } = await sb.from('blocks').insert({ blocker_id: me.id, blocked_id: pr.id });
        if (error) return toast(errMsg(error), true);
        toast('Blocked'); location.reload();
      }
    });
    $$('[data-list]', head).forEach(b => b.onclick = () => showList(b.dataset.list));
  };
  const showList = async which => {
    const col = which === 'followers' ? 'follower_id' : 'following_id', other = which === 'followers' ? 'following_id' : 'follower_id';
    const { data } = await sb.from('follows').select(`created_at, user:profiles!follows_${col}_fkey(id, username, name, avatar_url)`).eq(other, pr.id).order('created_at', { ascending: false }).limit(500);
    let mine = new Set();
    if (me && data?.length) {
      const { data: f } = await sb.from('follows').select('following_id').eq('follower_id', me.id).in('following_id', data.map(r => r.user.id));
      mine = new Set((f || []).map(r => r.following_id));
    }
    const d = document.createElement('dialog'); d.className = 'dlg wide';
    d.innerHTML = `<form method="dialog"><div class="dlg-head"><h3>${which === 'followers' ? 'Followers' : 'Following'} · ${esc(pr.username)}</h3><button class="icon-btn" value="x">✕</button></div>
      <div class="ulist">${data?.length ? data.map(r => userRow(r.user, me && me.id !== r.user.id ? `<button type="button" class="btn sm ${mine.has(r.user.id) ? '' : 'primary-ghost'}" data-follow="${r.user.id}" data-on="${mine.has(r.user.id) ? 1 : 0}">${mine.has(r.user.id) ? 'Following' : '＋ Follow'}</button>` : '')).join('') : '<p class="muted">Nobody yet.</p>'}</div></form>`;
    document.body.appendChild(d); d.showModal(); d.addEventListener('close', () => d.remove());
  };
  paint();
  const tabs = document.createElement('div');
  tabs.innerHTML = `<div class="section-head" style="margin-top:28px"><div class="seg"><button class="on" data-t="posts">🚀 Posts</button><button data-t="stars">✨ Stars</button></div></div><div id="ptab"></div>`;
  box.appendChild(tabs);
  const loadTab = async t => {
    $$('[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    let data;
    if (t === 'posts') ({ data } = await sb.from('post_cards').select('*').eq('author_id', pr.id).order('created_at', { ascending: false }).limit(60));
    else {
      const { data: s } = await sb.from('post_stars').select('post_id').eq('user_id', pr.id).order('created_at', { ascending: false }).limit(60);
      ({ data } = s?.length ? await sb.from('post_cards').select('*').in('id', s.map(x => x.post_id)) : { data: [] });
    }
    $('#ptab').innerHTML = data?.length ? `<div class="grid">${data.map(p => card(p)).join('')}</div>` : emptyBox(t === 'posts' ? '🌱' : '✨', t === 'posts' ? 'No posts yet' : 'No stars yet', t === 'posts' ? (self ? 'Showcase your first project!' : 'Nothing showcased yet.') : 'Posts starred on Gitgather show up here.', self && t === 'posts' ? `<a class="btn primary" href="new.html">＋ Post your project</a>` : '');
    if (data?.length) refreshStars(data);
  };
  $$('[data-t]').forEach(b => b.onclick = () => loadTab(b.dataset.t));
  loadTab('posts');
}

/* ================= MESSAGES ================= */
export async function pageMessages() {
  await init('messages');
  const box = $('#messages');
  if (!me) { box.innerHTML = signInCta('Sign in to send private messages.'); return; }
  box.innerHTML = `<div class="chat"><aside class="inbox" id="inbox"></aside><section class="thread" id="thread">${emptyBox('✉️', 'Your messages', 'Private 1:1 chats with other makers. Open someone\'s profile and tap “Message”.')}</section></div>`;
  let current = null, channel = null;
  const loadInbox = async () => {
    const { data: convs } = await sb.from('conversations').select('id, user_a, user_b, last_message_at').order('last_message_at', { ascending: false }).limit(100);
    if (!convs?.length) { $('#inbox').innerHTML = '<p class="muted small" style="padding:14px">No conversations yet.</p>'; return []; }
    const others = convs.map(c => c.user_a === me.id ? c.user_b : c.user_a);
    const [{ data: people }, { data: unread }, { data: blocks }] = await Promise.all([
      sb.from('profiles').select('id, username, name, avatar_url').in('id', others),
      sb.from('notifications').select('conversation_id').eq('type', 'message').is('read_at', null),
      sb.from('blocks').select('blocked_id'),
    ]);
    const by = new Map(people.map(p => [p.id, p])), un = new Set((unread || []).map(n => n.conversation_id)), bl = new Set((blocks || []).map(b => b.blocked_id));
    const list = convs.map(c => ({ ...c, other: by.get(c.user_a === me.id ? c.user_b : c.user_a) })).filter(c => c.other);
    $('#inbox').innerHTML = `<div class="inbox-head">Chats <span class="muted small">🔒 private</span></div>` + list.map(c => `
      <a class="conv ${current === c.id ? 'on' : ''} ${un.has(c.id) ? 'unread' : ''}" href="?c=${c.id}" data-c="${c.id}">${avatar(c.other, 40)}
        <span><b>${esc(c.other.name || c.other.username)}</b><br><small class="muted">@${esc(c.other.username)}${bl.has(c.other.id) ? ' · blocked' : ''}</small></span><small class="muted when">${ago(c.last_message_at)}</small></a>`).join('');
    $$('#inbox [data-c]').forEach(a => a.onclick = e => { e.preventDefault(); openConv(a.dataset.c, list.find(c => c.id === a.dataset.c).other); });
    return list;
  };
  const openConv = async (cid, other) => {
    current = cid; history.replaceState(null, '', '?c=' + cid);
    $$('#inbox .conv').forEach(a => a.classList.toggle('on', a.dataset.c === cid));
    box.querySelector('.chat').classList.add('open');
    $('#thread').innerHTML = `<div class="thread-head"><button class="icon-btn back" id="backBtn">←</button>${avatar(other, 36)}<a href="profile.html?u=${esc(other.username)}"><b>${esc(other.name || other.username)}</b><br><small class="muted">@${esc(other.username)}</small></a><span class="spacer"></span><button class="link" id="repUser">Report</button></div>
      <div class="msgs" id="msgs"></div>
      <form class="composer" id="mf"><textarea name="body" rows="1" maxlength="4000" placeholder="Write a message…" required></textarea><button class="btn primary">Send</button></form>`;
    $('#backBtn').onclick = () => box.querySelector('.chat').classList.remove('open');
    $('#repUser').onclick = () => report('user', other.id);
    const bubble = m => `<div class="msg ${m.sender_id === me.id ? 'mine' : ''}" data-m="${m.id}"><div class="bubble">${esc(m.body)}</div><small class="muted">${ago(m.created_at)}${m.sender_id === me.id && m.read_at ? ' · seen' : ''}${m.sender_id !== me.id ? ` · <button class="link" data-rep-msg="${m.id}">report</button>` : ''}</small></div>`;
    const { data: msgs } = await sb.from('messages').select('*').eq('conversation_id', cid).order('created_at', { ascending: true }).limit(500);
    const el = $('#msgs');
    el.innerHTML = msgs?.length ? msgs.map(bubble).join('') : '<p class="muted small center">Say hi 👋 — only the two of you can read this chat.</p>';
    el.scrollTop = el.scrollHeight;
    el.onclick = e => { const r = e.target.closest('[data-rep-msg]'); if (r) report('message', r.dataset.repMsg); };
    const markRead = async () => {
      await sb.from('messages').update({ read_at: new Date().toISOString() }).eq('conversation_id', cid).neq('sender_id', me.id).is('read_at', null);
      await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('conversation_id', cid).is('read_at', null);
      refreshBadges(); $(`#inbox [data-c="${cid}"]`)?.classList.remove('unread');
    };
    markRead();
    if (channel) sb.removeChannel(channel);
    channel = sb.channel('conv-' + cid).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${cid}` }, p => {
      if (el.querySelector(`[data-m="${p.new.id}"]`)) return;
      el.querySelector('p.center')?.remove();
      el.insertAdjacentHTML('beforeend', bubble(p.new)); el.scrollTop = el.scrollHeight;
      if (p.new.sender_id !== me.id) markRead();
    }).subscribe();
    const f = $('#mf');
    f.body.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } };
    f.onsubmit = async e => {
      e.preventDefault(); const body = f.body.value.trim(); if (!body) return;
      f.body.value = '';
      const { data, error } = await sb.from('messages').insert({ conversation_id: cid, sender_id: me.id, body }).select().single();
      if (error) { f.body.value = body; return toast(/row-level security/i.test(error.message) ? 'You can\'t message this person.' : errMsg(error), true); }
      if (!el.querySelector(`[data-m="${data.id}"]`)) { el.querySelector('p.center')?.remove(); el.insertAdjacentHTML('beforeend', bubble(data)); el.scrollTop = el.scrollHeight; }
    };
    f.body.focus();
  };
  const list = await loadInbox();
  document.addEventListener('gg:notification', e => { if (e.detail.type === 'message') loadInbox(); });
  const to = qs('to'), c = qs('c');
  if (to) {
    const { data: other } = await sb.from('profiles').select('id, username, name, avatar_url').ilike('username', to.replace(/[%_]/g, '')).maybeSingle();
    if (!other) return toast('User not found', true);
    const { data: cid, error } = await sb.rpc('open_conversation', { other: other.id });
    if (error) return toast(/row-level security/i.test(error.message) ? 'You can\'t message this person.' : errMsg(error), true);
    await loadInbox(); openConv(cid, other);
  } else if (c) {
    const conv = list.find(x => x.id === c); if (conv) openConv(c, conv.other);
  }
}

/* ================= NOTIFICATIONS ================= */
export async function pageNotifications() {
  await init('notifications');
  const box = $('#notifs');
  if (!me) { box.innerHTML = signInCta('Sign in to see your notifications.'); return; }
  const load = async () => {
    const { data } = await sb.from('notifications').select('*, actor:profiles!notifications_actor_id_fkey(username, name, avatar_url), post:posts(title)').order('created_at', { ascending: false }).limit(100);
    if (!data?.length) { box.innerHTML = emptyBox('🔔', 'All quiet', 'Follows, likes, stars, comments and messages show up here in real time.'); return; }
    const txt = { follow: 'started following you', like: 'liked', star: 'starred', comment: 'commented on', message: 'sent you a message' };
    const ico = { follow: '👤', like: '👍', star: '✨', comment: '💬', message: '✉️' };
    box.innerHTML = data.map(n => {
      const href = n.type === 'follow' ? `profile.html?u=${esc(n.actor?.username)}` : n.type === 'message' ? `messages.html?c=${n.conversation_id}` : `post.html?id=${n.post_id}${n.type === 'comment' ? '#comments' : ''}`;
      return `<a class="notif ${n.read_at ? '' : 'unread'}" href="${href}"><span class="nico">${ico[n.type]}</span>${avatar(n.actor, 36)}
        <span><b>${esc(n.actor?.name || n.actor?.username || 'Someone')}</b> ${txt[n.type]} ${n.post ? `<b>${esc(n.post.title)}</b>` : ''}<br><small class="muted">${ago(n.created_at)}</small></span></a>`;
    }).join('');
  };
  await load();
  $('#markAll').hidden = false;
  $('#markAll').onclick = async () => { await sb.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null).neq('type', 'message'); refreshBadges(); load(); };
  document.addEventListener('gg:notification', load);
  setTimeout(async () => { await sb.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null).neq('type', 'message'); refreshBadges(); }, 2500);
}

/* ================= SETTINGS ================= */
export async function pageSettings() {
  await init('settings');
  const box = $('#settings');
  if (!me) { box.innerHTML = signInCta('Sign in to manage your account.'); return; }
  box.innerHTML = `
    <div class="panel"><h3>👤 Profile</h3>
      <form id="sf" class="form">
        <label>Display name<input name="name" maxlength="80" value="${esc(me.name || '')}"></label>
        <label>Bio<textarea name="bio" maxlength="300" rows="3">${esc(me.bio || '')}</textarea></label>
        <label>Website<input name="website" type="url" placeholder="https://…" value="${esc(me.website || '')}"></label>
        <p class="small muted">Username and avatar come from your GitHub account (@${esc(me.username)}).</p>
        <button class="btn primary">Save</button></form></div>
    <div class="panel"><h3>⛔ Blocked users</h3><div id="blocked" class="ulist"></div></div>
    <div class="panel"><h3>🔐 Account</h3>
      <div class="acts"><button class="btn" id="outBtn">Sign out</button>
      <button class="btn danger" id="delBtn" ${me.deletion_requested_at ? 'disabled' : ''}>${me.deletion_requested_at ? 'Deletion requested ' + ago(me.deletion_requested_at) + ' ago' : 'Request account deletion'}</button>
      ${me.is_admin ? '<a class="btn" href="admin.html">🛡️ Admin: reports</a>' : ''}</div>
      <p class="small muted">Deletion requests are handled by an admin, who removes your account and all your content.</p></div>`;
  $('#sf').onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    const { error } = await sb.from('profiles').update({ name: f.name.value.trim() || null, bio: f.bio.value.trim() || null, website: f.website.value.trim() || null }).eq('id', me.id);
    toast(error ? errMsg(error) : 'Saved ✓', !!error);
  };
  $('#outBtn').onclick = signOut;
  $('#delBtn').onclick = async () => {
    if (!(await confirmBox('Request account deletion?', 'An admin will permanently delete your Gitgather account, posts, comments, likes, follows and messages.', 'Request deletion'))) return;
    const { error } = await sb.from('profiles').update({ deletion_requested_at: new Date().toISOString() }).eq('id', me.id);
    toast(error ? errMsg(error) : 'Request sent', !!error); if (!error) location.reload();
  };
  const loadBlocked = async () => {
    const { data } = await sb.from('blocks').select('blocked_id, user:profiles!blocks_blocked_id_fkey(id, username, name, avatar_url)').order('created_at', { ascending: false });
    $('#blocked').innerHTML = data?.length ? data.map(b => userRow(b.user, `<button class="btn sm" data-unblock="${b.blocked_id}">Unblock</button>`)).join('') : '<p class="muted small">You haven\'t blocked anyone.</p>';
    $$('[data-unblock]').forEach(b => b.onclick = async () => { await sb.from('blocks').delete().match({ blocker_id: me.id, blocked_id: b.dataset.unblock }); toast('Unblocked'); loadBlocked(); });
  };
  loadBlocked();
}

/* ================= ADMIN ================= */
export async function pageAdmin() {
  await init('admin');
  const box = $('#admin');
  if (!me) { box.innerHTML = signInCta('Admins: sign in with GitHub.'); return; }
  if (!me.is_admin) { box.innerHTML = emptyBox('🛡️', 'Admins only', 'You don\'t have access to this page.'); return; }
  let status = 'open';
  const load = async () => {
    $$('[data-s]').forEach(b => b.classList.toggle('on', b.dataset.s === status));
    const { data, error } = await sb.from('reports').select('*, reporter:profiles!reports_reporter_id_fkey(username)').eq('status', status).order('created_at', { ascending: false }).limit(200);
    if (error) { $('#rlist').innerHTML = emptyBox('⚠️', 'Error', esc(error.message)); return; }
    const link = r => r.target_type === 'post' ? `post.html?id=${esc(r.target_id)}` : r.target_type === 'user' ? `#` : r.target_type === 'comment' ? '#' : '#';
    $('#rlist').innerHTML = data.length ? data.map(r => `<div class="panel report" data-r="${r.id}">
      <div class="meta"><span class="pill sm">${esc(r.target_type)}</span><b>${esc(r.reason.replace('_', ' '))}</b><small class="muted">by @${esc(r.reporter?.username)} · ${ago(r.created_at)} ago · target ${esc(r.target_id)}</small></div>
      ${r.details ? `<p>${esc(r.details)}</p>` : ''}
      <div class="acts" id="ctx${r.id}"></div>
      <div class="acts">${r.target_type === 'post' ? `<a class="btn sm" href="${link(r)}">Open post</a><button class="btn sm danger" data-rm="post:${esc(r.target_id)}">Delete post</button>` : ''}
        ${r.target_type === 'comment' ? `<button class="btn sm danger" data-rm="comment:${esc(r.target_id)}">Delete comment</button>` : ''}
        ${status === 'open' ? `<button class="btn sm" data-st="resolved">✓ Resolve</button><button class="btn sm" data-st="dismissed">Dismiss</button>` : `<button class="btn sm" data-st="open">Reopen</button>`}</div></div>`).join('')
      : emptyBox('✅', 'No ' + status + ' reports', 'Nice and calm.');
    for (const r of data) {
      if (r.target_type === 'user') {
        const { data: u } = await sb.from('profiles').select('username').eq('id', r.target_id).maybeSingle();
        if (u) $('#ctx' + r.id).innerHTML = `<a class="btn sm" href="profile.html?u=${esc(u.username)}">Open @${esc(u.username)}</a>`;
      } else if (r.target_type === 'comment') {
        const { data: c } = await sb.from('comments').select('body, post_id').eq('id', r.target_id).maybeSingle();
        if (c) $('#ctx' + r.id).innerHTML = `<blockquote>${esc(c.body)}</blockquote><a class="btn sm" href="post.html?id=${c.post_id}#comments">Open post</a>`;
      } else if (r.target_type === 'message') {
        $('#ctx' + r.id).innerHTML = `<span class="small muted">Private message #${esc(r.target_id)} — message text stays private; review the reporter's account of it and the reported user's public activity.</span>`;
      }
    }
  };
  $('#rlist').onclick = async e => {
    const card = e.target.closest('[data-r]'); if (!card) return;
    const st = e.target.closest('[data-st]'), rm = e.target.closest('[data-rm]');
    if (st) { const { error } = await sb.from('reports').update({ status: st.dataset.st }).eq('id', card.dataset.r); if (error) toast(errMsg(error), true); load(); }
    if (rm) {
      const [t, id] = rm.dataset.rm.split(':');
      if (!(await confirmBox(`Delete this ${t}?`, 'This permanently removes it.', 'Delete'))) return;
      const { error } = await sb.from(t === 'post' ? 'posts' : 'comments').delete().eq('id', id);
      if (error) return toast(errMsg(error), true);
      await sb.from('reports').update({ status: 'resolved' }).eq('id', card.dataset.r); toast('Deleted'); load();
    }
  };
  $$('[data-s]').forEach(b => b.onclick = () => { status = b.dataset.s; load(); });
  load();
  const { data: dels } = await sb.from('profiles').select('username, deletion_requested_at').not('deletion_requested_at', 'is', null);
  $('#dels').innerHTML = dels?.length ? dels.map(d => `<div class="urow"><a href="profile.html?u=${esc(d.username)}">@${esc(d.username)}</a><span class="spacer"></span><small class="muted">${ago(d.deletion_requested_at)} ago</small></div>`).join('')
    + `<p class="small muted">Delete these in Supabase → Authentication → Users (removes all their data via cascade).</p>` : '<p class="muted small">No deletion requests.</p>';
}
