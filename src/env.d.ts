// Runtime-only secrets aren't in wrangler.jsonc, so wrangler types can't
// generate them; declare them here so the worker code typechecks.

interface Env {
  TURNSTILE_SECRET?: string
  // Cloudflare account id + API token used to call the AE SQL API. Both
  // optional: the /api/timeseries route returns an empty series when either
  // is missing, so deploying the code never breaks the front end.
  CF_ACCOUNT_ID?: string
  AE_API_TOKEN?: string
  // NetBox's admin URL for the uptime cron (src/status.ts monitors()); kept
  // out of the public repo. Missing → NetBox isn't monitored.
  NETBOX_URL?: string
}
