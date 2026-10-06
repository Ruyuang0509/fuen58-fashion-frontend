<script setup>
// 主頁互動作品的原型頁：/design/home/isles（群島）、/design/home/districts（分區）、/design/home/cloth（布）、/design/home/wind（風）。
// 畫布由 p5 畫；所有文字（站名、提示、主題名稱、連結）都是一般的 HTML，疊在畫布上面，
// 所以文字可以被選取、被讀屏唸出來、用鍵盤走到。
import '@fontsource/noto-serif-tc/400.css'
import '@fontsource/noto-serif-tc/900.css'
import '@fontsource/huninn/400.css'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getThemes } from '@/api'
import { SITE_NAME } from '@/config'
import { createClothSketch } from '@/sketches/clothSketch'
import { createDistrictsSketch } from '@/sketches/districtsSketch'
import { createIslesSketch } from '@/sketches/islesSketch'
import { createTownSketch } from '@/sketches/townSketch'
import { createWindSketch } from '@/sketches/windSketch'

const VARIANTS = {
  // night：這個原型是深色底，文字要換成淺色
  // names：主題名稱直接標在每座島下面（它們同時是連結），不另外列在頁尾
  // hand：手繪風，文字換成圓體
  street: { name: '商店街', create: createTownSketch, names: true, hand: true, hint: '左右拖曳走在街上，指著一間店它就上色，掃過吊著的衣服它會晃，點一間店進去。' },
  isles: { name: '群島', create: createIslesSketch, night: true, names: true, hint: '掃過衣服它會晃，按住拖曳縫一道線，點一座島進去。' },
  districts: { name: '分區', create: createDistrictsSketch, night: true, hint: '靠近一區它就動起來，按住拖曳拉一條線，點一區進去。' },
  cloth: { name: '布', create: createClothSketch, hint: '滑過去撥動布，按住拖曳畫一條粉線，點一件衣服進去。' },
  wind: { name: '風', create: createWindSketch, hint: '揮一下是一陣風，按住拖曳放出紅線，點一件衣服進去。' },
}

const route = useRoute()
const router = useRouter()
const canvasHost = ref(null)
const themes = ref([])
const hovered = ref(null) // 滑鼠指著的那件衣服（或那座島）：{ theme, x, y }
const spots = ref([]) // 每座島的名稱要放在畫面上的哪裡：{ theme, x, y }
const leaving = ref(false) // 點選之後、換頁之前：文字先淡出，把畫面讓給推近的鏡頭
let sketch = null

const variantKey = computed(() => (route.params.variant in VARIANTS ? route.params.variant : 'street'))
const variant = computed(() => VARIANTS[variantKey.value])
const hoveredTheme = computed(() => themes.value.find((theme) => theme.code === hovered.value?.theme))
// 把島的位置和主題的名稱、標語配在一起
const named = computed(() =>
  spots.value.map((spot) => ({ ...spot, ...themes.value.find((theme) => theme.code === spot.theme) })).filter((spot) => spot.name),
)

// 文字連結被指到或被鍵盤走到時，請畫布把那座島點亮（只有群島有這個功能）
const lightUp = (theme) => sketch?.focus?.(theme)

function start() {
  sketch?.dispose()
  hovered.value = null
  spots.value = []
  leaving.value = false
  sketch = variant.value.create(canvasHost.value, {
    onHover: (garment) => (hovered.value = garment),
    onLeave: () => (leaving.value = true),
    onLayout: (list) => (spots.value = list),
    onPick: ({ theme }) => router.push({ name: 'theme', params: { code: theme } }),
  })
  // 開發時把作品的狀態掛到 window 上，方便從主控台量測；正式版不會有
  if (import.meta.env.DEV) window.__home = sketch
}

onMounted(async () => {
  start()
  try {
    themes.value = await getThemes()
  } catch {
    // 主題清單拿不到時，畫布照常運作，只是沒有名稱可以顯示
    themes.value = []
  }
})

// 在「布」和「風」之間切換時，Vue Router 沿用同一個元件，要自己把舊的作品收掉再開新的
watch(variantKey, start)

// 離開這一頁時一定要收掉：p5 的動畫迴圈和事件監聽不會自己停
onBeforeUnmount(() => sketch?.dispose())
</script>

<template>
  <div class="home" :class="{ night: variant.night, hand: variant.hand, leaving }">
    <div ref="canvasHost" class="canvas" aria-hidden="true"></div>

    <header class="top">
      <RouterLink to="/design/home" class="mark">{{ SITE_NAME }}</RouterLink>
      <nav aria-label="主要">
        <RouterLink to="/wall">穿搭牆</RouterLink>
        <RouterLink to="/weather">天氣穿搭</RouterLink>
        <RouterLink to="/cart">購物車</RouterLink>
        <RouterLink to="/login">會員</RouterLink>
      </nav>
    </header>

    <!-- 群島：每座島下面標著名稱。它們是真的連結，用鍵盤走到時那座島也會亮 -->
    <nav v-if="variant.names" class="names" :class="{ picking: hovered }" aria-label="風格主題">
      <RouterLink
        v-for="spot in named"
        :key="spot.theme"
        :to="{ name: 'theme', params: { code: spot.theme } }"
        :class="{ on: hovered?.theme === spot.theme }"
        :style="{ left: `${spot.x}px`, top: `${spot.y}px` }"
        @focus="lightUp(spot.theme)"
        @blur="lightUp(null)"
        @mouseenter="lightUp(spot.theme)"
        @mouseleave="lightUp(null)"
      >
        <strong>{{ spot.name }}</strong>
        <span>{{ spot.tagline }}</span>
      </RouterLink>
    </nav>

    <!-- 其他原型：滑鼠指到衣服時，名稱出現在衣服上方 -->
    <p v-else-if="hoveredTheme" class="label" :style="{ left: `${hovered.x}px`, top: `${hovered.y}px` }">
      <strong>{{ hoveredTheme.name }}</strong>
      <span>{{ hoveredTheme.tagline }}</span>
    </p>

    <footer class="bottom">
      <!-- 同一批主題的文字連結：不用滑鼠、或畫布跑不起來的時候，從這裡一樣進得去 -->
      <nav v-if="!variant.names" class="themes" aria-label="風格主題">
        <RouterLink v-for="theme in themes" :key="theme.code" :to="{ name: 'theme', params: { code: theme.code } }">
          {{ theme.name }}
        </RouterLink>
      </nav>

      <span v-else></span>

      <p class="hint">{{ variant.hint }}</p>

      <nav class="switch" aria-label="原型">
        <RouterLink v-for="(item, key) in VARIANTS" :key="key" :to="`/design/home/${key}`" :aria-current="key === variantKey ? 'page' : undefined">
          {{ item.name }}
        </RouterLink>
        <RouterLink to="/design/home/float">浮動</RouterLink>
        <RouterLink to="/">一般模式</RouterLink>
      </nav>
    </footer>
  </div>
</template>

<style scoped>
/* 這一頁自己的顏色與字：墨與紙，加一個只在操作時出現的朱色（朱色由畫布畫，這裡用不到） */
.home {
  --paper: #f2ede3;
  --ink: #1d1b18;
  --ink-2: #5d574e;
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: var(--paper);
  color: var(--ink);
  font-family: 'Noto Serif TC', serif;
  transition: color 0.2s ease;
  /* 整層預設不接滑鼠，滑鼠事件才會落到畫布；連結再各自打開 */
  pointer-events: none;
  user-select: none;
}

/* 手繪風的原型：圓體、字距放鬆 */
.home.hand {
  --paper: #f7f2e8;
  --ink: #3a322e;
  --ink-2: #857a72;
  font-family: 'Huninn', 'Noto Sans TC', sans-serif;
}

.home.hand .mark {
  font-weight: 400;
  letter-spacing: 0.12em;
}

.home.hand .names strong {
  font-weight: 400;
  font-size: 1.15rem;
}

/* 深色底的原型：只換這三個變數，下面的規則都不用改 */
.home.night {
  --paper: #07080c;
  --ink: #e4e6ea;
  --ink-2: #8c93a0;
}

/* 點選後文字淡出 */
.top,
.bottom,
.label,
.names {
  transition: opacity 0.25s ease;
}

.leaving .top,
.leaving .bottom,
.leaving .label,
.leaving .names {
  opacity: 0;
}

.canvas {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  cursor: crosshair;
}

.home a {
  pointer-events: auto;
  color: inherit;
  text-decoration: none;
}

.home a:hover,
.home a[aria-current='page'] {
  text-decoration: underline;
  text-underline-offset: 0.35em;
}

.top,
.bottom {
  position: absolute;
  inset-inline: 0;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 2rem;
  padding: 1.5rem 2.25rem;
}

.top {
  top: 0;
}

.bottom {
  bottom: 0;
}

.mark {
  font-size: 1.5rem;
  font-weight: 900;
}

.top nav,
.themes,
.switch {
  display: flex;
  gap: 1.5rem;
}

.hint {
  color: var(--ink-2);
  font-size: 0.9rem;
  text-align: center;
}

.label {
  position: absolute;
  display: grid;
  gap: 0.15rem;
  /* 以衣服頂端的中心為基準，往上、置中 */
  transform: translate(-50%, calc(-100% - 0.75rem));
  text-align: center;
  white-space: nowrap;
}

/* 群島：島下面的名稱 */
.names a {
  position: absolute;
  display: grid;
  justify-items: center;
  gap: 0.3rem;
  transform: translateX(-50%);
  white-space: nowrap;
  transition: opacity 0.25s ease;
}

.names strong {
  font-size: 1.05rem;
  font-weight: 900;
  /* 字距拉開；最後一個字後面多出來的那一格用負的右邊界收回來，名稱才會真的置中 */
  letter-spacing: 0.5em;
  margin-right: -0.5em;
}

.names span {
  color: var(--ink-2);
  font-size: 0.85rem;
  opacity: 0;
  transition: opacity 0.25s ease;
}

/* 有一座島被指著時，其他名稱退後；被指著的那個顯示標語 */
.names.picking a:not(.on) {
  opacity: 0.55;
}

.names a.on span,
.names a:focus-visible span {
  opacity: 1;
}

.names a:hover,
.names a[aria-current='page'] {
  text-decoration: none;
}

/* 窄螢幕：字縮小、不換行；頁尾改成上下兩列 */
@media (max-width: 40rem) {
  .top,
  .bottom {
    gap: 0.75rem;
    padding: 1rem;
  }

  .home a {
    white-space: nowrap;
  }

  .mark {
    font-size: 1.15rem;
  }

  .top nav,
  .switch {
    gap: 0.8rem;
    font-size: 0.8rem;
  }

  .bottom {
    flex-direction: column;
    align-items: center;
  }

  .hint {
    font-size: 0.75rem;
  }

  .names strong {
    font-size: 0.9rem;
  }
}

.label strong {
  font-size: 2rem;
  font-weight: 900;
  line-height: 1.2;
}

.label span {
  color: var(--ink-2);
  font-size: 0.9rem;
}
</style>
