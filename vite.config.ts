/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // B6 — installable PWA: app shell precached; heavy art (24 MB of hex
    // maps) and structure icons cached at runtime instead; War API with a
    // network-first fallback so the last snapshot works offline.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Foxhole Swiss Army Knife',
        short_name: 'FoxholeSAK',
        description: 'Production, deployment, logistics and attack planner for Foxhole',
        theme_color: '#0f172a',
        background_color: '#020617',
        display: 'standalone',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html}'],
        runtimeCaching: [
          {
            urlPattern: /\/(maps|icons)\/.+\.png$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fsak-art',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          {
            // Detected road network overlay — static, fetched on first toggle.
            urlPattern: /\/roads\.geojson$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fsak-roads',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          {
            urlPattern: /^https:\/\/war-service-live\.foxholeservices\.com\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'fsak-warapi', networkTimeoutSeconds: 6 },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
