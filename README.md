# fuen58-fashion-frontend

FUEN58 專題（服飾電商）的前台。Vue 3、Vite、Vue Router、JavaScript（Composition API）。

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

開發用腳本：`scripts/gen-products.py` 產生商品假資料；`scripts/shop-check.mjs` 用無頭 Chrome 走一遍購買流程；`scripts/shots.mjs` 任意網址截圖。
規劃文件（功能清單、介面方向）在 vault 的 `projects/ispan-fuen58/`。

目前資料全部來自 `src/api/mock/` 的假資料，欄位還沒有和後端對過。
