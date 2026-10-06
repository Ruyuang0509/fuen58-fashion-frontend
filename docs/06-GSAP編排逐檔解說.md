# 06　第十二輪：GSAP——捲動連動、衣服飛過去、整句重排

2026-10-06。使用者問要不要投入 GSAP 與 three.js；我的建議是 GSAP 現在就加、three.js 做一輪有停損的試做，使用者裁決「GSAP 先」。

## 為什麼加、怎麼分工

到第十一輪為止動態全是 CSS（keyframes、transition、`TransitionGroup`）加一小段 Web Animations API（飛入購物車）。接下來要做的三件事 CSS 做得辛苦：捲動時多個東西綁在同一條進度上、衣服從卡片飛到另一頁、一句話改條件時整句滑到新位置。GSAP 3.15（`gsap`，Standard「no charge」授權，外掛都在套件裡）各有一個外掛對應：ScrollTrigger、Flip、（SplitText 這輪沒用到）。

**分工規矩，寫在 `src/motion/gsap.js`**：微互動（hover、焦點、按鈕回饋）留給 CSS；捲動的連動、換頁的連續、整句重排這些「編排」交給 GSAP；兩套不同時動同一個元素的同一個屬性。用到 GSAP 的地方都先問 `reducedMotion()`，系統設定減少動態時一律跳過。

建置：GSAP 核心＋Flip＋ScrollTrigger 約 144 KB 未壓縮；因為一句話列（`App.vue` 靜態引入）用了 Flip，它們進了主 chunk——`index` 從 38 KB 變 243 KB 未壓縮（gzip 91 KB）。可以接受；要省的話之後把一句話列的 Flip 改成動態載入。

## `src/motion/gsap.js`、`src/motion/lookFlip.js`

- `gsap.js`：全站唯一的 `registerPlugin`，匯出 `gsap`、`ScrollTrigger`、`Flip`、`reducedMotion()`；預設 ease `power3.out`、0.6 秒。
- `lookFlip.js`：衣服從卡片飛到穿搭頁的三個函式。`rememberLook(outfit, from)` 在點卡片那一刻記下那套人形（`.stack`）的位置與大小（`Flip.getState`），順手把穿搭資料帶著；`takeLook(id)` 穿搭頁拿走（id 對不上就當沒有）；`flyLookIn(target, state)` 從記下的位置補到新位置（0.8 秒、`power3.inOut`、用 scale 不改寬高），飛完 `clearProps` 把 transform 交回 CSS——天空的風還在用它。兩邊是不同的元素，靠同一個 `data-flip-id="look-<id>"`（`OutfitLook` 的 `.stack`）對上。

## `src/components/SkyPage.vue`：捲動連動

IntersectionObserver 換成 ScrollTrigger，兩件事綁在同一條捲動進度上：

- **一道門**（`ScrollTrigger.create`，`start: 'top bottom'`、`end: 'bottom top'`）：天空還在畫面裡就 `isActive`；離開時頂欄變實、天空停（`sky.pause()`），回來再動。重新整理時已經捲在下面也照現況處理。**起點不能用 `'top top'`**：天空的頂在 0 那一點有次像素誤差，一開始會被判成「還沒進入」——第一次跑檢查就是這樣，頂欄一開始就實、天空不動。
- **頂欄的底色**（`--header-solid`，0 → 1）：看捲了天空的幾成，捲到 55% 開始變實、95% 全實；`SiteHeader` 的 `.float` 用 `color-mix` 把紙色與線按這個比例混進去，字色也從天空上的顏色混到墨色。以前是一刀切。
- **視差**（只在沒有減少動態時）：一條 `scrub: 0.5` 的時間軸——天空往下 16%（比頁面慢）、天空裡的字往上 8%、字在捲到七成前淡掉（不會頂到頂欄）。
- 全部放在 `gsap.context()` 裡，離開頁面 `revert()` 一次清掉。

## `src/components/SentenceBar.vue`：整句重排

選了比較長或比較短的詞，後面的字滑到新位置而不是跳過去。做法：每個小段加 `data-flip-id`；**在使用者打開選單之前**（`focus`／`pointerdown`）先 `Flip.getState` 記下位置——原生 `<select>` 一選好就自己變寬（`field-sizing: content`），等 `change` 事件再記已經晚了（第一版就是這樣，量到的位移全是 0）；條件變了、畫面更新後 `Flip.from`（0.45 秒）。

## `src/views/OutfitView.vue`、`OutfitCard.vue`、`HomeView.vue`、`ThemeView.vue`

- 卡片（圖與標題）、首頁與路線頁的「今天的穿搭」、穿搭頁的「其他穿搭」點了都 `rememberLook`。
- 穿搭頁一進來先 `takeLook`：有的話先用帶來的資料把衣服掛出來、下一個 tick 飛過去，再去要細節（理由句會先少了厚薄那一段，資料到了補上）。
- 首頁換詞：詞與 tagline 從下面浮上來（0.55 秒、錯開 0.06 秒）。路線頁換路線：左邊的字一行行浮上來，天空同時慢慢移過去。
- 首頁與路線頁「今天的穿搭」離開的那幾套直接拿掉：淡出會和新進來的疊在一起（換路線的中間一格抓到）。

## `scripts/shots.mjs`

網址結尾多了 `#click=<選擇器>`（點了等 `SHOT_AFTER` 毫秒再拍，抓換頁動畫的中間一格）與 `#scroll=<像素>`。

## 實測了什麼

- `npm run build` 成功。購買流程 60 項、會員流程 39 項（桌機）全過；對比 33 組合格；無頭 Chrome 全程沒有主控台錯誤。
- 首頁捲動檢查：頂欄一開始浮、捲過天空後實且黏在 top 0、一句話列在、11 張卡、天空捲出停、捲回動、點詞進路線——修掉門的起點之後全過。
- 一句話列：對第一格先送 focus 再改值，120 ms 時後面三段的 transform 是 `translateX(6.48px)`（在滑），800 ms 後是 `none`（到位）。改成 focus 前記位置之前，量到的是全 0。
- 中間一格的截圖：首頁捲到 380／560 px（字淡掉、天空慢一拍、頂欄從透明混到紙色）；全部穿搭點第三張卡 320 ms 後（衣服在半路、天空已經在畫）；街頭路線點「龐克」320 ms 後（天空在變、字已經換）。截圖在 `docs/r12-shots/`。

**沒有驗證**：使用者本人還沒看；動的手感只能真的滑才知道（視差的幅度、飛行的 0.8 秒、重排的 0.45 秒都是我定的）；手機（390 寬）這輪沒重拍；Firefox／Safari 的 `color-mix` 與 ScrollTrigger；減少動態模式只靠程式分支，沒有實際切換看。

## 下一步

- three.js「一片布」的試做（停損先寫進 vault：真機低於 30 fps、或看起來沒有比 2D 更真就不做）。
- 商品頁上半部進不進天空；列表→商品頁的圖也可以用同一套 Flip。
- 要省主 chunk 的話，一句話列的 Flip 改動態載入。
