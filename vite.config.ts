import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'words.json'],
      manifest: {
        name: 'Deutsch Vokabeln',
        short_name: 'Vokabeln',
        description: 'German vocabulary trainer – learn words with spaced repetition',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'fullscreen',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
        ],
        categories: ['education']
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json,mp3}']
      },
      devOptions: { enabled: true }
    })
  ]
})
