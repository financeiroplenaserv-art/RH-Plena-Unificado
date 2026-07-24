/// <reference lib="WebWorker" />
/// <reference types="vite-plugin-pwa/client" />

import { clientsClaim, skipWaiting } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

// Ativa o SW novo imediatamente (sem esperar todas as abas fecharem)
// e assume o controle das abas abertas. Sem isso, usuários ficam
// presos em builds antigos do app (foi a causa do bug do PDF da ocorrência).
skipWaiting()

// Claim clients immediately
clientsClaim()

// Clean up old caches
cleanupOutdatedCaches()

// Precache all assets built by Vite
precacheAndRoute(self.__WB_MANIFEST)

// Cache Google Fonts CSS
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  })
)

// Cache Google Fonts webfonts files
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  })
)

// SPA fallback: try network first, then cache for navigation
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'pages-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
      }),
    ],
  })
)
