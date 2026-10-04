// Test stand-in for the Workers-only `cloudflare:email` module (aliased in
// vitest.config.ts). Keeps the raw MIME so tests can read what was sent.
export class EmailMessage {
  constructor(
    public readonly from: string,
    public readonly to: string,
    public readonly raw: string,
  ) {}
}
