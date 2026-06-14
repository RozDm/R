// Runtime-only secrets aren't in wrangler.jsonc, so wrangler types can't
// generate them; declare them here so the worker code typechecks.

interface Env {
  TURNSTILE_SECRET?: string
}
