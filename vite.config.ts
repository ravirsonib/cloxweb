import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'favicon.svg',
        'favicon.png',
        'favicon-32.png',
        'favicon-48.png',
        'icons/apple-touch-icon.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/maskable-512.png',
        'brand/logo-clox.webp',
        'brand/logo-clox-light.webp',
      ],
      manifest: {
        name: 'CLOX',
        short_name: 'CLOX',
        description:
          'CLOX platform PWA — sender, carrier, driver, and ops verification against the live API.',
        theme_color: '#0A1F3C',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        lang: 'en',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell offline; never cache Nest API — always hit the real backend.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /\/v1\//],
        runtimeCaching: [
          {
            urlPattern: /\/v1\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) =>
              url.hostname === 'localhost' && (url.port === '3000' || url.port === '3001'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        // Enable SW in `vite` only when debugging PWA; production build is authoritative.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
  },
});
