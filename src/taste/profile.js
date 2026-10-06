// 喜好推測（第十五輪子輪 4；規格 09 §5.2）。
// 把三種訊號加成每條路線的分數：挑過的（偏好調查）、收藏的、看過的；加總後正規化成兩位小數、總和 1 的權重。
// 純函式、不碰 store 與 API：store（stores/taste.js）把資料餵進來，這裡只算，所以可以單獨驗。
//
// 每一筆訊號的強度：
//   調查裡挑一套 1.0；
//   收藏一套穿搭 0.6、收藏一件單品 0.6（平分給它所屬的幾條路線）；
//   看過一套穿搭 0.2、看過一件單品 0.2（平分）。
// 理由取每條路線最強的那一種訊號：「你挑了 3 套街頭」「你收藏了 2 件復古」「你最近看了 4 套戶外」。
export const SIGNAL = { pick: 1, favouriteOutfit: 0.6, favouriteProduct: 0.6, seenOutfit: 0.2, seenProduct: 0.2 }

// 調查至少挑三套；後端只存了權重、沒有名單時，當作挑了三套
const MIN_PICKS = 3

const TEXT = {
  pick: (n, name) => `你挑了 ${n} 套${name}`,
  favouriteOutfit: (n, name) => `你收藏了 ${n} 套${name}`,
  favouriteProduct: (n, name) => `你收藏了 ${n} 件${name}`,
  seenOutfit: (n, name) => `你最近看了 ${n} 套${name}`,
  seenProduct: (n, name) => `你最近看了 ${n} 件${name}`,
}

const rankIn = (order) => (code) => {
  const index = order.indexOf(code)
  return index === -1 ? order.length : index
}

/**
 * 把各路線的分數變成兩位小數、總和剛好 1 的權重。
 * 最大餘數法：先無條件捨去到 0.01，差的幾個 0.01 補給餘數最大的；餘數一樣時照 order（路線的順序）。
 * 分數全是 0 → {}。
 * @param {Record<string, number>} scores
 * @param {string[]} order 路線順序（平手時誰先）
 */
export function normaliseWeights(scores, order = []) {
  const rank = rankIn(order)
  const entries = Object.entries(scores).filter(([, score]) => score > 0)
  const total = entries.reduce((sum, [, score]) => sum + score, 0)
  if (total <= 0) return {}
  const rows = entries.map(([code, score]) => {
    const exact = (score / total) * 100
    const floor = Math.floor(exact)
    return { code, pct: floor, remainder: exact - floor }
  })
  let missing = 100 - rows.reduce((sum, row) => sum + row.pct, 0)
  rows.sort((a, b) => b.remainder - a.remainder || rank(a.code) - rank(b.code))
  for (const row of rows) {
    if (missing <= 0) break
    row.pct += 1
    missing -= 1
  }
  rows.sort((a, b) => b.pct - a.pct || rank(a.code) - rank(b.code))
  return Object.fromEntries(rows.map((row) => [row.code, row.pct / 100]))
}

/** 權重由大到小排（平手照 order），回 [{ code, weight }]；0 的不列 */
export function rankWeights(weights, order = []) {
  const rank = rankIn(order)
  return Object.entries(weights ?? {})
    .filter(([, weight]) => weight > 0)
    .map(([code, weight]) => ({ code, weight }))
    .sort((a, b) => b.weight - a.weight || rank(a.code) - rank(b.code))
}

/**
 * 穿搭照路線權重排：權重高的路線先；權重一樣的照路線順序（挑了三條不同的路線時，同一條的會排在一起，
 * 不是三條交錯），沒有權重的最後；最後才照 id。
 */
export function sortByWeights(outfits, weights, order = []) {
  const rank = rankIn(order)
  const weightOf = (outfit) => weights?.[outfit.themeCode] ?? 0
  return [...outfits].sort((a, b) => (
    weightOf(b) - weightOf(a)
    || (weightOf(a) > 0 ? rank(a.themeCode) - rank(b.themeCode) : 0)
    || a.id - b.id
  ))
}

/**
 * 推測。沒有任何訊號回 null。
 * @param {object} input
 *   preferences  會員的偏好 { audience, themes: { code: weight }, pickedOutfitIds } 或 null
 *   favorites    { products: [{ productId }], outfits: [{ outfitId }] }
 *   history      { products: [{ id }], outfits: [{ id }] }
 *   outfitsById  Map：id → 穿搭（要有 themeCode）
 *   productsById Map：productId → 商品（要有 themeCodes）
 *   themes       路線清單（照 sort 排好；給名稱與平手順序）
 * @returns {{ weights: Record<string, number>, top: string, reasons: { code: string, text: string }[], source: 'quiz'|'favorites'|'history' } | null}
 */
export function buildProfile({ preferences = null, favorites = {}, history = {}, outfitsById = new Map(), productsById = new Map(), themes = [] }) {
  const order = themes.map((theme) => theme.code)
  const nameOf = (code) => themes.find((theme) => theme.code === code)?.name ?? code
  const scores = {}
  // 每條路線各種訊號的筆數與分數，理由從這裡挑最強的
  const tally = {}
  const add = (code, kind, value, count = 1) => {
    if (!code || !(value > 0)) return
    scores[code] = (scores[code] ?? 0) + value
    const bucket = (tally[code] ??= {})
    const cell = (bucket[kind] ??= { count: 0, value: 0 })
    cell.count += count
    cell.value += value
  }
  // 單品屬於好幾條路線時平分；筆數仍算一件
  const addProduct = (productId, kind, unit) => {
    const codes = productsById.get(Number(productId))?.themeCodes ?? []
    for (const code of codes) add(code, kind, unit / codes.length)
  }

  // 調查：有挑的名單就照名單數；只有權重（後端只存權重）就用權重乘挑的套數
  const picks = (preferences?.pickedOutfitIds ?? []).map((id) => outfitsById.get(Number(id))).filter(Boolean)
  if (picks.length) {
    for (const outfit of picks) add(outfit.themeCode, 'pick', SIGNAL.pick)
  } else if (preferences?.themes) {
    const n = Math.max(preferences.pickedOutfitIds?.length ?? 0, MIN_PICKS)
    for (const [code, weight] of Object.entries(preferences.themes)) add(code, 'pick', SIGNAL.pick * weight * n, Math.max(1, Math.round(weight * n)))
  }
  // 收藏：整套直接記在它的路線；單品平分
  for (const entry of favorites.outfits ?? []) add(outfitsById.get(Number(entry.outfitId))?.themeCode, 'favouriteOutfit', SIGNAL.favouriteOutfit)
  for (const entry of favorites.products ?? []) addProduct(entry.productId, 'favouriteProduct', SIGNAL.favouriteProduct)
  // 看過的
  for (const entry of history.outfits ?? []) add(outfitsById.get(Number(entry.id))?.themeCode, 'seenOutfit', SIGNAL.seenOutfit)
  for (const entry of history.products ?? []) addProduct(entry.id, 'seenProduct', SIGNAL.seenProduct)

  const weights = normaliseWeights(scores, order)
  const ranked = rankWeights(weights, order)
  if (!ranked.length) return null

  const reasons = ranked.map(({ code }) => {
    const [kind, cell] = Object.entries(tally[code]).sort((a, b) => b[1].value - a[1].value)[0]
    return { code, text: TEXT[kind](cell.count, nameOf(code)) }
  })
  const kinds = new Set(Object.values(tally).flatMap((bucket) => Object.keys(bucket)))
  const source = kinds.has('pick') ? 'quiz' : kinds.has('favouriteOutfit') || kinds.has('favouriteProduct') ? 'favorites' : 'history'

  return { weights, top: ranked[0].code, reasons, source }
}
