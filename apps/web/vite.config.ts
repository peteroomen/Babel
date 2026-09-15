import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Build to a `dist/` at the repository root rather than `apps/web/dist`.
 *
 * Vercel's Vite preset looks for an output directory named `dist` relative to
 * the project root, and a first deploy showed it using that default rather than
 * the `outputDirectory` in vercel.json (STATIC_BUILD_NO_OUT_DIR: 'No Output
 * Directory named "dist" found'). Emitting to the root means the build lands
 * where the preset looks even if vercel.json's outputDirectory is ignored, so
 * hosting configuration cannot silently disagree with the build again.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('../../dist', import.meta.url)),
    emptyOutDir: true,
  },
});
