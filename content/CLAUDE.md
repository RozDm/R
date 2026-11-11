# content/ — the blog

Loads with any file under `content/`. Read it too before changing the blog
code (`lib/blog.ts`, `lib/markdown.ts`, `lib/post-images.ts`, `lib/tags.ts`,
`data/tags.ts`, `scripts/build-diagrams.mjs`). Site-wide rules: the root
`CLAUDE.md`. A new post or a publish: the `/new-post` skill.

- Posts: Norwegian `content/blog/<slug>.md`, English
  `content/blog/en/<slug>.md` with `translationOf: <norwegian slug>`; one
  language only is fine. Frontmatter `title`, `description`, `date` (ISO),
  `tags`, optional `updated`, `draft: true`.
- Checks: reading a post checks it (`lib/post-frontmatter.ts`: no unknown
  field, `draft` a real boolean, real days, tags from `STANDARD_TAGS`,
  description 50–160 chars), so a slip stops dev, tests and the build instead
  of going live; `tests/blog-content.test.ts` adds the text: headings from
  `##`, one level at a time, links to other posts only to published ones.
- Twins share date, `updated`, tags and draft (`tests/blog-pairs.test.ts`);
  `/new-post` writes both drafts and publishes them (date = the publish day).
- Code: `lib/blog.ts` takes `lang` everywhere, URLs come from
  `lib/blog-paths.ts`, one view counter per post (`viewKey`: the Norwegian
  slug).
- Tags are canonical across languages (`lib/tags.ts`; canon + aliases in
  `data/tags.ts`; `TAG_LABELS_EN` gives English labels and URLs; tag URLs
  fold æ/ø/å like post slugs).
- Code blocks: highlighted at build by `rehype-highlight` with lowlight's
  common languages plus PowerShell (`HIGHLIGHT_OPTIONS` in `lib/markdown.ts`,
  shared by the page and RSS; a language left out renders plain), palette in
  `app/globals.css` (e2e checks both themes).
- Inline code: a chip that breaks only between words (`lib/inline-code.ts`,
  `.post-body` in `app/globals.css`), so `curl -v` never splits at its
  hyphen.
- Images: `![alt](/images/<slug>/file.webp)`, file in
  `public/images/<slug>/`; `rehypePostImages` (`lib/post-images.ts`) stamps
  size + lazy loading and fails the build on an external image (the CSP's
  `img-src 'self' data:` would block it), a missing file, no alt text or an
  unreadable format. `<slug>` is the Norwegian one for both twins.
- Diagrams: SVG, the source with live `<text>` in
  `content/diagrams/<slug>/`, the copy in `public/images/<slug>/` built by
  `npm run diagrams` (`scripts/build-diagrams.mjs`: text outlined in Intel
  One Mono, which an SVG in `<img>` can't load; `tests/diagrams.test.ts`
  fails on a stale copy; the copies are skipped by Grep and binary to
  `git diff`). Draw for the light theme on a white card: the dark theme
  inverts post SVGs (`app/globals.css`).
- Drafts: `draft: true` keeps a post off every public surface in production
  builds; `npm run dev` shows drafts with an «Utkast» badge.
