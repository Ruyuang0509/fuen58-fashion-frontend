<script setup>
// 探索區的頁面骨架：天空在上，內容在下。
// 首頁、主題頁、穿搭頁、全部穿搭都用它——同一片天空貫穿整個探索區，只是高度、時刻、染色不同。
//   頂欄浮在天空上，捲過天空後變實、一路黏在上面；
//   天空最下面淡進紙色（地平線）；天空捲出畫面就停；
//   滑鼠在天空上移動會推出風：雲被推一下，掛著的衣服也跟著擺（--wind 這個 CSS 變數）。
// 捲動的連動（第十二輪，GSAP ScrollTrigger）：往下捲時天空比頁面慢一點（視差）、天空裡的字往上飄並淡出、
// 頂欄的底色隨捲動漸漸實起來——三件事綁在同一條捲動進度上，不是各跳各的門檻。
import '@fontsource/noto-serif-tc/400.css'
import '@fontsource/noto-serif-tc/600.css'
import '@fontsource/noto-sans-tc/400.css'
import '@fontsource/space-mono/400.css'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import SiteFooter from '@/components/SiteFooter.vue'
import SiteHeader from '@/components/SiteHeader.vue'
import { gsap, ScrollTrigger, reducedMotion } from '@/motion/gsap'
import { createSky, skyWantsDarkText, sunNow, weatherLook } from '@/sky/sky'

const props = defineProps({
  // 雲、雨、霧從這裡算；null 就是晴
  weather: { type: Object, default: null },
  // 固定時刻（主題頁用自己的時刻）；null = 現在
  hour: { type: Number, default: null },
  // 染進天空的顏色（#rrggbb）；null 不染
  tint: { type: String, default: null },
  // 第一屏的高度與最小高度
  height: { type: String, default: '100svh' },
  minHeight: { type: String, default: '36rem' },
  // 「跳到內容」連結的目標
  skipTarget: { type: String, default: '#content' },
  skipLabel: { type: String, default: '跳到內容' },
  footer: { type: Boolean, default: true },
})

const root = ref(null)
const canvas = ref(null)
const hero = ref(null)
const heroBody = ref(null)
const darkText = ref(true)
const pastHero = ref(false)
const heroHeight = ref(0)
const wind = ref(0)
const solid = ref(0) // 頂欄底色實到什麼程度：0 透明 → 1 紙色
let sky = null
let lastPointer = null
let decayTimer = 0
let motion = null // gsap.context：離開頁面時一次清掉所有 ScrollTrigger 與補間
const reduced = reducedMotion()

const hexToUnit = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)

// 主題的時刻優先；開發時可以用 ?hour=19 看別的時刻（正式版沒有這個）
function clockNow() {
  const date = new Date()
  if (props.hour !== null) date.setHours(props.hour, 0, 0, 0)
  if (import.meta.env.DEV) {
    const hour = new URLSearchParams(location.search).get('hour')
    if (hour !== null) date.setHours(+hour, 0, 0, 0)
  }
  return date
}

function paint() {
  if (!sky) return
  const sun = sunNow(clockNow())
  const look = weatherLook(props.weather)
  sky.set({ sun: sun.elevation, sunX: sun.x, ...look, tint: props.tint ? hexToUnit(props.tint) : [0.5, 0.5, 0.5], tintK: props.tint ? 1 : 0 })
  darkText.value = skyWantsDarkText(sun, look)
}

// 滑鼠在天空上移動：推一下雲，也推一下衣服
function onMove(event) {
  if (reduced) return
  if (lastPointer) {
    const vx = (event.clientX - lastPointer.x) / window.innerWidth
    const vy = (event.clientY - lastPointer.y) / window.innerHeight
    sky?.stir(vx, vy)
    wind.value = Math.max(-1, Math.min(1, wind.value * 0.7 + vx * 6))
  }
  lastPointer = { x: event.clientX, y: event.clientY }
}

function measureHero() {
  heroHeight.value = hero.value?.getBoundingClientRect().height ?? 0
}

onMounted(() => {
  sky = createSky(canvas.value, { reduced })
  paint()
  measureHero()
  window.addEventListener('resize', measureHero, { passive: true })

  // 頂欄的底色實到什麼程度：看捲了天空的幾成（捲到後半才開始變實，捲完全實）
  function updateSolid() {
    const fraction = window.scrollY / Math.max(1, heroHeight.value)
    solid.value = reduced ? (fraction >= 1 ? 1 : 0) : Math.min(1, Math.max(0, (fraction - 0.55) / 0.4))
  }

  motion = gsap.context(() => {
    // 捲過天空：頂欄變實、天空停下（減少動態時也要）。
    // 「天空還在畫面裡」的範圍是：天空的頂碰到視窗底（一開始就成立）到天空的底碰到視窗頂；
    // 不能用 'top top' 當起點——天空頂在 0 的那一點有次像素誤差，一開始會被判成還沒進入。
    const gate = ScrollTrigger.create({
      trigger: hero.value,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => {
        pastHero.value = !self.isActive
        if (self.isActive) sky?.resume()
        else sky?.pause()
        updateSolid()
      },
      onUpdate: updateSolid,
    })
    // 重新整理時已經捲在下面：直接用現況，不等 toggle
    pastHero.value = !gate.isActive
    if (pastHero.value) sky?.pause()
    updateSolid()

    // 視差：天空慢一點、字快一點；字在捲到七成前就淡掉，不會頂到頂欄
    if (!reduced) {
      gsap
        .timeline({ scrollTrigger: { trigger: hero.value, start: 'top top', end: 'bottom top', scrub: 0.5 } })
        .to(canvas.value, { yPercent: 16, ease: 'none', duration: 1 }, 0)
        .to(heroBody.value, { yPercent: -8, ease: 'none', duration: 1 }, 0)
        .to(heroBody.value, { opacity: 0, ease: 'none', duration: 0.7 }, 0)
    }
  }, root.value)

  // 風沒人推就慢慢停
  decayTimer = setInterval(() => {
    if (Math.abs(wind.value) < 0.005) wind.value = 0
    else wind.value *= 0.86
  }, 80)
})

watch(() => [props.weather, props.hour, props.tint], paint, { deep: true })

// 第一屏換高度（首頁 100svh → 路線頁 78svh）：高度用 CSS 過渡，過渡完再量一次、也讓 ScrollTrigger 重算位置
let refreshTimer = 0
watch(
  () => props.height,
  () => {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => {
      measureHero()
      ScrollTrigger.refresh()
    }, 750)
  },
)

onBeforeUnmount(() => {
  motion?.revert()
  clearInterval(decayTimer)
  clearTimeout(refreshTimer)
  window.removeEventListener('resize', measureHero)
  sky?.dispose()
})

// 給開發時的量測用
defineExpose({
  webgl: () => sky?.webgl ?? false,
  running: () => !pastHero.value,
  dark: () => darkText.value,
  pastHero: () => pastHero.value,
  solid: () => solid.value,
})
</script>

<template>
  <div ref="root" class="sky-page" :class="{ dark: darkText, past: pastHero }">
    <a class="skip" :href="skipTarget">{{ skipLabel }}</a>
    <!-- 頂欄黏在最上面；在天空上是透明的，隨捲動漸漸實起來 -->
    <div class="header-slot" :style="{ '--header-solid': solid.toFixed(3) }">
      <SiteHeader :float="!pastHero" />
    </div>

    <section ref="hero" class="hero" :style="{ '--hero-h': height, '--hero-min': minHeight, '--wind': wind.toFixed(3) }" @pointermove="onMove">
      <canvas ref="canvas" class="sky" aria-hidden="true"></canvas>
      <div ref="heroBody" class="hero-body">
        <slot name="hero" :dark="darkText" :wind="wind" />
      </div>
    </section>

    <div class="below">
      <slot :hero-height="heroHeight" :past-hero="pastHero" />
    </div>
    <SiteFooter v-if="footer" />
  </div>
</template>

<style scoped>
.sky-page {
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

/* 頂欄的字色：天空上是 --hdr-fg（白天深、夜裡淺），底色愈實愈靠近墨色 */
.header-slot {
  --hdr-fg: var(--fg);
  position: sticky;
  top: 0;
  z-index: 20;
  color: color-mix(in srgb, var(--ink) calc(var(--header-solid, 0) * 100%), var(--hdr-fg));
}

.sky-page:not(.dark) .header-slot {
  --hdr-fg: #f3f1ec;
}

.sky-page.past .header-slot {
  color: var(--ink);
}

.hero {
  position: relative;
  height: var(--hero-h);
  min-height: var(--hero-min);
  /* 頂欄黏在上面佔掉的高度，天空從頁面最上面開始畫 */
  margin-top: calc(-1 * var(--header-h));
  overflow: hidden;
  color: var(--fg);
  font-family: 'Noto Serif TC', serif;
  /* 字色隨天空明暗；高度在首頁與路線頁之間換時慢慢變，不跳 */
  transition: color 0.6s ease, height 0.7s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* 傍晚與夜裡：天暗了，字變淺 */
.sky-page:not(.dark) .hero {
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
  will-change: transform;
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
  z-index: 1;
}

.hero-body {
  position: absolute;
  inset: 0;
  padding-top: var(--header-h);
  z-index: 2;
  will-change: transform, opacity;
}

.hero :deep(a) {
  color: inherit;
  text-decoration: none;
}

.below {
  position: relative;
  background: var(--bg);
}

/* 窄螢幕：天空的高度跟著內容走，裡面上下排 */
@media (max-width: 52rem) {
  .hero {
    height: auto;
    min-height: var(--hero-min);
    margin-top: 0;
  }

  /* 要留在流裡（高度跟著內容），但不能變成 static：static 的文字會被絕對定位的天空畫布蓋住（手機版字消失的原因） */
  .hero-body {
    position: relative;
    inset: auto;
    z-index: 2;
    padding: 1.2rem 1.2rem 3.5rem;
  }
}
</style>
