import { defineConfig } from 'vite'
import { execSync } from 'child_process'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: { outDir: 'dist', emptyOutDir: true },
  plugins: [
    {
      name: 'compile-yaml',
      buildStart() {
        execSync('node scripts/compile-yaml.js', { stdio: 'inherit' })
      }
    }
  ]
})
