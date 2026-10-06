import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    // 讓 import 可以寫 '@/components/...'，不必數 ../ 有幾層
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // 固定埠號；被占用時直接報錯，不要悄悄換到別的埠
  server: { port: 5183, strictPort: true },
})
