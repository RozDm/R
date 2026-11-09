---
name: new-post
description: Scaffold a new blog post in Norwegian and English (content/blog/<slug>.md + content/blog/en/<slug>.md, linked by translationOf) with the project's frontmatter conventions (title, description, ISO date, tags from data/tags.ts), and publish a draft when it is ready. Use when the user asks to create, start, draft, translate, add or publish a blog post / artikkel / blogginnlegg / статью.
---

# New blog post

The blog is bilingual: a Norwegian post in `content/blog/<slug>.md` and its English twin in `content/blog/en/<en-slug>.md`, which names the Norwegian slug in `translationOf`. The owner may write the draft in any language (often Russian) — you produce both versions, and they read both before publishing. A post that only makes sense in one language (e.g. a Norway-specific topic) may skip the twin; ask if unsure.

The rules below are enforced, so a slip fails `npm run dev`, `npm test` and the build instead of going live: the frontmatter by `lib/post-frontmatter.ts` (on every read), the text by `tests/blog-content.test.ts`, the twins by `tests/blog-pairs.test.ts`, images by `lib/post-images.ts` at build.

## Inputs

If the user did not state them, ask once (combined `AskUserQuestion`) for:

1. **Topic / title** — in any language; you write the Norwegian and English titles (sentence case).
2. **Tags** — at least one, from `STANDARD_TAGS` in `data/tags.ts`. Show 3–5 that fit and let the user pick. Do NOT invent tags (the build refuses them), and never `Velkommen` (the welcome post's own). Both files carry the same canonical tags (English frontmatter may use an alias like `Security`, but canonical is clearer); the English blog shows `TAG_LABELS_EN` labels automatically.
3. **Description** (one sentence, 50–160 characters, aim for ~140) — you write it in both languages; meta + RSS + OG.
4. **Body** — the user's draft or notes, if any.

## Steps

1. Read `data/tags.ts` for `STANDARD_TAGS` (and `TAG_LABELS_EN`).
2. Today's date in ISO-8601 (UTC): `YYYY-MM-DD`, quoted.
3. Slugs: Norwegian from the Norwegian title, English from the English title — lowercase, ASCII-fold `æ→ae ø→o å→a`, non-alphanumeric → `-`, trimmed. Neither file may already exist (append `-2`…); the English slug must also not equal any existing Norwegian slug of a *different* post (`tests/blog-pairs.test.ts` checks).
4. Write `content/blog/<slug>.md` — these fields only, any other is refused:

```markdown
---
title: "<Norwegian title>"
description: "<Norwegian description>"
date: "<YYYY-MM-DD>"
tags: ["<Tag1>", "<Tag2>"]
draft: true
---

<body in Norwegian>
```

5. Write `content/blog/en/<en-slug>.md` with the SAME `date`, `tags` and `draft`, plus `translationOf`:

```markdown
---
title: "<English title>"
description: "<English description>"
date: "<YYYY-MM-DD>"
tags: ["<Tag1>", "<Tag2>"]
translationOf: "<slug>"
draft: true
---

<body in English (en-GB spelling: optimise, virtualisation)>
```

6. Body: tight and technical, a short hook then sections. The page shows the title as the h1, so headings start at `##` and go down one level at a time (`##` → `###`, never `##` → `####`). Fenced code blocks with a language tag (`bash`, `ts`, `yaml`, …) — highlighted at build; comments inside code stay English in both versions. The two bodies say the same thing; translate meaning, not word order, and keep commands/config identical.
   Links to other posts: `/blogg/<slug>/` from the Norwegian text, `/en/blog/<en-slug>/` from the English one, and only to published posts (a draft is a 404 in production).
   Images (only if the post needs them): put the file in `public/images/<slug>/` (WebP, PNG, JPEG, GIF or SVG; keep it small) and reference it from both versions as `![<alt in that language>](/images/<slug>/<file>)`. Never link an external image — the CSP blocks it and the build fails on purpose; alt text is required (the build fails without it).
7. Run `npx vitest run tests/blog-content.test.ts tests/blog-pairs.test.ts` and fix what they name.
8. Both start as `draft: true`: invisible in production everywhere, while `npm run dev` shows them with an «Utkast» badge. A build drops drafts, so to show the owner a draft from a cloud session, screenshot `http://localhost:3000/blogg/<slug>/` from `npm run dev` (the Playwright launch in the `browser-check` skill) and send it. Tell the user in one line: "Read both; say when to publish."

## Publishing a draft

When the owner says the post is ready:

1. In BOTH files: set `date` to today (UTC) if the draft was written on an earlier day — a post is dated the day it goes live — and remove `draft: true`. Later edits go to both files too, with `updated: "<YYYY-MM-DD>"` bumped in both.
2. First real post only — while `content/blog/velkommen.md` exists: delete it and `content/blog/en/welcome.md`, and drop `'Velkommen'` from `STANDARD_TAGS`, its `TAG_LABELS_EN` entry and the `welcome` alias in `data/tags.ts` (`tests/tags.test.ts` insists the three agree). Nothing else names the welcome post: the browser tests (`e2e/posts.ts`) and `scripts/smoke.sh` take the newest post from the feeds.
3. `npm run check`, then `npm run build` (image, CSP and WAF checks need it), then a PR with squash auto-merge. After the merge, look at the deploy run once.

## Launch (search engines)

Only on the owner's explicit word — never with a post on your own (pre-launch; on 2026-11-09 the owner said they will tell when). Flip all three in one PR, or CI or the deploy fails:

- `robots.index: false` → `true` in `app/layout.tsx`;
- the e2e test "pre-launch: every page tells search engines noindex" (`e2e/site.e2e.ts`) → the sitemap's pages carry no `noindex`, while `/kontakt/`, `/personvern/` and the tag pages outside `INDEXED_TAGS` keep it;
- the home check in `scripts/smoke.sh`, which asserts `content="noindex` → assert it is gone.

Then the owner submits `https://rozsoshnykh.no/sitemap.xml` in Google Search Console.

## Constraints

- Files: `content/blog/<slug>.md` and `content/blog/en/<en-slug>.md`; slugs lowercase ASCII + dashes.
- Dates are quoted `"YYYY-MM-DD"` strings (an unquoted date is read as the same day, but quoted keeps the files uniform).
- Do not edit `lib/`, the sitemap, RSS or components as part of this skill — new posts flow through the existing pipeline. A genuinely new tag is a separate change to `data/tags.ts` (add it to `STANDARD_TAGS`, and to `TAG_LABELS_EN` if it is a Norwegian word); the welcome-post cleanup above is the one exception.
