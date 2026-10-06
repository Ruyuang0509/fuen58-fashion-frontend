import { createRouter, createWebHistory } from 'vue-router'
import { SITE_NAME } from '@/config'

// 還沒做的頁面先共用同一個佔位畫面，路由先定下來
const todo = () => import('@/views/PlaceholderView.vue')

// meta 的欄位：
//   title     分頁標題與佔位畫面的標題
//   zone      'explore' 探索區（寬舞台）｜'transaction' 交易區（置中單欄，操作守慣例）
//   sentence  true 時顯示一句話列
//   level     功能清單的層級：必／特／加（只有佔位畫面會顯示）
//   note      這一頁要放什麼（只有佔位畫面會顯示）
const routes = [
  // 探索區
  // 入口自己畫全幅的天空與頂欄，所以 bare；一句話篩選在入口是那句大字，不用共用的 SentenceBar
  { path: '/', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { title: '入口', zone: 'explore', bare: true } },
  { path: '/themes/:code', name: 'theme', component: () => import('@/views/ThemeView.vue'), meta: { title: '主題', zone: 'explore', sentence: true } },
  { path: '/outfits', name: 'outfits', component: () => import('@/views/OutfitsView.vue'), meta: { title: '全部穿搭', zone: 'explore', sentence: true } },
  // 搜尋結果是單品格，一句話列篩的是穿搭，兩者不是同一組條件，所以這頁不放一句話列
  { path: '/search', name: 'search', component: () => import('@/views/SearchView.vue'), meta: { title: '搜尋結果', zone: 'explore' } },
  // 商品頁：上半部屬探索區；購買區塊守慣例（在頁面裡自己分）
  { path: '/products/:id', name: 'product', component: () => import('@/views/ProductView.vue'), meta: { title: '商品頁', zone: 'explore' } },
  { path: '/brands/:id', name: 'brand', component: () => import('@/views/BrandView.vue'), meta: { title: '品牌頁', zone: 'explore' } },
  { path: '/wall', name: 'wall', component: todo, meta: { title: '穿搭牆', zone: 'explore', level: '特', note: '瀑布流；依主題篩選；依最新或最多讚排序。' } },
  { path: '/wall/:id', name: 'wall-post', component: todo, meta: { title: '穿搭照', zone: 'explore', level: '特', note: '單張穿搭照與照片上的商品標註。' } },
  // 天氣穿搭就是首頁第一屏（天氣、一句理由、合今天的幾套、可換風格），所以這個網址直接回首頁（2026-10-06 使用者裁決）
  { path: '/weather', name: 'weather', redirect: '/' },
  { path: '/onboarding/style', name: 'onboarding-style', component: todo, meta: { title: '選偏好', zone: 'explore', level: '特', note: '註冊後引導第一步：至少選三張風格圖片；可略過。' } },
  { path: '/fitting', name: 'fitting', component: todo, meta: { title: '試穿間', zone: 'explore', level: '加', note: '2D 人偶試穿；先試做再決定是否排入。' } },

  // 交易區
  { path: '/cart', name: 'cart', component: () => import('@/views/CartView.vue'), meta: { title: '購物車', zone: 'transaction' } },
  // 結帳與會員（第十輪）。auth: true 的頁面沒登入會先到登入頁，登入後回到原本要去的網址
  { path: '/checkout', name: 'checkout', component: () => import('@/views/CheckoutView.vue'), meta: { title: '結帳', zone: 'transaction', auth: true } },
  { path: '/checkout/done/:orderId', name: 'checkout-done', component: () => import('@/views/OrderDoneView.vue'), meta: { title: '訂單完成', zone: 'transaction', auth: true } },
  // guest: true 的頁面是給還沒登入的人的；已登入就直接去會員中心
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { title: '登入', zone: 'transaction', guest: true } },
  { path: '/register', name: 'register', component: () => import('@/views/RegisterView.vue'), meta: { title: '註冊', zone: 'transaction', guest: true } },
  { path: '/onboarding/body', name: 'onboarding-body', component: todo, meta: { title: '填身形', zone: 'transaction', level: '特', note: '註冊後引導第二步：身高、體重，三圍選填；可略過。' } },
  { path: '/account', name: 'account', component: () => import('@/views/AccountView.vue'), meta: { title: '個人資料', zone: 'transaction', auth: true } },
  { path: '/account/addresses', name: 'account-addresses', component: () => import('@/views/AddressesView.vue'), meta: { title: '地址簿', zone: 'transaction', auth: true } },
  { path: '/account/orders', name: 'account-orders', component: () => import('@/views/OrdersView.vue'), meta: { title: '訂單紀錄', zone: 'transaction', auth: true } },
  { path: '/account/orders/:id', name: 'account-order', component: () => import('@/views/OrderView.vue'), meta: { title: '訂單明細', zone: 'transaction', auth: true } },
  { path: '/account/body', name: 'account-body', component: todo, meta: { title: '身形資料', zone: 'transaction', level: '特', note: '供尺寸推薦與試穿使用。' } },
  { path: '/account/style', name: 'account-style', component: todo, meta: { title: '我的偏好', zone: 'transaction', level: '特', note: '以風格組成比例呈現；可重選。' } },
  { path: '/account/favorites', name: 'account-favorites', component: todo, meta: { title: '收藏', zone: 'transaction', level: '特', note: '收藏的商品，可直接加入購物車。' } },
  { path: '/account/outfits', name: 'account-outfits', component: todo, meta: { title: '我的穿搭照', zone: 'transaction', level: '特', note: '自己發的照片與審核狀態。' } },
  { path: '/wall/new', name: 'wall-new', component: todo, meta: { title: '上傳穿搭照', zone: 'transaction', level: '特', note: '上傳、標註、公開同意與送出。' } },
  { path: '/consign', name: 'consign', component: todo, meta: { title: '寄賣申請', zone: 'transaction', level: '加', note: '二手做法定案後才決定做不做。' } },

  // 其他網址一律到這裡。要放在最後。
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue'), meta: { title: '找不到頁面', zone: 'transaction' } },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // 上一頁、下一頁：回到離開時的捲動位置
    if (savedPosition) return savedPosition
    // 同一頁只是換篩選條件：留在原地
    if (to.path === from.path) return false
    return { top: 0 }
  },
})

// 要登入的頁面：沒登入就先去登入頁，帶著原本要去的網址，登入後回來（功能規劃 2「登入後回到原本頁面」）。
// session store 用動態載入：首頁這類不用登入的頁面不必先載它。
router.beforeEach(async (to) => {
  if (!to.meta.auth && !to.meta.guest) return true
  const { useSession } = await import('@/stores/session')
  const loggedIn = useSession().loggedIn.value
  if (to.meta.guest) return loggedIn ? { name: 'account' } : true
  if (loggedIn) return true
  return { name: 'login', query: { redirect: to.fullPath } }
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title}｜${SITE_NAME}` : SITE_NAME
})
