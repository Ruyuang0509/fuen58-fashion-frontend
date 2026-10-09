// 試穿間的狀態（第十六輪子輪 3）：網址是主要的（可以貼給人），localStorage 的 fitting 是上一次的記憶——
// 單品頁的「放進試穿間」用它組連結：換掉對應的那一層、其他兩層照舊。
export const FITTING_KEY = 'fitting'
export const FITTING_SLOTS = ['outer', 'top', 'bottom']

/** 上一次試穿間的三層 { outer, top, bottom }（各 { id, colour } 或 null）；沒有或壞掉回 null */
export function readFitting() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FITTING_KEY))
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function writeFitting(state) {
  try {
    localStorage.setItem(FITTING_KEY, JSON.stringify(state))
  } catch {
    // 存不了就只有網址記得
  }
}

/** 「放進試穿間」的查詢字串：這一件換進它的那一層，其他層沿用上一次的 */
export function fittingQueryWith(category, productId, colourCode) {
  const saved = readFitting()
  const query = {}
  for (const key of FITTING_SLOTS) {
    const entry = saved?.[key]
    if (entry && Number.isInteger(Number(entry.id)) && entry.colour) query[key] = `${entry.id}:${entry.colour}`
  }
  query[category] = `${productId}:${colourCode}`
  return query
}
