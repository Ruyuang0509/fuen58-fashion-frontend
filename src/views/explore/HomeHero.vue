<script setup>
// 首頁的第一屏（天空裡的內容；天空本身與底下的店在 ExploreView）。
//
// 「臺北，10 月 6 日，18°，濕度 85%，有雨。」「今天，走［簡約］路線。」括號裡的詞是風格，
// 底下排著全部風格，指到就換（天空染一點那個風格的顏色、右邊換成那個風格合今天的幾套），點進去就到那個風格。
// 沒有人動的時候，詞自己每幾秒換一個，像在想；一碰就停。
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getOutfits, getThemes, getWeather } from '@/api'
import Icon from '@/components/Icon.vue'
import OutfitLook from '@/components/OutfitLook.vue'
import { gsap, reducedMotion } from '@/motion/gsap'
import { rememberLook } from '@/motion/lookFlip'
import { useExploreSky } from '@/stores/explore'
import { accentOf } from '@/theme/themes'

const CYCLE_MS = 3600 // 沒有人動時，幾秒換一個詞

const router = useRouter()
const page = inject('skyPage', ref(null))
const { setSky } = useExploreSky()
const themes = ref([])
const weather = ref(null)
const outfits = ref([])
const active = ref(null) // 現在括號裡的風格代碼
const touched = ref(false) // 使用者有沒有碰過（碰過就不自動換）
const loading = ref(true)
let cycleTimer = 0
const reduced = reducedMotion()

const theme = computed(() => themes.value.find((item) => item.code === active.value))
const tint = computed(() => (active.value ? accentOf(active.value) : null))
// 天空：今天的天氣、現在的時刻，染目前那個風格的顏色
watch(tint, (value) => setSky({ tint: value, height: '100svh', minHeight: '36rem' }), { immediate: true })

const hasOuter = (outfit) => (outfit.items.some((item) => item.category === 'outer') ? 1 : 0)
const picks = computed(() => {
  const mine = outfits.value.filter((outfit) => outfit.themeCode === active.value)
  // 合今天天氣的排前面：冷或下雨時有外套的先
  const wantOuter = weather.value && (weather.value.temperature < 22 || weather.value.condition === 'rain')
  return [...mine].sort((a, b) => (hasOuter(b) - hasOuter(a)) * (wantOuter ? 1 : -1)).slice(0, 3)
})

// 開發時可以用 ?hour=19 看傍晚或夜裡的天空；正式版沒有這個
function clockNow() {
  const date = new Date()
  if (import.meta.env.DEV) {
    const hour = new URLSearchParams(location.search).get('hour')
    if (hour !== null) date.setHours(+hour, 0, 0, 0)
  }
  return date
}

const dateText = computed(() => {
  const d = clockNow()
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
})
const conditionText = computed(() => ({ rain: '有雨', cloudy: '多雲', clear: '晴' })[weather.value?.condition] ?? '')

function choose(code, byUser = true) {
  active.value = code
  if (byUser) touched.value = true
}

// 換詞的時候：新的詞與那一句 tagline 從下面浮上來
const wordEl = ref(null)
const taglineEl = ref(null)
watch(active, async (code, previous) => {
  if (previous === null || reduced) return
  await nextTick()
  gsap.fromTo([wordEl.value, taglineEl.value].filter(Boolean), { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.06, overwrite: 'auto' })
})

function go(code) {
  touched.value = true
  router.push({ name: 'theme', params: { code } })
}

function startCycle() {
  if (reduced) return
  stopCycle()
  cycleTimer = setInterval(() => {
    if (touched.value || page.value?.pastHero() || themes.value.length < 2) return
    const index = themes.value.findIndex((item) => item.code === active.value)
    choose(themes.value[(index + 1) % themes.value.length].code, false)
  }, CYCLE_MS)
}
const stopCycle = () => clearInterval(cycleTimer)

// 往下到店
function toShop() {
  document.getElementById('shop')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
}

onMounted(async () => {
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
  startCycle()
  if (import.meta.env.DEV) {
    // 開發時給量測用
    window.__home = {
      probe: () => ({
        active: active.value,
        touched: touched.value,
        webgl: page.value?.webgl(),
        darkText: page.value?.dark(),
        pastHero: page.value?.pastHero(),
        skyRunning: page.value?.running(),
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

onBeforeUnmount(stopCycle)
</script>

<template>
  <div class="home-hero" :class="{ touched }">
    <div class="say" aria-live="polite">
      <p class="today">
        <template v-if="weather">
          {{ weather.city }}，{{ dateText }}，<span class="num">{{ weather.temperature }}°</span>，濕度 <span class="num">{{ weather.humidity }}%</span><template v-if="conditionText">，{{ conditionText }}</template>。
        </template>
        <template v-else-if="loading">正在看今天的天氣……</template>
        <template v-else>今天。</template>
      </p>
      <h1 class="line">
        今天，<br />走<button type="button" class="slot" :aria-label="theme ? `進入「${theme.name}」` : '風格'" @click="theme && go(theme.code)">
          <span class="bracket">［</span><span ref="wordEl" class="word">{{ theme?.name ?? '　　' }}</span><span class="bracket">］</span></button>路線。
      </h1>
      <p ref="taglineEl" class="tagline">{{ theme?.tagline ?? '　' }}</p>

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

    <!-- 今天的穿搭：這個風格裡合今天天氣的幾套；點一套進那套的頁面 -->
    <section class="looks" aria-label="今天的穿搭" @pointerenter="touched = true">
      <h2 class="looks-title">今天的穿搭<span v-if="theme">　／　{{ theme.name }}</span></h2>
      <TransitionGroup name="look" tag="div" class="row">
        <RouterLink v-for="(outfit, i) in picks" :key="outfit.id" :to="{ name: 'outfit', params: { id: outfit.id } }" class="look-link" :style="{ '--i': i }" @click="rememberLook(outfit, $event.currentTarget)">
          <OutfitLook :outfit="outfit" :height="250" />
        </RouterLink>
      </TransitionGroup>
      <p v-if="!loading && !picks.length" class="empty">這個風格今天還沒有搭好的穿搭。</p>
    </section>

    <!-- 地平線上的一行字 -->
    <button type="button" class="down" @click="toShop">往下，看今天全部的穿搭<Icon name="down" /></button>
  </div>
</template>

<style scoped>
.home-hero {
  position: absolute;
  inset: 0;
}

.num {
  font-family: 'Space Mono', monospace;
  font-size: 0.92em;
}

.say {
  position: absolute;
  left: 2.4rem;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  gap: 0.7rem;
  max-width: 36rem;
  user-select: none;
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
  margin-top: 1.4rem;
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
  right: 2.4rem;
  bottom: 17%;
  display: grid;
  gap: 1.2rem;
  justify-items: end;
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
  gap: 2rem;
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

/* 離開的那幾套直接拿掉：留著淡出會和新進來的疊在一起 */
.look-leave-active {
  display: none;
}

.look-enter-from {
  opacity: 0;
  transform: translateY(26px);
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
  left: 2.4rem;
  bottom: 1.6rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 0.8rem;
  letter-spacing: 0.16em;
  color: var(--ink-soft);
}

.down .icon {
  transition: transform 0.3s ease;
}

.down:hover .icon,
.down:focus-visible .icon {
  transform: translateY(3px);
}

@media (prefers-reduced-motion: reduce) {
  .look-enter-active,
  .look-link,
  .down .icon {
    transition: none;
  }
}

/* 窄螢幕：上下排，穿搭可以左右滑 */
@media (max-width: 52rem) {
  .home-hero {
    position: static;
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
    margin-top: 1.6rem;
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
    margin-top: 1.6rem;
  }
}
</style>
