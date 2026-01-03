import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { BACKEND_LOCAL_PORT } from '@holdem/shared/config'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${BACKEND_LOCAL_PORT}`,
        changeOrigin: true,
        ws: true,
      },
      '/ws': {
        target: `http://localhost:${BACKEND_LOCAL_PORT}`,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
