import { ref } from 'vue'

// 沒接住的錯誤（第十七輪子輪 2）：Vue 的 errorHandler、沒人接的 Promise、路由載不到頁面都來這裡；
// App.vue 看到有值就改畫「出了點問題」的畫面（功能規劃 7「錯誤頁：伺服器錯誤」）。整站一份。
const fatal = ref(null)

export function reportFatal(error, where = '') {
  // 已經在錯誤畫面上就不再覆蓋：第一個錯誤最接近原因
  if (fatal.value) return
  const message = error instanceof Error ? error.message : String(error ?? '')
  fatal.value = {
    message,
    where,
    stack: error instanceof Error ? error.stack ?? '' : '',
    at: new Date().toISOString(),
  }
  if (import.meta.env.DEV) console.error('[fatal]', where, error)
}

export function useFatal() {
  return { fatal }
}
