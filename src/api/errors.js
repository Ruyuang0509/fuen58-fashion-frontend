// API 的錯誤（契約通則：{ error: { code, message, field? } }）。假 API 直接丟這個；接真後端時 fetch 包裝把回應轉成它。
// 放在自己的檔案：index.js 與 account.js 都要用，彼此不互相 import。
export class ApiError extends Error {
  constructor(code, message, field = null) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.field = field
  }
}

// 開發版的失敗開關（第十七輪子輪 2）：localStorage 的 apiFail 寫函式名（逗號分隔，例如 getOutfits,getProducts；* 是全部），
// 假 API 對應的函式就丟 NETWORK 錯誤——拿來驗每一頁的錯誤態，也是正控（開關關掉要全綠）。正式版不認這個開關。
export function failIfSwitched(name) {
  if (!import.meta.env.DEV) return
  let raw = null
  try {
    raw = localStorage.getItem('apiFail')
  } catch {
    return
  }
  if (!raw) return
  const names = raw.split(',').map((entry) => entry.trim())
  if (names.includes('*') || names.includes(name)) throw new ApiError('NETWORK', '連不上伺服器')
}
