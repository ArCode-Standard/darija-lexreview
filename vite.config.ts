import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const runtimeEnv =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const disableHmr =
  runtimeEnv.DISABLE_HMR === 'true' || Boolean(runtimeEnv.APPLET_ID)

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: [
        'icon.svg',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-maskable-512x512.png',
        'assets/darija-lexreview-emblem.png',
        'assets/darija-lexreview-logo.png',
      ],
      manifest: {
        id: '/',
        name: 'Darija LexReview — مراجعة الدارجة المغربية',
        short_name: 'LexReview',
        description:
          'مساحة موثوقة لمراجعة مفردات الدارجة المغربية وتوثيق شواهدها قبل اعتمادها في المعجم الرسمي.',
        dir: 'rtl',
        lang: 'ar',
        theme_color: '#050507',
        background_color: '#050507',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'المراجعة السريعة',
            short_name: 'مراجعة',
            url: '/review',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'تصفح المعجم',
            short_name: 'المعجم',
            url: '/lexicon',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'إضافة مفردة جديدة',
            short_name: 'إضافة',
            url: '/contribute',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'خارطة تغطية المعجم',
            short_name: 'التغطية',
            url: '/insights',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/about/,
          /^\/methodology/,
          /^\/privacy/,
          /^\/terms/,
          /^\/reporting/,
          /^\/attribution/,
          /^\/auth\/callback/,
          /^\/404\.html/,
        ],
        runtimeCaching: [
          {
            urlPattern:
              /^https:\/\/raw\.githubusercontent\.com\/ArCode-Standard\/moroccan-darija-dataset\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'darija-official-corpus-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 12,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
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
          )
            return 'react-vendor'
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
