import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import istanbul from 'vite-plugin-istanbul';
import { managedDistRoot } from './scripts/lib/artifact-roots.mjs';

const host = process.env.TAURI_DEV_HOST;
const buildTarget = 'es2020';
const coverageEnabled = process.env.VITE_COVERAGE === 'true';

export default defineConfig({
  plugins: [
    react(),
    istanbul({
      include: ['src/**/*'],
      exclude: ['tests/**', 'src/types.ts'],
      requireEnv: true,
      checkProd: true,
      forceBuildInstrument: false,
    }),
  ],
  clearScreen: false,
  server: {
    host: host || false,
    ...(host
      ? {
          hmr: {
            host,
            port: 1421,
            protocol: 'ws' as const,
          },
        }
      : {}),
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    emptyOutDir: true,
    minify: process.env.TAURI_DEBUG ? false : 'esbuild',
    outDir: managedDistRoot(),
    sourcemap: coverageEnabled || Boolean(process.env.TAURI_DEBUG),
    target: buildTarget,
  },
});
