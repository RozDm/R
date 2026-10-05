---
name: new-post
description: Scaffold a new blog post in Norwegian and English (content/blog/<slug>.md + content/blog/en/<slug>.md, linked by translationOf) with the project's frontmatter conventions (title, description, ISO date, tags from data/tags.ts). Use when the user asks to create, start, draft, translate or add a new blog post / artikkel / blogginnlegg.
---

# New blog post

The blog is bilingual: a Norwegian post in `content/blog/<slug>.md` and its English twin in `content/blog/en/<en-slug>.md`, which names the Norwegian slug in `translationOf`. The owner may write the draft in any language (often Russian) — you produce both versions, and they read both before publishing. A post that only makes sense in one language (e.g. a Norway-specific topic) may skip the twin; ask if unsure.

## Inputs

If the user did not state them, ask once (combined `AskUserQuestion`) for:

1. **Topic / title** — in any language; you write the Norwegian and English titles (sentence case).
2. **Tags** — must come from `STANDARD_TAGS` in `data/tags.ts`. Show 3–5 that fit and let the user pick. Do NOT invent tags. Both files carry the same canonical tags (English frontmatter may use an alias like `Security`, but canonical is clearer); the English blog shows `TAG_LABELS_EN` labels automatically.
3. **Description** (1 sentence, ~140 chars) — you write it in both languages; meta + RSS + OG.
4. **Body** — the user's draft or notes, if any.

## Steps

1. Read `data/tags.ts` for `STANDARD_TAGS` (and `TAG_LABELS_EN`). Refuse tags outside the canon.
2. Today's date in ISO-8601 (UTC): `YYYY-MM-DD`, quoted.
3. Slugs: Norwegian from the Norwegian title, English from the English title — lowercase, ASCII-fold `æ→ae ø→o å→a`, non-alphanumeric → `-`, trimmed. Neither file may already exist (append `-2`…); the English slug must also not equal any existing Norwegian slug of a *different* post (`tests/blog-pairs.test.ts` checks).
4. Write `content/blog/<slug>.md`:

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

6. Body: tight and technical, a short hook then sections. Fenced code blocks with a language tag (`bash`, `ts`, `yaml`, …) — highlighted at build; comments inside code stay English in both versions. The two bodies say the same thing; translate meaning, not word order, and keep commands/config identical.
7. Run `npx vitest run tests/blog-pairs.test.ts` — it fails if the twins' date, `updated`, tags or draft state differ.
8. Both start as `draft: true` (invisible in production everywhere). Tell the user in one line: "Read both, then remove `draft: true` from both files and merge to publish." Edits later go to both files; bump `updated` in both.
9. Only if it applies: when the first post goes public, flip `robots: { index: false }` in `app/layout.tsx` and submit the sitemap in Search Console.

## Constraints

- Files: `content/blog/<slug>.md` and `content/blog/en/<en-slug>.md`; slugs lowercase ASCII + dashes.
- Dates are quoted `"YYYY-MM-DD"` strings (unquoted YAML dates become Date objects with timezone wobble).
- Do not edit `lib/`, `data/tags.ts`, the sitemap, RSS or components as part of this skill — new posts flow through the existing pipeline. A genuinely new tag is a separate change (add it to `STANDARD_TAGS`, and to `TAG_LABELS_EN` if it is a Norwegian word).
