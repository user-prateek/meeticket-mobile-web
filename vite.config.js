import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const refexTarget = (env.VITE_REFEX_BASE_URL || '').replace(/\/$/, '')

  return {
    plugins: [react()],
    server: {
      proxy: refexTarget
        ? {
            '/refex-api': {
              target: refexTarget,
              changeOrigin: true,
              secure: true,
              rewrite: (path) => path.replace(/^\/refex-api/, ''),
            },
          }
        : undefined,
    },
  }
})
