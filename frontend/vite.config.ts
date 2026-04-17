import path from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  // Default 8889 — matches backend\run_api.bat (avoids stale processes on 8888).
  const proxyTarget = (
    env.VITE_PROXY_TARGET?.trim() ||
    env.VITE_API_URL?.trim() ||
    'http://127.0.0.1:8889'
  ).replace(/\/$/, '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
          timeout: 180_000,
          proxyTimeout: 180_000,
          rewrite: (p) => {
            const stripped = p.replace(/^\/api/, '')
            return stripped.length > 0 ? stripped : '/'
          },
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.error(
                `[vite] /api proxy → ${proxyTarget} failed: ${err.message}\n` +
                  `  Start backend: backend\\run_api.bat  (port 8889)  or  uvicorn ... --port 8889\n` +
                  `  Or set VITE_PROXY_TARGET / VITE_API_URL in frontend/.env to your uvicorn port`,
              )
            })
          },
        },
      },
    },
  }
})
