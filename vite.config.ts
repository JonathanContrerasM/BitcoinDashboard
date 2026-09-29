/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const PRICE_API_ORIGIN = 'https://api.kraken.com'

/**
 * Injects the Content-Security-Policy meta tag. The production build gets a strict policy;
 * the dev server additionally needs inline scripts and a websocket for React Fast Refresh / HMR.
 */
function contentSecurityPolicy(): Plugin {
  let isDev = false
  return {
    name: 'content-security-policy',
    configResolved(config) {
      isDev = config.command === 'serve'
    },
    transformIndexHtml(html) {
      const directives = [
        "default-src 'self'",
        isDev ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        isDev
          ? `connect-src 'self' ${PRICE_API_ORIGIN} ws://127.0.0.1:* ws://localhost:*`
          : `connect-src 'self' ${PRICE_API_ORIGIN}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
      ]
      return html.replace(
        '<!-- CSP -->',
        `<meta http-equiv="Content-Security-Policy" content="${directives.join('; ')}" />`,
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
