<script setup>
// 第二階段：風格家族頁 /design/family/:code
//
// 從入口點一件單品進來。底色接著入口的顏色繼續流動，單品放大成主角，
// 整個介面的「輪廓」在一秒內從入口的膠囊形變成這個家族的形狀（skins.js）：
// 圓角、邊框、字型、字距、標籤的形狀都換。子風格列在旁邊，各自是進第三階段（穿搭列表）的門。
//
// 使用者 2026-10-06 裁決：認可兩段式；第二階段整體 UI silhouette 變成對應風格的設計。
import '@fontsource/noto-sans-tc/300.css'
import '@fontsource/noto-sans-tc/400.css'
import '@fontsource/noto-sans-tc/700.css'
import '@fontsource/noto-serif-tc/400.css'
import '@fontsource/noto-serif-tc/600.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/fraunces/600.css'
import '@fontsource/huninn/400.css'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getThemes } from '@/api'
import { SITE_NAME } from '@/config'
import { renderGarment } from '@/garments/render'
import { createGradientField, paletteOf, wantsDarkText } from '@/sketches/float/gradient'
import { ENTRANCE_VARS, skinOf } from '@/theme/skins'
import { FAMILIES } from './families'

const route = useRoute()
const field = ref(null)
const themes = ref([])
const darkText = ref(true)
const entering = ref(true) // 剛進來：還是入口的形狀，下一幀才變成這個家族的形狀
let gradient = null

const family = computed(() => FAMILIES.find((item) => item.theme === route.params.code) ?? FAMILIES[0])
const theme = computed(() => themes.value.find((item) => item.code === family.value.theme))
const skin = computed(() => skinOf(family.value.theme))
const vars = computed(() => (entering.value ? ENTRANCE_VARS : skin.value.vars))
const hero = computed(() => renderGarment(family.value.kind, { colour: family.value.colour, fabric: family.value.fabric, px: 1000 }))

function paint() {
  gradient?.setColour(family.value.key, 900)
  darkText.value = wantsDarkText(paletteOf(family.value.key).top)
}

onMounted(async () => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  gradient = createGradientField(field.value, { hex: family.value.key, reduced, onTone: (dark) => (darkText.value = dark) })
  // 兩幀之後把入口的形狀換成家族的形狀，CSS transition 負責中間
  requestAnimationFrame(() => requestAnimationFrame(() => (entering.value = false)))
  try {
    themes.value = await getThemes()
  } catch {
    themes.value = []
  }
})

// 在家族之間直接切換（同一個元件被沿用）
watch(() => route.params.code, paint)

onBeforeUnmount(() => gradient?.dispose())
</script>

<template>
  <div class="family" :class="[`chip-${skin.chip}`, { dark: darkText, entering }]" :style="vars">
    <canvas ref="field" class="field" aria-hidden="true"></canvas>

    <header class="top">
      <RouterLink to="/design/home/float" class="pill mark">{{ SITE_NAME }}</RouterLink>
      <nav class="pill" aria-label="主要">
        <RouterLink to="/wall">穿搭牆</RouterLink>
        <RouterLink to="/weather">天氣穿搭</RouterLink>
        <RouterLink to="/cart">購物車</RouterLink>
        <RouterLink to="/login">會員</RouterLink>
      </nav>
      <RouterLink to="/design/home/float" class="pill back">← 回入口</RouterLink>
    </header>

    <main class="stage">
      <figure class="hero">
        <img :src="hero" :alt="theme?.name ?? family.theme" draggable="false" />
      </figure>

      <section class="copy">
        <p class="kicker">風格家族</p>
        <h1>{{ theme?.name ?? family.theme }}</h1>
        <p class="tagline">{{ theme?.tagline }}</p>

        <!-- 子風格：每一個是進第三階段（穿搭列表）的門；現在都先連到同一個主題頁 -->
        <nav class="subs" aria-label="子風格">
          <RouterLink
            v-for="(name, n) in family.subs"
            :key="name"
            :to="{ name: 'theme', params: { code: family.theme } }"
            class="chip"
            :style="{ '--n': n }"
          >
            <span class="chip-text">{{ name }}</span>
          </RouterLink>
        </nav>

        <RouterLink :to="{ name: 'theme', params: { code: family.theme } }" class="pill cta">看這個家族的穿搭 →</RouterLink>
      </section>
    </main>

    <footer class="bottom">
      <nav class="others" aria-label="其他家族">
        <RouterLink v-for="item in FAMILIES" :key="item.theme" :to="{ name: 'design-family', params: { code: item.theme } }" :aria-current="item.theme === family.theme ? 'page' : undefined">
          {{ themes.find((t) => t.code === item.theme)?.name ?? item.theme }}
        </RouterLink>
      </nav>
    </footer>
  </div>
</template>

<style scoped>
.family {
  --fg: #1d1c22;
  --fg-soft: rgba(29, 28, 34, 0.62);
  position: fixed;
  inset: 0;
  overflow: hidden;
  color: var(--fg);
  font-family: var(--body);
  user-select: none;
  transition: color 0.5s ease;
}

.family:not(.dark) {
  --fg: #f4f3f7;
  --fg-soft: rgba(244, 243, 247, 0.72);
}

.field {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
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
}

.top {
  top: 0;
}

.bottom {
  bottom: 0;
}

.family a {
  color: inherit;
  text-decoration: none;
}

/* 介面輪廓：這些屬性都吃變數，變數一換就跟著變；transition 讓它們慢慢變 */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 1.1rem;
  padding: 0.55rem 1.1rem;
  border-radius: var(--radius);
  background: var(--pill-bg);
  border: var(--pill-border);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  font-family: var(--display);
  font-weight: var(--display-weight);
  letter-spacing: var(--display-spacing);
  font-size: 0.92rem;
  transition: border-radius 0.9s cubic-bezier(0.2, 0.8, 0.2, 1), background-color 0.9s ease, border-color 0.9s ease, letter-spacing 0.9s ease, transform 0.9s ease;
}

.chip-punk .pill,
.chip-torn .pill {
  color: #f4f3f7;
}

.mark {
  letter-spacing: calc(var(--display-spacing) + 0.08em);
  font-size: 1.05rem;
}

.back {
  margin-left: auto;
}

.stage {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: 5fr 6fr;
  align-items: center;
  gap: 2rem;
  padding: 5rem 4rem 5rem 3rem;
  z-index: 1;
}

.hero {
  margin: 0;
  justify-self: center;
  width: min(34vw, 62vh);
  aspect-ratio: 0.63;
}

.hero img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 30px 40px rgba(20, 16, 30, 0.28));
  transform: translateY(0);
  animation: settle 0.9s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes settle {
  from {
    transform: translateY(24px) scale(0.92);
    opacity: 0.6;
  }
}

.copy {
  display: grid;
  gap: 0.9rem;
  align-content: center;
  max-width: 34rem;
}

.kicker {
  margin: 0;
  color: var(--fg-soft);
  font-size: 0.8rem;
  letter-spacing: 0.3em;
}

h1 {
  margin: 0;
  font-family: var(--display);
  font-weight: var(--display-weight);
  letter-spacing: var(--display-spacing);
  font-size: clamp(2.6rem, 6vw, 4.6rem);
  line-height: 1.1;
  transition: letter-spacing 0.9s ease;
}

.tagline {
  margin: 0 0 0.6rem;
  font-size: 1.1rem;
  color: var(--fg-soft);
}

/* 子風格標籤：共用的部分 */
.subs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem 0.9rem;
  margin-top: 0.4rem;
}

.chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1rem;
  font-family: var(--display);
  font-weight: var(--display-weight);
  letter-spacing: var(--display-spacing);
  font-size: 1rem;
  border-radius: var(--radius);
  background: var(--pill-bg);
  border: var(--pill-border);
  --flip: 1;
  transform: rotate(calc(var(--tilt) * var(--flip)));
  transition: border-radius 0.9s cubic-bezier(0.2, 0.8, 0.2, 1), background-color 0.9s ease, border-color 0.9s ease, transform 0.9s ease, box-shadow 0.9s ease, letter-spacing 0.9s ease;
}

.chip:nth-child(even) {
  --flip: -1;
}

.chip:hover {
  transform: translateY(-2px) rotate(calc(var(--tilt) * var(--flip)));
}

/* 剛進來那一幀：所有標籤還是入口的膠囊，之後各自變形 */
.entering .chip {
  transform: none;
  box-shadow: none;
}

/* 各家族的標籤形狀 */
.chip-line .chip {
  padding-inline: 0;
  border: 0;
  border-bottom: var(--rule);
  background: transparent;
}

.chip-sticker .chip {
  box-shadow: 3px 3px 0 currentColor;
}

.chip-torn .chip {
  color: #f4f3f7;
  background: rgba(18, 14, 20, 0.9);
  border: 0;
  clip-path: polygon(2% 8%, 14% 0, 30% 6%, 48% 0, 66% 7%, 84% 1%, 98% 9%, 100% 40%, 96% 62%, 100% 90%, 86% 100%, 68% 94%, 50% 100%, 32% 95%, 14% 100%, 0 92%, 3% 60%, 0 30%);
}

.chip-tag .chip {
  padding-left: 1.6rem;
}

.chip-tag .chip::before {
  content: '';
  position: absolute;
  left: 0.6rem;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  border: 1.5px solid currentColor;
}

.chip-rule .chip {
  padding-inline: 0.2rem;
  border: 0;
  border-top: var(--rule);
  border-bottom: var(--rule);
  background: transparent;
}

.chip-pill .chip::before {
  content: '♡';
  margin-right: 0.4rem;
  font-size: 0.85em;
}

.chip-lace .chip {
  outline: 1px solid currentColor;
  outline-offset: -5px;
}

.chip-label .chip {
  outline: 1px solid currentColor;
  outline-offset: 3px;
}

.cta {
  justify-self: start;
  margin-top: 0.8rem;
}

.others {
  display: flex;
  gap: 1.2rem;
  font-size: 0.85rem;
  color: var(--fg-soft);
}

.others a[aria-current='page'] {
  color: var(--fg);
  text-decoration: underline;
  text-underline-offset: 0.3em;
}

@media (max-width: 44rem) {
  .stage {
    grid-template-columns: 1fr;
    align-content: start;
    gap: 1rem;
    padding: 5.5rem 1.4rem 5rem;
    overflow-y: auto;
  }

  .hero {
    width: 48vw;
  }

  .back {
    display: none;
  }

  .others {
    flex-wrap: wrap;
  }
}
</style>
