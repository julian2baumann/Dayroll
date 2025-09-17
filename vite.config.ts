import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'html'],
      exclude: [
        'src/main.tsx',
        'vite.config.ts',
        'playwright.config.ts',
        'tailwind.config.js',
        'postcss.config.js',
        '**/*.config.*',
        '**/vite-env.d.ts',
      ],
    },
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
})
