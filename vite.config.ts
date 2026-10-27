import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'approved-public-assets',
    apply: 'build',
    generateBundle() {
      // Preserve originals in public, but distribute only reviewed resources.
      for (const fileName of ['army-mark.svg', 'manifest.webmanifest', 'offline.html', 'social-push-sw.js']) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(new URL(`./public/${fileName}`, import.meta.url)) })
      }
      this.emitFile({ type: 'asset', fileName: 'runtime-license-notices.txt', source: readFileSync(new URL('./docs/runtime-license-notices.txt', import.meta.url)) })
    },
  }],
  build: { copyPublicDir: false },
})
