import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcjs from '@tailwindcss/vite'
import { compression } from 'vite-plugin-compression2'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcjs(),
    // Generate pre-compressed Brotli + gzip assets — Vercel serves these automatically
    compression({
      algorithms: ['brotliCompress', 'gzip'],
      exclude: [/\.(png|webp|jpg|ico|woff2)$/],
    }),
  ],
  server: {
    port: 3000,
    host: true,
  },
  build: {
    // Target modern browsers — removes unnecessary polyfills
    target: 'esnext',
    minify: 'esbuild',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-icons': ['lucide-react'],
          'vendor-supabase': ['@supabase/supabase-js'],
          // Split heavy, page-specific libs into separate chunks
          'vendor-charts': ['recharts'],
          'vendor-confetti': ['canvas-confetti'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})

