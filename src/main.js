import { createApp, nextTick } from 'vue'
import App from './App.vue'
import { router } from './router'
import { reportFatal } from './stores/fatal'
// 身形 store 要一開站就在：登入那一刻把訪客在商品頁輸入的身形併進帳號，不管人在哪一頁（第十六輪子輪 2）
import './stores/body'
import './styles/tokens.css'
import './styles/base.css'

const app = createApp(App)

// ── 沒接住的錯誤 → 「出了點問題」的畫面（第十七輪子輪 2；功能規劃 7「錯誤頁」）──
// Vue 元件裡丟出來的、沒人接的 Promise、路由載不到頁面的，都報到 fatal store；App.vue 看到就換畫面。
app.config.errorHandler = (error, _instance, info) => reportFatal(error, `vue:${info}`)
window.addEventListener('unhandledrejection', (event) => reportFatal(event.reason, 'promise'))
router.onError((error) => reportFatal(error, 'router'))

// 換版本後的舊分頁：動態載入的 chunk 檔名已經不在伺服器上，Vite 會送 vite:preloadError（文件：Build › Load Error Handling）。
// 30 秒內沒重載過就重載一次（sessionStorage 記時間）；重載過還是失敗就交給錯誤畫面——部署真的壞了，不無限重載。
const RELOAD_KEY = 'reloaded-for-chunk'
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  let last = 0
  try {
    last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0
  } catch {
    // 讀不到就當沒重載過
  }
  if (Date.now() - last > 30000) {
    try {
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
    } catch {
      // 記不住就只重載這一次
    }
    window.location.reload()
    return
  }
  reportFatal(event.payload ?? new Error('載入新版本失敗'), 'chunk')
})

// ── 換頁的焦點與播報 ──
// 整頁載入會把焦點歸零並播報標題，單頁應用不會，鍵盤與讀屏的人會留在上一頁的位置。所以路徑改變時（只改查詢字串的一句話列不算）
// 把焦點移到新頁面的第一個 h1（還沒畫出來就 main），不捲動（捲動歸 scrollBehavior 管）；再把「已前往 X」寫進 aria-live 區塊。
router.afterEach((to, from) => {
  if (!from.matched.length || to.path === from.path) return
  nextTick(() => {
    const target = document.querySelector('main h1, h1') ?? document.querySelector('main')
    if (target) {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
      target.focus({ preventScroll: true })
    }
    const announcer = document.getElementById('route-announcer')
    if (!announcer) return
    announcer.textContent = ''
    setTimeout(() => {
      announcer.textContent = `已前往 ${to.meta.title ?? ''}`.trim()
    }, 50)
  })
})

app.use(router).mount('#app')
