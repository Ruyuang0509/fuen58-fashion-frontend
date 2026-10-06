import { computed, reactive } from 'vue'

// 瀏覽紀錄（第十五輪子輪 2）：看過哪些單品、哪些穿搭，各最多 24 筆，重看的移到最前面。
// 純前端、只存在這個瀏覽器的 localStorage，不進後端（規格 09 §3.1；契約只留「選配同步」一行）。
const KEY = 'history'
const CAP = 24

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY))
    if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.outfits)) return parsed
  } catch {
    // 儲存空間不能用或內容壞掉：從空的開始
  }
  return { products: [], outfits: [] }
}

const state = reactive(load())

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ products: state.products, outfits: state.outfits }))
  } catch {
    // 存不了就只留在記憶體，重新整理後會消失
  }
}

/** 記一筆：kind 是 products 或 outfits，id 是商品或穿搭的編號 */
function record(kind, id) {
  const target = Number(id)
  if (!state[kind] || !Number.isFinite(target)) return
  const rest = state[kind].filter((entry) => entry.id !== target)
  state[kind] = [{ id: target, at: new Date().toISOString() }, ...rest].slice(0, CAP)
  save()
}

function clear() {
  state.products = []
  state.outfits = []
  save()
}

export function useHistory() {
  return {
    products: computed(() => state.products),
    outfits: computed(() => state.outfits),
    count: computed(() => state.products.length + state.outfits.length),
    record,
    clear,
  }
}
