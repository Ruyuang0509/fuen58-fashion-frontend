<script setup>
// 主頁原型「浮動單品」：/design/home/float
//
// 一個風格用一件單品來帶。單品浮在一片會流動的漸層上；指到哪一件，整個畫面的顏色就換成那個風格的顏色，
// 單品自己放大一點；移開就退回預設色。滑鼠移動時每件單品以不同的速度跟著漂，看起來有前後。
// 參考 Skylrk 首頁的機制（2026-10-06 實際看過），畫面與單品是我們自己的。
//
// 單品現在是程式把款式圖「打光」畫出來的；正式上線換成商品去背照片，其他都不用動。
//
// 一進站的開場（約 3 秒，每個分頁只播一次，任何操作都能跳過，減少動態時不播）：
//   先一行今天的天氣，再問「今天穿什麼？」，然後單品一件一件飄進來——
//   合今天天氣的先到、近一點（大一點），不合的後到、遠一點。底色也是今天天氣的顏色。
//   開場後那句話留在左上角；指著一件時，它變成那個風格的名字和標語。
import '@fontsource/noto-sans-tc/400.css'
import '@fontsource/noto-sans-tc/500.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-mono/400.css'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getThemes, getWeather } from '@/api'
import { SITE_NAME } from '@/config'
import { renderGarment } from '@/garments/render'
import { createGradientField } from '@/sketches/float/gradient'
import { FAMILIES } from './families'

// 每個風格一件單品：款式、布色、布料、帶動整個畫面的顏色、在畫面上的位置（比例）與大小
// 入口放的是「風格家族」，一個家族一件單品；指著它，家族底下的子風格以小標籤散開。清單在 families.js
const PIECES = FAMILIES
const INTRO_KEY = 'home-intro-seen' // sessionStorage：這個分頁播過開場了

const clamp01 = (v) => Math.min(1, Math.max(0, v))

// 今天的天氣 → 底色。暖而乾是奶油色，冷而濕是灰藍，中間內插
function todayKey(today) {
  if (!today) return '#8d98b8'
  const cold = clamp01((26 - today.temperature) / 16) // 10° 以下算 1，26° 以上算 0
  const wet = clamp01((today.humidity - 50) / 40)
  const warmDry = [227, 195, 138]
  const coldWet = [124, 136, 166]
  const t = Math.min(1, cold * 0.6 + wet * 0.5)
  return '#' + [0, 1, 2].map((i) => Math.round(warmDry[i] + (coldWet[i] - warmDry[i]) * t).toString(16).padStart(2, '0')).join('')
}

// 這件單品有多合今天的天氣（0 到 1）
function fitToday(piece, today) {
  if (!today) return 0.5
  const wantWarm = clamp01((26 - today.temperature) / 16)
  const wantRain = clamp01((today.humidity - 50) / 40)
  return 1 - (Math.abs(piece.warm - wantWarm) * 0.6 + Math.abs(piece.rain - wantRain) * 0.4)
}
// 每件單品跟著滑鼠漂的速度不一樣，才有前後；數字是畫面寬高的比例
const DRIFT = [
  { x: 0.012, y: 0.014, ease: 0.04 },
  { x: 0.02, y: 0.01, ease: 0.06 },
  { x: 0.008, y: 0.02, ease: 0.035 },
  { x: 0.024, y: 0.016, ease: 0.05 },
  { x: 0.01, y: 0.018, ease: 0.065 },
  { x: 0.018, y: 0.008, ease: 0.045 },
  { x: 0.014, y: 0.022, ease: 0.055 },
  { x: 0.022, y: 0.012, ease: 0.04 },
]

const router = useRouter()
const field = ref(null)
const stage = ref(null)
const itemEls = ref([])
const themes = ref([])
const weather = ref(null)
const darkText = ref(true)
const hovered = ref(null)
const picked = ref(null)
// 開場的階段：ask（問句）→ arrive（單品飄進來）→ ready（可以玩了）
const phase = ref('ask')
let gradient = null
let introTimers = []
let raf = 0
let mouse = { x: 0, y: 0 } // -1 到 1
const drift = PIECES.map(() => ({ x: 0, y: 0 }))
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const pieces = computed(() => {
  // 依合今天天氣的程度排名：第一名先飄進來、大一點；最後一名晚到、小一點
  const ranked = [...PIECES].sort((a, b) => fitToday(b, weather.value) - fitToday(a, weather.value)).map((piece) => piece.theme)
  return PIECES.map((piece) => {
    const rank = ranked.indexOf(piece.theme)
    return {
      ...piece,
      rank,
      near: 1.1 - (rank / (PIECES.length - 1)) * 0.25, // 第一名 1.1，最後一名 0.85
      name: themes.value.find((theme) => theme.code === piece.theme)?.name ?? '',
      tagline: themes.value.find((theme) => theme.code === piece.theme)?.tagline ?? '',
      src: renderGarment(piece.kind, { colour: piece.colour, fabric: piece.fabric, px: 720 }),
    }
  })
})
const hoveredPiece = computed(() => pieces.value.find((piece) => piece.theme === hovered.value))
const restKey = computed(() => todayKey(weather.value))

// 任何操作都結束開場
function settle() {
  if (phase.value === 'ready') return
  introTimers.forEach(clearTimeout)
  introTimers = []
  phase.value = 'ready'
  try {
    sessionStorage.setItem(INTRO_KEY, '1')
  } catch {
    // 無痕或擋 storage：每次都播，沒關係
  }
}

function enter(piece, event) {
  if (picked.value) return
  settle()
  hovered.value = piece.theme
  gradient?.setColour(piece.key, 800)
  const box = stage.value.getBoundingClientRect()
  gradient?.setFocus([(event.clientX - box.left) / box.width, 1 - (event.clientY - box.top) / box.height])
}

function leave() {
  if (picked.value) return
  hovered.value = null
  gradient?.setColour(restKey.value, 800)
  gradient?.setFocus(null)
}

function pick(piece, event) {
  event.preventDefault()
  if (picked.value) return
  picked.value = piece.theme
  gradient?.setColour(piece.key, 500)
  // 第二階段：家族頁
  setTimeout(() => router.push({ name: 'design-family', params: { code: piece.theme } }), reduced ? 0 : 520)
}

function onMove(event) {
  if (phase.value === 'arrive') settle()
  const box = stage.value.getBoundingClientRect()
  mouse = { x: ((event.clientX - box.left) / box.width - 0.5) * 2, y: ((event.clientY - box.top) / box.height - 0.5) * 2 }
}

function onLeaveStage() {
  mouse = { x: 0, y: 0 }
}

// 每一幀把每件單品往它該在的位置靠近一點
function tick() {
  const box = stage.value?.getBoundingClientRect()
  if (box) {
    itemEls.value.forEach((el, i) => {
      if (!el) return
      const rule = DRIFT[i % DRIFT.length]
      const goalX = mouse.x * rule.x * box.width
      const goalY = mouse.y * rule.y * box.height
      drift[i].x += (goalX - drift[i].x) * rule.ease
      drift[i].y += (goalY - drift[i].y) * rule.ease
      el.style.setProperty('--dx', `${drift[i].x.toFixed(1)}px`)
      el.style.setProperty('--dy', `${drift[i].y.toFixed(1)}px`)
    })
  }
  raf = requestAnimationFrame(tick)
}

onMounted(async () => {
  let seen = reduced
  try {
    seen = seen || sessionStorage.getItem(INTRO_KEY) === '1'
  } catch {
    // 讀不到就當沒看過
  }
  gradient = createGradientField(field.value, { hex: seen ? restKey.value : '#9aa1b4', reduced, onTone: (dark) => (darkText.value = dark) })
  if (!reduced) raf = requestAnimationFrame(tick)
  if (seen) phase.value = 'ready'
  else {
    // 開場：0.2 秒天氣那行、1.0 秒問句、1.7 秒單品開始飄進來、3.4 秒結束
    introTimers.push(setTimeout(() => (phase.value = 'arrive'), 1700))
    introTimers.push(setTimeout(settle, 3400))
  }
  if (import.meta.env.DEV) {
    // 開發時給量測用：每件單品現在在哪裡
    window.__home = {
      probe: () => ({
        hovered: PIECES.findIndex((piece) => piece.theme === hovered.value),
        picked: picked.value,
        webgl: gradient?.webgl,
        darkText: darkText.value,
        centres: itemEls.value.map((el, i) => {
          const r = el.getBoundingClientRect()
          return { theme: PIECES[i].theme, x: r.left + r.width / 2, y: r.top + r.height / 2 }
        }),
        boxes: [],
        sway: [],
        heat: [],
      }),
    }
  }
  try {
    const [themeList, today] = await Promise.all([getThemes(), getWeather()])
    themes.value = themeList
    weather.value = today
    // 天氣到了，底色換成今天的顏色
    if (!hovered.value) gradient?.setColour(todayKey(today), 1400)
  } catch {
    themes.value = []
  }
})

onBeforeUnmount(() => {
  introTimers.forEach(clearTimeout)
  cancelAnimationFrame(raf)
  gradient?.dispose()
})
</script>

<template>
  <div ref="stage" class="float" :class="[phase, { dark: darkText, picking: hovered, leaving: picked }]" @mousemove="onMove" @mouseleave="onLeaveStage" @click="settle">
    <canvas ref="field" class="field" aria-hidden="true"></canvas>

    <header class="top">
      <RouterLink to="/design/home/float" class="pill mark">{{ SITE_NAME }}</RouterLink>
      <nav class="pill" aria-label="主要">
        <RouterLink to="/wall">穿搭牆</RouterLink>
        <RouterLink to="/weather">天氣穿搭</RouterLink>
        <RouterLink to="/cart">購物車</RouterLink>
        <RouterLink to="/login">會員</RouterLink>
      </nav>
      <p v-if="weather" class="mono weather">[ {{ weather.temperature }}°　濕度 {{ weather.humidity }}% ]</p>
    </header>

    <!-- 開場的問句；開場結束後縮小留在左上角，指著單品時變成那個風格的名字 -->
    <div class="ask" aria-live="polite">
      <p class="ask-today">
        <template v-if="weather">今天 {{ weather.temperature }}°，濕度 {{ weather.humidity }}%。</template>
        <template v-else>今天。</template>
      </p>
      <p class="ask-what">
        <template v-if="hoveredPiece"><strong>{{ hoveredPiece.name }}</strong>　{{ hoveredPiece.tagline }}</template>
        <template v-else>今天穿什麼？</template>
      </p>
    </div>

    <!-- 單品：每一件是一個連結，進到那個風格 -->
    <RouterLink
      v-for="(piece, i) in pieces"
      :key="piece.theme"
      :ref="(el) => (itemEls[i] = el?.$el ?? el)"
      :to="{ name: 'theme', params: { code: piece.theme } }"
      class="item"
      :class="{ on: hovered === piece.theme, picked: picked === piece.theme }"
      :style="{ '--x': piece.x, '--y': piece.y, '--scale': piece.scale * piece.near, '--rank': piece.rank }"
      @mouseenter="enter(piece, $event)"
      @mouseleave="leave"
      @focus="enter(piece, { clientX: 0, clientY: 0 })"
      @blur="leave"
      @click="pick(piece, $event)"
    >
      <img :src="piece.src" :alt="piece.name" draggable="false" />
      <span class="name"><strong>{{ piece.name }}</strong><em class="mono">{{ piece.tagline }}</em></span>
      <!-- 子風格：指著這個家族時散開在單品兩側，先只是標籤（之後各自是連結） -->
      <span class="subs" aria-hidden="true">
        <span v-for="(name, n) in piece.subs" :key="name" class="sub mono" :style="{ '--n': n }">{{ name }}</span>
      </span>
    </RouterLink>

    <footer class="bottom">
      <p class="mono hint">合今天天氣的先到、近一點。指著一件，畫面就換成那個風格的顏色。</p>
      <nav class="pill switch" aria-label="原型">
        <RouterLink to="/design/home/float" aria-current="page">浮動</RouterLink>
        <RouterLink to="/design/home/street">商店街</RouterLink>
        <RouterLink to="/design/home/isles">群島</RouterLink>
        <RouterLink to="/">一般模式</RouterLink>
      </nav>
    </footer>
  </div>
</template>

<style scoped>
.float {
  --fg: #1d1c22;
  --fg-soft: rgba(29, 28, 34, 0.62);
  --pill: rgba(255, 255, 255, 0.28);
  position: fixed;
  inset: 0;
  overflow: hidden;
  color: var(--fg);
  font-family: 'Space Grotesk', 'Noto Sans TC', sans-serif;
  user-select: none;
  transition: color 0.4s ease;
}

/* 底色深的時候字換成淺色 */
.float:not(.dark) {
  --fg: #f4f3f7;
  --fg-soft: rgba(244, 243, 247, 0.7);
  --pill: rgba(255, 255, 255, 0.16);
}

.field {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.mono {
  font-family: 'Space Mono', monospace;
  font-size: 0.78rem;
  letter-spacing: 0.02em;
}

.top,
.bottom {
  position: absolute;
  inset-inline: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.1rem 1.4rem;
  z-index: 2;
  transition: opacity 0.3s ease;
}

.top {
  top: 0;
}

.bottom {
  bottom: 0;
  justify-content: space-between;
}

.leaving .top,
.leaving .bottom {
  opacity: 0;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 1.1rem;
  padding: 0.55rem 1.1rem;
  border-radius: 999px;
  background: var(--pill);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  font-size: 0.92rem;
  font-weight: 500;
  letter-spacing: 0.04em;
}

.mark {
  font-size: 1.05rem;
  letter-spacing: 0.18em;
}

.weather {
  margin-left: auto;
  color: var(--fg-soft);
}

.float a {
  color: inherit;
  text-decoration: none;
}

.pill a:hover,
.pill a[aria-current='page'] {
  text-decoration: underline;
  text-underline-offset: 0.3em;
}

/* 開場的問句 */
.ask {
  position: absolute;
  left: 50%;
  top: 44%;
  transform: translate(-50%, -50%);
  z-index: 2;
  text-align: center;
  font-family: 'Noto Sans TC', sans-serif;
  transition: left 0.7s cubic-bezier(0.2, 0.8, 0.2, 1), top 0.7s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease;
  pointer-events: none;
}

.ask p {
  margin: 0;
  opacity: 0;
  transform: translateY(0.6rem);
  transition: opacity 0.6s ease, transform 0.6s ease, font-size 0.7s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.ask-today {
  font-size: 1.1rem;
  letter-spacing: 0.12em;
  color: var(--fg-soft);
}

.ask-what {
  font-size: 2.6rem;
  font-weight: 500;
  letter-spacing: 0.16em;
  line-height: 1.4;
}

/* 階段 ask：兩行依序出現 */
.ask .ask-today,
.arrive .ask-today,
.ready .ask-today {
  opacity: 1;
  transform: none;
  transition-delay: 0.2s;
}

.ask .ask-what,
.arrive .ask-what,
.ready .ask-what {
  opacity: 1;
  transform: none;
  transition-delay: 1s;
}

/* 單品開始飄進來時，問句就縮小、靠到左上角讓位 */
.arrive .ask,
.ready .ask {
  left: 1.4rem;
  top: 4.6rem;
  transform: none;
  text-align: left;
}

.arrive .ask p,
.ready .ask p {
  transition-delay: 0s;
}

.arrive .ask-today,
.ready .ask-today {
  font-size: 0.85rem;
}

.arrive .ask-what,
.ready .ask-what {
  font-size: 1.15rem;
  letter-spacing: 0.1em;
}

.ask-what strong {
  font-weight: 500;
}

.leaving .ask {
  opacity: 0;
}

/* 單品：--size 是衣服的高度，寬是高的 0.63（款式圖的格子是 120×160 加留白） */
.item {
  --size: calc(20vw * var(--scale));
  position: absolute;
  left: calc(var(--x) * 100%);
  top: calc(var(--y) * 100%);
  width: calc(var(--size) * 0.63);
  height: var(--size);
  margin: calc(var(--size) / -2) 0 0 calc(var(--size) * -0.315);
  transform: translate(var(--dx, 0px), var(--dy, 0px));
  z-index: 1;
  display: block;
  transition: opacity 0.4s ease;
}

/* 開場：單品先在畫面下方等，arrive 時依合天氣的名次一件一件飄上來 */
.float.ask .item {
  opacity: 0;
}

.float.ask .item img {
  transform: translateY(70px);
}

.arrive .item {
  transition: opacity 0.7s ease calc(var(--rank) * 0.12s);
}

.arrive .item img {
  transition: transform 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) calc(var(--rank) * 0.12s), filter 0.35s ease;
}

.item img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 14px 22px rgba(20, 16, 30, 0.22));
  transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.35s ease;
  pointer-events: none;
}

.item.on img {
  transform: scale(1.14);
  filter: drop-shadow(0 26px 34px rgba(20, 16, 30, 0.3));
}

/* 有一件被指著時，其他件稍微退後 */
.picking .item:not(.on) {
  opacity: 0.72;
}

.leaving .item:not(.picked) {
  opacity: 0;
}

.item.picked img {
  transform: scale(1.5);
  filter: drop-shadow(0 30px 40px rgba(20, 16, 30, 0.25));
  transition-duration: 0.5s;
}

/* 名稱：平常只有名字，指到時多一行標語 */
.name {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  display: grid;
  justify-items: center;
  gap: 0.15rem;
  white-space: nowrap;
  transition: transform 0.35s ease;
}

.name strong {
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 0.9rem;
  font-weight: 500;
  letter-spacing: 0.3em;
  margin-right: -0.3em;
}

.name em {
  font-style: normal;
  color: var(--fg-soft);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.item.on .name {
  transform: translate(-50%, 0.6rem);
}

.item.on .name em,
.item:focus-visible .name em {
  opacity: 1;
}

.hint {
  color: var(--fg-soft);
}

/* 子風格標籤：左右交錯排在單品兩側，指到時依序浮出 */
.subs {
  position: absolute;
  inset: 12% -1rem auto -1rem;
  pointer-events: none;
}

.sub {
  position: absolute;
  top: calc(var(--n) * 1.9rem);
  padding: 0.22rem 0.6rem;
  border-radius: 999px;
  background: var(--pill);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  font-size: 0.72rem;
  white-space: nowrap;
  opacity: 0;
  transform: translateX(0);
  transition: opacity 0.3s ease, transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.sub:nth-child(odd) {
  right: 100%;
}

.sub:nth-child(even) {
  left: 100%;
}

.item.on .sub,
.item:focus-visible .sub {
  opacity: 1;
  transition-delay: calc(0.08s + var(--n) * 0.06s);
}

.item.on .sub:nth-child(odd) {
  transform: translateX(-0.4rem);
}

.item.on .sub:nth-child(even) {
  transform: translateX(0.4rem);
}

/* 窄螢幕：單品改成兩欄往下排，可以捲 */
@media (max-width: 44rem) {
  .ask,
  .ready .ask {
    position: relative;
    left: auto;
    top: auto;
    transform: none;
    margin: 6rem 1.4rem 0;
    text-align: left;
  }

  .ask-what {
    font-size: 1.6rem;
  }

  .float {
    overflow-y: auto;
  }

  .field {
    position: fixed;
  }

  .top {
    flex-wrap: wrap;
  }

  .weather {
    margin-left: 0;
  }

  .item {
    --size: 52vw;
    position: relative;
    left: auto;
    top: auto;
    margin: 0;
    transform: none;
    display: inline-grid;
    vertical-align: top;
  }

  .item:nth-of-type(odd) {
    margin-left: 6vw;
  }

  .item:nth-of-type(even) {
    margin-left: 10vw;
    margin-top: 3rem;
  }

  .name {
    position: static;
    margin-top: 0.4rem;
  }

  .bottom {
    position: sticky;
    flex-direction: column;
    align-items: center;
  }
}
</style>
