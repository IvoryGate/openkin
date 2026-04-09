import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/v1': 'http://127.0.0.1:3333',
      '/health': 'http://127.0.0.1:3333',
      '/metrics': 'http://127.0.0.1:3333',
      '/_internal': 'http://127.0.0.1:3333',
    },
  },
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@theworld/shared-contracts': new URL(
        '../../packages/shared/contracts/src/index.ts',
        import.meta.url,
      ).pathname,
      '@theworld/client-sdk': new URL(
        '../../packages/sdk/client/src/index.ts',
        import.meta.url,
      ).pathname,
    },
  },
})
