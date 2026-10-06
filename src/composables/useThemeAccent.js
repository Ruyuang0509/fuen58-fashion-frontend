import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { accentOf, THEME_VISUALS } from '@/theme/themes'

// 主題色跟著走：進過哪個主題，全站的強調色就換成那個主題的顏色，
// 直到進入另一個主題為止。做法只是改寫 <html> 上的 --accent 這個 CSS 變數。
// 用 sessionStorage 記住，重新整理後還在；關掉分頁就回到預設。
const KEY = 'activeTheme'

function remembered() {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    // 瀏覽器停用儲存空間時讀不到，當作沒有進過主題
    return null
  }
}

// 最近進過的主題代碼（搜尋沒有結果時拿來推薦同路線的單品）；沒有就 null
export const rememberedTheme = remembered

function remember(code) {
  try {
    sessionStorage.setItem(KEY, code)
  } catch {
    // 存不了就只在這次頁面載入期間有效
  }
}

function apply(code) {
  document.documentElement.style.setProperty('--accent', accentOf(code))
}

export function useThemeAccent() {
  const route = useRoute()
  apply(remembered())
  watch(
    () => (route.name === 'theme' ? String(route.params.code) : null),
    (code) => {
      // 網址上的主題代碼不存在時（例如手動打錯），不要動現在的強調色
      if (!code || !(code in THEME_VISUALS)) return
      remember(code)
      apply(code)
    },
    { immediate: true },
  )
}
