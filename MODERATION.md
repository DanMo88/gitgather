# Moderation notes (for maintainers)

All content lives in GitHub Discussions of this repo, so moderation uses GitHub's own tools.

| Goal | How |
|---|---|
| Hide a showcase post from the site | Add the label **`hidden`** to the discussion, or **Close** it. The next leaderboard run drops it from `posts.json`/`top100.json`. Run the workflow manually for an instant update. |
| Stop a heated thread | **Lock conversation** on the discussion (comments stop; it stays visible). |
| Remove content | Delete the comment/discussion (`…` → Delete) or "Hide" a comment as spam/abuse/off-topic. |
| Block a user | Profile → `…` → Block user, or repo **Settings → Moderation options → Blocked users**. |
| Slow down a raid | **Settings → Moderation options → Interaction limits** (e.g. limit to prior contributors for 24h). |
| Keep chat rooms on top | Pin the Lobby/Help/Show & Tell discussions in the GitHub UI (`Pin discussion`). |
| Star-trading / brigading | Hide the post, warn once, block repeat offenders. Report coordinated abuse to GitHub. |

## Anti-gaming built into scoring
- Only activity in the **last 24 hours** counts.
- The post author's own comments and reactions are ignored.
- Each person counts **once** for reactions and **max 3 times** for comments per post.
- Stars count only **0.5 points each, capped at 10 stars/day**, so star swaps can't buy a top spot.
- Weights live in `scripts/build-data.mjs` (`WEIGHTS`) and are published in the JSON files.
