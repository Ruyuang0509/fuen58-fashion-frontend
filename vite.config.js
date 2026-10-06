import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // 放到 GitHub Pages 時網址有一層 repo 名（https://<帳號>.github.io/fuen58-fashion-frontend/），
  // 建置時由工作流程設 GITHUB_PAGES=1；本機與其他主機維持根路徑
  base: process.env.GITHUB_PAGES ? '/fuen58-fashion-frontend/' : '/',
  resolve: {
    // 讓 import 可以寫 '@/components/...'，不必數 ../ 有幾層
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // 固定埠號；被占用時直接報錯，不要悄悄換到別的埠
  server: { port: 5183, strictPort: true },
})
