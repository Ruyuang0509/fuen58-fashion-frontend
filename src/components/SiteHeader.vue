<script setup>
// 頂欄（第十一輪重做）：左邊是站名加「現在的天氣」一個小圖示，右邊四件事各一個線條圖示配小字。
// 搜尋平常只是一個圖示，點了才滑出輸入框；滑過任何一項，圖示與字變深、底下一條線畫出來。
// 浮在天空上時（float）沒有底、沒有線，顏色跟著外面；捲過天空後才有底色與一條細線。
import '@fontsource/noto-serif-tc/600.css'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getWeather } from '@/api'
import HeaderPopover from '@/components/HeaderPopover.vue'
import Icon from '@/components/Icon.vue'
import CartPeek from '@/components/peeks/CartPeek.vue'
import FavPeek from '@/components/peeks/FavPeek.vue'
import MemberPeek from '@/components/peeks/MemberPeek.vue'
import RoutesPeek from '@/components/peeks/RoutesPeek.vue'
import { FEATURES, SITE_NAME } from '@/config'
import { useCart } from '@/stores/cart'
import { useFavorites } from '@/stores/favorites'
import { useSession } from '@/stores/session'

defineProps({
  float: { type: Boolean, default: false },
})

const route = useRoute()
const router = useRouter()
const { count } = useCart()
const { count: favCount } = useFavorites()
const { user, loggedIn } = useSession()

// 搜尋框：在帶關鍵字的單品列表頁常開；其他頁點圖示才開
const onResults = () => route.name === 'products' && !!route.query.q
const keyword = ref(String(route.query.q ?? ''))
const searching = ref(onResults())
const searchInput = ref(null)
watch(
  () => route.query.q,
  (q) => (keyword.value = String(q ?? '')),
)
watch(
  () => [route.name, route.query.q],
  () => {
    if (onResults()) searching.value = true
  },
)

async function toggleSearch() {
  searching.value = !searching.value
  if (searching.value) {
    await nextTick()
    searchInput.value?.focus()
  }
}

function closeSearch() {
  if (!onResults()) searching.value = false
}

function onBlur() {
  // 沒打字就離開：收回去；打了字留著，像一般的搜尋框
  if (!keyword.value.trim()) closeSearch()
}

function search() {
  const q = keyword.value.trim()
  if (q) router.push({ name: 'products', query: { q } })
}

// 商品圖飛到提袋的那一刻（useFlyToCart 送的 cart:arrive）、小愛心飛到收藏的那一刻（fav:arrive），
// 件數與圖示一起跳一下。數字本身在按下的瞬間就更新了，這裡只是回饋。
function bumper() {
  const on = ref(false)
  let timer = 0
  const hit = () => {
    on.value = false
    requestAnimationFrame(() => (on.value = true))
    clearTimeout(timer)
    timer = setTimeout(() => (on.value = false), 600)
  }
  return { on, hit, stop: () => clearTimeout(timer) }
}
const cartBump = bumper()
const favBump = bumper()
const bump = cartBump.on
onMounted(() => {
  window.addEventListener('cart:arrive', cartBump.hit)
  window.addEventListener('fav:arrive', favBump.hit)
})
onBeforeUnmount(() => {
  window.removeEventListener('cart:arrive', cartBump.hit)
  window.removeEventListener('fav:arrive', favBump.hit)
  cartBump.stop()
  favBump.stop()
})

// 站名旁的小天氣：晴、多雲、雨，夜裡是月亮
const weather = ref(null)
onMounted(async () => {
  try {
    weather.value = await getWeather()
  } catch {
    weather.value = null
  }
})
const hour = new Date().getHours()
const glyph = computed(() => {
  if (!weather.value) return null
  if (hour < 6 || hour >= 18) return 'moon'
  return { rain: 'rain', cloudy: 'cloud', clear: 'sun' }[weather.value.condition] ?? 'sun'
})
const conditionText = computed(() => ({ rain: '有雨', cloudy: '多雲', clear: '晴' })[weather.value?.condition] ?? '')
</script>

<template>
  <header class="site-header" :class="{ float, searching }">
    <RouterLink to="/" class="brand">
      <span class="mark">{{ SITE_NAME }}</span>
      <span v-if="glyph" class="today">
        <Icon :name="glyph" />
        <span class="today-text">{{ weather.city }} {{ weather.temperature }}°<template v-if="conditionText">，{{ conditionText }}</template></span>
      </span>
    </RouterLink>

    <!-- 「天氣穿搭」不另設連結：首頁第一屏就是它；穿搭牆有內容前先不放 -->
    <nav class="links" aria-label="主要">
      <form class="search" role="search" @submit.prevent="search">
        <button type="button" class="nav-item toggle" :aria-expanded="searching" aria-controls="site-search" @click="toggleSearch">
          <Icon name="search" />
          <span class="label">搜尋</span>
        </button>
        <label class="visually-hidden" for="site-search">搜尋單品、品牌或路線</label>
        <input id="site-search" ref="searchInput" v-model="keyword" type="search" placeholder="單品、品牌、路線" :tabindex="searching ? 0 : -1" @keydown.esc="closeSearch" @blur="onBlur" />
      </form>

      <!-- 每個圖示都是連結，滑到或 Tab 到會多一個預覽的小面板（HeaderPopover；只在桌機）：
           全部穿搭列八條路線、收藏看最近收的、購物車看裡面有什麼、會員是小選單 -->
      <HeaderPopover label="路線" wide>
        <template #trigger>
          <RouterLink :to="{ name: 'outfits' }" class="nav-item">
            <Icon name="hanger" />
            <span class="label">全部穿搭</span>
          </RouterLink>
        </template>
        <RoutesPeek />
      </HeaderPopover>
      <RouterLink v-if="FEATURES.wall" to="/wall" class="nav-item">
        <Icon name="camera" />
        <span class="label">穿搭牆</span>
      </RouterLink>
      <!-- 收藏（第十五輪子輪 2）：訪客也能用，件數和購物車同一種標法 -->
      <HeaderPopover label="收藏預覽">
        <template #trigger>
          <RouterLink :to="{ name: 'favorites' }" class="nav-item fav-link" :class="{ arrive: favBump.on.value }">
            <span class="badge-anchor">
              <Icon name="heart" />
              <span v-if="favCount" class="count" :class="{ bump: favBump.on.value }">{{ favCount }}<span class="visually-hidden"> 件</span></span>
            </span>
            <span class="label">收藏</span>
          </RouterLink>
        </template>
        <FavPeek />
      </HeaderPopover>
      <HeaderPopover label="購物車預覽">
        <template #trigger>
          <RouterLink to="/cart" class="nav-item cart-link" :class="{ arrive: bump }">
            <span class="badge-anchor">
              <Icon name="bag" />
              <span v-if="count" class="count" :class="{ bump }">{{ count }}<span class="visually-hidden"> 件</span></span>
            </span>
            <span class="label">購物車</span>
          </RouterLink>
        </template>
        <CartPeek />
      </HeaderPopover>
      <HeaderPopover label="會員">
        <template #trigger>
          <RouterLink v-if="loggedIn" :to="{ name: 'account' }" class="nav-item member">
            <Icon name="user" />
            <span class="label">{{ user.name || '會員' }}</span>
          </RouterLink>
          <RouterLink v-else :to="{ name: 'login' }" class="nav-item member">
            <Icon name="user" />
            <span class="label">會員</span>
          </RouterLink>
        </template>
        <MemberPeek />
      </HeaderPopover>
    </nav>
  </header>
</template>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  min-height: var(--header-h);
  padding: 0 var(--s4);
  background: var(--bg);
  border-bottom: 1px solid var(--line);
  transition: background-color var(--ease), border-color var(--ease), color var(--ease);
}

/* 浮在天空上：底色與線隨 --header-solid（SkyPage 照捲動進度給）從透明漸漸實起來；顏色繼承外面 */
.site-header.float {
  background: color-mix(in srgb, var(--bg) calc(var(--header-solid, 0) * 100%), transparent);
  border-bottom-color: color-mix(in srgb, var(--line) calc(var(--header-solid, 0) * 100%), transparent);
  color: inherit;
}

/* ── 站名與今天的天氣 ── */
.brand {
  display: inline-flex;
  align-items: baseline;
  gap: var(--s2);
  color: inherit;
  text-decoration: none;
}

.mark {
  font-family: 'Noto Serif TC', serif;
  font-size: var(--fs-2);
  font-weight: 600;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.today {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 1rem;
  opacity: 0.75;
  transition: opacity var(--ease);
}

/* 天氣的字平常收著，滑到站名才展開 */
.today-text {
  max-width: 0;
  overflow: hidden;
  white-space: nowrap;
  font-size: var(--fs-0);
  letter-spacing: 0.06em;
  opacity: 0;
  transition: max-width 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s;
}

.brand:hover .today,
.brand:focus-visible .today {
  opacity: 1;
}

.brand:hover .today-text,
.brand:focus-visible .today-text {
  max-width: 12em;
  opacity: 1;
}

/* ── 右邊的四件事 ── */
.links {
  display: flex;
  align-items: center;
  gap: var(--s2);
}

.nav-item {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 0.2rem;
  padding: 0.45rem 0.7rem 0.4rem;
  border: 0;
  background: transparent;
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  opacity: 0.78;
  transition: opacity var(--ease), transform var(--ease);
}

.nav-item .icon {
  font-size: 1.35rem;
}

.label {
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  white-space: nowrap;
}

/* 底下的線：平常是 0 寬，滑過與目前所在的頁面畫滿 */
.nav-item::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 0;
  height: 1px;
  background: currentColor;
  transform: translateX(-50%);
  transition: width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.nav-item:hover,
.nav-item:focus-visible,
.nav-item.router-link-active {
  opacity: 1;
}

.nav-item:hover .icon {
  transform: translateY(-1px);
}

.nav-item .icon {
  transition: transform var(--ease);
}

.nav-item:hover::after,
.nav-item:focus-visible::after,
.nav-item.router-link-active::after {
  width: 60%;
}

.nav-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* 購物車件數：唯一用強調色的地方，因為它是狀態 */
.badge-anchor {
  position: relative;
  display: inline-grid;
}

.count {
  position: absolute;
  top: -0.45rem;
  right: -0.9rem;
  min-width: 1.2rem;
  padding: 0 0.3rem;
  border-radius: 999px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 0.68rem;
  line-height: 1.2rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.count.bump {
  animation: bump 0.45s ease;
}

/* 東西飛到的那一刻，提袋（或愛心）也接一下 */
.cart-link.arrive .badge-anchor .icon,
.fav-link.arrive .badge-anchor .icon {
  animation: catch 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* 在收藏頁、或有收藏時，頂欄的心是填滿的 */
.fav-link.router-link-active .icon :deep(path) {
  fill: currentColor;
}

@keyframes bump {
  40% {
    transform: scale(1.35);
  }
}

@keyframes catch {
  30% {
    transform: translateY(3px) scale(1.12);
  }
  60% {
    transform: translateY(-2px) scale(1.04);
  }
}

/* ── 搜尋：圖示在前，輸入框從它右邊滑出來 ── */
.search {
  display: flex;
  align-items: center;
}

.search input {
  width: 0;
  padding: 0.35rem 0;
  border: 0;
  border-bottom: 1px solid transparent;
  background: transparent;
  color: inherit;
  opacity: 0;
  transition: width 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s, border-color var(--ease);
}

.search input::placeholder {
  color: inherit;
  opacity: 0.55;
}

.searching .search input {
  width: 13rem;
  padding-inline: 0.5rem;
  border-bottom-color: color-mix(in srgb, currentColor 55%, transparent);
  opacity: 1;
}

.searching .search .toggle {
  opacity: 1;
}

.search input:focus-visible {
  outline: none;
  border-bottom-color: currentColor;
}

/* 窄螢幕：只剩圖示，字藏起來（讀屏還讀得到）；搜尋開啟時整條蓋在頂欄上 */
@media (max-width: 48rem) {
  .site-header {
    /* 不黏在上面：兩列的頂欄會吃掉手機四分之一個畫面。relative 是給搜尋列定位用 */
    position: relative;
    flex-wrap: wrap;
    padding: var(--s2) var(--s3);
  }

  .links {
    gap: 0;
  }

  .label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* 五個圖示（第十五輪多了收藏）要和站名擠在同一列：圖示之間再緊一點，天氣的小圖示在最窄的螢幕先收起來 */
  .nav-item {
    padding: 0.5rem 0.45rem;
  }

  .today-text {
    display: none;
  }
}

@media (max-width: 36rem) {
  .today {
    display: none;
  }

  /* 搜尋開啟時：整條搜尋列蓋在頂欄那一列上（站名暫時被蓋住），輸入框吃掉剩下的寬度。
     以前是 order: 3 加 width: 100%，但 .links 不換行，輸入框在 390 寬會把頂欄撐出 31px（第十五輪實測） */
  .searching .search {
    position: absolute;
    inset: 0 var(--s3);
    z-index: 1;
    display: flex;
    align-items: center;
    gap: var(--s1);
    background: var(--bg);
    color: var(--ink);
  }

  .searching .search input {
    flex: 1;
    width: auto;
    min-width: 0;
  }
}
</style>
