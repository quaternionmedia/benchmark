import { defineConfig } from 'vite'
import { execSync } from 'child_process'

export default defineConfig({
  root: '.',
  base: '/benchmark/',
  publicDir: 'public',
  build: { outDir: 'dist', emptyOutDir: true },
  plugins: [
    {
      name: 'compile-yaml',
      buildStart() {
        execSync('node scripts/compile-yaml.js', { stdio: 'inherit' })
      }
    },
    {
      // Vite dev server doesn't map .webmanifest → application/manifest+json;
      // Chrome rejects the PWA manifest without the correct Content-Type.
      name: 'webmanifest-mime',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.endsWith('.webmanifest')) {
            res.setHeader('Content-Type', 'application/manifest+json')
          }
          next()
        })
      }
    }
  ]
})
