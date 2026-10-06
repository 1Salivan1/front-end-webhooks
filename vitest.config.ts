import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The required test exercises the HTTP layer, not the DOM.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
