---
name: audit
description: Whole-project audit producing a prioritized improvement list (P0/P1/P2/P3) with risk and time estimates, scoped to this site's free-tier Cloudflare constraints. Use when the user asks to analyze/audit the project, find what can be improved, what's outdated, or what to do next.
---

# Project audit

Produce a focused, opinionated improvement list for `rozsoshnykh.no`. The output is a punch list the user can pick from, not an essay.

## Scope

Audit everything that ships:
- App: `app/`, `components/`, `lib/`, `data/`, `content/`, `public/`, `app/globals.css`.
- Worker: `src/` (`index.ts`, `csp.ts`, `http.ts`, `status.ts`, `metrics.ts`, `contact.ts`, `timeseries.ts`, `routes/*`).
- Build/deploy: `package.json`, `next.config.js`, `wrangler.jsonc`, `.github/workflows/*`, `scripts/*`, `tsconfig*.json`.
- Docs: `CLAUDE.md`, `src/CLAUDE.md`, `README.md`, `docs/history.md` (drift against code is a finding; narrative belongs in history.md, rules in the CLAUDE.md files).
- Tests: `tests/*.ts`.

Look for:
- **Security**: CSP, headers, secrets handling, rate limits, validation, Turnstile gating, DMARC/DNSSEC posture.
- **Performance**: initial JS, image weight, RSC/Server Component opportunities, dynamic-import candidates, font/CSS payload.
- **Correctness**: dead code, stale comments, drift between docs and code, broken types, untested paths.
- **Modernization**: Next 16, React 19, TypeScript 6 features actually used; obsolete patterns; dependencies a major behind.
- **SEO**: canonicals, sitemap/robots correctness, JSON-LD coverage, OG images.
- **Operational**: free-tier limits (KV 1k writes/day, D1 100k writes/day), monitoring blind spots, missing alerts.

## Hard constraints (do NOT recommend violating)

- **Free Cloudflare tier only.** R2 requires a payment card on file — never recommend it. KV writes are scarce — never add a KV write per request.
- **DNSSEC stays on.** Never recommend disabling it without first removing DS at the registrar (would cause global SERVFAIL).
- **Sandbox egress varies.** Newer remote sessions can `curl` production through the agent proxy (use it to verify findings live); older web sandboxes have no egress. Never make a recommendation *depend* on being able to reach production from the dev environment — the deploy gate is `scripts/smoke.sh` in CI, not ad-hoc curl.
- **`package.json` is not `type: module`.** Don't propose making it one — it breaks Next 16 / turbopack config load.
- **ESLint stays on 9.** `eslint-plugin-react` via `eslint-config-next` is not ESLint-10-compatible. Don't propose a bump.
- **`workers_dev: true` stays in `wrangler.jsonc`.** Setting it false silently breaks 301s.
- **`HISTORY_LIMIT = 149` is intentional** (monolith 1:4:9 — the 2001 theme is load-bearing). Don't propose "fixing" it.
- **`%USERNAME%` in the intro is a literal joke**, not a template variable.
- **`/kontakt` and `/status` stay `noindex`** permanently; never propose adding them to the sitemap.
- **`StatusDashboard` is code-split** (`LazyStatusDashboard.tsx`), so the smoke-checked `Driftsstatus` heading must stay in the server component `Status.tsx`.

## Workflow

1. **Survey first, read second.** Use `Glob`/`Grep` to map the codebase, then `Read` only files where a finding looks plausible. Don't read every file.
2. **For each potential finding**, ask: is it real (not a stale assumption from earlier sessions), is it within scope (the hard constraints above), is the fix cheap relative to the win?
3. **Group findings into priority tiers.** Use the rubric below — be honest about risk.
4. **Produce the report** in the exact format below. No preamble, no follow-up offer to implement — the user will pick.

## Priority rubric

- **P0** — security, data loss, broken prod, blocking launch. Always recommend doing first.
- **P1** — clear quality/perf wins on hot paths, no schema change, < 1 day work, low risk.
- **P2** — refactors and tightenings: cleaner architecture, smaller bundles, follow-up to a P0/P1 — visible but not urgent.
- **P3** — nice-to-have / conditional / waiting on something external (e.g. ≥5 posts before semantic search makes sense).

## Output format

Use exactly this shape (markdown, no extra prose around it):

```
## Audit — <YYYY-MM-DD>

### P0 — critical
| # | Item | Why it matters | Effort | Risk |
|---|------|----------------|--------|------|
| 1 | <short title> | <one line> | <e.g. 30 min> | low/med/high |
...

### P1 — high-value, low-risk
<same table shape>

### P2 — cleanup / hardening
<same table shape>

### P3 — later / conditional
<same table shape>

### Out of scope / rejected
- <thing the user might expect, with a one-line reason it's not on the list>
```

Tables stay tight: max ~6 items per tier. If you find more, fold the least-impactful into a single "Misc" row with a comma-separated list.

## Anti-patterns to avoid

- Inventing problems to fill a tier. An empty tier is fine — write "_(none)_".
- "Migrate to X" without a concrete reason this codebase benefits.
- Recommending big abstractions where three similar lines work.
- Citing best-practice articles without checking whether the practice applies here (e.g. don't recommend ISR for a static export).
- Recommending tests for code that's already covered by `scripts/smoke.sh` in CI.
