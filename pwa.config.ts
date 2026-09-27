import type { VitePWAOptions } from 'vite-plugin-pwa'

// `fp-bg` in the light theme: the splash and title bar before the app has painted.
const LIGHT_BG = '#FAF8F4'

export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'prompt',
  // The app registers the worker itself, through `virtual:pwa-register/react`.
  injectRegister: false,
  devOptions: { enabled: false },
  manifest: {
    id: '/',
    name: 'Means — Financial Planner',
    short_name: 'Means',
    description:
      'Track wallets, spending, budgets and savings goals — on your device, online or off.',
    lang: 'en',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: LIGHT_BG,
    background_color: LIGHT_BG,
    categories: ['finance', 'productivity'],
    icons: [
      { src: 'favicon.svg', type: 'image/svg+xml', sizes: 'any' },
      { src: 'icon-192.png', type: 'image/png', sizes: '192x192' },
      { src: 'icon-512.png', type: 'image/png', sizes: '512x512' },
      {
        src: 'icon-maskable-192.png',
        type: 'image/png',
        sizes: '192x192',
        purpose: 'maskable',
      },
      {
        src: 'icon-maskable-512.png',
        type: 'image/png',
        sizes: '512x512',
        purpose: 'maskable',
      },
      {
        src: 'icon-monochrome-512.png',
        type: 'image/png',
        sizes: '512x512',
        purpose: 'monochrome',
      },
    ],
  },
  // The glob below already precaches every file in the build, public icons included.
  includeManifestIcons: false,
  workbox: {
    // Everything the build emits is precached, so a new chunk type never needs a list edit.
    // The manifest is added by the plugin itself; `_headers` is host config, never served.
    globPatterns: ['**/*'],
    globIgnores: ['**/*.map', '_headers', 'manifest.webmanifest'],
    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
    navigateFallback: 'index.html',
    // A same-origin API (the Worker proxy) must always reach the network, never the shell.
    navigateFallbackDenylist: [/^\/api\//],
    cleanupOutdatedCaches: true,
  },
}
