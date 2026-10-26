// Refreshes the cached GitHub star count for up to 20 posts.
// Public & idempotent: it only writes numbers fetched from the GitHub API, at most once per 30 min per post.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let ids: number[] = [];
  try {
    const body = await req.json();
    ids = (Array.isArray(body.post_ids) ? body.post_ids : [body.post_id]).map(Number).filter((n: number) => Number.isInteger(n) && n > 0).slice(0, 20);
  } catch { return json({ error: "bad json" }, 400); }
  if (!ids.length) return json({ updated: [] });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: posts, error } = await db.from("posts").select("id, repo_url, repo_stars_updated_at").in("id", ids)
    .or(`repo_stars_updated_at.is.null,repo_stars_updated_at.lt.${since}`);
  if (error) return json({ error: error.message }, 500);

  const gh = Deno.env.get("GITHUB_TOKEN"); // optional secret for a higher GitHub rate limit
  const updated: { id: number; stars: number }[] = [];
  for (const p of posts ?? []) {
    const m = p.repo_url.match(/^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)\/?$/i);
    if (!m) continue;
    const r = await fetch(`https://api.github.com/repos/${m[1]}/${m[2]}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "gitgather", ...(gh ? { Authorization: `Bearer ${gh}` } : {}) },
    });
    if (r.status === 403 || r.status === 429) break; // GitHub rate limit: try later
    if (!r.ok) { await db.from("posts").update({ repo_stars_updated_at: new Date().toISOString() }).eq("id", p.id); continue; }
    const repo = await r.json();
    const stars = Number(repo.stargazers_count) || 0;
    await db.from("posts").update({ repo_stars: stars, repo_stars_updated_at: new Date().toISOString() }).eq("id", p.id);
    updated.push({ id: p.id, stars });
  }
  return json({ updated });
});
