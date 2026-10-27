import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // 将 sql-wasm.wasm 内联为 data URL，使构建产物支持双击 index.html 直接打开
  build: {
    assetsInlineLimit: 100 * 1024 * 1024,
    chunkSizeWarningLimit: 4096,
  },
})
