import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      // Workers-only module imported by the contact route; tests/worker/*
      // run the route handlers under plain Node with this stand-in.
      'cloudflare:email': path.resolve(__dirname, './tests/worker/stubs/cloudflare-email.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
