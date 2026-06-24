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
        short_name: 'BruchésiPhotos',
        theme_color: '#16a34a',
        background_color: '#0d1117',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
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
