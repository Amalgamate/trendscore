import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  base: '/',

  plugins: [
    react(),
    svgr(),
  ],

  resolve: {
    alias: { '@': '/src' },
  },

  server: {
    port: Number(process.env.VITE_PORT || 3000),
    open: true,
    strictPort: true,
    // Proxy /api calls to the local Express server so the HTTPS frontend
    // never makes mixed-content requests to http://localhost:5000.
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },

  // Pre-bundle frequently used heavy deps to reduce cold-start churn in dev.
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'recharts',
      'jspdf',
      'html2canvas',
      'exceljs',
      'socket.io-client',
      'react-big-calendar',
      'react-day-picker',
      'date-fns',
      'lucide-react',
      'qrcode.react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-slot',
      '@radix-ui/react-tabs'
    ]
  },

  build: {
    outDir: 'build',
    // Source maps bloat the build by 2× and serve no purpose in production.
    // Enable only when debugging a prod issue, then redeploy without.
    sourcemap: false,
    assetsDir: 'assets',
    // Raise the chunk warning threshold — we are intentionally splitting
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        /**
         * Manual chunk splitting strategy
         * Goal: keep the initial JS that must load on every page < 200 KB.
         * Heavy libraries are split into their own named chunks so they:
         *   (a) load lazily only when first needed
         *   (b) are cached by the browser independently of app code changes
         */
        manualChunks(id) {
          // ── Charting — recharts + d3 helpers (~350 KB) ─────────────────────
          if (id.includes('node_modules/recharts') ||
              id.includes('node_modules/d3-') ||
              id.includes('node_modules/victory-')) {
            return 'vendor-charts';
          }
          // ── PDF generation (~800 KB) ─────────────────────────────────────
          if (id.includes('node_modules/jspdf') ||
              id.includes('node_modules/html2canvas')) {
            return 'vendor-pdf';
          }
          // ── Spreadsheet export (~1.5 MB) ─────────────────────────────────
          if (id.includes('node_modules/exceljs')) {
            return 'vendor-excel';
          }
          // ── Calendar (~300 KB) ───────────────────────────────────────────
          if (id.includes('node_modules/react-big-calendar') ||
              id.includes('node_modules/react-day-picker') ||
              id.includes('node_modules/date-fns')) {
            return 'vendor-calendar';
          }
          // ── Socket.io client (~200 KB) ───────────────────────────────────
          if (id.includes('node_modules/socket.io-client') ||
              id.includes('node_modules/engine.io-client')) {
            return 'vendor-socket';
          }
          // ── Radix UI primitives (~300 KB combined) ───────────────────────
          if (id.includes('node_modules/@radix-ui')) {
            return 'vendor-radix';
          }
          // ── React core — always cached separately ────────────────────────
          if (id.includes('node_modules/react') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react-router-dom') ||
              id.includes('node_modules/scheduler')) {
            return 'vendor-react';
          }
        },
      },
    },
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
});
