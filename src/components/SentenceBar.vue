<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getThemes } from '@/api'
import ClausePicker from '@/components/ClausePicker.vue'
import { useFilters } from '@/composables/useFilters'
import { AUDIENCES, CATEGORIES, OCCASIONS, SIZES } from '@/filters/options'
import { Flip, reducedMotion } from '@/motion/gsap'
import { useWeather } from '@/stores/weather'

// offset：這一列上方還有多高的東西（首頁的天空），收合的門檻從那裡起算
const props = defineProps({
  offset: { type: Number, default: 0 },
})

const { filters, setFilter } = useFilters()
const themes = ref([])
// 天氣讀整站共用的那一份（第十六輪子輪 1）：換縣市、拿到真的天氣時，這裡的第一格跟著變
const { weather } = useWeather()

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
// 第十五輪子輪 3 的格子是自己做的（ClausePicker），所以在「送出新值之前」記位置就好；多選時每勾一個都記一次、動一次。
const line = ref(null)
let before = null
function capture() {
  if (reducedMotion() || !line.value) return
  before = Flip.getState(line.value.querySelectorAll('.clause'))
}
function change(key, value) {
  capture()
  setFilter(key, value)
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
  // 主題拿不到時風格那一格只剩「不限」；天氣由 store 管（拿不到會退到示範值，句子不會少一段）
  try {
    themes.value = await getThemes()
  } catch {
    themes.value = []
  }
})

onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

const styleOptions = computed(() => [
  { value: '', label: '什麼風格都好', short: '' },
  ...themes.value.map((theme) => ({ value: theme.code, label: theme.name, short: theme.name })),
])

// 收合成一行時的短稱；多選的用「／」連
const shortOf = (options, value) => [].concat(value).map((entry) => options.find((option) => option.value === entry)?.short ?? '').filter(Boolean).join('／')

// 第一格（第十六輪子輪 1）：「今天 24°C」或「合今天 24°C 的」——後者會篩掉會冷、太厚的穿搭（?fit=today）
const fitOptions = computed(() => [
  { value: '', label: `今天 ${weather.value?.temperature}°C`, short: '' },
  { value: 'today', label: `合今天 ${weather.value?.temperature}°C 的`, short: '合今天' },
])

const summary = computed(() => {
  const parts = [
    weather.value ? `${filters.value.fit ? '合今天 ' : ''}${weather.value.temperature}°C` : '',
    shortOf(AUDIENCES, filters.value.audience),
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
      <!-- 每個 clause 是一個不換行的小段，標點跟著前面的字走，不會掉到下一列的開頭；data-flip-id 給重排的動畫對位置。
           場合、類別、尺寸可以多選（句子讀成「上班或約會」）；給誰穿、風格單選 -->
      <span v-if="weather" class="clause" data-flip-id="clause-weather">
        <ClausePicker label="天氣" :options="fitOptions" :model-value="filters.fit" @update:model-value="change('fit', $event)" />，
      </span>
      <span class="clause" data-flip-id="clause-audience">
        <ClausePicker label="給誰穿" :options="AUDIENCES" :model-value="filters.audience" @update:model-value="change('audience', $event)" />，
      </span>
      <span class="clause" data-flip-id="clause-occasion">
        <ClausePicker label="場合" :options="OCCASIONS" :model-value="filters.occasion" multi @update:model-value="change('occasion', $event)" />，
      </span>
      <span class="clause" data-flip-id="clause-style">
        想穿
        <ClausePicker label="風格" :options="styleOptions" :model-value="filters.style" @update:model-value="change('style', $event)" />，
      </span>
      <span class="clause" data-flip-id="clause-category">
        找
        <ClausePicker label="類別" :options="CATEGORIES" :model-value="filters.category" multi @update:model-value="change('category', $event)" />，
      </span>
      <span class="clause" data-flip-id="clause-size">
        尺寸
        <ClausePicker label="尺寸" :options="SIZES" :model-value="filters.size" multi @update:model-value="change('size', $event)" />。
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
