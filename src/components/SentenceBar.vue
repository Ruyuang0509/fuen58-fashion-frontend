<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getThemes, getWeather } from '@/api'
import { useFilters } from '@/composables/useFilters'
import { CATEGORIES, OCCASIONS, SIZES } from '@/filters/options'
import { Flip, reducedMotion } from '@/motion/gsap'

// offset：這一列上方還有多高的東西（首頁的天空），收合的門檻從那裡起算
const props = defineProps({
  offset: { type: Number, default: 0 },
})

const { filters, setFilter } = useFilters()
const themes = ref([])
const weather = ref(null)

// 往下捲超過 COLLAPSE_AT 就收合成一行摘要；捲回 EXPAND_AT 以內才自動展開。
// 兩個門檻刻意不同：收合會讓頁面變矮、捲動位置跟著變，同一個門檻會在邊界上來回閃。
const COLLAPSE_AT = 160
const EXPAND_AT = 60
const scrolledPast = ref(false)
// 使用者在收合狀態點了「改條件」：先展開，等他再捲一段才收回去
const reopenedAt = ref(null)
const collapsed = computed(() => scrolledPast.value && reopenedAt.value === null)

function onScroll() {
  const y = window.scrollY - props.offset
  if (y > COLLAPSE_AT) scrolledPast.value = true
  else if (y < EXPAND_AT) scrolledPast.value = false
  if (reopenedAt.value !== null && Math.abs(y - reopenedAt.value) > 120) reopenedAt.value = null
}

function reopen() {
  reopenedAt.value = window.scrollY
}

// 改條件時整句重排有過程（第十二輪，GSAP Flip）：選了比較長或比較短的詞，後面的字滑到新位置，不是跳過去。
// 位置要在使用者「打開選單之前」記（focus／pointerdown）：原生 <select> 一選好就自己變寬，等到 change 事件再記已經晚了。
const line = ref(null)
let before = null
function capture() {
  if (reducedMotion() || !line.value) return
  before = Flip.getState(line.value.querySelectorAll('.clause'))
}
watch(filters, async () => {
  if (!before) return
  const state = before
  before = null
  await nextTick()
  if (line.value) Flip.from(state, { duration: 0.45, ease: 'power2.out' })
})

onMounted(async () => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  // 兩份資料各自獨立：天氣拿不到時句子少一段，主題拿不到時風格那一格只剩「不限」
  const [themeResult, weatherResult] = await Promise.allSettled([getThemes(), getWeather()])
  if (themeResult.status === 'fulfilled') themes.value = themeResult.value
  if (weatherResult.status === 'fulfilled') weather.value = weatherResult.value
})

onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

const styleOptions = computed(() => [
  { value: '', label: '什麼風格都好', short: '' },
  ...themes.value.map((theme) => ({ value: theme.code, label: theme.name, short: theme.name })),
])

const shortOf = (options, value) => options.find((option) => option.value === value)?.short ?? ''

const summary = computed(() => {
  const parts = [
    weather.value ? `${weather.value.temperature}°C` : '',
    shortOf(OCCASIONS, filters.value.occasion),
    shortOf(styleOptions.value, filters.value.style),
    shortOf(CATEGORIES, filters.value.category),
    shortOf(SIZES, filters.value.size),
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : '沒有設定條件'
})
</script>

<template>
  <section class="sentence" aria-label="用一句話篩選穿搭">
    <button v-if="collapsed" type="button" class="summary" @click="reopen">
      {{ summary }}
      <span class="hint">改條件</span>
    </button>

    <p v-else ref="line" class="line">
      <!-- 每個 clause 是一個不換行的小段，標點跟著前面的字走，不會掉到下一列的開頭；data-flip-id 給重排的動畫對位置 -->
      <span v-if="weather" class="clause" data-flip-id="clause-weather">今天 {{ weather.temperature }}°C，</span>
      <span class="clause" data-flip-id="clause-occasion">
        <label>
          <span class="visually-hidden">場合</span>
          <select @focus="capture" @pointerdown="capture" :value="filters.occasion" @change="setFilter('occasion', $event.target.value)">
            <option v-for="option in OCCASIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select> </label
        >，
      </span>
      <span class="clause" data-flip-id="clause-style">
        想穿
        <label>
          <span class="visually-hidden">風格</span>
          <select @focus="capture" @pointerdown="capture" :value="filters.style" @change="setFilter('style', $event.target.value)">
            <option v-for="option in styleOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select> </label
        >，
      </span>
      <span class="clause" data-flip-id="clause-category">
        找
        <label>
          <span class="visually-hidden">類別</span>
          <select @focus="capture" @pointerdown="capture" :value="filters.category" @change="setFilter('category', $event.target.value)">
            <option v-for="option in CATEGORIES" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select> </label
        >，
      </span>
      <span class="clause" data-flip-id="clause-size">
        尺寸
        <label>
          <span class="visually-hidden">尺寸</span>
          <select @focus="capture" @pointerdown="capture" :value="filters.size" @change="setFilter('size', $event.target.value)">
            <option v-for="option in SIZES" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select> </label
        >。
      </span>
    </p>
  </section>
</template>

<style scoped>
.sentence {
  position: sticky;
  top: var(--header-h);
  z-index: 10;
  padding: var(--s2) var(--s3);
  background: var(--bg);
  border-bottom: 1px solid var(--line);
}

.line {
  max-width: var(--stage-max);
  margin-inline: auto;
  font-size: var(--fs-2);
  /* 句子換行時，每一列的下拉選單之間要留得出空隙 */
  line-height: 2.2;
}

.clause {
  display: inline-block;
  white-space: nowrap;
}

/* 每一格是真的下拉選單：鍵盤、讀屏、手機的原生選單都能用 */
select {
  /* 寬度跟著目前選到的字走，不是跟著最長的選項；不支援的瀏覽器會維持原本的寬度 */
  field-sizing: content;
  padding: 0 var(--s1);
  border: 0;
  border-bottom: 2px solid var(--accent);
  border-radius: 0;
  background: transparent;
  font-weight: 700;
  cursor: pointer;
}

.summary {
  display: flex;
  align-items: center;
  gap: var(--s2);
  width: 100%;
  max-width: var(--stage-max);
  margin-inline: auto;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.hint {
  color: var(--ink-soft);
  font-size: var(--fs-0);
  text-decoration: underline;
}

/* 窄螢幕的頂欄會換成兩列、高度不固定，這一列就不黏在頂欄下面，跟著內容捲走 */
@media (max-width: 48rem) {
  .sentence {
    position: static;
  }
}
</style>
