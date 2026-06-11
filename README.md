## rozsoshnykh.no

Personlig nettsted og blogg for **Dmytro Rozsoshnykh** — systemadministrator / DevOps i Vestland. Statisk Next.js-eksport servert fra en Cloudflare Worker som også kjører uptime-overvåking, besøkstelling og visningstelling via KV.

### Stack

- Next.js 15 (App Router, `output: 'export'`) + React 19, TypeScript, Tailwind v4
- Innhold: markdown-poster i `content/blog/` (gray-matter + react-markdown + remark-gfm)
- Hosting: Cloudflare Workers + Static Assets (binding `ASSETS`), KV (binding `STATUS`), cron `*/5 * * * *`
- Worker (`src/`) håndterer kanonisk vert (301 fra `www` og `*.workers.dev`), strict hash-CSP for HTML den kan dekode, alle security-headere og API-ene under `/api/`

### Scripts

| | |
|--|--|
| `npm run dev` | Next dev-server med Turbopack |
| `npm run build` | Statisk eksport til `out/` |
| `npm run lint` | ESLint (flat config, `next/core-web-vitals` + `next/typescript`) |
| `npm run typecheck` | `tsc --noEmit` for app **og** worker (`tsconfig.worker.json`) |
| `npm test` | Vitest — CSP-hashing, statushistorikk, tags, metrics, lesetid |
| `npm run cf-typegen` | Regenererer `worker-configuration.d.ts` fra `wrangler.jsonc` |
| `npm run deploy` | Manuell vei: `predeploy` (lint + typecheck + test) → build → `wrangler deploy` |

### CI/CD

Push til `main` → `.github/workflows/deploy.yml`: lint → typecheck → test → build → `wrangler deploy` → **`scripts/smoke.sh`** mot produksjon (sider, API-er, redirects, sikkerhetsheadere). Feiler smoke-testen, feiler deployen synlig. `ci.yml` kjører samme sjekker på PR-er.

Hemmeligheter i repoet: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

### Struktur

```
app/                Next App Router: forside, /blogg, feed.xml, sitemap, robots, OG-bilder
components/         React-komponenter (Hero, Skills, StatusDashboard, GeoMap, HalIdle, …)
content/blog/       Markdown-poster (frontmatter: title, description, date, tags)
context/            ThemeContext (light/dark uten FOUC)
data/               Skills og certifications
lib/                blog.ts, tags.ts (alias-normalisering), reading-time.ts, site.ts
scripts/            smoke.sh (post-deploy-verifisering)
src/                Cloudflare Worker (index.ts, csp.ts, status.ts, metrics.ts)
tests/              Vitest
wrangler.jsonc      Worker-konfig (ASSETS, STATUS KV, cron, custom domains)
```

### Statusovervåking

Crontrigger pinger hver `MONITORS`-oppføring i `src/status.ts` hvert 5. minutt og skriver et JSON-snapshot til KV (nøkkel `status`). `/api/status` serverer snapshot; forsiden (`/#status`) viser det med historikk per tjeneste, avkortet til `HISTORY_LIMIT` (149 ≈ 12,5 timer — monolittens 1:4:9).

Legg til en tjeneste ved å utvide `MONITORS`. Bruk `internal: true` for ruter som peker på dette nettstedet selv (ASSETS-binding må brukes — Workers blokkerer self-fetch over offentlig URL). En sjekk regnes som oppe kun ved endelig HTTP 200 (redirects følges).

### Metrikker

- **Visninger per post**: `GET/POST /api/views/<slug>` (KV `views:<slug>`); telles én gang per nettleserøkt fra postsiden, bot-UA-er ignoreres.
- **Besøk per land**: Workeren leser `request.cf.country` på menneskelige HTML-treff og aggregerer i KV (`geo`). `GET /api/geo` mater verdenskartet på forsiden. Ingen informasjonskapsler, ingen sporing av enkeltpersoner.
- **Lesetid** beregnes fra markdown (~200 ord/min, kodeblokker teller ikke).

### Deploy manuelt

Krever `wrangler login` og at KV-namespacet i `wrangler.jsonc` eksisterer (eller bytt id). Deretter `npm run deploy` — `predeploy` kjører lint/typecheck/test først.

### Status (soft launch)

Nettstedet kjører på `rozsoshnykh.no` (med 301 fra `www` og `d.rozsoshnykh.workers.dev`).
`robots: { index: false }` står inntil de første postene er publisert. Når innholdet er
klart: bytt `robots.index` til `true` i `app/layout.tsx` og send sitemap til Search Console.
