<script setup>
// 試做頁：一片布。左邊是現在的 2D（款式圖打光、CSS 晃），右邊是 three.js 的布（頂點起伏、太陽方向打光）。
// 同一片天空、同一件外套（教練外套 201），用來判斷要不要投入 three.js。停損條件在 vault 筆記第 13 節：
// 手機 FPS 低於 30、或看起來沒有比 2D 更真，就不做。這一頁不連進導覽，網址直接打：/lab/cloth
import '@fontsource/space-mono/400.css'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getProduct, getWeather } from '@/api'
import GarmentImage from '@/components/GarmentImage.vue'
import SkyPage from '@/components/SkyPage.vue'
import { renderGarment } from '@/garments/render'
import { FLAT_BOX } from '@/garments/flats'
import { createCloth } from '@/lab/cloth'
import { accentOf } from '@/theme/themes'

const PRODUCT_ID = 201 // 教練外套（尼龍，街頭路線）

const weather = ref(null)
const product = ref(null)
const canvas = ref(null)
const fps = ref(null)
const gust = ref(0.5)
const mode = ref('both') // both | three | two
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
let cloth = null
let lastX = null

const colour = computed(() => product.value?.colours[0] ?? null)
const fpsTone = computed(() => (fps.value === null ? '' : fps.value >= 50 ? 'good' : fps.value >= 30 ? 'ok' : 'bad'))

// 開發時可以用 ?hour=19 看傍晚的光；正式版沒有這個
function clockNow() {
  const date = new Date()
  if (import.meta.env.DEV) {
    const hour = new URLSearchParams(location.search).get('hour')
    if (hour !== null) date.setHours(+hour, 0, 0, 0)
  }
  return date
}

onMounted(async () => {
  const [weatherResult, productResult] = await Promise.allSettled([getWeather(), getProduct(PRODUCT_ID)])
  if (weatherResult.status === 'fulfilled') weather.value = weatherResult.value
  if (productResult.status === 'fulfilled') product.value = productResult.value
  if (!product.value || !canvas.value) return
  // 同一張款式圖：2D 用它當 <img>，3D 用它當貼圖
  const textureUrl = renderGarment(product.value.kind, { colour: colour.value.hex, fabric: product.value.fabric, px: 1024 })
  cloth = createCloth(canvas.value, {
    textureUrl,
    aspect: (FLAT_BOX.width + 24) / (FLAT_BOX.height + 24),
    reduced,
    onFps: (value) => (fps.value = value),
  })
  cloth.setGust(gust.value)
  cloth.setTime(clockNow())
})

watch(gust, (value) => cloth?.setGust(Number(value)))

// 滑過布：水平速度變成風
function onMove(event) {
  if (lastX !== null) cloth?.stir((event.clientX - lastX) / window.innerWidth)
  lastX = event.clientX
}
function onLeave() {
  lastX = null
}

onBeforeUnmount(() => cloth?.dispose())
</script>

<template>
  <SkyPage class="lab" :weather="weather" :tint="accentOf('street')" height="100svh" min-height="40rem" skip-target="#notes" skip-label="跳到說明">
    <template #hero>
      <div class="stage" :class="mode">
        <header class="head">
          <p class="eyebrow">試做　／　一片布</p>
          <h1 class="line">{{ product?.name ?? '教練外套' }}</h1>
          <p class="sub">左邊是現在的做法（圖加 CSS 晃），右邊是 three.js 的布（頂點起伏、光跟著太陽）。滑過右邊的布，風會推它。</p>
        </header>

        <div class="pair">
          <figure v-if="product && mode !== 'three'" class="two">
            <div class="swing"><GarmentImage :kind="product.kind" :colour="colour.hex" :fabric="product.fabric" :height="340" /></div>
            <figcaption>2D　現在的做法</figcaption>
          </figure>
          <figure v-show="mode !== 'two'" class="three">
            <canvas ref="canvas" class="cloth" aria-label="three.js 的布" @pointermove="onMove" @pointerleave="onLeave"></canvas>
            <figcaption>3D　three.js 的布</figcaption>
          </figure>
        </div>

        <!-- 讀數與控制：FPS 是停損條件 (1) 的依據，要手機上讀 -->
        <div class="panel">
          <p class="fps" :class="fpsTone" role="status">
            FPS <span class="num">{{ fps ?? '—' }}</span>
            <span class="hint" v-if="fps !== null">{{ fps >= 30 ? '（過 30，停損 (1) 沒觸發）' : '（低於 30，停損 (1) 觸發）' }}</span>
          </p>
          <label class="gust">風 <input v-model="gust" type="range" min="0" max="1" step="0.05" /><span class="num">{{ Number(gust).toFixed(2) }}</span></label>
          <div class="modes" role="group" aria-label="顯示">
            <button type="button" :class="{ on: mode === 'both' }" @click="mode = 'both'">並排</button>
            <button type="button" :class="{ on: mode === 'three' }" @click="mode = 'three'">只看 3D</button>
            <button type="button" :class="{ on: mode === 'two' }" @click="mode = 'two'">只看 2D</button>
          </div>
        </div>
      </div>
    </template>

    <template #default>
      <section id="notes" class="notes">
        <h2>怎麼判斷</h2>
        <ol>
          <li>用手機開這一頁，看 FPS 讀數：低於 30 就不做（停損 1）。</li>
          <li>並排看、滑過右邊的布：3D 有沒有比 2D 更真？沒有就不做（停損 2）。</li>
          <li>兩關都過，下一步才是把整套衣服搬進天空、把天空併進同一個場景。</li>
        </ol>
        <p class="soft">這一頁不連進導覽，只有網址。three.js 0.186（MIT）只在這一頁載入，其他頁面不受影響。</p>
      </section>
    </template>
  </SkyPage>
</template>

<style scoped>
.num {
  font-family: 'Space Mono', monospace;
}

.stage {
  position: absolute;
  /* 從頂欄下面開始（絕對定位不吃 .hero-body 的 padding） */
  inset: var(--header-h) 0 0 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: var(--s2);
  padding: var(--s3) var(--s4) var(--s4);
}

.head {
  display: grid;
  gap: 0.4rem;
  max-width: 44rem;
}

.eyebrow {
  margin: 0;
  color: var(--fg-soft);
  font-size: 0.9rem;
  letter-spacing: 0.14em;
}

.line {
  margin: 0;
  font-weight: 600;
  font-size: clamp(1.8rem, 3.6vw, 2.8rem);
  letter-spacing: 0.08em;
}

.sub {
  margin: 0;
  color: var(--fg-soft);
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 0.95rem;
  line-height: 1.7;
}

.pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s4);
  align-items: end;
  min-height: 0;
}

.stage.three .pair,
.stage.two .pair {
  grid-template-columns: 1fr;
}

.two,
.three {
  margin: 0;
  display: grid;
  justify-items: center;
  align-content: end;
  gap: var(--s2);
  min-height: 0;
}

figcaption {
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 0.8rem;
  letter-spacing: 0.16em;
  color: var(--fg-soft);
}

/* 2D 的晃：和 OutfitLook 同一個節奏 */
.swing {
  transform-origin: 50% 0;
  animation: breathe 7s ease-in-out infinite alternate;
}

@keyframes breathe {
  from {
    transform: rotate(-0.7deg);
  }
  to {
    transform: rotate(0.7deg);
  }
}

.cloth {
  display: block;
  width: min(100%, 30rem);
  height: 24rem;
  max-height: 52svh;
  touch-action: none;
  cursor: grab;
}

.panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s3);
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 0.9rem;
}

.fps {
  margin: 0;
  display: inline-flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.3rem 0.8rem;
  border: 1px solid var(--line-soft);
  letter-spacing: 0.1em;
}

.fps .num {
  font-size: 1.3rem;
}

.fps.good .num {
  color: inherit;
}

.fps.bad {
  border-color: #c0392b;
}

.hint {
  color: var(--fg-soft);
  font-size: 0.78rem;
  letter-spacing: 0.04em;
}

.gust {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--fg-soft);
}

.gust input {
  width: 9rem;
}

.modes {
  display: inline-flex;
  gap: var(--s2);
}

.modes button {
  padding: 0.3rem 0.8rem;
  border: 1px solid var(--line-soft);
  background: transparent;
  color: inherit;
  cursor: pointer;
  letter-spacing: 0.1em;
}

.modes button.on {
  background: var(--fg);
  color: var(--bg);
  border-color: var(--fg);
}

.notes {
  max-width: 44rem;
  margin-inline: auto;
  padding: var(--s5) var(--s3);
  display: grid;
  gap: var(--s2);
}

.notes h2 {
  font-size: var(--fs-2);
  font-weight: 400;
  letter-spacing: 0.12em;
  color: var(--ink-soft);
}

.notes ol {
  margin: 0;
  padding-left: 1.4em;
  line-height: 1.8;
}

.soft {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

@media (prefers-reduced-motion: reduce) {
  .swing {
    animation: none;
  }
}

@media (max-width: 52rem) {
  .stage {
    position: relative;
    inset: auto;
    padding: var(--s2) var(--s2) var(--s4);
  }

  .pair {
    grid-template-columns: 1fr;
  }

  .cloth {
    height: 24rem;
  }
}
</style>
