<script setup>
// 首頁：天空在上，店在下。
//
// 第一屏是「現在的天空」（sky.js）：時間決定太陽，今天的天氣決定雲、雨、霧。畫面上只有一句話：
// 「臺北，10 月 6 日，18°，濕度 85%，有雨。」「今天，走［簡約］路線。」括號裡的詞是風格，
// 底下排著全部風格，指到就換（天空染一點那個風格的顏色、右邊換成那個風格合今天的幾套），點進去就到那個風格。
// 沒有人動的時候，詞自己每幾秒換一個，像在想；一碰就停。
//
// 往下捲，天空在地平線處淡進紙色，底下是店：共用的一句話篩選列黏在頂欄下面，接著是全部的穿搭。
// 2026-10-06 使用者裁決：這個風格可以繼續；入場島不再是獨立的一頁，而是首頁的第一屏（天空）＋店（下面）。
//
// 保留的功能：所有風格都進得去（詞的數量不限）、天氣顯示與依天氣的推薦、頂欄（搜尋、四個連結、購物車數量）、
// 一句話篩選、全部穿搭、鍵盤可操作、減少動態時不自動換詞、沒有 WebGL 時退回 CSS 天空、天空捲出畫面時停下。
import '@fontsource/noto-serif-tc/400.css'
import '@fontsource/noto-serif-tc/600.css'
import '@fontsource/noto-sans-tc/400.css'
import '@fontsource/space-mono/400.css'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getOutfits, getThemes, getWeather } from '@/api'
import OutfitLook from '@/components/OutfitLook.vue'
import OutfitStage from '@/components/OutfitStage.vue'
import SentenceBar from '@/components/SentenceBar.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import SiteHeader from '@/components/SiteHeader.vue'
import { createSky, skyWantsDarkText, sunNow, weatherLook } from '@/sky/sky'
import { accentOf } from '@/theme/themes'

const CYCLE_MS = 3600 // 沒有人動時，幾秒換一個詞

const router = useRouter()
const canvas = ref(null)
const hero = ref(null)
const themes = ref([])
const weather = ref(null)
const outfits = ref([])
const active = ref(null) // 現在括號裡的風格代碼
const touched = ref(false) // 使用者有沒有碰過（碰過就不自動換）
const darkText = ref(true)
const loading = ref(true)
const pastHero = ref(false) // 捲過天空了：頂欄變成有底色的、天空停下
const heroHeight = ref(0)
let sky = null
let cycleTimer = 0
let lastPointer = null
let observer = null
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const theme = computed(() => themes.value.find((item) => item.code === active.value))
const hasOuter = (outfit) => (outfit.items.some((item) => item.category === 'outer') ? 1 : 0)
const picks = computed(() => {
  const mine = outfits.value.filter((outfit) => outfit.themeCode === active.value)
  // 合今天天氣的排前面：冷或下雨時有外套的先
  const wantOuter = weather.value && (weather.value.temperature < 22 || weather.value.condition === 'rain')
  return [...mine].sort((a, b) => (hasOuter(b) - hasOuter(a)) * (wantOuter ? 1 : -1)).slice(0, 3)
})

const dateText = computed(() => {
  const d = clockNow()
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
})
const conditionText = computed(() => ({ rain: '有雨', cloudy: '多雲', clear: '晴' })[weather.value?.condition] ?? '')

const hexToUnit = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)

// 開發時可以用 ?hour=19 看傍晚或夜裡的天空；正式版沒有這個
function clockNow() {
  const date = new Date()
  if (import.meta.env.DEV) {
    const hour = new URLSearchParams(location.search).get('hour')
    if (hour !== null) date.setHours(+hour, 0, 0, 0)
  }
  return date
}

function paintSky() {
  if (!sky) return
  const sun = sunNow(clockNow())
  const look = weatherLook(weather.value)
  sky.set({ sun: sun.elevation, sunX: sun.x, ...look, tint: active.value ? hexToUnit(accentOf(active.value)) : [0.5, 0.5, 0.5], tintK: active.value ? 1 : 0 })
  darkText.value = skyWantsDarkText(sun, look)
}

function choose(code, byUser = true) {
  active.value = code
  if (byUser) touched.value = true
  paintSky()
}

function go(code) {
  touched.value = true
  router.push({ name: 'theme', params: { code } })
}

function startCycle() {
  if (reduced) return
  stopCycle()
  cycleTimer = setInterval(() => {
    if (touched.value || pastHero.value || themes.value.length < 2) return
    const index = themes.value.findIndex((item) => item.code === active.value)
    choose(themes.value[(index + 1) % themes.value.length].code, false)
  }, CYCLE_MS)
}
const stopCycle = () => clearInterval(cycleTimer)

// 滑鼠在天空上移動：推一下雲
function onMove(event) {
  if (!sky || reduced) return
  if (lastPointer) sky.stir((event.clientX - lastPointer.x) / window.innerWidth, (event.clientY - lastPointer.y) / window.innerHeight)
  lastPointer = { x: event.clientX, y: event.clientY }
}

// 往下到店
function toShop() {
  document.getElementById('shop')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
}

function measureHero() {
  heroHeight.value = hero.value?.getBoundingClientRect().height ?? 0
}

onMounted(async () => {
  sky = createSky(canvas.value, { reduced })
  paintSky()
  measureHero()
  window.addEventListener('resize', measureHero, { passive: true })
  // 天空捲出畫面就停、捲回來再動；頂欄也在這裡換樣子
  observer = new IntersectionObserver(
    ([entry]) => {
      pastHero.value = !entry.isIntersecting
      if (entry.isIntersecting) sky?.resume()
      else sky?.pause()
    },
    { threshold: 0.02 },
  )
  observer.observe(hero.value)

  try {
    const [themeList, today, outfitList] = await Promise.all([getThemes(), getWeather(), getOutfits()])
    themes.value = themeList
    weather.value = today
    outfits.value = outfitList
    if (!active.value && themeList.length) choose(themeList[0].code, false)
  } catch {
    themes.value = []
  }
  loading.value = false
  paintSky()
  startCycle()
  if (import.meta.env.DEV) {
    // 開發時給量測用
    window.__home = {
      probe: () => ({
        active: active.value,
        touched: touched.value,
        webgl: sky?.webgl,
        darkText: darkText.value,
        pastHero: pastHero.value,
        skyRunning: !pastHero.value,
        centres: [...document.querySelectorAll('.words button')].map((el) => {
          const r = el.getBoundingClientRect()
          return { theme: el.dataset.code, x: r.left + r.width / 2, y: r.top + r.height / 2 }
        }),
        boxes: [],
        heat: [],
        sway: [],
      }),
    }
  }
})

watch(active, paintSky)
onBeforeUnmount(() => {
  stopCycle()
  observer?.disconnect()
  window.removeEventListener('resize', measureHero)
  sky?.dispose()
})
</script>

<template>
  <div class="home" :class="{ dark: darkText, touched, past: pastHero }">
    <a class="skip" href="#shop">跳到穿搭</a>
    <!-- 頂欄：在天空上是透明的；捲過天空後變回有底色的，一路黏在上面 -->
    <div class="header-slot">
      <SiteHeader :float="!pastHero" />
    </div>

    <section ref="hero" class="hero" aria-label="今天" @pointermove="onMove">
      <canvas ref="canvas" class="sky" aria-hidden="true"></canvas>

      <div class="say" aria-live="polite">
        <p class="today">
          <template v-if="weather">
            {{ weather.city }}，{{ dateText }}，<span class="num">{{ weather.temperature }}°</span>，濕度 <span class="num">{{ weather.humidity }}%</span><template v-if="conditionText">，{{ conditionText }}</template>。
          </template>
          <template v-else-if="loading">正在看今天的天氣……</template>
          <template v-else>今天。</template>
        </p>
        <h1 class="line">
          今天，<br />走<button type="button" class="slot" @click="theme && go(theme.code)" :aria-label="theme ? `進入「${theme.name}」` : '風格'">
            <span class="bracket">［</span><span class="word">{{ theme?.name ?? '　　' }}</span><span class="bracket">］</span></button>路線。
        </h1>
        <p class="tagline">{{ theme?.tagline ?? '　' }}</p>

        <!-- 全部的風格：指到換詞；按 Enter 或點進去 -->
        <nav class="words" aria-label="風格">
          <button
            v-for="item in themes"
            :key="item.code"
            type="button"
            :data-code="item.code"
            :class="{ on: item.code === active }"
            @pointerenter="choose(item.code)"
            @focus="choose(item.code)"
            @click="go(item.code)"
          >
            {{ item.name }}
          </button>
        </nav>
      </div>

      <!-- 今天的穿搭：這個風格裡合今天天氣的幾套 -->
      <section class="looks" aria-label="今天的穿搭" @pointerenter="touched = true">
        <h2 class="looks-title">今天的穿搭<span v-if="theme">　／　{{ theme.name }}</span></h2>
        <TransitionGroup name="look" tag="div" class="row">
          <RouterLink v-for="(outfit, i) in picks" :key="outfit.id" :to="{ name: 'theme', params: { code: outfit.themeCode } }" class="look-link" :style="{ '--i': i }">
            <OutfitLook :outfit="outfit" :height="250" />
          </RouterLink>
        </TransitionGroup>
        <p v-if="!loading && !picks.length" class="empty">這個風格今天還沒有搭好的穿搭。</p>
      </section>

      <!-- 地平線：天空淡進紙色，底下就是店 -->
      <button type="button" class="down" @click="toShop">往下，看今天全部的穿搭<span aria-hidden="true">　↓</span></button>
    </section>

    <!-- 店：一句話篩選黏在頂欄下面，接著是全部的穿搭 -->
    <div id="shop" class="shop">
      <!-- 一句話篩選列：捲進店裡再多 320px 才收合，進店時先看得到整句 -->
      <SentenceBar :offset="heroHeight + 320" />
      <main class="stage">
        <h2 class="shop-title">今天全部的穿搭</h2>
        <OutfitStage />
      </main>
      <SiteFooter />
    </div>
  </div>
</template>

<style scoped>
.home {
  --fg: #1a1d26;
  --fg-soft: rgba(26, 29, 38, 0.82); /* 0.66 時日期那行在最亮的雲上只有 3.5:1，量過後調到 0.82 */
  --line-soft: rgba(26, 29, 38, 0.35);
  color: var(--ink);
}

.skip {
  position: absolute;
  left: var(--s2);
  top: -4rem;
  z-index: 40;
  padding: var(--s1) var(--s2);
  background: var(--surface);
}

.skip:focus {
  top: var(--s1);
}

/* 頂欄黏在最上面；在天空上時字色跟著天空 */
.header-slot {
  position: sticky;
  top: 0;
  z-index: 20;
  color: var(--fg);
  transition: color 0.6s ease;
}

.home:not(.dark) .header-slot {
  color: #f3f1ec;
}

.home.past .header-slot {
  color: var(--ink);
}

/* ── 第一屏：天空 ── */
.hero {
  position: relative;
  height: 100svh;
  min-height: 36rem;
  /* 頂欄黏在上面佔掉的高度，天空從頁面最上面開始畫 */
  margin-top: calc(-1 * var(--header-h));
  overflow: hidden;
  color: var(--fg);
  font-family: 'Noto Serif TC', serif;
  user-select: none;
  transition: color 0.6s ease;
}

/* 傍晚與夜裡：天暗了，字變淺 */
.home:not(.dark) .hero {
  --fg: #f3f1ec;
  --fg-soft: rgba(243, 241, 236, 0.84);
  --line-soft: rgba(243, 241, 236, 0.4);
}

.sky {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

/* 地平線：最下面一段淡進紙色 */
.hero::after {
  content: '';
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  height: 22%;
  background: linear-gradient(to bottom, transparent, var(--bg));
  pointer-events: none;
}

.hero a {
  color: inherit;
  text-decoration: none;
}

.num {
  font-family: 'Space Mono', monospace;
  font-size: 0.92em;
}

.say {
  position: absolute;
  left: 2.2rem;
  top: 50%;
  transform: translateY(-52%);
  display: grid;
  gap: 0.6rem;
  max-width: 36rem;
  z-index: 1;
}

.today {
  margin: 0;
  color: var(--fg-soft);
  font-size: 1rem;
  letter-spacing: 0.1em;
}

.line {
  margin: 0;
  font-weight: 600;
  font-size: clamp(2rem, 4.4vw, 3.6rem);
  line-height: 1.45;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

/* 括號裡的詞：是一個按鈕，按下去進那個風格 */
.slot {
  all: unset;
  cursor: pointer;
  display: inline-block;
  margin-inline: 0.05em;
  padding-bottom: 0.05em;
  border-bottom: 2px solid var(--line-soft);
  transition: border-color 0.3s ease;
}

.slot:hover,
.slot:focus-visible {
  border-color: var(--fg);
}

.bracket {
  color: var(--fg-soft);
  font-weight: 400;
}

.word {
  display: inline-block;
  min-width: 2.2em;
  text-align: center;
}

.tagline {
  margin: 0;
  color: var(--fg-soft);
  font-size: 1.05rem;
  min-height: 1.5em;
}

.words {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 1.4rem;
  margin-top: 1.2rem;
  font-family: 'Noto Sans TC', sans-serif;
}

.words button {
  all: unset;
  cursor: pointer;
  padding: 0.3rem 0;
  font-size: 0.95rem;
  letter-spacing: 0.14em;
  color: var(--fg-soft);
  border-bottom: 1px solid transparent;
  transition: color 0.25s ease, border-color 0.25s ease;
}

.words button.on,
.words button:hover,
.words button:focus-visible {
  color: var(--fg);
  border-color: var(--fg);
}

/* 今天的穿搭 */
.looks {
  position: absolute;
  right: 2.2rem;
  bottom: 16%;
  display: grid;
  gap: 1rem;
  justify-items: end;
  z-index: 1;
}

.looks-title {
  margin: 0;
  font-family: 'Noto Sans TC', sans-serif;
  font-weight: 400;
  font-size: 0.85rem;
  letter-spacing: 0.2em;
  color: var(--fg-soft);
}

.row {
  display: flex;
  gap: 1.6rem;
  align-items: flex-end;
}

.look-link {
  transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.look-link:hover {
  transform: translateY(-6px);
}

.look-enter-active {
  transition: opacity 0.6s ease calc(var(--i) * 0.1s), transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) calc(var(--i) * 0.1s);
}

.look-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
  position: absolute;
}

.look-enter-from {
  opacity: 0;
  transform: translateY(26px);
}

.look-leave-to {
  opacity: 0;
  transform: translateY(14px);
}

.empty {
  margin: 0;
  font-size: 0.9rem;
  color: var(--fg-soft);
}

/* 往下的提示：地平線上的一行字 */
.down {
  all: unset;
  cursor: pointer;
  position: absolute;
  left: 2.2rem;
  bottom: 1.4rem;
  z-index: 1;
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 0.8rem;
  letter-spacing: 0.16em;
  color: var(--ink-soft);
}

.down:hover,
.down:focus-visible {
  text-decoration: underline;
  text-underline-offset: 0.35em;
}

/* ── 店 ── */
.shop {
  position: relative;
  background: var(--bg);
}

.stage {
  max-width: var(--stage-max);
  margin-inline: auto;
  padding: var(--s3);
  min-height: 60vh;
}

.shop-title {
  margin: var(--s2) 0 var(--s3);
  font-size: var(--fs-2);
  font-weight: 400;
  letter-spacing: 0.12em;
  color: var(--ink-soft);
}

@media (prefers-reduced-motion: reduce) {
  .look-enter-active,
  .look-leave-active,
  .look-link {
    transition: none;
  }
}

/* 窄螢幕：天空裡上下排，穿搭可以左右滑 */
@media (max-width: 52rem) {
  .hero {
    height: auto;
    min-height: 100svh;
    margin-top: 0;
    display: grid;
    align-content: start;
    gap: 1.6rem;
    padding: 1.6rem 1.2rem 4rem;
  }

  .say {
    position: static;
    transform: none;
  }

  .line {
    font-size: 1.9rem;
    white-space: normal;
  }

  .looks {
    position: static;
    justify-items: start;
    width: 100%;
  }

  .row {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 0.5rem;
    scroll-snap-type: x mandatory;
  }

  .look-link {
    scroll-snap-align: start;
    flex: 0 0 auto;
  }

  .down {
    position: static;
    justify-self: start;
  }
}
</style>
