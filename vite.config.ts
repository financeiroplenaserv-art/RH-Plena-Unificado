import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

const THEME_COLOR = '#16225C'
const BACKGROUND_COLOR = '#16225C'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      devOptions: {
        enabled: false,
        type: 'module',
      },
      manifest: {
        name: 'CORH — Plena',
        short_name: 'CORH',
        description: 'Controle Operacional e de RH da Plena',
        theme_color: THEME_COLOR,
        background_color: BACKGROUND_COLOR,
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'pt-BR',
        dir: 'ltr',
        icons: [
          {
            src: '/corh_icone_app_192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/corh_icone_app_512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/corh_icone_app_512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        // Precache enxuto: só o essencial para a shell abrir rápido.
        // Chunks lazy (xlsx, jspdf, pdfjs, html2canvas) e imagens de marketing
        // ficam fora — o navegador os baixa sob demanda (HTTP cache).
        maximumFileSizeToCacheInBytes: 1024 * 1024,
        globPatterns: [
          'index.html',
          'registerSW.js',
          'manifest.webmanifest',
          'assets/index-*.js',
          'assets/index-*.css',
          'assets/supabase-*.js',
          'assets/utils-*.js',
          'favicon*',
          'icons.svg',
          'apple-touch-icon.png',
          'corh_icone_app_*.png',
          'corh_coracao_icone_*.svg',
          'corh_coracao_icone_*_512.png',
          'logo_plena_30anos_redonda.png',
          'corh_abraco_final.svg',
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
})
