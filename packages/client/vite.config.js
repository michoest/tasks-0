import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';

export default defineConfig(({ mode }) => {
  // Check if we're in development and certs exist
  const isDev = mode === 'development';
  const certsExist = isDev && fs.existsSync('../../certs/key.pem') && fs.existsSync('../../certs/cert.pem');

  return {
    plugins: [
      vue(),
      vuetify({ autoImport: true }),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'icon-192.svg', 'icon-512.svg'],
        manifest: {
          name: 'Tasks',
          short_name: 'Tasks',
          description: 'Manage household tasks and stay organized',
          theme_color: '#6366F1',
          background_color: '#F9FAFB',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: '/icon-192.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            },
            {
              src: '/icon-512.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/tasks\.api\.michoest\.com\/api\//,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 300
                }
              }
            }
          ],
          // Import custom service worker code for push notifications
          importScripts: ['/sw-custom.js']
        },
        devOptions: {
          enabled: true
        }
      })
    ],
    server: {
      host: '0.0.0.0',
      port: 5173,
      https: certsExist ? {
        key: fs.readFileSync('../../certs/key.pem'),
        cert: fs.readFileSync('../../certs/cert.pem'),
      } : undefined,
      proxy: {
        '/api': {
          target: 'https://localhost:3000',
          changeOrigin: false,
          secure: false,
          ws: true,
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // Forward cookies
              if (req.headers.cookie) {
                proxyReq.setHeader('cookie', req.headers.cookie);
              }
            });
          }
        }
      }
    }
  };
});
