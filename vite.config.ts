import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.GEMINI_API_KEY || ''),
    },
    plugins: [
      react(),
      VitePWA({
        injectRegister: null, // Critical: Disable automatic injection to use manual registration in index.tsx
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
        manifest: {
          name: 'Stocker - Professional Stock Analysis',
          short_name: 'Stocker',
          description: 'A comprehensive stock market dashboard featuring advanced charting, 5-day historical data analysis, and a personalized favorites list.',
          theme_color: '#010203',
          background_color: '#010203',
          display: 'standalone',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: 'icon-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'icon-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ],
          screenshots: [
            {
              src: 'screenshot-mobile.png',
              sizes: '540x1080',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'Mobile View'
            },
            {
              src: 'screenshot-desktop.png',
              sizes: '1280x720',
              type: 'image/png',
              form_factor: 'wide',
              label: 'Desktop Dashboard'
            }
          ]
        }
      })
    ],
  }
})
