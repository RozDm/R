import { defineConfig } from 'vitest/config'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))

// .mts: an ES module by its extension (package.json is not "type": "module",
// CLAUDE.md Gotchas), so Vite loads it natively — a .ts config here drew
// Vite's "ESM syntax in a file loaded as CommonJS" warning on every run.
export default defineConfig({
  resolve: {
    alias: {
      '@': ROOT,
      // Workers-only module imported by the contact route; tests/worker/*
      // run the route handlers under plain Node with this stand-in.
      'cloudflare:email': join(ROOT, 'tests/worker/stubs/cloudflare-email.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
