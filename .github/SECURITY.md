# Security policy

This repository is the source of <https://rozsoshnykh.no> — a personal site
and blog: a static Next.js export on Cloudflare Workers static assets, plus
a small Worker for `/api/*` (contact form, visit counters, status).

## Reporting a vulnerability

Please report privately — not in a public issue:

- **GitHub:** Security → [Report a vulnerability](https://github.com/RozDm/R/security/advisories/new)
  (private vulnerability reporting), or
- **E-mail:** <contact@rozsoshnykh.no> (also in
  [`/.well-known/security.txt`](https://rozsoshnykh.no/.well-known/security.txt)).

Norwegian, English or Ukrainian are all fine. Useful to include: the URL or
file, what an attacker gains, and steps or a proof of concept.

This is a one-person project: I aim to answer within a week and to fix
confirmed issues as soon as I can. There is no bug bounty, but credit in the
fix is yours if you want it.

## Scope

In scope: the site and its API on `rozsoshnykh.no` (and
`mta-sts.rozsoshnykh.no`), and this repository's code and workflows.

Out of scope:

- volumetric denial of service, and exhausting the Cloudflare Free plan's
  daily Worker request quota (a known, accepted limit — pages keep working);
- reports from automated scanners without a demonstrated impact;
- missing headers or settings that `docs/cloudflare-security.md` documents
  as deliberate;
- third-party services the site uses (Cloudflare, Turnstile, GitHub) — report
  those to their vendors.
