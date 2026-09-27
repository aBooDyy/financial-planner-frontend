import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { pwaOptions } from './pwa.config'

// Plain client-rendered SPA (no SSR). `tanstackRouter` must precede the React plugin.
export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
    tailwindcss(),
    VitePWA(pwaOptions),
  ],
  build: {
    // Rolldown drops `/*! @license … */` banners from emitted chunks unless asked; the
    // vendored Phosphor notice on the icon paths module has to ship with it.
    rollupOptions: {
      output: { comments: { legal: true } },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
