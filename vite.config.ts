import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const runtimeEnv =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const disableHmr =
  runtimeEnv.DISABLE_HMR === 'true' || Boolean(runtimeEnv.APPLET_ID)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: [
      'ajv',
      'ajv/dist/2020',
      'ajv-formats',
      'recharts',
      'lucide-react',
      '@supabase/supabase-js',
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/')
          ) return 'react-vendor'
          if (id.includes('/@supabase/')) return 'supabase-vendor'
          if (id.includes('/recharts/') || id.includes('/d3-')) return 'charts-vendor'
          if (id.includes('/ajv/') || id.includes('/ajv-formats/')) return 'validation-vendor'
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    hmr: disableHmr ? false : undefined,
  },
})
