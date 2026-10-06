// 假資料 API 層。
// 畫面只呼叫這裡匯出的函式，不直接碰 JSON；後端 API 好了以後，
// 只要把每個函式的內容換成 fetch，畫面不用改。
// 欄位名與回傳形狀寫在 docs/api-契約草案.md，要和後端組員對過才算數。
//
// 資料模型（和後端的資料表同形）：
//   products.json  商品主表：列表欄位（名稱、品牌、類別、價格、尺寸）加細節（描述、材質、顏色×尺寸庫存、尺寸表、試穿資訊…）
//   outfits.json   穿搭：只用 productId 加顏色代碼引用商品；這裡的 resolveOutfit() 就是後端的 join
//   brands.json    品牌（虛構）
//   themes.json    風格主題
import themes from './mock/themes.json'
import outfits from './mock/outfits.json'
import products from './mock/products.json'
import brands from './mock/brands.json'

// 模擬網路延遲，讓「載入中」的畫面在開發時看得到
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const productById = new Map(products.map((product) => [product.productId, product]))
const brandByCode = new Map(brands.map((brand) => [brand.code, brand]))

export async function getThemes() {
  await wait(150)
  return [...themes].sort((a, b) => a.sort - b.sort)
}

export async function getWeather() {
  await wait(150)
  // 正式版接後端的氣象資料；condition 先用 clear | cloudy | rain 三種
  return { city: '臺北', temperature: 18, humidity: 85, condition: 'rain', observedAt: '2026-10-06T08:00:00+08:00' }
}

// ── 穿搭 ──

// 把穿搭裡的 { productId, colour } 展開成畫面要的單品欄位；colour 是那套穿搭選的顏色代碼，展開後給 hex
function resolveOutfit(outfit) {
  const items = outfit.items
    .map((ref) => {
      const product = productById.get(ref.productId)
      if (!product) return null
      const way = product.colours.find((entry) => entry.code === ref.colour) ?? product.colours[0]
      const { name, brand, brandCode, category, price, sizes, kind, fabric } = product
      return { productId: product.productId, name, brand, brandCode, category, price, sizes, kind, fabric, colour: way.hex, colourCode: way.code, colourName: way.name }
    })
    .filter(Boolean)
  return { ...outfit, items }
}

// 給誰穿：選女生會連中性的一起出現，選男生也是；中性只給中性；小孩只給小孩
function forAudience(outfit, audience) {
  const own = outfit.audience ?? 'unisex'
  if (audience === 'kids' || audience === 'unisex') return own === audience
  return own === audience || own === 'unisex'
}

/**
 * 取得穿搭組合。五個條件都是選填，空字串代表不限。
 * @param {{ style?: string, audience?: string, occasion?: string, category?: string, size?: string }} filters
 */
export async function getOutfits(filters = {}) {
  await wait(250)
  const { style, audience, occasion, category, size } = filters
  return outfits.map(resolveOutfit).filter((outfit) => {
    if (style && outfit.themeCode !== style) return false
    if (audience && !forAudience(outfit, audience)) return false
    if (occasion && !outfit.occasions.includes(occasion)) return false
    if (category && !outfit.items.some((item) => item.category === category)) return false
    // 尺寸：只看指定類別的單品有沒有這個尺寸；沒指定類別時，任何一件有就算
    if (size) {
      const candidates = category ? outfit.items.filter((item) => item.category === category) : outfit.items
      if (!candidates.some((item) => item.sizes.includes(size))) return false
    }
    return true
  })
}

/** 一套穿搭；找不到回 null */
export async function getOutfit(id) {
  await wait(200)
  const outfit = outfits.find((entry) => entry.id === Number(id))
  return outfit ? resolveOutfit(outfit) : null
}

/** 包含這件商品的穿搭 */
export async function getOutfitsWithProduct(id) {
  await wait(200)
  const pid = Number(id)
  return outfits.filter((outfit) => outfit.items.some((item) => item.productId === pid)).map(resolveOutfit)
}

// ── 商品 ──

// 一件商品屬於哪些主題：看它出現在哪些主題的穿搭裡（功能規劃 3.1：一件商品可屬於多個主題）
const themeCodesOf = (id) => [...new Set(outfits.filter((outfit) => outfit.items.some((item) => item.productId === id)).map((outfit) => outfit.themeCode))]

function productOf(id) {
  const product = productById.get(id)
  return product ? { ...product, themeCodes: themeCodesOf(id) } : null
}

const hasStock = (product) => Object.values(product.stock).some((n) => n > 0)

// 排序：new 新上架｜price-asc 價格低到高｜price-desc 價格高到低｜popular 熱銷。其他值不排序。
const SORTS = {
  new: (a, b) => b.listedAt.localeCompare(a.listedAt) || a.productId - b.productId,
  'price-asc': (a, b) => a.price - b.price || a.productId - b.productId,
  'price-desc': (a, b) => b.price - a.price || a.productId - b.productId,
  popular: (a, b) => b.sold - a.sold || a.productId - b.productId,
}

function arrange(list, { sort, inStock } = {}) {
  let result = inStock ? list.filter(hasStock) : [...list]
  if (SORTS[sort]) result.sort(SORTS[sort])
  return result
}

/** 一件商品；找不到回 null（商品頁據此顯示「找不到這件商品」） */
export async function getProduct(id) {
  await wait(200)
  return productOf(Number(id))
}

/**
 * 多件商品。
 * @param {{ ids?: number[], theme?: string, brand?: string, exclude?: number[], sort?: string, inStock?: boolean }} query
 *   ids      只要這幾件（照給的順序回；找不到的略過）
 *   theme    這個主題的穿搭裡出現過的商品
 *   brand    這個品牌（代碼）的商品
 *   exclude  不要這幾件
 *   sort     排序，見 SORTS
 *   inStock  只看有庫存的
 */
export async function getProducts({ ids, theme, brand, exclude = [], sort, inStock } = {}) {
  await wait(200)
  let list = ids ? ids.map(productOf).filter(Boolean) : products.map((product) => productOf(product.productId))
  if (theme) list = list.filter((product) => product.themeCodes.includes(theme))
  if (brand) list = list.filter((product) => product.brandCode === brand)
  if (exclude.length) list = list.filter((product) => !exclude.includes(product.productId))
  return arrange(list, { sort, inStock })
}

/**
 * 關鍵字搜尋：比對名稱、品牌、標籤、所屬主題名稱（功能規劃 3.2）。
 * 空白分開的多個詞要全部命中；不分大小寫。
 */
export async function searchProducts(keyword, { sort, inStock } = {}) {
  await wait(250)
  const words = String(keyword ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const themeName = Object.fromEntries(themes.map((theme) => [theme.code, theme.name]))
  const list = products
    .map((product) => productOf(product.productId))
    .filter((product) => {
      const haystack = [product.name, product.brand, ...product.tags, ...product.themeCodes.map((code) => themeName[code] ?? '')]
        .join(' ')
        .toLowerCase()
      return words.every((word) => haystack.includes(word))
    })
  return arrange(list, { sort, inStock })
}

// ── 品牌 ──

export async function getBrands() {
  await wait(150)
  return [...brands]
}

/** 一個品牌；找不到回 null */
export async function getBrand(code) {
  await wait(150)
  return brandByCode.get(String(code)) ?? null
}
