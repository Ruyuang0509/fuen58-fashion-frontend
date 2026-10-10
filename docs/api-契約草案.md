# API 契約草案（前台 ↔ 後端）

2026-10-06，草案。這份是前台**已經在用**（或下一輪要用）的資料形狀，寫出來給後端組員對；
欄位名、端點、狀態碼都可以改，但改了要一起改前台 `src/api/`。
參考實作就是前台的假資料層：`src/api/index.js`、`src/api/account.js`（會員與訂單，第十輪）、`src/api/mock/*.json`。

2026-10-11 依 `docs/28-契約稽核核對與增補.md` 增補：標了 **〔第十八輪稽核增補・待 11/2 全組確認〕** 的段落，是照前台**現況**寫成的**提案**——前台負責人與全組都還沒確認，11/2 對 DB 前要定下來；沒標的部分不動。

通則：

- JSON、UTF-8；日期時間用 ISO 8601 含時區（`2026-10-06T08:00:00+08:00`）；金額是整數（新台幣元）。
  **〔第十八輪稽核增補・待 11/2 全組確認〕** 純日期欄位用 `YYYY-MM-DD`（`listedAt`、`birthday`、`startsAt`／`endsAt`、`forecast[].date`、折扣碼的 `expiresAt`）。日期時間任何 ISO 8601 偏移都收（前台假資料用 `toISOString()` 的 `Z` 結尾，範例用 `+08:00`），前台一律換成臺北時間顯示。
- 單筆直接回物件。清單 **〔第十八輪稽核增補・待 11/2 全組確認〕**：前台現在把每個清單端點都當 **JSON 陣列**讀（`themes`、`brands`、`outfits`、`campaigns`、`me/addresses`、`orders`、`products`），不送 `page`／`pageSize`，「共 N 件」是陣列長度。提案：清單一律回陣列；只有 `GET /api/products` 帶 `page` 時才回 `{ items, page, pageSize, total }`（§4.2）。前台接真後端時的 fetch 包裝會兩種都收（陣列或 `{ items }`），但請定一種。（原本這行寫「清單用 `{ items, page, pageSize, total }` 包起來」，與 §1、§3、§9 的「→ 陣列」和假資料層的實作不一致。）
- 錯誤一律 `{ error: { code, message, field? } }`，`message` 是給使用者看的繁體中文，`field` 指出是哪個欄位（表單錯誤貼在欄位旁要用）。
  `code` 的完整清單、建議的 HTTP 狀態碼、前台會對的 `field` 值都在 §15（這裡不再另列一份，免得兩份漂移）。
- 需要登入的端點帶 `Authorization: Bearer <token>`；沒帶或過期回 401 `UNAUTHORIZED`。
- **〔第十八輪稽核增補・待 11/2 全組確認〕** 單筆 `GET`（`/products/:id`、`/outfits/:id`、`/brands/:code`、`/campaigns/:code`、`/orders/:id`）找不到回 404 `NOT_FOUND`；前台的 fetch 包裝會把它轉成 `null`，各頁據此顯示「找不到」（現在的假 API 就是回 `null`——`ProductView`、`OutfitView`、`BrandView`、`OrderView` 都走這個分支，不是 catch 錯誤）。
- 前台不直接呼叫氣象來源，天氣由後端抓取並快取（功能規劃 6.1）。

## 1. 風格主題 `GET /api/themes`

```json
[{ "code": "street", "name": "街頭", "tagline": "寬鬆、層次、不怕顯眼。", "sort": 2 }]
```

主題的顏色與圖樣在前端（`src/theme/themes.js`），後台只管名稱、說明、排序、啟用。主題清單八個是暫定，全組決定。

## 2. 天氣 `GET /api/weather?city=臺北`

```json
{ "city": "臺北", "temperature": 18, "humidity": 85, "condition": "rain", "observedAt": "2026-10-06T08:00:00+08:00" }
```

`condition`：`clear | cloudy | rain`。抓不到時回上一次的快取並保留 `observedAt`（前台會標示時間）。

## 3. 品牌

- `GET /api/brands` → 陣列
- `GET /api/brands/:code` → 單筆；沒有回 404

```json
{ "code": "wuan", "name": "霧岸", "since": 2019, "intro": "做給每天要出門的人：剪裁乾淨、布料耐穿，顏色只在灰與駝之間。" }
```

品牌一律虛構，只有名稱與一句介紹，沒有圖像商標（v1.3）。

## 4. 商品

### 4.1 單筆 `GET /api/products/:id`

```json
{
  "productId": 101,
  "name": "落肩混紡大衣",
  "brand": "霧岸", "brandCode": "wuan",
  "category": "outer",
  "price": 3280,
  "sizes": ["S", "M", "L"],
  "listedAt": "2026-09-21",
  "sold": 28,
  "kind": "coat", "fabric": "wool",
  "material": "羊毛 60%・聚酯纖維 40%；內裡聚酯纖維",
  "description": "落肩、直身，長度到小腿中段。布面帶一點毛感，不挺不軟，風吹不透。",
  "warmth": 5,
  "features": [],
  "colours": [{ "code": "oat", "name": "燕麥", "hex": "#d9d4ca" }, { "code": "charcoal", "name": "炭灰", "hex": "#4a4a4c" }],
  "stock": { "oat-S": 0, "oat-M": 13, "oat-L": 7, "charcoal-S": 7, "charcoal-M": 15, "charcoal-L": 0 },
  "measure": { "columns": ["肩寬", "胸寬", "衣長", "袖長"], "rows": { "S": [48, 58, 100, 60], "M": [50, 61, 103, 61.5], "L": [52, 64, 106, 63] } },
  "fit": { "height": 170, "weight": 56, "size": "M", "note": "肩線落在肩點外約 3 公分，衣長到小腿中段，裡面可以再穿一件針織。" },
  "tags": ["大衣", "落肩", "長版", "通勤"],
  "themeCodes": ["minimal"],
  "images": []
}
```

| 欄位 | 說明 | 對應功能規劃 |
|---|---|---|
| `category` | `outer | top | bottom | shoes | acc` | 3.1 分類 |
| `colours` | 顏色清單；第一個是預設色。`hex` 現在給程式畫款式圖用，有照片後可以不給 | 3.1 規格 |
| `stock` | 顏色代碼 + `-` + 尺寸 → 庫存件數。**規格 = 顏色 × 尺寸**；現在各色同價，若要各色不同價，`price` 要搬進 `colours` | 3.1 規格 |
| `sizes` | 尺寸順序（畫面照這個順序排）；單一尺寸用 `["F"]`。**〔第十八輪稽核增補・待 11/2 全組確認〕** 尺寸代碼現在只有 `S｜M｜L｜XL｜F｜110｜120｜130`（後三個是童裝）；前台的篩選器（`src/filters/options.js`）只認這 8 個，尺寸建議只對 XS–XXL 算 | |
| `measure` | 尺寸表：欄名依類別不同；平量公分。**〔第十八輪稽核增補・待 11/2 全組確認〕** `rows` 的格子是數字；單一尺寸（`F`）的配件可為字串（範圍或小數——假資料 204 毛帽 `'56–60'`、404 健行襪 `'23–27'`／`'22'`、505 細皮帶 `'95'`／`'1.8'`，共 5 格）。尺寸建議只對 XS–XXL 的尺寸算，字串格不會進去。若後端欄位要純數字，就把這 5 格改掉、這一行維持「數字」 | 3.1 尺寸表 |
| `fit` | 模特兒試穿資訊：身高、體重、穿的尺寸、一句穿感 | 3.1、3.3（必，v1.3） |
| `warmth` | 厚薄等級 1–5；`features` 機能標籤，現在的值只有 `防潑水`、`快乾`。**〔第十八輪稽核增補・待 11/2 全組確認〕** `防潑水` 這個字串被前台當程式邏輯用（`src/products/weatherFit.js`：下雨時外層吸不吸水），`fabric` 的 `nylon`、`leather` 也是——要改字請一起改前台 | 3.1 天氣標籤 |
| `kind`、`fabric` | 給前端程式畫款式圖；正式有照片後改用 `images`。**〔第十八輪稽核增補・待 11/2 全組確認〕** 現在的值：`kind` ＝ `coat｜jacket｜vest｜top｜blouse｜dress｜trousers｜skirt｜beanie｜socks｜belt`；`fabric` ＝ `cotton｜wool｜nylon｜satin｜denim｜leather`。`kind` 不在前台款式圖表（`src/garments/flats.js`）裡的會改畫布料近拍，所以後端要新增 `kind` 得同步前台 | 過渡期 |
| `images` | 正式版：多張；區分模特兒圖、平拍圖 | 3.1 圖片 |
| `themeCodes` | 一件商品可屬於多個主題。**〔第十八輪稽核增補・待 11/2 全組確認〕** **必有的陣列**（可以是 `[]`，不能是 `null`）：`ProductCard` 直接取 `themeCodes[0]` 當路線色。資料來源二選一：(a) 新表 `product_themes`；(b) 由 `outfit_items` 反推——商品出現在哪些穿搭，那些穿搭的 `themeCode` 去重。(b) 是現在假資料的做法（`products.json` 沒有這欄，`src/api/index.js` 的 `themeCodesOf()` 算出來的） | 3.1 風格主題 |
| `listedAt`、`sold` | 排序用（新上架、熱銷） | 3.2 排序 |
| 品況 | **還沒有**：等 10/12 二手做法定案再加 `condition` | 3.1 品況 |

### 4.2 清單 `GET /api/products`

查詢字串（都選填）：`q`（關鍵字：比對名稱、品牌、標籤、主題名稱）、`theme`、`brand`、`category`、`size`、`colour`、`priceMin`、`priceMax`、`inStock=1`、`sort=new|popular|price-asc|price-desc`、`page`、`pageSize`。
**〔第十八輪稽核增補・待 11/2 全組確認〕** 再加兩個前台已經在用的：`ids=101,102`（只要這幾件，**照給的順序回**，找不到的略過；不與其他條件併用——購物車、結帳、收藏、看過的、試穿間、訂單頁、活動頁共 11 處呼叫）、`exclude=101,102`（不要這幾件；商品頁「同路線」「同品牌」、穿搭頁「換一件」共 4 處）。
回傳：不帶 `page` 回**陣列**（前台現況，見通則）；帶 `page` 才回 `{ items: [商品], page, pageSize, total }`——待 11/2 定。`ids=` 查詢回的每件是 §4.1 的**完整物件**（結帳、購物車要讀 `stock`、`sizes`、`colours`；收藏要 `measure`、`fit` 算建議尺寸；試穿間要 `stock`、`warmth`、`features`、`brandCode`）；其他清單查詢每筆至少要有 4.1 的前 12 個欄位加 `colours` 與 `themeCodes`（`ProductCard` 要 `themeCodes[0]`），不能只給前 12 欄。
篩選條件全部寫在前台網址裡（3.2「篩選寫入網址」），所以後端要接受全部用查詢字串傳。

第十五輪子輪 3 起的多值與色系（前台 `/products` 已在用）：
- `brand`、`size`、`colour` 可以多值，逗號分隔、**任一符合**：`brand=wuan,banri`、`size=S,M`。
- `colour` 傳的是**色系代碼**不是商品的色名：`black | white | grey | beige | brown | yellow | green | blue | purple | pink | red`。前台現在用 hex 算 HSL 分類（`src/products/colourFamily.js`，門檻在裡面）；正式版建議商品顏色表加一欄 `family`，由後台在建顏色時填（或用同一套規則算一次存起來），查詢就直接比對欄位。
- 價格前台給三檔預設，送出去仍是 `priceMin`／`priceMax`（含）：兩千以下 → `priceMax=1999`；兩千到四千 → `priceMin=2000&priceMax=4000`；四千以上 → `priceMin=4001`。
- 不認得的值（`size=XXL`）前台會先丟掉；後端收到也請忽略而不是回錯。

**〔第十八輪稽核增補・待 11/2 全組確認〕** 查詢參數的名字對照——線上（這份契約）用單數、逗號分隔；前台畫面內部用複數、陣列。接真後端時只在 `src/api/index.js` 的包裝裡換名，畫面不改；後端照**線上名**做即可：

| 線上名（契約） | 前台內部名 | 說明 |
|---|---|---|
| `brand=wuan,banri` | `brands: ['wuan', 'banri']`（另有單值 `brand`） | 品牌代碼，任一符合 |
| `colour=black,grey` | `colours: [...]` | 色系代碼（上面那 11 個） |
| `size=S,M` | `sizes: [...]` | 任一符合 |
| `inStock=1` | `inStock: true` | 前台送布林，線上送 `1` |
| `theme`（§5 穿搭） | `style` | 路線代碼 |
| `for`（§5 穿搭） | `audience` | 給誰穿 |
| 商品的 `ids`、`exclude`、`q`、`category`、`theme`、`priceMin`、`priceMax`、`sort`；穿搭的 `occasion`、`category`、`size`、`ids` | 同名 | 多值在線上一律逗號分隔（假 API 陣列或逗號字串都收） |

## 5. 穿搭

- `GET /api/outfits` 查詢字串：`theme`、`for`（給誰穿）、`occasion`、`category`、`size`、`ids`（逗號分隔，只要這幾套；活動頁用）
- `GET /api/outfits/:id`
- `GET /api/products/:id/outfits`（包含這件商品的穿搭）

```json
{
  "id": 1, "title": "通勤的灰階", "themeCode": "minimal", "occasions": ["work"], "audience": "unisex",
  "items": [
    { "productId": 101, "colour": "oat" },
    { "productId": 102, "colour": "ivory" },
    { "productId": 103, "colour": "ink" }
  ]
}
```

資料表：`outfits`（id、title、theme_code、created…）、`outfit_items`（outfit_id、product_id、colour_code、sort）、`outfit_occasions`（outfit_id、occasion）。
`colour` 是那套穿搭選的顏色代碼。**前台會把 `items` 展開成商品欄位**（`src/api/index.js` 的 `resolveOutfit()`），後端也可以直接回展開後的。

**〔第十八輪稽核增補・待 11/2 全組確認〕** 展開後的 item——畫面（穿搭卡、穿搭頁、試穿間、首頁「這一週」、合今天的判斷）讀的全是這個形狀，不是上面的原始引用：

```json
{ "productId": 101, "name": "落肩混紡大衣", "brand": "霧岸", "brandCode": "wuan", "category": "outer", "price": 3280, "sizes": ["S", "M", "L"], "kind": "coat", "fabric": "wool", "warmth": 5, "features": [], "colour": "#d9d4ca", "colourCode": "oat", "colourName": "燕麥" }
```

- 十四個欄位：前十一個從 §4.1 的商品抄過來；顏色三欄是依那套穿搭選的 `colour_code` 從商品的 `colours` 挑出來的那一筆——`colourCode` 是代碼、`colourName` 是色名、**`colour` 是那個色的 hex**（畫款式圖用）。注意原始引用裡的 `colour` 是代碼、展開後的 `colour` 是 hex，同名不同義，兩種形狀不要混回。
- 穿搭引用到的商品找不到時那一件略過（假 API 如此）。
- 提案：**後端直接回展開後的**（省前台每套再打一次 `GET /api/products?ids=`）。若後端只回 `{ productId, colour }`，前台就要自己 join——哪一邊做，11/2 定一個。
- 參數名：線上 `theme`／`for` ↔ 前台內部 `style`／`audience`，對照表在 §4.2。
`occasions`：`work | date | weekend | outdoor`。**這是功能規劃沒有的欄位**，一句話列的「場合」那格靠它；使用者 2026-10-06 裁決先留，請後端在穿搭表加這個標籤。
`audience`：`women | men | unisex | kids`（穿搭表一欄）。查詢 `for=women` 要回 women 加 unisex，`for=men` 回 men 加 unisex，`unisex` 與 `kids` 只回自己（第十四輪，使用者要求加「男、女、中性、小孩」）。
第十五輪起穿搭有 18 套（每條路線至少兩套）；第三子輪會把 `occasion`、`category`、`size` 改成多值逗號分隔（任一符合）。

## 6. 會員與登入（第十輪前台先用假資料實作；路徑是建議）

| 端點 | 內容 | 錯誤 |
|---|---|---|
| `POST /api/auth/register` `{ email, password, name }` | 建帳號並登入，回 `{ token, user }` | `EMAIL_TAKEN`（`field: "email"`）、`VALIDATION`（`name` 必填 → `field: "name"`；電子郵件格式 → `"email"`；密碼至少 8 碼、要有英文與數字 → `"password"`） |
| `POST /api/auth/login` `{ email, password }` | 回 `{ token, user }` | `INVALID_CREDENTIALS`（訊息不區分是帳號還是密碼錯） |
| `POST /api/auth/logout` | 讓 token 失效 | |
| `GET /api/me` | 目前會員 | 401 |
| `PATCH /api/me` `{ name, phone, birthday, gender }` | 改個人資料；**〔第十八輪稽核增補・待 11/2 全組確認〕** **回完整的 user**（前台拿回傳覆蓋登入態） | `VALIDATION`：`name` 必填；`phone` 選填、`09` 開頭 10 碼（空白與 `-` 先去掉）；`birthday` 選填、`YYYY-MM-DD` 且不晚於今天；`field` 就是欄位名。`gender` 不在四個值裡落 `unsaid` |
| `POST /api/me/password` `{ current, next }` | 改密碼 | `INVALID_CREDENTIALS`（舊密碼錯，`field: "current"`）、`VALIDATION`（新密碼不合規，`field: "next"`） |

```json
{ "id": 1, "email": "demo@example.com", "name": "林示範", "phone": "0912345678", "birthday": "1998-04-12", "gender": "female", "createdAt": "2026-09-01T10:00:00+08:00" }
```

`gender`：`female | male | other | unsaid`。密碼只存雜湊（功能規劃 7）。「記住登入」由前台決定把 token 放 localStorage 還是 sessionStorage。

**〔第十八輪稽核增補・待 11/2 全組確認〕**
- register／login／`GET /api/me` 回的 `user` 都要帶 `preferences`（§11；沒挑過是 `null`）與 `body`（§14；沒填是 `null`）。前台**不打 `GET /api/me`**（`session.refresh()` 目前沒有呼叫端），舞台怎麼排、尺寸建議怎麼算，都是登入那一刻從 `user` 讀的；上面的範例少了這兩欄。
- `phone`、`birthday` 選填；空值回 `""` 還是 `null` 請定一個（假資料是 `""`，前台 `?? ''` 兩種都吃）。

## 7. 地址簿（需登入）

- `GET /api/me/addresses`、`POST /api/me/addresses`、`PATCH /api/me/addresses/:id`、`DELETE /api/me/addresses/:id`、`POST /api/me/addresses/:id/default`

```json
{ "id": 1, "recipient": "林示範", "phone": "0912345678", "postalCode": "106", "city": "臺北市", "district": "大安區", "street": "和平東路二段 100 號 5 樓", "isDefault": true }
```

刪掉預設地址時，剩下的第一筆變預設。

**〔第十八輪稽核增補・待 11/2 全組確認〕** 回傳與規則（都是前台假 API 的現況，`AddressesView` 依賴其中兩個回傳）：
- `POST` 回新地址（物件）；`PATCH` 回更新後的地址。這兩個前台不讀（存完重新 `GET`）。
- `DELETE /api/me/addresses/:id` 回**剩餘的整份清單**、`POST .../:id/default` 回**整份清單**——前台直接把回傳當新狀態。若後端想回 204 或單筆，請說一聲，前台改成重新 `GET`。
- 第一筆新增自動成為預設。`PATCH` 帶 `isDefault: true` 會把其他筆取消預設；**不能用 `PATCH` 把預設取消**（畫面也把那個勾鎖住）。找不到回 404 `NOT_FOUND`。
- 驗證（`VALIDATION`，`field` 就是欄位名）：`recipient`、`phone`、`postalCode`、`city`、`district`、`street` 六欄必填；`phone` 去掉空白與 `-` 後要是 `09` 開頭 10 碼；`postalCode` 3、5 或 6 位數字。

## 8. 訂單（需登入）

| 端點 | 內容 | 錯誤 |
|---|---|---|
| `POST /api/orders` | 下單：`{ items: [{ productId, colour, size, qty }], addressId 或 address, payment: { method }, couponCode? }`。後端重算金額（單價、折扣、運費、合計）、**扣庫存**，回訂單（`待付款`）。**〔第十八輪稽核增補・待 11/2 全組確認〕** `payment.method` ∈ `card｜cod｜mock`（`card` 在發表時是真的沙盒還是等同 `mock`，待定）。前台現在每件多送 `name`、`brand`、`colourName`、`price`（購物車的快照）：提案是後端忽略多的欄位、金額以後端重算為準；或者要求前台只送四欄（改 `CheckoutView`），二選一 | `OUT_OF_STOCK`（附 `field` 指出哪一件——格式待定：`items[<index>]` 或 `productId:<id>`，二選一；結帳頁目前只把 `message` 貼在表單頂，§15 寫的「回購物車處理」還沒做）；`COUPON_INVALID`（`field: "coupon"`）；〔稽核增補〕`VALIDATION`（`field`：`items` 空購物車｜`address` 沒選地址｜`payment` 付款方式不在三個值裡）、`NOT_FOUND`（`addressId` 不是自己的地址） |
| `POST /api/orders/:id/pay` `{ method }` | 付款：金流沙盒或「模擬付款成功」（發表備援）。`待付款 → 已付款`。訂單頁也能呼叫（結帳時付款失敗、留在待付款的訂單）。**〔第十八輪稽核增補・待 11/2 全組確認〕** `method` 只收 `card｜mock`（貨到付款不走這支）；**回完整訂單**（訂單頁拿回傳直接換掉畫面上的訂單） | `NOT_PAYABLE`（不是待付款；付款期限已過的訊息是「付款期限已過，訂單已取消」）；〔稽核增補〕`VALIDATION`（`field: "payment"`）、`NOT_FOUND` |
| `GET /api/orders` | 我的訂單，新的在前 | |
| `GET /api/orders/:id` | 明細 | 404 |
| `POST /api/orders/:id/cancel` | 只有 `待付款` 能取消；回補庫存；〔稽核增補〕**回完整訂單**（`cancelReason: "member"`，`history` 多一步 `note: "自行取消"`） | `NOT_CANCELLABLE`（逾時已自動取消的訊息是「付款期限已過，訂單已經自動取消了」）、`NOT_FOUND` |
| `POST /api/orders/:id/confirm` | 確認收貨：只有 `已送達` 能按；`→ 完成`；〔稽核增補〕**回完整訂單** | `NOT_DELIVERED`、`NOT_FOUND` |

```json
{
  "id": "WD-20261003-0002",
  "createdAt": "2026-10-03T19:20:00+08:00",
  "status": "待付款",
  "items": [{ "productId": 509, "name": "酒紅吊帶連身裙", "brand": "舊課本", "colour": "burgundy", "colourName": "酒紅", "size": "M", "qty": 1, "price": 3680 }],
  "address": { "recipient": "林示範", "phone": "0912345678", "postalCode": "106", "city": "臺北市", "district": "大安區", "street": "和平東路二段 100 號 5 樓" },
  "subtotal": 3680, "coupon": null, "discount": 0, "shipping": 0, "total": 3680,
  "payment": { "method": "mock", "paidAt": null },
  "payBy": "2026-10-03T19:35:00+08:00",
  "cancelReason": null,
  "history": [{ "status": "待付款", "at": "2026-10-03T19:20:00+08:00" }]
}
```

- 狀態機（功能規劃 4，v1.3）：`待付款 → 已付款 → 出貨中 → 已送達 → 完成`；另有 `已取消`。只能照箭頭前進，其他轉換 API 拒絕。
- **第十七輪子輪 1 補的欄位**（前台已在用）：
  - `payBy`：付款期限（下單＋15 分鐘），只有「待付款且不是貨到付款」的訂單有，其他 `null`。後端算、前台只顯示與倒數。
  - `cancelReason`：`member`（會員自己取消）｜`timeout`（付款逾時自動取消）｜`null`。
  - `history[].note`（選填）：那一步的說明，例如「付款逾時，自動取消」「貨到付款，送達時付款」「送達 7 天後自動完成」。
- **貨到付款的走法（提案，10/12 確認）**：狀態機原圖只有「待付款 → 已付款 → 出貨中」，貨到付款的訂單送達前本來就沒付款。前台現在照 `待付款（不逾時）→ 出貨中 → 已送達（這一步記 paidAt、note 寫「送達時付款」）→ 完成` 顯示，少「已付款」一步。
- **自動完成**：已送達後 N 天沒按確認收貨就自動 `完成`（功能規劃 4「N 天後自動」）；前台假 API 用 N＝7，**建議值**，後端排程決定。
- **示範用的時間比例只在前台假 API**（`src/api/account.js` 的 `DEMO_LOGISTICS`）：付款（貨到付款是下單）2 分鐘後出貨、5 分鐘後送達，讓發表現場看得到狀態走完；訂單頁有寫是模擬。後端不用做這個——出貨與送達是後台操作。
- 訂單裡的單品是**下單當時的快照**（名稱、價格），商品之後改價不影響訂單。
- 運費規則：固定 80 元，滿 2,000 免運——**前端暫定，全組決定**；正式以後端算的為準，前台只顯示。
- **折扣碼（第十八輪子輪 3；功能規劃 4「優惠券」加分項）**：`coupon` 是 `{ code, label, discount, freeShipping }` 或 `null`；`discount` 是折掉的元數；`total = subtotal − discount + shipping`。免運門檻看折扣後的小計；免運券的 `shipping` 直接 0。端點與規則在 §16。
- 付款逾時 15 分鐘自動取消並回補庫存是後端排程的事，前台只顯示狀態與 `payBy`（倒數到了就重讀一次訂單）。前台假 API 在每次讀訂單時結算，所以示範得出來。
- 訂單編號格式 `WD-YYYYMMDD-NNNN` 是前台假資料用的，後端可以換。
- **〔第十八輪稽核增補・待 11/2 全組確認〕** 前台假 API **不扣庫存、不驗庫存**，`OUT_OF_STOCK` 從來沒有真的被觸發過；這條錯誤的處理（含 `field` 格式與「回購物車」）要等後端有了才測得到。

## 9. 活動（第十五輪；**功能規劃沒有這一項，10/12 要全組確認**）

- `GET /api/campaigns?active=1` → 陣列（進行中的；沒帶 `active` 就全部）。前台另外會用 `placement=stage|footer` 篩放哪裡，後端可以不做、前台自己篩。**〔第十八輪稽核增補・待 11/2 全組確認〕** 清單排序：`endsAt` 升冪（快結束的在前）——舞台只插前兩檔，順序有意義。
- `GET /api/campaigns/:code` → 單筆；過期的也回（前台顯示「已經結束」），沒有回 404。

```json
{
  "code": "rain-week",
  "title": "下雨也照常出門",
  "tagline": "防潑水、快乾、口袋夠多——雨季一週的穿搭。",
  "startsAt": "2026-10-01", "endsAt": "2026-10-31",
  "themeCode": "outdoor",
  "brandCodes": ["yejing"],
  "outfitIds": [6, 18, 12],
  "productIds": [401, 402, 403, 404, 601, 603],
  "placements": ["stage", "footer"],
  "active": true
}
```

- 進行中 = `startsAt ≤ 今天 ≤ endsAt`（臺北時間，`endsAt` 含當天）。**〔第十八輪稽核增補・待 11/2 全組確認〕** `active: true|false` 是**必有**欄位（原本寫「最好」）：活動頁直接依它顯示「已經結束」。另外回應要加 `outfits`——展開後的穿搭陣列（§5 展開後的形狀，依 `campaign_outfits.sort` 排）：舞台插卡取第一套、活動頁取前三套畫人形；前台假資料的 `decorateCampaign()` 就是這樣多回 `active` 與 `outfits`。
- 資料表：`campaigns`（code、title、tagline、starts_at、ends_at、theme_code、created…）、`campaign_brands`、`campaign_outfits`（campaign_id、outfit_id、sort）、`campaign_products`（campaign_id、product_id、sort）、`campaign_placements`（或一個字串欄）。
- 前台放在：穿搭格子裡的插卡（首頁與全部穿搭最多兩檔、路線頁只放同路線的）、活動頁 `/campaigns/:code`、頁尾「現在的活動」。**購物車、結帳、會員頁不放活動**。
- 假資料四檔，其中 `summer-linen` 已結束，用來驗證過期的處理。

## 10. 收藏（需登入；第十五輪子輪 2，功能規劃「特」）

單品與整套穿搭都能收。訪客收在瀏覽器本機；登入或註冊成功時前台把本機那包送到 `merge`，之後只用帳號的。

| 端點 | 內容 |
|---|---|
| `GET /api/me/favorites` | 整包：`{ products: [{ productId, colour, addedAt }], outfits: [{ outfitId, addedAt }] }`，新的在前 |
| `PUT /api/me/favorites/products/:id` `{ colour? }` | 收藏單品（`colour` 是收藏時看的顏色代碼，可不給）；已收藏就當成功 |
| `DELETE /api/me/favorites/products/:id` | 取消 |
| `PUT /api/me/favorites/outfits/:id`、`DELETE …/outfits/:id` | 穿搭 |
| `POST /api/me/favorites/merge` | body 就是上面那包的形狀（訪客本機的）；**聯集**、同一件兩邊都有時保留較早的 `addedAt`；回併完的整包 |

資料表：`member_favorite_products`（member_id、product_id、colour_code、added_at，主鍵 member_id + product_id）、`member_favorite_outfits`（member_id、outfit_id、added_at）。
瀏覽紀錄**不進後端**（前台本機存、各 24 筆）；若要跨裝置同步再開 `GET/PUT /api/me/history`（組員清單裡是「加」）。

## 11. 偏好（需登入；第十五輪子輪 4，功能規劃「特」）

註冊成功後的三步調查（給誰穿、挑至少三套、看風格組成比例）存在這裡；登入不會再問。前台另外用收藏與看過的一起推測喜好（純前端算，不進後端），所以後端只要存調查的結果。

| 端點 | 內容 |
|---|---|
| `GET /api/me/preferences` | 整包或 `null`（沒挑過） |
| `PUT /api/me/preferences` | body 是整包（少 `updatedAt`）；**整包換掉**，不是局部更新。後端驗：`audience` 是四個代碼之一或 `null`、`themes` 的 key 是存在的路線代碼、權重 0–1、`pickedOutfitIds` 是存在的穿搭編號；回存好的那包 |
| `DELETE /api/me/preferences` | 清掉（會員中心「清掉偏好」）；之後 `GET` 回 `null` |

```json
{
  "audience": "women",
  "themes": { "street": 0.34, "outdoor": 0.33, "punk": 0.33 },
  "pickedOutfitIds": [4, 14, 18],
  "updatedAt": "2026-10-06T09:40:00+08:00"
}
```

- `audience`：women｜men｜unisex｜kids｜null（第一步「先不選」）。
- `themes`：各路線被挑的套數 ÷ 總數，兩位小數、總和 1；只挑了給誰穿、沒挑穿搭時是 `{}`。前台顯示用它，推測時若有 `pickedOutfitIds` 會重算。
- 資料表：`members.audience`；`member_preferences`（member_id、theme_code、weight，主鍵 member_id + theme_code）；`member_preference_picks`（member_id、outfit_id）。`updatedAt` 取三張表最新的那個時間就好。
- 前台把 `preferences` 當會員資料的一部分：`GET /api/me`（§6）回的會員物件**要帶 `preferences`**（沒挑過是 `null`），登入那一刻舞台才知道怎麼排，不必多打一次。

## 12. 還沒定的

1. 品況（二手）欄位——等 10/12 定案。
2. 穿搭牆（穿搭照、標註、按讚、審核）——等照片來源定案；前台導覽列先藏。
3. 身形（尺寸推薦）——特色項目，資料表可先留 `member_body`（height、weight、bust、waist、hips）；偏好已在 §11；身形的形狀第十六輪子輪 2 會補。
4. 商品清單的多值條件——第三子輪：`brand`、`colour`（色系代碼）、`size` 逗號分隔、任一符合。
5. **登入憑證放哪**（2026-10-06 使用者：交給後端決定）：(a) 現在寫的 Bearer token，前台存 localStorage／sessionStorage，寫法簡單、跨網域也行，但 XSS 拿得到；(b) 後端發 `httpOnly; Secure; SameSite=Lax` 的 cookie，前台不碰 token、XSS 拿不到，但要處理 CSRF（同站 cookie 加自訂 header 或 token）與跨網域的部署設定。前台兩種都能接；選了 (b) 就把 §6 的 `Authorization` 改成 cookie、所有需登入的請求帶 `credentials: 'include'`。

## 13. 天氣（第十六輪子輪 1；功能規劃 6.1「特」）

前台現在**直接打 Open-Meteo**（免金鑰、瀏覽器可呼叫、非商業免費、CC BY 4.0 要標來源，頁尾有）。後端做好下面這支就換成打後端——回的形狀一樣，前台只改 `getWeather` 一個函式。氣象署開放資料要金鑰，照 6.1 的原則金鑰只能在後端；後端定時抓、快取 15 分鐘。

| 端點 | 內容 |
|---|---|
| `GET /api/weather?city=taipei` | 某縣市現在的天氣與七天預報；`city` 是前台 `src/weather/cities.js` 的代碼（十四個縣市），沒給就臺北。**永遠回 200 一包**：抓不到就回上次快取並標 `stale: true`，連快取都沒有就回示範值 `source: "demo"`，前台會寫在畫面上 |
| `GET /api/outfits?fit=today&city=taipei` | 只留合今天天氣的穿搭：這套上半身最厚的一層（outer／top 的 `warmth`）對上今天要的厚度，差 −1～+1 就算合（要的厚度：≥ 26° 是 1、≥ 22° 是 2、≥ 16° 是 3、≥ 10° 是 4、其他 5——前台暫定，由「天氣規則管理」維護） |

```json
{
  "city": "臺北", "cityCode": "taipei",
  "temperature": 24, "humidity": 84, "apparent": 28, "condition": "cloudy", "isDay": false,
  "observedAt": "2026-10-10T01:30:00+08:00", "fetchedAt": "2026-10-10T01:31:12+08:00",
  "source": "open-meteo", "stale": false,
  "forecast": [
    { "date": "2026-10-10", "high": 28, "low": 24, "rainChance": 2, "condition": "rain" },
    { "date": "2026-10-11", "high": 28, "low": 23, "rainChance": 2, "condition": "cloudy" }
  ]
}
```

- `condition` 只有三種：`clear`｜`cloudy`｜`rain`（天空只畫這三種）。從氣象署的天氣現象對過來：晴→clear；多雲、陰、霧→cloudy；有雨、雷雨、雪→rain。
- `temperature`、`humidity`、`apparent` 都是整數；`forecast` 七筆、含今天；`rainChance` 是當天最大降雨機率（%）。
- `source`：`cwa`（後端抓到的）｜`cache`（後端的快取）｜`demo`；前台還認 `open-meteo`。
- 資料表：`weather_cache`（city_code、payload、fetched_at）就夠；「天氣規則」那張表（溫度區間 → 厚薄等級）前台現在寫死在 `products/weatherFit.js`。

## 14. 身形（需登入；第十六輪子輪 2，功能規劃「特」）

只用來算商品頁的「建議尺寸」，不公開。訪客在商品頁臨時輸入的身高體重存在瀏覽器本機；登入時帳號沒有而本機有，前台會 `PUT` 一次併進帳號。

| 端點 | 內容 |
|---|---|
| `GET /api/me/body` | `{ height, weight, chest, waist, hips, updatedAt }` 或 `null`（沒填） |
| `PUT /api/me/body` | 整包換掉。後端驗：身高 100–230、體重 25–200 必填；胸圍 50–160、腰圍 40–160、臀圍 50–170 選填（`null` 代表沒填）；錯誤格式照 §6，`field` 指出哪一欄 |
| `DELETE /api/me/body` | 清掉；之後 `GET` 回 `null` |

```json
{ "height": 168, "weight": 58, "chest": 92, "waist": null, "hips": null, "updatedAt": "2026-10-10T10:00:00+08:00" }
```

- **尺寸建議是純前端的規則**（`src/products/sizeAdvice.js`），後端不用做：以模特兒試穿資訊為基準（身高每 12 公分、體重每 8 公斤算一級，從模特兒穿的尺寸上下移）；有三圍而且尺寸表有對應的欄（胸寬 ×2 當胸圍、腰圍、臀圍）就逐項比鬆份（胸 ≥ 6、腰 ≥ 2、臀 ≥ 4 公分），以三圍為準。門檻是設計假設，畫面上會寫依據。
- 資料表：`member_body`（member_id 主鍵、height、weight、chest、waist、hips、updated_at）。`GET /api/me`（§6）回的會員物件**要帶 `body`**（沒填是 `null`）。
- 加分（不排）：訂單裡買過的尺寸、同身高體重的人買的尺寸——要有評論或訂單統計才做得出來。

## 15. 錯誤代碼（整理；第十七輪）

全部的 `code` 都在這（通則只指到這裡）。**〔第十八輪稽核增補・待 11/2 全組確認〕** 多了兩欄：「HTTP」是建議的狀態碼——前台接線時的 fetch 包裝打算以 JSON 裡的 `error.code` 為準，狀態碼只在回應沒有 JSON 時兜底（404 → `NOT_FOUND`、401 → `UNAUTHORIZED`、其餘 → `NETWORK`），所以後端用哪個 4xx 不會弄壞前台，但請定一套；「前台會對的 `field`」是表單真的拿來貼欄位的值，改名要同步前台。

| `code` | HTTP（建議） | 哪裡 | 前台會對的 `field` | 前台怎麼用 |
|---|---|---|---|---|
| `VALIDATION` | 422 | 所有寫入 | 註冊 `name`／`email`／`password`；個人資料 `name`／`phone`／`birthday`；改密碼 `next`；地址 `recipient`／`phone`／`postalCode`／`city`／`district`／`street`；身形 `height`／`weight`／`chest`／`waist`／`hips`；下單 `items`／`address`／`payment`（假 API 會給，結帳頁目前只貼 `message`） | `field` 指欄位，錯誤貼在欄位旁；沒有 `field` 或對不到欄位就貼在表單頂 |
| `NOT_FOUND` | 404 | 單筆 GET；地址、訂單的寫入 | — | 單筆 GET 由 fetch 包裝轉成 `null`，頁面顯示「找不到」與回上一層的連結（通則） |
| `EMAIL_TAKEN` | 409 | §6 註冊 | `email` | 貼在信箱欄旁 |
| `INVALID_CREDENTIALS` | 401 | §6 登入、改密碼 | 登入沒有；改密碼 `current` | 登入貼在表單頂；改密碼貼在「目前的密碼」旁 |
| `UNAUTHORIZED` | 401 | 所有需登入的 | — | 一律登出並帶著原網址回登入頁 |
| `OUT_OF_STOCK` | 409 | §8 下單 | 格式待定（`items[<index>]` 或 `productId:<id>`） | `field` 指出哪一件；回購物車處理（**還沒做**，目前只貼 `message`） |
| `NOT_PAYABLE`、`NOT_CANCELLABLE`、`NOT_DELIVERED` | 409 | §8 | — | 把 `message` 貼在按鈕旁，並重讀訂單（狀態可能已被排程改掉） |
| `COUPON_INVALID` | 422 | §16、§8 下單 | `coupon` | `message` 寫原因（沒有這個折扣碼／已經過期／未達門檻：滿 N 元才能用）；結帳頁貼在折扣碼欄旁 |
| `NETWORK` | — | 前台自己用 | — | 後端連不上、逾時、回的不是 JSON 時前台的 `fetch` 包裝丟這個；頁面顯示「沒有載入成功」與「再試一次」。後端不會回它 |

## 16. 折扣碼（第十八輪子輪 3；功能規劃 4「優惠券」加分項、後台 5「優惠券管理」）

| 端點 | 內容 |
|---|---|
| `GET /api/coupons/:code?subtotal=280` | 結帳前驗一次給回饋：回 `{ code, label, discount, freeShipping }`；不能用就 `COUPON_INVALID`（見 §15） |

```json
{ "code": "SHIPFREE", "label": "免運", "discount": 0, "freeShipping": true }
```

- 規則（前台假資料的四個示範碼，`src/api/mock/coupons.json`）：`WELCOME100` 滿 1,000 折 100；`AUTUMN15` 85 折、最多折 500；`SHIPFREE` 免運；`SPRING2026` 已過期。種類：`amount`（固定金額，不超過小計）、`percent`（百分比，可設上限）、`shipping`（免運）；`minSubtotal` 門檻、`expiresAt` 到期日（臺北日期）。
- 下單（`POST /api/orders`）帶 `couponCode`，**後端再驗一次並重算**；前台顯示的折扣只是預覽。
- 資料表：`coupon`（code、label、kind、value、max_discount、min_subtotal、expires_at、uses_left 選填）；訂單記 `coupon_code`、`discount`。
- 沒做：一人一次、指定商品、同時用多張。
