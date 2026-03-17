import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcjs from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcjs(),
  ],
  server: {
    port: 3000,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-icons': ['lucide-react'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})

