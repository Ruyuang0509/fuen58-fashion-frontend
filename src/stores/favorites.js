import { computed, reactive, watch } from 'vue'
import * as account from '@/api/account'
import { useSession } from '@/stores/session'

// 收藏（第十五輪子輪 2）：單品與整套穿搭都能收。
// 訪客收在 localStorage 的 favorites；登入或註冊成功的那一刻，把本機這包併進帳號（聯集、同一件保留較早的時間），併完清掉本機。
// 這裡只放「現在這個人的收藏」一份：畫面上每顆愛心、頂欄的件數、收藏頁都讀它。
// 和購物車一樣，存不了就留在記憶體（規格 09 §7 第 1 點）。
const KEY = 'favorites'
const ID_KEY = { products: 'productId', outfits: 'outfitId' }

const empty = () => ({ products: [], outfits: [] })
const state = reactive(empty())

function readLocal() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY))
    if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.outfits)) return parsed
  } catch {
    // 儲存空間不能用或內容壞掉：當作沒有
  }
  return empty()
}

function writeLocal() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ products: state.products, outfits: state.outfits }))
  } catch {
    // 存不了就只留在記憶體
  }
}

function clearLocal() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // 清不掉也沒關係，下次登入會再併一次（併入是聯集，不會重複）
  }
}

function assign(next) {
  state.products = Array.isArray(next?.products) ? next.products : []
  state.outfits = Array.isArray(next?.outfits) ? next.outfits : []
}

const { token, loggedIn } = useSession()

// 登入狀態一變就重新對齊：登出 → 讀本機；登入 → 本機有東西就併進帳號，沒有就直接拿帳號的
let syncing = 0
async function sync() {
  const ticket = ++syncing
  if (!loggedIn.value) {
    assign(readLocal())
    return
  }
  const mine = readLocal()
  try {
    const result = mine.products.length || mine.outfits.length
      ? await account.mergeFavorites(token.value, mine)
      : await account.getFavorites(token.value)
    if (ticket !== syncing) return
    clearLocal()
    assign(result)
  } catch {
    // 帳號那邊拿不到：先用本機的，下次再試
    if (ticket === syncing) assign(mine)
  }
}
watch(loggedIn, sync, { immediate: true })

function has(kind, id) {
  const key = ID_KEY[kind]
  const target = Number(id)
  return !!key && state[kind].some((entry) => entry[key] === target)
}

/**
 * 收藏或取消。回傳切換後是不是「已收藏」。
 * @param {'products'|'outfits'} kind
 * @param {number|string} id
 * @param {{ colour?: string }} extra 單品可以記下收藏時看的顏色
 */
async function toggle(kind, id, extra = {}) {
  const key = ID_KEY[kind]
  if (!key) return false
  const target = Number(id)
  const on = !has(kind, target)
  if (on) {
    const entry = { [key]: target, addedAt: new Date().toISOString() }
    if (kind === 'products' && extra.colour) entry.colour = extra.colour
    state[kind] = [entry, ...state[kind]]
  } else {
    state[kind] = state[kind].filter((entry) => entry[key] !== target)
  }
  if (loggedIn.value) {
    try {
      if (on) await account.addFavorite(token.value, kind, target, extra)
      else await account.removeFavorite(token.value, kind, target)
    } catch {
      // 畫面已經切換；帳號那邊失敗就等下次同步
    }
  } else {
    writeLocal()
  }
  return on
}

export function useFavorites() {
  return {
    products: computed(() => state.products),
    outfits: computed(() => state.outfits),
    count: computed(() => state.products.length + state.outfits.length),
    has,
    toggle,
    refresh: sync,
  }
}
