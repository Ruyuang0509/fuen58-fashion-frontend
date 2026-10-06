import { computed, ref } from 'vue'
import * as account from '@/api/account'

// 登入狀態宣告在模組最外層，所以整個網站共用同一份。
const KEY = 'session'

function storedSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY))
    if (parsed?.token && parsed.user && typeof parsed.user === 'object') {
      return {
        value: parsed,
        remembered: true,
      }
    }
  } catch {
    // 儲存空間不能用或內容壞掉時，繼續檢查分頁儲存空間
  }

  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY))
    if (parsed?.token && parsed.user && typeof parsed.user === 'object') {
      return {
        value: parsed,
        remembered: false,
      }
    }
  } catch {
    // 兩種儲存空間都不能用時，就從登出狀態開始
  }

  return {
    value: null,
    remembered: false,
  }
}

const stored = storedSession()
let remembered = stored.remembered
const token = ref(stored.value?.token ?? null)
const user = ref(stored.value?.user ?? null)
const loggedIn = computed(() => !!user.value)

function persist() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // 儲存空間不能用時，登入狀態仍留在記憶體
  }

  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // 儲存空間不能用時，登入狀態仍留在記憶體
  }

  if (!token.value) return

  const value = JSON.stringify({
    token: token.value,
    user: user.value,
  })

  if (remembered) {
    try {
      localStorage.setItem(KEY, value)
    } catch {
      // 寫入失敗時，這次登入只留在記憶體
    }
    return
  }

  try {
    sessionStorage.setItem(KEY, value)
  } catch {
    // 寫入失敗時，這次登入只留在記憶體
  }
}

async function login({ email, password, remember = false }) {
  const result = await account.login({ email, password })
  remembered = !!remember
  token.value = result.token
  user.value = result.user
  persist()
  return result.user
}

async function register({ email, password, name }) {
  const result = await account.register({ email, password, name })
  // 註冊後只記在這個分頁；要長久登入就用「記住登入」重新登入
  remembered = false
  token.value = result.token
  user.value = result.user
  persist()
  return result.user
}

function setUser(next) {
  user.value = next
  persist()
}

async function refresh() {
  if (!token.value) return null

  const me = await account.getMe(token.value)
  if (me) {
    setUser(me)
  } else {
    token.value = null
    user.value = null
    persist()
  }

  return me
}

async function logout() {
  const old = token.value

  // 先清掉畫面上的登入狀態，再通知後端；後端失敗也不影響登出
  token.value = null
  user.value = null
  persist()

  try {
    await account.logout(old)
  } catch {
    // 畫面已完成登出，不讓後端失敗影響使用者
  }
}

export function useSession() {
  return {
    user,
    token,
    loggedIn,
    login,
    register,
    logout,
    refresh,
    setUser,
  }
}
