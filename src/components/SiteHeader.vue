<script setup>
// 頂欄（第十一輪重做）：左邊是站名加「現在的天氣」一個小圖示，右邊四件事各一個線條圖示配小字。
// 搜尋平常只是一個圖示，點了才滑出輸入框；滑過任何一項，圖示與字變深、底下一條線畫出來。
// 浮在天空上時（float）沒有底、沒有線，顏色跟著外面；捲過天空後才有底色與一條細線。
import '@fontsource/noto-serif-tc/600.css'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getWeather } from '@/api'
import Icon from '@/components/Icon.vue'
import { FEATURES, SITE_NAME } from '@/config'
import { useCart } from '@/stores/cart'
import { useSession } from '@/stores/session'

defineProps({
  float: { type: Boolean, default: false },
})

const route = useRoute()
const router = useRouter()
const { count } = useCart()
const { user, loggedIn } = useSession()

// 搜尋框：在搜尋結果頁常開；其他頁點圖示才開
const keyword = ref(String(route.query.q ?? ''))
const searching = ref(route.name === 'search')
const searchInput = ref(null)
watch(
  () => route.query.q,
  (q) => (keyword.value = String(q ?? '')),
)
watch(
  () => route.name,
  (name) => {
    if (name === 'search') searching.value = true
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
  if (route.name !== 'search') searching.value = false
}

function onBlur() {
  // 沒打字就離開：收回去；打了字留著，像一般的搜尋框
  if (!keyword.value.trim()) closeSearch()
}

function search() {
  const q = keyword.value.trim()
  if (q) router.push({ name: 'search', query: { q } })
}

// 件數變了就跳一下（只是回饋；數字本身立刻更新，沒有延遲）
const bump = ref(false)
watch(count, () => {
  bump.value = false
  requestAnimationFrame(() => (bump.value = true))
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

      <RouterLink :to="{ name: 'outfits' }" class="nav-item">
        <Icon name="hanger" />
        <span class="label">全部穿搭</span>
      </RouterLink>
      <RouterLink v-if="FEATURES.wall" to="/wall" class="nav-item">
        <Icon name="camera" />
        <span class="label">穿搭牆</span>
      </RouterLink>
      <RouterLink to="/cart" class="nav-item cart-link">
        <span class="badge-anchor">
          <Icon name="bag" />
          <span v-if="count" class="count" :class="{ bump }">{{ count }}<span class="visually-hidden"> 件</span></span>
        </span>
        <span class="label">購物車</span>
      </RouterLink>
      <RouterLink v-if="loggedIn" :to="{ name: 'account' }" class="nav-item member">
        <Icon name="user" />
        <span class="label">{{ user.name || '會員' }}</span>
      </RouterLink>
      <RouterLink v-else :to="{ name: 'login' }" class="nav-item">
        <Icon name="user" />
        <span class="label">會員</span>
      </RouterLink>
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

/* 浮在天空上：透明、沒有線，顏色繼承 */
.site-header.float {
  background: transparent;
  border-bottom-color: transparent;
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
  animation: bump 0.35s ease;
}

@keyframes bump {
  40% {
    transform: scale(1.3);
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

/* 窄螢幕：只剩圖示，字藏起來（讀屏還讀得到）；搜尋開啟時佔滿一列 */
@media (max-width: 48rem) {
  .site-header {
    /* 兩列的頂欄太高，黏在上面會吃掉手機四分之一個畫面 */
    position: static;
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

  .nav-item {
    padding: 0.5rem 0.6rem;
  }

  .today-text {
    display: none;
  }

  .searching .search {
    order: 3;
    width: 100%;
    margin-top: var(--s1);
  }

  .searching .search input {
    flex: 1;
    width: auto;
  }
}
</style>
