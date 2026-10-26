// Gitgather data builder: reads Showcase discussions via GitHub GraphQL,
// computes a 24h engagement score and writes data/posts.json + data/top100.json.
// Runs in GitHub Actions with GITHUB_TOKEN. No dependencies (Node 18+).
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const TOKEN = process.env.GITHUB_TOKEN;
const [OWNER, NAME] = (process.env.GITHUB_REPOSITORY || 'DanMo88/gitgather').split('/');
const CATEGORY_SLUG = process.env.SHOWCASE_CATEGORY || 'show-and-tell';
const MAX_POSTS = 500;
const NOW = Date.now();
const DAY = 24 * 3600 * 1000;

// Scoring weights: conversation beats stars on purpose (anti star-trading).
export const WEIGHTS = {
  comment: 3,          // per comment/reply in last 24h (max 3 counted per person)
  reactor: 2,          // per unique person reacting to the post in last 24h
  commentReaction: 0.5,// per reaction on the post's comments in last 24h
  star: 0.5,           // per star gained by the repo in last 24h ...
  starCap: 10,         // ... counting at most 10 stars
  fresh: 1,            // small bonus for posts created in last 24h
};

if (!TOKEN) { console.error('GITHUB_TOKEN missing'); process.exit(1); }

async function gql(query, variables = {}) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'gitgather-bot' },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && !json.errors) return json.data;
    if (attempt >= 3) throw new Error(`GraphQL failed: ${res.status} ${JSON.stringify(json.errors || json)}`);
    await new Promise(r => setTimeout(r, 2000 * attempt));
  }
}

const recent = iso => iso && NOW - Date.parse(iso) <= DAY;

function parseForm(body = '') {
  const out = {};
  const parts = body.split(/^###\s+/m).slice(1);
  for (const p of parts) {
    const nl = p.indexOf('\n');
    const label = p.slice(0, nl).trim().toLowerCase();
    let val = p.slice(nl + 1).trim();
    if (val === '_No response_') val = '';
    out[label] = val;
  }
  return out;
}

function parseRepo(text = '') {
  const m = text.match(/github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})/);
  if (!m) return null;
  return { owner: m[1], name: m[2].replace(/\.git$/, '').replace(/[.]+$/, '') };
}

function firstImage(text = '') {
  const md = text.match(/!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/);
  if (md) return md[1];
  const html = text.match(/<img[^>]+src="(https:\/\/[^"]+)"/i);
  return html ? html[1] : '';
}

const clean = (s, n) => (s || '').replace(/<!--[\s\S]*?-->/g, '').trim().slice(0, n);

async function main() {
  const cats = await gql(`query($o:String!,$n:String!){repository(owner:$o,name:$n){discussionCategories(first:25){nodes{id slug name}}}}`, { o: OWNER, n: NAME });
  const cat = cats.repository.discussionCategories.nodes.find(c => c.slug === CATEGORY_SLUG);
  if (!cat) throw new Error(`Category ${CATEGORY_SLUG} not found`);

  const raw = [];
  let after = null;
  while (raw.length < MAX_POSTS) {
    const d = await gql(`query($o:String!,$n:String!,$c:ID!,$a:String){repository(owner:$o,name:$n){
      discussions(first:25, after:$a, categoryId:$c, orderBy:{field:CREATED_AT,direction:DESC}){
        pageInfo{hasNextPage endCursor}
        nodes{ number title url body createdAt updatedAt closed locked
          labels(first:10){nodes{name}}
          author{ login avatarUrl url ... on User { name followers{totalCount} following{totalCount} } }
          reactions(last:100){ totalCount nodes{ createdAt content user{login} } }
          comments(last:50){ totalCount nodes{ createdAt author{login}
            reactions(last:50){ totalCount nodes{ createdAt } }
            replies(last:50){ totalCount nodes{ createdAt author{login} } } } }
        } } } }`, { o: OWNER, n: NAME, c: cat.id, a: after });
    const conn = d.repository.discussions;
    raw.push(...conn.nodes);
    if (!conn.pageInfo.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }

  // Build posts
  const posts = [];
  for (const d of raw) {
    const labels = d.labels.nodes.map(l => l.name);
    if (d.closed || labels.includes('hidden') || !d.author) continue; // moderation
    const f = parseForm(d.body);
    const repo = parseRepo(f['project repository url'] || d.body);
    const author = d.author.login;
    const tags = (f['tags'] || '').split(/[,#\n]/).map(t => t.trim().toLowerCase().replace(/[^a-z0-9+.#_-]/g, '')).filter(Boolean).slice(0, 6);
    const description = clean(f['description'] || d.body, 600);

    // 24h engagement, excluding the post author's own activity
    const perUser = {};
    let comments24 = 0, commentReactions24 = 0, allComments = d.comments.totalCount;
    const countComment = (c) => {
      if (!recent(c.createdAt) || !c.author || c.author.login === author) return;
      perUser[c.author.login] = (perUser[c.author.login] || 0) + 1;
      if (perUser[c.author.login] <= 3) comments24++;
    };
    for (const c of d.comments.nodes) {
      countComment(c);
      allComments += c.replies.totalCount;
      for (const r of c.replies.nodes) countComment(r);
      commentReactions24 += c.reactions.nodes.filter(r => recent(r.createdAt)).length;
    }
    const reactors24 = new Set(d.reactions.nodes.filter(r => recent(r.createdAt) && r.user && r.user.login !== author).map(r => r.user.login)).size;
    const reactionCounts = {};
    for (const r of d.reactions.nodes) reactionCounts[r.content] = (reactionCounts[r.content] || 0) + 1;

    posts.push({
      number: d.number,
      url: d.url,
      title: clean(f['short title'] || d.title.replace(/^\[showcase\]\s*/i, ''), 120) || d.title,
      description,
      tags,
      screenshot: /^https:\/\//.test(f['screenshot url'] || '') ? f['screenshot url'] : firstImage(d.body),
      repo: repo ? `${repo.owner}/${repo.name}` : null,
      author: {
        login: author, name: d.author.name || '', avatar: d.author.avatarUrl,
        followers: d.author.followers?.totalCount ?? null, following: d.author.following?.totalCount ?? null,
      },
      createdAt: d.createdAt, updatedAt: d.updatedAt, locked: d.locked,
      reactions: d.reactions.totalCount, reactionCounts, comments: allComments,
      last24h: { comments: comments24, reactors: reactors24, commentReactions: commentReactions24, stars: 0 },
      stars: null, language: null, repoDescription: '',
    });
  }

  // Repo stats (stars + stars gained in 24h), batched with aliases
  const repos = [...new Set(posts.map(p => p.repo).filter(Boolean))];
  const repoInfo = {};
  for (let i = 0; i < repos.length; i += 20) {
    const chunk = repos.slice(i, i + 20);
    const q = chunk.map((r, j) => {
      const [o, n] = r.split('/');
      return `r${j}: repository(owner:${JSON.stringify(o)}, name:${JSON.stringify(n)}){ nameWithOwner stargazerCount description primaryLanguage{name color}
        stargazers(first:100, orderBy:{field:STARRED_AT,direction:DESC}){ edges{ starredAt } } }`;
    }).join('\n');
    try {
      const d = await fetchRepos(`query{${q}}`);
      chunk.forEach((r, j) => { if (d[`r${j}`]) repoInfo[r] = d[`r${j}`]; });
    } catch (e) { console.warn('repo batch failed', e.message); }
  }

  for (const p of posts) {
    const info = p.repo && repoInfo[p.repo];
    if (info) {
      p.repo = info.nameWithOwner;
      p.stars = info.stargazerCount;
      p.language = info.primaryLanguage;
      p.repoDescription = (info.description || '').slice(0, 200);
      p.last24h.stars = info.stargazers.edges.filter(e => recent(e.starredAt)).length;
    }
    const s = p.last24h;
    p.score = Math.round((
      s.comments * WEIGHTS.comment +
      s.reactors * WEIGHTS.reactor +
      s.commentReactions * WEIGHTS.commentReaction +
      Math.min(s.stars, WEIGHTS.starCap) * WEIGHTS.star +
      (recent(p.createdAt) ? WEIGHTS.fresh : 0)
    ) * 10) / 10;
  }

  const top = posts.filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 100)
    .map((p, i) => ({ rank: i + 1, number: p.number, score: p.score, last24h: p.last24h }));

  await mkdir('data', { recursive: true });
  const generatedAt = new Date(NOW).toISOString();
  const changed = await writeIfChanged('data/posts.json', { generatedAt, weights: WEIGHTS, count: posts.length, posts });
  const changed2 = await writeIfChanged('data/top100.json', { generatedAt, window: '24h', weights: WEIGHTS, top });
  console.log(`posts=${posts.length} top=${top.length} changed=${changed || changed2}`);
}

async function fetchRepos(query) {
  // Missing/renamed repos produce partial errors; keep the data we got.
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'gitgather-bot' },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (!json.data) throw new Error(JSON.stringify(json.errors || json));
  return json.data;
}

async function writeIfChanged(path, obj) {
  const strip = o => JSON.stringify({ ...o, generatedAt: undefined });
  try {
    const old = JSON.parse(await readFile(path, 'utf8'));
    // Refresh at least every 6h so "updated" timestamps stay honest
    if (strip(old) === strip(obj) && NOW - Date.parse(old.generatedAt) < 6 * 3600 * 1000) return false;
  } catch {}
  await writeFile(path, JSON.stringify(obj, null, 2) + '\n');
  return true;
}

main().catch(e => { console.error(e); process.exit(1); });
