// 假資料 API 層。
// 畫面只呼叫這裡匯出的函式，不直接碰 JSON；後端 API 好了以後，
// 只要把每個函式的內容換成 fetch，畫面不用改。
// 這些資料的欄位是前端先假設的，要和後端組員對過才算數。
//
// 商品資料分兩份：穿搭（outfits.json）裡每件單品帶著名稱、品牌、價格、尺寸這些列表就要用的欄位；
// 商品頁才需要的細節（描述、材質、顏色、庫存、尺寸表、模特兒試穿）放在 products.json，用 productId 對起來。
// 後端做的時候會是一張商品表加一張穿搭單品表，這裡的組合邏輯（productOf）就是那個 join。
import themes from './mock/themes.json'
import outfits from './mock/outfits.json'
import details from './mock/products.json'

// 模擬網路延遲，讓「載入中」的畫面在開發時看得到
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function getThemes() {
  await wait(150)
  return [...themes].sort((a, b) => a.sort - b.sort)
}

export async function getWeather() {
  await wait(150)
  // 正式版接後端的氣象資料；condition 先用 clear | cloudy | rain 三種
  return { city: '臺北', temperature: 18, humidity: 85, condition: 'rain', observedAt: '2026-10-06T08:00:00+08:00' }
}

/**
 * 取得穿搭組合。四個條件都是選填，空字串代表不限。
 * @param {{ style?: string, occasion?: string, category?: string, size?: string }} filters
 */
export async function getOutfits(filters = {}) {
  await wait(250)
  const { style, occasion, category, size } = filters
  return outfits.filter((outfit) => {
    if (style && outfit.themeCode !== style) return false
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

// ── 商品 ──

const detailOf = new Map(details.map((detail) => [detail.productId, detail]))

// 一件商品的完整資料：列表欄位（來自穿搭裡的單品）加細節（products.json），
// 再加上它出現在哪些主題（一件商品可以屬於多個主題：功能規劃 3.1）。
function productOf(id) {
  const detail = detailOf.get(id)
  let base = null
  const themeCodes = []
  for (const outfit of outfits) {
    const item = outfit.items.find((entry) => entry.productId === id)
    if (!item) continue
    base ??= item
    if (!themeCodes.includes(outfit.themeCode)) themeCodes.push(outfit.themeCode)
  }
  if (!base || !detail) return null
  const { colour, ...listFields } = base
  return { ...listFields, ...detail, kind: detail.kind ?? base.kind ?? null, themeCodes }
}

const allIds = () => [...new Set(outfits.flatMap((outfit) => outfit.items.map((item) => item.productId)))]

/** 一件商品；找不到回 null（商品頁據此顯示「找不到這件商品」） */
export async function getProduct(id) {
  await wait(200)
  return productOf(Number(id))
}

/**
 * 多件商品。
 * @param {{ ids?: number[], theme?: string, exclude?: number[] }} query
 *   ids      只要這幾件（照給的順序回；找不到的略過）
 *   theme    這個主題的穿搭裡出現過的商品
 *   exclude  不要這幾件
 */
export async function getProducts({ ids, theme, exclude = [] } = {}) {
  await wait(200)
  let list = ids ? ids.map(productOf).filter(Boolean) : allIds().map(productOf).filter(Boolean)
  if (theme) list = list.filter((product) => product.themeCodes.includes(theme))
  if (exclude.length) list = list.filter((product) => !exclude.includes(product.productId))
  return list
}

/** 包含這件商品的穿搭 */
export async function getOutfitsWithProduct(id) {
  await wait(200)
  const pid = Number(id)
  return outfits.filter((outfit) => outfit.items.some((item) => item.productId === pid))
}

/**
 * 關鍵字搜尋：比對名稱、品牌、標籤、所屬主題名稱（功能規劃 3.2）。
 * 空白分開的多個詞要全部命中；不分大小寫。
 */
export async function searchProducts(keyword) {
  await wait(250)
  const words = String(keyword ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const themeName = Object.fromEntries(themes.map((theme) => [theme.code, theme.name]))
  return allIds()
    .map(productOf)
    .filter(Boolean)
    .filter((product) => {
      const haystack = [product.name, product.brand, ...product.tags, ...product.themeCodes.map((code) => themeName[code] ?? '')]
        .join(' ')
        .toLowerCase()
      return words.every((word) => haystack.includes(word))
    })
}
