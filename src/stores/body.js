import { computed, ref, watch } from 'vue'
import * as account from '@/api/account'
import { cleanBody } from '@/products/sizeAdvice'
import { useSession } from '@/stores/session'

// 身形（第十六輪子輪 2）：整站一份，給商品頁的尺寸建議、收藏頁的尺寸下拉用。
// 訪客存 localStorage 的 body（商品頁臨時輸入的身高體重）；登入時帳號沒有而本機有就併進帳號；帳號有的優先。
// 和收藏、購物車一樣：存不了就留在記憶體。
const KEY = 'body'

const { user, token, loggedIn, setUser } = useSession()

function readLocal() {
  try {
    return cleanBody(JSON.parse(localStorage.getItem(KEY)))
  } catch {
    return null
  }
}

function writeLocal(value) {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value))
    else localStorage.removeItem(KEY)
  } catch {
    // 存不了就只在這次有效
  }
}

const local = ref(readLocal())

const body = computed(() => (loggedIn.value ? cleanBody(user.value?.body) : local.value))
const source = computed(() => (body.value ? (loggedIn.value ? 'account' : 'local') : null))

// 登入那一刻：帳號沒有、本機有 → 併進帳號（身高體重都齊才送；不齊就留在本機）
async function sync() {
  if (!loggedIn.value) return
  const mine = local.value
  if (!mine || !mine.height || !mine.weight || user.value?.body) return
  try {
    const saved = await account.saveBody(token.value, mine)
    setUser({ ...user.value, body: saved })
    local.value = null
    writeLocal(null)
  } catch {
    // 下次登入再試
  }
}
watch(loggedIn, sync, { immediate: true })

/** 存身形：登入的進帳號（後端驗範圍、丟 ApiError），訪客存本機 */
async function save(data) {
  if (loggedIn.value) {
    const saved = await account.saveBody(token.value, data)
    setUser({ ...user.value, body: saved })
    return saved
  }
  const clean = cleanBody(data)
  local.value = clean
  writeLocal(clean)
  return clean
}

async function clear() {
  if (loggedIn.value) {
    await account.clearBody(token.value)
    setUser({ ...user.value, body: null })
  }
  local.value = null
  writeLocal(null)
}

export function useBody() {
  return { body, source, save, clear }
}
