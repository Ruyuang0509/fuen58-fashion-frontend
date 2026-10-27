<script setup>
// 試做頁：穿搭卡牆（HTML-in-Canvas × WebGPU）。穿搭卡還是現在的 OutfitCard（連結、整套加入購物車、收藏都是真的），
// 只是放進 <canvas content="drawable"> 裡：WebGPU 把每張卡的快照畫成一面微彎的牆，矩陣寫回 DOM 讓點擊與焦點對得上。
// 只有 Chromium 155 以上且開了 chrome://flags/#canvas-draw-element 才跑得起來；不支援、一般模式、窄螢幕都退回普通的卡片格。
// 停損條件在 docs/29；這一頁不連進導覽，網址直接打：/lab/plates
import '@fontsource/space-mono/400.css'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getOutfits, getThemes } from '@/api'
import OutfitCard from '@/components/OutfitCard.vue'
import { createPlates, platesSupport } from '@/lab/plates'
import { isPlain, isReduced } from '@/stores/motion'
import { accentOf } from '@/theme/themes'
import { SITE_NAME } from '@/config'

const CARD_W = 272
const CARD_H = 900 // 上限；實際高度照每張卡的內容量（四件的卡約 810）。蓋住內容的話，快照與點擊的幾何會對不上
const COUNT = 6

const outfits = ref([])
const themeNames = ref({})
const stage = ref(null)
const plateEls = ref([])
const support = ref(platesSupport())
const narrow = ref(window.matchMedia('(max-width: 64rem)').matches)
const mode = computed(() => (support.value || isPlain() || narrow.value ? 'grid' : 'plates'))
const stats = ref(null)
const failed = ref('')
let plates = null

const fpsTone = computed(() => (!stats.value ? '' : stats.value.fps >= 50 ? 'good' : stats.value.fps >= 30 ? 'ok' : 'bad'))
const why = computed(() => support.value || (isPlain() ? '一般模式（不用 WebGL／WebGPU）' : narrow.value ? '視窗太窄（這一輪只做桌機）' : ''))

// 牆：八張卡排成一排微彎的弧，離中央愈遠愈往後退、愈往內轉；y 有一點起伏
function poseFor(i, W, H) {
  const k = i - (COUNT - 1) / 2
  const gap = Math.min(320, (W - 64) / COUNT)
  const s = Math.min(1, gap / (CARD_W + 16))
  return {
    x: W / 2 + k * gap,
    // 卡高不一（件數不同）：以板子的中心對齊舞台中線偏下一點
    y: H * 0.5 + Math.abs(k) * 6,
    z: -Math.abs(k) * 70,
    ry: -k * 6,
    rz: k * 0.6,
    s,
    o: 1,
  }
}
function layout() {
  if (!plates || !stage.value) return
  const r = stage.value.getBoundingClientRect()
  outfits.value.forEach((o, i) => plates.setTarget(o.id, poseFor(i, r.width, r.height)))
}

onMounted(async () => {
  const [outfitsResult, themesResult] = await Promise.allSettled([getOutfits(), getThemes()])
  if (themesResult.status === 'fulfilled') themeNames.value = Object.fromEntries(themesResult.value.map((t) => [t.code, t.name]))
  if (outfitsResult.status === 'fulfilled') outfits.value = outfitsResult.value.slice(0, COUNT)
  if (mode.value !== 'plates') return
  await nextTick()
  try {
    plates = await createPlates(stage.value, { reduced: isReduced(), bg: '#faf8f4', tint: accentOf(outfits.value[0]?.themeCode), onStats: (s) => (stats.value = s) })
  } catch (err) {
    failed.value = String(err?.message || err)
    support.value = failed.value
    return
  }
  window.__plates = plates
  const r = stage.value.getBoundingClientRect()
  outfits.value.forEach((o, i) => {
    const el = plateEls.value[i]
    const pose = poseFor(i, r.width, r.height)
    // 卡的高度照內容量（每套件數不同）：量過才登記，不然底下的按鈕列會被 overflow 切掉、也點不到
    const h = Math.min(CARD_H, Math.max(320, Math.ceil(el.scrollHeight || CARD_H)))
    // 進場：從下面升上來、淡入，一張接一張；減少動態時直接到位
    plates.addCard(o.id, el, CARD_W, h, pose, { y: pose.y + 160, z: pose.z - 120, o: 0 })
    setTimeout(() => plates?.setTarget(o.id, { o: 1 }), 60 * i)
  })
  // 滑過或聚焦：那張卡抬起來、轉正、放大一點
  outfits.value.forEach((o, i) => {
    const el = plateEls.value[i]
    const base = () => poseFor(i, stage.value.getBoundingClientRect().width, stage.value.getBoundingClientRect().height)
    const lift = () => { const p = base(); plates?.setTarget(o.id, { ...p, z: p.z + 90, ry: 0, rz: 0, s: Math.min(1.04, p.s * 1.06) }) }
    const drop = () => plates?.setTarget(o.id, base())
    el.addEventListener('pointerenter', lift); el.addEventListener('pointerleave', drop)
    el.addEventListener('focusin', lift); el.addEventListener('focusout', drop)
  })
  window.addEventListener('resize', layout)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', layout)
  plates?.dispose()
  plates = null
  delete window.__plates
})
</script>

<template>
  <div class="lab" :class="mode">
    <header class="head">
      <p class="eyebrow"><RouterLink to="/" class="back">{{ SITE_NAME }}</RouterLink>　／　試做　／　穿搭卡牆</p>
      <h1 class="line">同一張穿搭卡，放到 GPU 的牆上</h1>
      <p class="sub">卡片還是現在的 OutfitCard：連結、整套加入購物車、收藏都是真的。只是瀏覽器把它的快照交給 WebGPU 畫成一面微彎的牆，再把位置寫回 DOM，所以滑過會抬起來，點得到、Tab 走得到。</p>
    </header>

    <!-- 牆：canvas 裡的 div 是真的 DOM；每個 div 一張卡。layoutsubtree 是 155 還認的舊名字，content=drawable 是新的，兩個都寫 -->
    <div v-if="mode === 'plates'" class="wall">
      <canvas ref="stage" class="stage" layoutsubtree content="drawable" aria-label="穿搭卡牆">
        <div v-for="o in outfits" :key="o.id" ref="plateEls" class="plate" drawable :data-plate="o.id">
          <OutfitCard :outfit="o" :theme-name="themeNames[o.themeCode] ?? ''" />
        </div>
      </canvas>
      <p class="stats num" role="status" :class="fpsTone">
        <template v-if="stats">
          FPS {{ stats.fps }}　抓圖/s {{ stats.capsSec }}　paint/s {{ stats.paintsSec }}　累計抓圖 {{ stats.captures }}　卡 {{ stats.cards }}<span v-if="stats.errors"> 　GPU 錯誤 {{ stats.errors }}</span>
          <span class="soft">　{{ stats.adapter }}</span>
        </template>
        <template v-else>起動中…</template>
      </p>
    </div>

    <!-- 退路：不支援、一般模式、窄螢幕 → 普通的卡片格，功能一樣 -->
    <section v-else class="grid-wrap">
      <p class="notice" role="status">這一頁的 3D 牆這裡開不了：{{ why }}。下面是同樣的卡片，普通排法。</p>
      <div class="grid">
        <OutfitCard v-for="o in outfits" :key="o.id" :outfit="o" :theme-name="themeNames[o.themeCode] ?? ''" />
      </div>
    </section>

    <section id="notes" class="notes">
      <h2>怎麼判斷</h2>
      <ol>
        <li>在開了 <code>chrome://flags/#canvas-draw-element</code> 的 Chrome 155 以上開這一頁，滑過卡片、點「整套加入購物車」、點標題、用 Tab 走：有任何一個對不上位置就不做（停損 1）。</li>
        <li>看右下角 FPS 與抓圖/s：滑過卡片時 FPS 低於 30 就不做（停損 2）。</li>
        <li>到 11/2 全組確認時，組員的瀏覽器開不了這一頁（沒有 flag、不是 Chromium）→ 留在試做，不進正式頁（停損 3）。</li>
      </ol>
      <p class="soft">需要：Chromium 155 以上、WebGPU、HTML-in-Canvas 旗標或 origin trial。沒有的話會看到上面的普通排法。WebGPU 的程式只在這一頁載入。</p>
    </section>
  </div>
</template>

<style scoped>
.num {
  font-family: 'Space Mono', monospace;
}

.lab {
  min-height: 100svh;
  background: var(--bg);
  color: var(--ink);
}

.head {
  display: grid;
  gap: 0.4rem;
  max-width: 52rem;
  padding: var(--s3) var(--s4) var(--s2);
}

.eyebrow {
  margin: 0;
  color: var(--ink-soft);
  font-size: 0.9rem;
  letter-spacing: 0.14em;
}

.back {
  color: inherit;
}

.line {
  margin: 0;
  font-weight: 600;
  font-size: clamp(1.6rem, 3vw, 2.4rem);
  letter-spacing: 0.06em;
}

.sub {
  margin: 0;
  color: var(--ink-soft);
  font-size: 0.95rem;
  line-height: 1.7;
}

.wall {
  position: relative;
  height: calc(100svh - 11rem);
  min-height: 40rem;
}

.stage {
  display: block;
  width: 100%;
  height: 100%;
}

/* canvas 裡的卡：絕對定位在 0,0，位置全由 transform 決定（由 plates.js 每幀寫） */
.plate {
  position: absolute;
  left: 0;
  top: 0;
  width: 272px;
  overflow: hidden;
  border-radius: var(--radius);
}

/* 卡裡人形的「呼吸」是無限循環的 CSS 動畫：在牆上它會讓每張卡每一幀都算「變了」，抓圖撞到上限（實測 8 張卡 152 次/秒）。
   牆上先關掉；要晃就改在 GPU 端晃板子，不要讓快照一直變 */
.plate :deep(*) {
  animation: none !important;
}

/* 退場或還沒進場的卡不接事件 */
.plate[data-hid='1'] {
  pointer-events: none;
}

.stats {
  position: absolute;
  right: var(--s3);
  bottom: var(--s2);
  margin: 0;
  padding: 0.3rem 0.8rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  font-size: 0.8rem;
  letter-spacing: 0.06em;
}

.stats.bad {
  border-color: #c0392b;
}

.grid-wrap {
  padding: 0 var(--s4) var(--s4);
}

.notice {
  margin: 0 0 var(--s3);
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: var(--s3);
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

@media (max-width: 64rem) {
  .head {
    padding-inline: var(--s3);
  }

  .grid-wrap {
    padding-inline: var(--s3);
  }
}
</style>
