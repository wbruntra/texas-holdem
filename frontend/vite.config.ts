import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { BACKEND_LOCAL_PORT } from '@scaffold/shared/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
