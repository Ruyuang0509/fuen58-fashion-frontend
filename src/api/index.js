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
//   campaigns.json 活動（第十五輪）：期間、所屬路線、幾套穿搭、幾件單品、放在哪些位置
import themes from './mock/themes.json'
import outfits from './mock/outfits.json'
import products from './mock/products.json'
import brands from './mock/brands.json'
import campaigns from './mock/campaigns.json'
import { familyOf } from '@/products/colourFamily'

// 多值條件：陣列或逗號字串都收，空的丟掉（第十五輪子輪 3：場合、類別、尺寸、品牌、色系可以多選，任一符合）
const many = (value) => (Array.isArray(value) ? value : value ? String(value).split(',') : []).map((entry) => String(entry).trim()).filter(Boolean)

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
 * 取得穿搭組合。條件都是選填，空的代表不限。場合、類別、尺寸可以多選（陣列或逗號字串），任一符合就算。
 * @param {{ style?: string, audience?: string, occasion?: string|string[], category?: string|string[], size?: string|string[], ids?: number[] }} filters
 *   ids  只要這幾套（照給的順序；活動頁用）
 */
export async function getOutfits(filters = {}) {
  await wait(250)
  const { style, audience, ids } = filters
  const occasions = many(filters.occasion)
  const categories = many(filters.category)
  const sizes = many(filters.size)
  const base = ids ? ids.map((id) => outfits.find((outfit) => outfit.id === Number(id))).filter(Boolean) : outfits
  return base.map(resolveOutfit).filter((outfit) => {
    if (style && outfit.themeCode !== style) return false
    if (audience && !forAudience(outfit, audience)) return false
    if (occasions.length && !occasions.some((occasion) => outfit.occasions.includes(occasion))) return false
    if (categories.length && !outfit.items.some((item) => categories.includes(item.category))) return false
    // 尺寸：只看選到的類別的單品有沒有這些尺寸之一；沒選類別時，任何一件有就算
    if (sizes.length) {
      const candidates = categories.length ? outfit.items.filter((item) => categories.includes(item.category)) : outfit.items
      if (!candidates.some((item) => item.sizes.some((size) => sizes.includes(size)))) return false
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

// 關鍵字：比對名稱、品牌、標籤、所屬主題名稱（功能規劃 3.2）。空白分開的多個詞要全部命中；不分大小寫
const themeNameOf = Object.fromEntries(themes.map((theme) => [theme.code, theme.name]))
const wordsOf = (keyword) => String(keyword ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean)
function matchesWords(product, words) {
  const haystack = [product.name, product.brand, ...product.tags, ...product.themeCodes.map((code) => themeNameOf[code] ?? '')].join(' ').toLowerCase()
  return words.every((word) => haystack.includes(word))
}

/**
 * 多件商品。條件都是選填（契約 4.2；第十五輪子輪 3 加了 q、category、brands、colours、sizes、價格區間）。
 * @param {{ ids?: number[], theme?: string, brand?: string, brands?: string[]|string, exclude?: number[], q?: string, category?: string,
 *   colours?: string[]|string, sizes?: string[]|string, priceMin?: number, priceMax?: number, sort?: string, inStock?: boolean }} query
 *   ids       只要這幾件（照給的順序回；找不到的略過）
 *   theme     這個主題的穿搭裡出現過的商品
 *   brand     這個品牌（代碼）的商品；brands 多個品牌任一
 *   exclude   不要這幾件
 *   q         關鍵字
 *   category  類別代碼
 *   colours   色系代碼（products/colourFamily.js），商品任一個顏色屬於其中之一就算
 *   sizes     尺寸任一
 *   priceMin／priceMax  價格區間（含）
 *   sort      排序，見 SORTS；inStock 只看有庫存的
 */
export async function getProducts({ ids, theme, brand, brands: brandList, exclude = [], q, category, colours, sizes, priceMin, priceMax, sort, inStock } = {}) {
  await wait(200)
  let list = ids ? ids.map(productOf).filter(Boolean) : products.map((product) => productOf(product.productId))
  if (theme) list = list.filter((product) => product.themeCodes.includes(theme))
  if (brand) list = list.filter((product) => product.brandCode === brand)
  const brandCodes = many(brandList)
  if (brandCodes.length) list = list.filter((product) => brandCodes.includes(product.brandCode))
  if (category) list = list.filter((product) => product.category === category)
  const families = many(colours)
  if (families.length) list = list.filter((product) => product.colours.some((colour) => families.includes(familyOf(colour.hex))))
  const sizeCodes = many(sizes)
  if (sizeCodes.length) list = list.filter((product) => product.sizes.some((size) => sizeCodes.includes(size)))
  if (Number.isFinite(priceMin)) list = list.filter((product) => product.price >= priceMin)
  if (Number.isFinite(priceMax)) list = list.filter((product) => product.price <= priceMax)
  const words = wordsOf(q)
  if (words.length) list = list.filter((product) => matchesWords(product, words))
  if (exclude.length) list = list.filter((product) => !exclude.includes(product.productId))
  return arrange(list, { sort, inStock })
}

/** 關鍵字搜尋（getProducts 的薄包裝）；沒有關鍵字回空陣列 */
export async function searchProducts(keyword, { sort, inStock } = {}) {
  if (!wordsOf(keyword).length) {
    await wait(50)
    return []
  }
  return getProducts({ q: keyword, sort, inStock })
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

// ── 活動（第十五輪）──
// 一檔活動：期間、所屬路線（天空與顏色跟它）、幾套穿搭、幾件單品、放在哪些位置（stage 舞台插卡｜footer 頁尾）。
// 進行中與否在這裡算（臺北時間，endsAt 含當天），畫面不自己比日期。功能規劃沒有這一項，10/12 要全組確認。

const todayInTaipei = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date())

function decorateCampaign(campaign) {
  const today = todayInTaipei()
  return {
    ...campaign,
    active: campaign.startsAt <= today && today <= campaign.endsAt,
    outfits: campaign.outfitIds.map((id) => outfits.find((outfit) => outfit.id === id)).filter(Boolean).map(resolveOutfit),
  }
}

/**
 * 活動清單，快結束的排前面。
 * @param {{ active?: boolean, theme?: string, placement?: 'stage' | 'footer' }} query
 */
export async function getCampaigns({ active = false, theme, placement } = {}) {
  await wait(150)
  let list = campaigns.map(decorateCampaign)
  if (active) list = list.filter((campaign) => campaign.active)
  if (theme) list = list.filter((campaign) => campaign.themeCode === theme)
  if (placement) list = list.filter((campaign) => campaign.placements.includes(placement))
  return list.sort((a, b) => a.endsAt.localeCompare(b.endsAt))
}

/** 一檔活動；過期的也回（active 是 false），找不到回 null */
export async function getCampaign(code) {
  await wait(150)
  const found = campaigns.find((campaign) => campaign.code === String(code))
  return found ? decorateCampaign(found) : null
}
