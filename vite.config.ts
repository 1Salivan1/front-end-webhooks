import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The service worker scope must be the site root, otherwise MSW cannot
  // intercept /v1/* requests.
  base: '/',
})
