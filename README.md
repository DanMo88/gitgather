<p align="center"><img src="assets/logo.svg" width="96" alt="Gitgather logo"></p>
<h1 align="center">Gitgather</h1>
<p align="center"><b>The hangout for GitHub people.</b><br>Showcase your projects, react, comment, chat, and climb the <b>Top 100 · 24h</b> — all running on GitHub.</p>
<p align="center"><a href="https://danmo88.github.io/gitgather/"><b>🌐 Open Gitgather</b></a> · <a href="https://github.com/DanMo88/gitgather/discussions/new?category=show-and-tell">＋ Post your project</a> · <a href="https://danmo88.github.io/gitgather/chat.html">💬 Lobby</a></p>

---

## What it is
Gitgather is a social network for developers: sign in with GitHub, showcase your repos, follow people, like, comment, star, chat privately and climb the **Top 100 · 24h**.

| Feature | How |
|---|---|
| Sign in | Supabase Auth with **GitHub OAuth** (profile auto-created from your GitHub username, name and avatar) |
| Posts | Showcase a GitHub repo with title, description, tags and image (falls back to the repo's GitHub preview card) |
| Likes · comments · ✨ stars | In-app reactions; ✨ stars also save a post to your profile. ⭐ **Star on GitHub** links to the real repo (star count cached by an edge function) |
| Follow / Follow back / Unfollow | Unlimited follows, "Follows you" + "Follow back" labels, followers/following lists, remove a follower |
| Following feed | Posts from people you follow |
| Top 100 · 24h | SQL function `top_posts_24h`: comments ×3, likes ×2, stars ×2 in the last 24h, linear recency decay, max 3 comments per person, author's own activity ignored |
| Private chat | 1:1 conversations, only participants can read (RLS), realtime, "seen" receipts |
| Notifications | Follow, like, star, comment, message — created by DB triggers, delivered in realtime |
| Block | Hides content both ways, removes follows, prevents follows, comments, likes and DMs (enforced in RLS) |
| Report | Posts, comments, users, messages — only admins can read reports (`admin.html`) |
| Anti-spam | Max 3 posts/min & 30/day, 10 comments/min, 30 messages/min, 5 reports/min. **Follows are not limited.** |
| App | Installable PWA, dark/light, mobile-first, vanilla HTML/CSS/JS on GitHub Pages — no build step |

## Architecture
```
GitHub Pages (this repo)  ──supabase-js──▶  Supabase (Postgres + RLS, Auth, Realtime, Edge Function)
index / post / new / profile / messages / notifications / settings / admin
supabase/migrations/0001_gitgather_core.sql   # schema, RLS, triggers, views, RPCs
supabase/functions/repo-stars/index.ts        # caches GitHub star counts
```
The frontend only contains the **publishable** key. Every table has Row Level Security; privileged helpers live in a non-exposed `private` schema.

## Moderation
- Admin = GitHub account **DanMo88** (set automatically from the verified GitHub identity on first sign-in).
- `admin.html`: review open reports, delete posts/comments, resolve/dismiss; see account-deletion requests.
- Delete a user in Supabase → Authentication → Users; all their data is removed by cascade.

## Limits
- GitHub star counts are cached for 30 minutes (GitHub's unauthenticated API allows 60 requests/hour per IP).
- Supabase free plan: 500 MB database, 50k monthly active users, 200 concurrent realtime connections, project pauses after 1 week without activity.
- Private messages are private to the two participants but not end-to-end encrypted (they're stored in the database).

<div dir="rtl">

## 🇮🇷 معرفی به فارسی

**Gitgather** یک «پاتوق» برای اهالی گیت‌هاب است؛ یک شبکهٔ اجتماعی کوچک که **همه‌چیزش روی خود گیت‌هاب اجرا می‌شود** — بدون سرور، بدون دیتابیس و بدون هزینه.

- **ورود:** با همان اکانت گیت‌هاب خودت وارد می‌شوی و پروفایلت خودکار ساخته می‌شود.
- **معرفی پروژه:** لینک ریپو، عنوان، توضیح، تگ و تصویر را وارد کن تا پروژه‌ات در فید نمایش داده شود.
- **لایک، کامنت و استار:** کاربران می‌توانند پست‌ها را لایک کنند، نظر بدهند و استار بزنند. دکمهٔ «Star on GitHub» هم مستقیم به ریپو می‌رود.
- **فالو، فالوبک و آنفالو:** بدون هیچ محدودیتی. برچسب «Follows you» و دکمهٔ «Follow back» هم نمایش داده می‌شود.
- **چت خصوصی:** گفتگوی دونفره که فقط همان دو نفر می‌بینند، به‌صورت لحظه‌ای.
- **اعلان‌ها:** برای فالو، لایک، استار، کامنت و پیام جدید، به‌صورت لحظه‌ای.
- **بلاک و ریپورت:** بلاک کردن محتوای دو طرف را از هم پنهان می‌کند و جلوی فالو، کامنت و پیام را می‌گیرد. ریپورت‌ها را فقط ادمین می‌بیند.
- **۱۰۰ پست برتر ۲۴ ساعت گذشته:** بر اساس کامنت‌ها (۳ امتیاز)، لایک‌ها (۲) و استارها (۲) در ۲۴ ساعت اخیر، و فعالیت تازه‌تر امتیاز بیشتری دارد.

لطفاً مهربان باش، اسپم نکن و درخواست «استار بده، استار می‌دم» نگذار — این کار خلاف قوانین گیت‌هاب است.

ساخته شده توسط **Daniel Mozafari**

</div>

---
<p align="center">Made by <b>Daniel Mozafari</b> · MIT License</p>
