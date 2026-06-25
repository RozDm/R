---
name: launch
description: Flip the site from soft-launch (noindex) to public/indexable — runs the documented launch gate (robots.index, Turnstile in prod, content threshold, smoke-test assertion, sitemap submission). Use when the user says they are ready to launch / go live / publish the site / enable indexing / "flip robots".
---

# Launch checklist

The site ships in a deliberate **soft-launch** state: `robots: { index: false }`
so nothing gets indexed before the content is ready. This skill walks the
flip to public and the things that must move *with* it, then lists the manual
steps that can only happen off-box.

Do NOT run any of this unasked — launching is a one-way, outward-facing action.
Confirm the user actually wants to go live first.

## Preconditions — verify before touching anything

1. **Content is ready.** `content/blog/` has the posts the user wants public,
   none of them accidentally `draft: true` (drafts 404 in prod by design).
   Ask the user to confirm the list reads right — launching with one stub post
   is the most common "oops".
2. **Turnstile decision.** The contact form's challenge only applies when BOTH
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (build-time) and `TURNSTILE_SECRET`
   (runtime secret) are set. If the user wants the form protected at launch,
   confirm both GitHub secrets exist *before* flipping — otherwise the form
   runs on the weaker defences (Sec-Fetch + UA + honeypot + D1 rate limit).
   Can't verify secrets from the web sandbox (no egress) — ask the user, or
   read the deploy run logs.
3. **Working tree clean / on a `claude/*` branch**, reset onto `origin/main`
   (squash-merge history rule from CLAUDE.md).

## The flip — code changes (do these together; they MUST stay in sync)

1. **`app/layout.tsx`** — the `metadata.robots` block: set `index: true`.
   Keep `follow: true`. Leave the Norwegian comment honest (it currently says
   indexing waits for the first posts; update or drop it).

2. **`scripts/smoke.sh`** — the `home` check currently *asserts* noindex:
   ```
   check "home" "$BASE/" 200 "Dmytro Rozsoshnykh" "Driftsstatus" 'name="robots" content="noindex'
   ```
   That assertion will FAIL the deploy the moment indexing is on. Remove the
   `'name="robots" content="noindex'` pattern from that line (keep the other
   two greps). Optionally flip it to assert the page is now indexable, but the
   simplest correct move is to drop the noindex pattern.

3. **Do NOT touch `/kontakt` or `/status`-style utility pages** — they stay
   `robots: { index: false }` permanently (per CLAUDE.md), and the sitemap must
   never list a noindex URL. Confirm `app/sitemap.ts` still excludes them.

## Gate

Run the full gate and a build; all must pass:
```
npm run lint && npm run typecheck && npm test && npm run build
```
Then sanity-check the built HTML actually flipped:
```
grep -o 'name="robots" content="[^"]*"' out/index.html
```
Expect `index, follow` (or no noindex), not `noindex`.

## Ship + post-deploy (manual, off-box)

4. Commit, push, open the PR as usual; the deploy runs on squash-merge to
   `main` and `scripts/smoke.sh` re-checks the live site.
5. **After the deploy is green**, the user does these by hand (the sandbox has
   no egress, so you can't):
   - **Google Search Console**: add/verify the property if needed, then submit
     `https://rozsoshnykh.no/sitemap.xml`.
   - Spot-check `https://rozsoshnykh.no/robots.txt` and a couple of pages show
     the new indexable state.
   - (Optional) request indexing for the homepage + key posts to speed up
     first crawl.

## Report

Tell the user exactly what changed (robots flag + smoke assertion), that the
gate passed, and hand them the short manual list (sitemap submission in Search
Console) as the only remaining step. Do not claim the site is "indexed" — it is
*indexable*; crawling is on Google's clock.
