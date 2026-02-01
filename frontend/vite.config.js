import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            editor: ['@monaco-editor/react', 'monaco-editor'],
          }
        }
      }
    },
    preview: {
      port: 4173,
    },
    server: {
      port: 5173,
      strictPort: false,
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    }
  }
})
