import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const refexTarget = (env.VITE_REFEX_BASE_URL || '').replace(/\/$/, '')
  const ordersTarget = (env.VITE_ORDERS_BASE_URL || 'https://mmts.iamgds.com').replace(/\/$/, '')
  const qrTarget = (env.VITE_QR_BASE_URL || 'https://meeticketqr.iamgds.com').replace(/\/$/, '')

  const proxy = {}
  if (refexTarget) {
    proxy['/refex-api'] = {
      target: refexTarget,
      changeOrigin: true,
      secure: true,
      rewrite: (path) => path.replace(/^\/refex-api/, ''),
    }
  }
  if (ordersTarget) {
    proxy['/orders-api'] = {
      target: ordersTarget,
      changeOrigin: true,
      secure: true,
      rewrite: (path) => path.replace(/^\/orders-api/, ''),
    }
  }
  if (qrTarget) {
    proxy['/qr-api'] = {
      target: qrTarget,
      changeOrigin: true,
      secure: true,
      rewrite: (path) => path.replace(/^\/qr-api/, ''),
    }
  }

  return {
    plugins: [react()],
    build: {
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          // Parallel download of vendor vs app on slow networks (HTTP/2).
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (
              id.includes('react-dom') ||
              id.includes('react-router') ||
              id.includes('/jotai/') ||
              id.includes('\\jotai\\') ||
              /node_modules\/react\//.test(id) ||
              /node_modules\\react\\/.test(id)
            ) {
              return 'vendor'
            }
            return undefined
          },
        },
      },
    },
    server: {
      // Ola calls the sandbox host directly (no /ola-api proxy).
      // Refex and Orders need a dev proxy for CORS.
      proxy: Object.keys(proxy).length ? proxy : undefined,
    },
  }
})
