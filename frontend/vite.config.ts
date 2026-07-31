import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // @excalidraw/excalidraw (+ diagram deps) legitimately exceeds the 500 kB default.
    chunkSizeWarningLimit: 2000,
  },
})
