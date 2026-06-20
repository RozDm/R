---
name: new-post
description: Scaffold a new Norwegian blog post under content/blog/ with the project's frontmatter conventions (title, description, ISO date, tags from data/tags.ts). Use when the user asks to create, start, draft, or add a new blog post / artikkel / blogginnlegg.
---

# New blog post

Creates `content/blog/<slug>.md` with the frontmatter the build expects and a sane starting body. Site copy is Norwegian (`nb-NO`); only the frontmatter strings and the body are Norwegian — file names and tag keys are not.

## Inputs

If the user did not state them, ask once (combined `AskUserQuestion`) for:

1. **Title** (Norwegian, sentence case) — becomes `title` and is used to derive the slug if not given.
2. **Tags** — must come from `STANDARD_TAGS` in `@/home/user/R/data/tags.ts`. Show 3–5 tags that fit the title and let the user pick. Do NOT invent tags; aliases (`TAG_ALIASES`) are normalized at read-time, but for clarity pass canonical names.
3. **Description** (Norwegian, 1 sentence, ~140 chars) — meta + RSS + OG.

Optional: `slug` (override; otherwise derive from the title using `tagToSlug`-style rules — lowercase, ASCII-fold `æ→ae ø→o å→a`, non-alphanumeric → `-`, trim leading/trailing `-`).

## Steps

1. Read `data/tags.ts` to pull `STANDARD_TAGS`. Refuse to write a tag that is not in this array (case-insensitive, after alias lookup) — the build will keep it, but the canonical list is the single source of truth.
2. Compute today's date in ISO-8601 (UTC): `YYYY-MM-DD`. The frontmatter parser (`gray-matter`) needs this exact shape; do not use timestamps.
3. Compute the slug. Verify `content/blog/<slug>.md` does not already exist; if it does, append `-2` (or higher) until unique. Do not overwrite.
4. Write the file with this template:

```markdown
---
title: "<title>"
description: "<description>"
date: "<YYYY-MM-DD>"
tags: ["<Tag1>", "<Tag2>"]
draft: true
---

<one-paragraph hook in Norwegian — what the reader will learn and why it
matters>

## <First section heading>

<content>

## <Second section heading>

<content>
```

Keep the body tight — readers are technical and dislike fluff. Code blocks are auto-highlighted at build via `rehype-highlight`; use fenced blocks with a language tag (`bash`, `ts`, `tsx`, `nginx`, `yaml`, …). The reading-time estimate excludes fenced code, so don't pad with banks of snippets to look longer.

5. Do NOT run `npm test` or `npm run build` — markdown posts don't affect those checks. If the user wants verification, suggest `npm run dev` to see it rendered (drafts surface there with a red "Utkast" badge).
6. The post starts as `draft: true` on purpose — it is invisible in production (list, sitemap, RSS, slug routing all skip it) until the author removes the line. Tell the user in one line: "Remove `draft: true` and merge to publish." Don't remove it yourself unless asked.
7. Remind the user (single short line, only if it applies):
   - If this is the **first** post going public, flip `robots: { index: false }` to `true` in `app/layout.tsx` and submit the sitemap in Google Search Console.
   - Do not list `/kontakt` or status-style utility URLs in the sitemap (they stay `noindex` permanently).

## Constraints

- File naming: `content/blog/<slug>.md`, slug lowercase ASCII + dashes. No spaces, no Norwegian diacritics, no underscores.
- `title` and `description` are Norwegian. Comments in any code blocks stay English to match the rest of the codebase.
- Date is `"YYYY-MM-DD"` quoted as a string — the YAML parser otherwise turns unquoted dates into JS Date objects with timezone wobble.
- Tags array MUST use the canonical spellings from `STANDARD_TAGS` in `data/tags.ts`. `normalizeTags` will dedupe at read-time, but writing canonical avoids RSS/sitemap regenerating with two near-duplicate tag pages.
- Do not edit `lib/tags.ts`, `data/tags.ts`, sitemap, RSS, or any component as part of this skill. New posts flow through the existing pipeline.
