## d.rozsoshnykh.workers.dev

Personlig nettsted og blogg for **Dmytro Rozsoshnykh** — systemadministrator / DevOps i Vestland. Statisk Next.js-eksport servert fra en Cloudflare Worker som også kjører uptime-overvåking via cron.

### Stack

- Next.js 15 (App Router, `output: 'export'`) + React 19, TypeScript, Tailwind v4
- Innhold: markdown-poster i `content/blog/` (gray-matter + react-markdown + remark-gfm)
- Hosting: Cloudflare Workers + Static Assets (binding `ASSETS`), KV (binding `STATUS`), cron `*/5 * * * *`
- Worker (`src/`) håndterer HTTPS-redirect, strict hash-CSP for HTML den kan dekode, alle security-headere og `/api/status`

### Scripts

| | |
|--|--|
| `npm run dev` | Next dev-server med Turbopack |
| `npm run build` | Statisk eksport til `out/` |
| `npm run lint` | ESLint (flat config, `next/core-web-vitals` + `next/typescript`) |
| `npm run typecheck` | `tsc --noEmit` for app **og** worker (`tsconfig.worker.json`) |
| `npm test` | Vitest — dekker `inlineScriptHashes`, `buildStatusData`, `normalizeTags` |
| `npm run cf-typegen` | Regenererer `worker-configuration.d.ts` fra `wrangler.jsonc` |
| `npm run deploy` | `predeploy` (lint + typecheck + test) → `next build` → `wrangler deploy` |

### Struktur

```
app/                Next App Router: forside, /blogg, /status, sitemap, robots, OG-bilder
components/         React-komponenter (Header, Hero, Skills, StatusDashboard, …)
content/blog/       Markdown-poster (frontmatter: title, description, date, tags)
context/            ThemeContext (light/dark uten FOUC)
data/               Skills og certifications
lib/                blog.ts, tags.ts (alias-normalisering), site.ts
src/                Cloudflare Worker (entry: src/index.ts, csp.ts, status.ts)
tests/              Vitest
wrangler.jsonc      Worker-konfig (ASSETS, STATUS KV, cron)
```

### Statusovervåking

Crontrigger pinger hver `MONITORS`-oppføring i `src/status.ts` hvert 5. minutt og skriver et JSON-snapshot til KV (nøkkel `status`). `/api/status` serverer snapshot; `/status` viser det. Historikken lagrer opp/ned **per tjeneste** (`Record<name, boolean>`), avkortet til `HISTORY_LIMIT` (96 ≈ 8 timer).

Legg til en tjeneste ved å utvide `MONITORS`. Bruk `internal: true` for ruter som peker på dette nettstedet selv (ASSETS-binding må brukes — Workers blokkerer self-fetch over offentlig URL).

### Deploy

Krever `wrangler login` og at KV-namespacet i `wrangler.jsonc` eksisterer (eller bytt id). Deretter:

```bash
npm run deploy
```

`predeploy` kjører lint/typecheck/test først — feiler én av dem, deployer ikke.

### Status (soft launch)

Nettstedet kjører på `*.workers.dev` med `robots: { index: false }` til eget `.no`-domene og endelig innhold er på plass. Når det skiftes:
1. `SITE_URL` i `lib/site.ts`
2. `robots.index` i `app/layout.tsx`
3. Send sitemap til Search Console
