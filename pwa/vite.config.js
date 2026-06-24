import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Bruchési Photos',
        short_name: 'Bruchési',
        description: 'Photos de votre enfant au camp Bruchési',
        lang: 'fr',
        theme_color: '#E5823B',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Le SW Workbox généré importe nos gestionnaires de push/notificationclick
        importScripts: ['/push-sw.js'],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/parents\/photos/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-photos', networkTimeoutSeconds: 10 },
          },
        ],
      },
    }),
  ],
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
