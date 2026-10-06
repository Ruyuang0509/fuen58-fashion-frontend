# fuen58-fashion-frontend

FUEN58 專題「今天穿什麼」的前台：天氣接到穿搭的服飾電商（課程作品，品牌皆虛構）。Vue 3、Vite、Vue Router、GSAP、JavaScript（Composition API）。

**即時版（推到 main 自動部署）**：<https://ruyuang0509.github.io/fuen58-fashion-frontend/>

## 給組員

- 直接開上面的網址就能逛；會員與結帳的示範帳號是 `demo@example.com`／`demo1234`（假資料，存在你自己瀏覽器的 localStorage）。
- 目前**全部是假資料**（`src/api/mock/`），欄位與端點的提案在 [docs/api-契約草案.md](docs/api-契約草案.md)——後端請以這份對，有要改的直接改它再告訴我。
- 每一輪做了什麼、為什麼這樣做，在 `docs/01`～`docs/06`。
- 要在本機跑：裝 Node 22 以上，然後照下面兩個指令。

```bash
npm install
```

```bash
npm run dev
```

開 <http://localhost:5183>。

- `npm run build`：產生正式版到 `dist/`
- `npm run check:contrast`：計算全站文字與背景的對比度，改過顏色後要跑

逐檔解說（讀的順序）：

1. [docs/01-全站骨架解說.md](docs/01-全站骨架解說.md)：路由、版面、一句話列、穿搭卡、假資料 API 層
2. [docs/02-入口「天空」逐檔解說.md](docs/02-入口「天空」逐檔解說.md)：首頁＝天空第一屏＋店
3. [docs/03-購買路徑逐檔解說.md](docs/03-購買路徑逐檔解說.md)：商品頁、購物車、搜尋、商品資料層
4. [docs/04-基底補完逐檔解說.md](docs/04-基底補完逐檔解說.md)：資料模型翻正、品牌頁、會員與結帳 8 頁、部署後備
5. [docs/05-天空貫穿探索區逐檔解說.md](docs/05-天空貫穿探索區逐檔解說.md)：SkyPage 骨架、穿搭頁、新頂欄、會動的衣服
6. [docs/06-GSAP編排逐檔解說.md](docs/06-GSAP編排逐檔解說.md)：GSAP 的分工規矩、捲動連動、衣服飛到穿搭頁、一句話列重排
7. [docs/07-three試做-一片布.md](docs/07-three試做-一片布.md)：three.js 的試做（`/lab/cloth`）與停損條件；使用者已判過（互動性）
8. [docs/08-同一片天空與細修逐檔解說.md](docs/08-同一片天空與細修逐檔解說.md)：探索區共用一個殼、圓角、穿搭卡 hover、一句話列「給誰穿」

給後端組員的：[docs/api-契約草案.md](docs/api-契約草案.md)（端點、欄位、錯誤格式；11/2 看 DB 前要對）。

開發用腳本：`scripts/gen-products.py` 產生商品假資料；`scripts/shop-check.mjs` 與 `scripts/member-check.mjs` 用無頭 Chrome 分別走一遍購買流程與會員／結帳流程；`scripts/shots.mjs` 任意網址截圖；`npm run build` 後會自動多出 `dist/404.html`（靜態主機的 SPA fallback；用 Netlify／nginx 的話要另設全部導到 `index.html`）。

示範帳號（假資料，發表時用）：`demo@example.com`／`demo1234`。會員與訂單的假資料存在瀏覽器 localStorage 的 `account`，要重置就在主控台跑 `localStorage.removeItem('account')` 再重新整理。
規劃文件（功能清單、介面方向）在 vault 的 `projects/ispan-fuen58/`。

目前資料全部來自 `src/api/mock/` 的假資料，欄位還沒有和後端對過。
