import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5176,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4175,
    strictPort: true,
  },
})
