import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

import plainText from 'vite-plugin-plain-text'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), plainText(['**/*.v', '**/*.xdc'])],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  define: { 'process.env': {} }
})
