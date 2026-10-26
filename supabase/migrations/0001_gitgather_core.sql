-- Gitgather core schema (Supabase). Strict RLS on every table.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  name text,
  avatar_url text,
  bio text check (char_length(bio) <= 300),
  website text check (website is null or website ~* '^https?://'),
  github_id text,
  is_admin boolean not null default false,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- posts ----------
create table public.posts (
  id bigint generated always as identity primary key,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  repo_url text not null check (repo_url ~* '^https://github\.com/[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}/?$'),
  title text not null check (char_length(title) between 3 and 120),
  body text not null default '' check (char_length(body) <= 5000),
  tags text[] not null default '{}' check (cardinality(tags) <= 6),
  image_url text check (image_url is null or image_url ~* '^https://'),
  repo_stars integer,
  repo_stars_updated_at timestamptz,
  created_at timestamptz not null default now()
);
create index posts_author_idx on public.posts(author_id);
create index posts_created_idx on public.posts(created_at desc);

create table public.likes (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index likes_user_idx on public.likes(user_id);
create index likes_created_idx on public.likes(created_at);

create table public.post_stars (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_stars_user_idx on public.post_stars(user_id);
create index post_stars_created_idx on public.post_stars(created_at);

create table public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments(post_id, created_at);
create index comments_author_idx on public.comments(author_id);

create table public.follows (
  follower_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_idx on public.follows(following_id);

create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks(blocked_id);

create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment','user','message')),
  target_id text not null check (char_length(target_id) <= 64),
  reason text not null check (reason in ('spam','harassment','star_trading','inappropriate','impersonation','malware','other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now()
);
create index reports_reporter_idx on public.reports(reporter_id);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);
create index conversations_b_idx on public.conversations(user_b);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index messages_conv_idx on public.messages(conversation_id, created_at);
create index messages_sender_idx on public.messages(sender_id);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in ('follow','like','comment','message','star')),
  post_id bigint references public.posts(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index notifications_actor_idx on public.notifications(actor_id);
create index notifications_post_idx on public.notifications(post_id);
create index notifications_conv_idx on public.notifications(conversation_id);

-- ---------- private helpers (security definer, not exposed via the Data API) ----------
create or replace function private.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select a is not null and b is not null and exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function private.can_interact_post(p_post bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.posts p where p.id = p_post
                 and not private.is_blocked(auth.uid(), p.author_id));
$$;

create or replace function private.is_participant(p_conv uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversations c where c.id = p_conv
                 and auth.uid() in (c.user_a, c.user_b));
$$;

create or replace function private.can_message(p_conv uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversations c where c.id = p_conv
                 and auth.uid() in (c.user_a, c.user_b)
                 and not private.is_blocked(c.user_a, c.user_b));
$$;

grant execute on all functions in schema private to anon, authenticated;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.post_stars enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

-- Anonymous visitors may only read; all writes require sign-in.
revoke insert, update, delete, truncate on all tables in schema public from anon;
revoke truncate on all tables in schema public from authenticated;

-- profiles: public read; users edit only safe columns of their own row (never is_admin/username)
create policy profiles_read on public.profiles for select to anon, authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, update, delete on public.profiles from authenticated;
grant update (name, bio, website, deletion_requested_at) on public.profiles to authenticated;

-- posts
create policy posts_read on public.posts for select to anon, authenticated
  using (not private.is_blocked((select auth.uid()), author_id));
create policy posts_insert on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy posts_update_own on public.posts for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy posts_delete on public.posts for delete to authenticated
  using (author_id = (select auth.uid()) or private.is_admin());
revoke update on public.posts from authenticated;
grant update (title, body, tags, image_url) on public.posts to authenticated;

-- likes / stars
create policy likes_read on public.likes for select to anon, authenticated
  using (not private.is_blocked((select auth.uid()), user_id));
create policy likes_insert on public.likes for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_interact_post(post_id));
create policy likes_delete on public.likes for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.likes from authenticated;

create policy stars_read on public.post_stars for select to anon, authenticated
  using (not private.is_blocked((select auth.uid()), user_id));
create policy stars_insert on public.post_stars for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_interact_post(post_id));
create policy stars_delete on public.post_stars for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.post_stars from authenticated;

-- comments
create policy comments_read on public.comments for select to anon, authenticated
  using (not private.is_blocked((select auth.uid()), author_id));
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()) and private.can_interact_post(post_id));
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = (select auth.uid()) or private.is_admin()
         or exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));
revoke update on public.comments from authenticated;

-- follows (no limits)
create policy follows_read on public.follows for select to anon, authenticated
  using (not private.is_blocked((select auth.uid()), follower_id)
     and not private.is_blocked((select auth.uid()), following_id));
create policy follows_insert on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()) and not private.is_blocked(follower_id, following_id));
create policy follows_delete on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid())); -- unfollow, or remove a follower
revoke update on public.follows from authenticated;

-- blocks: only the blocker sees their blocks
create policy blocks_read on public.blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy blocks_insert on public.blocks for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy blocks_delete on public.blocks for delete to authenticated using (blocker_id = (select auth.uid()));
revoke update on public.blocks from authenticated;

-- reports: anyone signed in can file; only admins read/update
create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy reports_admin_read on public.reports for select to authenticated using (private.is_admin());
create policy reports_admin_update on public.reports for update to authenticated using (private.is_admin()) with check (private.is_admin());
revoke update on public.reports from authenticated;
grant update (status) on public.reports to authenticated;

-- conversations: participants only
create policy conv_read on public.conversations for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));
create policy conv_insert on public.conversations for insert to authenticated
  with check ((select auth.uid()) in (user_a, user_b) and not private.is_blocked(user_a, user_b));
revoke update, delete on public.conversations from authenticated;

-- messages: participants only; blocked pairs can't send
create policy msg_read on public.messages for select to authenticated using (private.is_participant(conversation_id));
create policy msg_insert on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and private.can_message(conversation_id));
create policy msg_mark_read on public.messages for update to authenticated
  using (private.is_participant(conversation_id) and sender_id <> (select auth.uid()))
  with check (private.is_participant(conversation_id) and sender_id <> (select auth.uid()));
revoke update, delete on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;

-- notifications: own only; created by triggers
create policy notif_read on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notif_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notif_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------- triggers ----------
-- New auth user -> profile from GitHub metadata. Admin = GitHub account DanMo88 (id 347421481).
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  base text := lower(regexp_replace(coalesce(meta->>'user_name', meta->>'preferred_username', split_part(new.email, '@', 1), 'user'), '[^A-Za-z0-9-]', '', 'g'));
  uname text;
  gh_id text := coalesce(meta->>'provider_id', meta->>'sub');
begin
  if base = '' then base := 'user'; end if;
  uname := coalesce(meta->>'user_name', meta->>'preferred_username', base);
  uname := regexp_replace(uname, '[^A-Za-z0-9-]', '', 'g');
  if uname = '' or exists (select 1 from public.profiles where lower(username) = lower(uname)) then
    uname := uname || '-' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  insert into public.profiles (id, username, name, avatar_url, github_id, is_admin)
  values (new.id, uname, coalesce(meta->>'full_name', meta->>'name'), meta->>'avatar_url', gh_id,
          exists (select 1 from auth.identities i where i.user_id = new.id and i.provider = 'github' and i.provider_id = '347421481'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Keep avatar/name fresh on later sign-ins (never username or admin).
create or replace function private.handle_user_updated() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set
    avatar_url = coalesce(new.raw_user_meta_data->>'avatar_url', avatar_url),
    name = coalesce(name, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  where id = new.id;
  return new;
end $$;
create trigger on_auth_user_updated after update of raw_user_meta_data on auth.users
  for each row execute function private.handle_user_updated();

-- Admin flag from the verified GitHub identity (identities are written by Supabase Auth, not the user).
create or replace function private.handle_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.provider = 'github' and new.provider_id = '347421481' then
    update public.profiles set is_admin = true where id = new.user_id;
  end if;
  return new;
end $$;
create trigger on_auth_identity_created after insert on auth.identities
  for each row execute function private.handle_identity();

-- Rate limits (spam protection). Follows are intentionally NOT limited.
create or replace function private.rate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n int; lim int; win interval := interval '1 minute'; who uuid := auth.uid();
begin
  if who is null then return new; end if;
  if tg_table_name = 'posts' then
    select count(*) into n from public.posts where author_id = who and created_at > now() - win; lim := 3;
    if n < lim then
      select count(*) into n from public.posts where author_id = who and created_at > now() - interval '1 day'; lim := 30;
    end if;
  elsif tg_table_name = 'comments' then
    select count(*) into n from public.comments where author_id = who and created_at > now() - win; lim := 10;
  elsif tg_table_name = 'messages' then
    select count(*) into n from public.messages where sender_id = who and created_at > now() - win; lim := 30;
  elsif tg_table_name = 'reports' then
    select count(*) into n from public.reports where reporter_id = who and created_at > now() - win; lim := 5;
  elsif tg_table_name = 'conversations' then
    select count(*) into n from public.conversations where who in (user_a, user_b) and created_at > now() - win; lim := 10;
  else return new;
  end if;
  if n >= lim then
    raise exception 'Slow down: too many % right now. Please wait a minute.', tg_table_name using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger rl_posts before insert on public.posts for each row execute function private.rate_limit();
create trigger rl_comments before insert on public.comments for each row execute function private.rate_limit();
create trigger rl_messages before insert on public.messages for each row execute function private.rate_limit();
create trigger rl_reports before insert on public.reports for each row execute function private.rate_limit();
create trigger rl_conversations before insert on public.conversations for each row execute function private.rate_limit();

-- Blocking removes follows both ways.
create or replace function private.on_block() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.follows
   where (follower_id = new.blocker_id and following_id = new.blocked_id)
      or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end $$;
create trigger after_block after insert on public.blocks for each row execute function private.on_block();

-- Notifications (created by triggers only)
create or replace function private.notify_follow() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications(user_id, actor_id, type) values (new.following_id, new.follower_id, 'follow');
  return new;
end $$;
create trigger notify_follow after insert on public.follows for each row execute function private.notify_follow();

-- likes/stars rows have user_id, comments have author_id; use separate wrappers
create or replace function private.notify_like() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  select author_id into target from public.posts where id = new.post_id;
  if target is not null and target <> new.user_id then
    insert into public.notifications(user_id, actor_id, type, post_id)
    values (target, new.user_id, case when tg_table_name = 'likes' then 'like' else 'star' end, new.post_id);
  end if;
  return new;
end $$;
create or replace function private.notify_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  select author_id into target from public.posts where id = new.post_id;
  if target is not null and target <> new.author_id then
    insert into public.notifications(user_id, actor_id, type, post_id) values (target, new.author_id, 'comment', new.post_id);
  end if;
  return new;
end $$;
create trigger notify_like after insert on public.likes for each row execute function private.notify_like();
create trigger notify_star after insert on public.post_stars for each row execute function private.notify_like();
create trigger notify_comment after insert on public.comments for each row execute function private.notify_comment();

create or replace function private.notify_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare other uuid;
begin
  select case when c.user_a = new.sender_id then c.user_b else c.user_a end into other
    from public.conversations c where c.id = new.conversation_id;
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  -- one unread message notification per conversation at a time
  if other is not null and not exists (select 1 from public.notifications n
      where n.user_id = other and n.conversation_id = new.conversation_id and n.type = 'message' and n.read_at is null) then
    insert into public.notifications(user_id, actor_id, type, conversation_id) values (other, new.sender_id, 'message', new.conversation_id);
  end if;
  return new;
end $$;
create trigger notify_message after insert on public.messages for each row execute function private.notify_message();

-- ---------- views (security_invoker => RLS of the viewer applies) ----------
create view public.post_cards with (security_invoker = true) as
select p.id, p.author_id, p.repo_url, p.title, p.body, p.tags, p.image_url, p.repo_stars, p.repo_stars_updated_at, p.created_at,
       pr.username, pr.name as author_name, pr.avatar_url,
       (select count(*) from public.likes l where l.post_id = p.id)::int as like_count,
       (select count(*) from public.comments c where c.post_id = p.id)::int as comment_count,
       (select count(*) from public.post_stars s where s.post_id = p.id)::int as star_count,
       exists (select 1 from public.likes l where l.post_id = p.id and l.user_id = (select auth.uid())) as liked_by_me,
       exists (select 1 from public.post_stars s where s.post_id = p.id and s.user_id = (select auth.uid())) as starred_by_me,
       exists (select 1 from public.follows f where f.following_id = p.author_id and f.follower_id = (select auth.uid())) as author_followed_by_me
from public.posts p join public.profiles pr on pr.id = p.author_id;

create view public.profile_cards with (security_invoker = true) as
select pr.id, pr.username, pr.name, pr.avatar_url, pr.bio, pr.website, pr.created_at, pr.is_admin,
       (select count(*) from public.follows f where f.following_id = pr.id)::int as followers_count,
       (select count(*) from public.follows f where f.follower_id = pr.id)::int as following_count,
       (select count(*) from public.posts p where p.author_id = pr.id)::int as posts_count,
       exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = pr.id) as followed_by_me,
       exists (select 1 from public.follows f where f.follower_id = pr.id and f.following_id = (select auth.uid())) as follows_me,
       exists (select 1 from public.blocks b where b.blocker_id = (select auth.uid()) and b.blocked_id = pr.id) as blocked_by_me
from public.profiles pr;

-- ---------- RPCs (security invoker) ----------
-- Top 100 in the last 24h: comments 3, likes 2, in-app stars 2, each event decays linearly
-- (an event from 24h ago counts 50%), max 3 comments per person, the author's own activity excluded.
create or replace function public.top_posts_24h(max_rows int default 100)
returns table (id bigint, score numeric, likes_24h int, comments_24h int, stars_24h int)
language sql stable security invoker set search_path = '' as $$
  with ev as (
    select l.post_id, l.user_id as actor, 'like'::text as kind, 2::numeric as w, l.created_at
      from public.likes l where l.created_at > now() - interval '24 hours'
    union all
    select s.post_id, s.user_id, 'star', 2::numeric, s.created_at
      from public.post_stars s where s.created_at > now() - interval '24 hours'
    union all
    select c.post_id, c.author_id, 'comment', 3::numeric, c.created_at from (
      select c.post_id, c.author_id, c.created_at,
             row_number() over (partition by c.post_id, c.author_id order by c.created_at desc) as rn
        from public.comments c where c.created_at > now() - interval '24 hours') c
     where c.rn <= 3
  )
  select ev.post_id,
         round(sum(ev.w * (1 - extract(epoch from (now() - ev.created_at)) / 172800.0)), 2) as score,
         (count(*) filter (where ev.kind = 'like'))::int,
         (count(*) filter (where ev.kind = 'comment'))::int,
         (count(*) filter (where ev.kind = 'star'))::int
    from ev join public.posts p on p.id = ev.post_id   -- RLS hides posts of blocked users
   where ev.actor <> p.author_id
   group by ev.post_id
  having sum(ev.w) > 0
   order by 2 desc, ev.post_id desc
   limit least(greatest(max_rows, 1), 100);
$$;

-- Open (or create) a 1:1 conversation with another user.
create or replace function public.open_conversation(other uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare me uuid := auth.uid(); a uuid; b uuid; cid uuid;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if other is null or other = me then raise exception 'Pick another user'; end if;
  a := least(me, other); b := greatest(me, other);
  select id into cid from public.conversations where user_a = a and user_b = b;
  if cid is null then
    insert into public.conversations(user_a, user_b) values (a, b) returning id into cid;
  end if;
  return cid;
end $$;

-- ---------- realtime ----------
alter publication supabase_realtime add table public.messages, public.notifications;
