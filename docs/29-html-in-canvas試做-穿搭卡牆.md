# 29　HTML-in-Canvas × WebGPU 試做：穿搭卡牆（待判定）

2026-10-27。使用者看了一個 HTML-in-Canvas 的儀表板 demo（vault `research/2026-10-27-html-in-canvas-bot-dashboard-逆向工程.md`），要我「拿全端班那專案試驗看看」。和 docs/07 一樣：**一輪有停損的試做**，不是正式功能，不連進導覽。

## 在哪裡、怎麼看

- 網址：`/lab/plates`。
- 要 Chromium 155 以上、WebGPU、`chrome://flags/#canvas-draw-element` 設 Enabled 後重啟（或站台申請 origin trial）。不支援、一般模式、視窗窄於 64rem 時，同一頁退回普通的卡片格，功能一樣，上面會寫為什麼。
- 右下角讀數：FPS、每秒抓圖次數（抓圖＝把一張卡的快照交給 GPU）、每秒 paint 事件、累計抓圖、卡數、GPU adapter。

## 做法（`src/lab/plates.js`、`src/views/lab/PlatesLabView.vue`）

- 穿搭卡**還是現在的 `OutfitCard`**，沒有改它。六張卡放在 `<canvas layoutsubtree content="drawable">` 裡（兩個屬性都寫：155 認舊名字），每張包一層 `.plate`。
- WebGPU（手寫，不用框架）每幀：畫底（頁面底色、一團主題色的光、紙紋）→ 每張卡一層柔邊影子 → 每張卡的快照貼在帶透視的板子上。六張排成一排微彎的弧：離中央愈遠愈往後退（z −70／格）、愈往內轉（ry 6°／格）。
- 快照來自 `queue.drawElementImageToTexture({source: el}, {texture})`；只在 canvas 的 `paint` 事件說那張卡變了才重抓，每卡每秒最多 20 次，看不見的不抓，字型載好後整批重抓一次。
- 每幀把板子的 4×4 矩陣寫回 `el.style.transform`（角點移動超過 0.05 px 才寫）再呼叫 `canvas.updateElementGeometry(el)`，所以傾斜板子上的連結、按鈕、收藏、Tab 焦點全是真的 DOM 在接。
- 滑過或聚焦：那張卡抬起來（z +90）、轉正、放大 6%；減少動態時直接到位、沒有進場動畫。
- 離開頁面 `dispose()`：貼圖、buffer、device 全釋放。只在這一頁載入（lazy chunk 14.7 KB，gzip 6.9 KB）。

## 停損條件（建置前寫在頁面上，這裡抄一份）

1. 在開了旗標的 Chrome 155 以上：滑過卡片、點「整套加入購物車」、點標題、Tab 走，任何一個位置對不上 → 不做。
2. 滑過卡片時 FPS 低於 30 → 不做。
3. 11/2 全組確認時，組員的瀏覽器開不了這一頁（沒旗標、不是 Chromium）→ 留在試做，不進正式頁。

判定人：(1)(2) 使用者看，(3) 全組。桌機無頭 Chrome 的數字只當對照。

## 實測了什麼（`scripts/plates-check.mjs`，headless Chrome 155、真 GPU、視口 1440×900；截圖 `docs/r19-shots/plates/`）

| 檢查 | 結果 |
|---|---|
| API 有（`drawElementImageToTexture`、`updateElementGeometry`）、頁面進 plates 模式 | 過 |
| 六張卡都抓到圖、畫出來 | 過（`01-wall.png`） |
| 滑過第三張：DOM 有 `:hover`、板子抬起 | 過（`02-hover.png`） |
| 點傾斜板子上的「整套加入購物車」：回饋「已加入 4 件」、購物車 4 筆 | 過（`03-added.png`） |
| Tab 從卡外走進卡裡的連結與收藏鈕 | 過（`04-tab.png`） |
| 閒置 2 秒：零重抓；FPS 130 | 過 |
| 點標題 → `/outfits/3`；回來牆重建 | 過（`05-outfit-page.png`） |
| console 錯誤、WebGPU 錯誤 | 0 |

## 踩到的坑

- **卡片裡人形的「呼吸」（OutfitLook 的無限 CSS 動畫）會讓每張卡每一幀都算「變了」**：八張卡每秒抓 152 次，剛好撞到每卡 20 次的上限。牆上先關掉（`.plate :deep(*) { animation: none }`）；要晃就在 GPU 端晃板子，別讓快照一直變。這是這條路線的根本限制：**卡片內容每變一次就要重抓一次**。
- 卡的高度要照內容量（每套件數不同，四件的約 810 px）：先前固定 560／680 會把底下的按鈕列切掉，快照裡沒有、點也點不到。現在先量 `scrollHeight` 再登記。
- 驗收腳本第一次跑被 headless 的視口騙了：`--window-size=1440,900` 的視口只有 743 高，牆的下緣在摺線外，`elementFromPoint` 對摺線外一律回 null，看起來像「按鈕點不到」。固定視口（`Emulation.setDeviceMetricsOverride`）就好了。
- Chrome 155 要同時寫 `layoutsubtree` 與 `content="drawable"`；不要開 `--enable-experimental-web-platform-features`（原型階段實測它讓重抓後的卡片消失）。

## 沒有驗證

- 使用者自己的 Chrome（要開旗標）與真人滑鼠；手機（這一輪只做桌機，窄螢幕直接退回卡片格）；DPR 2 以上的抓圖成本；讀屏（卡片的 `role="region"` 等由 OutfitCard 原樣帶進來，沒聽過）；Safari／Firefox 一律退回卡片格，沒看。
- 視覺：這只是「同一張卡放到牆上」，沒有為牆重新設計卡片（陰影、間距、進場都是最素的）。

## 判定後

- 過：下一步才談要不要把探索區的穿搭舞台（`OutfitStage`）換成這種牆；代價是只有 Chromium 155 以上加旗標能看，正式站要申請 origin trial，所以在 11/2 之前只會是試做。
- 不過：刪 `src/lab/plates.js`、`src/views/lab/PlatesLabView.vue`、這條路由、`scripts/plates-check.mjs` 與這份文件以外的痕跡；理由記進 vault。
