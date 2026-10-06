// 建置後把 dist/index.html 複製一份成 dist/404.html。
// 這個站用 history 模式的網址（/products/101），靜態主機找不到那個檔案時會給 404 頁；
// GitHub Pages 這類主機會拿 404.html 當那個頁，於是還是載入我們的程式、由 Vue Router 接手。
// 其他主機（Netlify、nginx、IIS）要另外設「全部導到 index.html」，見 README。
import { copyFileSync, existsSync } from 'node:fs'

const from = new URL('../dist/index.html', import.meta.url)
const to = new URL('../dist/404.html', import.meta.url)
if (!existsSync(from)) {
  console.error('dist/index.html 不存在，先跑 npm run build')
  process.exit(1)
}
copyFileSync(from, to)
console.log('dist/404.html 已建立（SPA fallback）')
