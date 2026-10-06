<script setup>
import { computed, ref, watch } from 'vue'
import { getOutfits, getThemes } from '@/api'
import OutfitCard from '@/components/OutfitCard.vue'
import { useFilters } from '@/composables/useFilters'

// count：目前有幾套（外面的標題會說「N 套」）
const emit = defineEmits(['count'])

const { filters } = useFilters()
const outfits = ref([])
const themes = ref([])
// 每個要資料的畫面都有三種狀態：載入中、有結果（可能是空的）、出錯
const status = ref('loading')

const themeNames = computed(() => Object.fromEntries(themes.value.map((theme) => [theme.code, theme.name])))

// 條件連續變動時，先送出的請求可能比較晚回來；只採用最後一次送出的結果
let latest = 0

async function load() {
  const ticket = ++latest
  status.value = 'loading'
  try {
    const [outfitList, themeList] = await Promise.all([getOutfits(filters.value), getThemes()])
    if (ticket !== latest) return
    outfits.value = outfitList
    themes.value = themeList
    status.value = 'ready'
    emit('count', outfitList.length)
  } catch {
    if (ticket === latest) status.value = 'error'
  }
}

// 網址上的條件一變就重新要資料；immediate 讓元件一出現就先要一次
watch(filters, load, { immediate: true })
</script>

<template>
  <section aria-label="穿搭" :aria-busy="status === 'loading'">
    <p v-if="status === 'loading' && !outfits.length" class="state">載入中…</p>

    <div v-else-if="status === 'error'" class="state">
      <p>穿搭沒有載入成功。</p>
      <button type="button" class="btn" @click="load">再試一次</button>
    </div>

    <div v-else-if="status === 'ready' && outfits.length === 0" class="state">
      <p>這組條件沒有符合的穿搭。</p>
      <RouterLink class="btn" :to="{ name: 'outfits' }">看全部穿搭</RouterLink>
    </div>

    <!-- 改條件時卡片重新排列有位移過程（功能規劃 9），不是整頁閃換 -->
    <TransitionGroup v-else name="card" tag="div" class="grid" :class="{ busy: status === 'loading' }">
      <OutfitCard
        v-for="(outfit, i) in outfits"
        :key="outfit.id"
        :outfit="outfit"
        :theme-name="themeNames[outfit.themeCode] ?? ''"
        :preferred-size="filters.size"
        :style="{ '--i': i }"
      />
    </TransitionGroup>
  </section>
</template>

<style scoped>
.state {
  display: grid;
  justify-items: start;
  gap: var(--s2);
  padding: var(--s4) 0;
  color: var(--ink-soft);
}

/* 12 欄格線，卡片寬度每六張循環一次：4-5-3／3-5-4，不是整齊的等寬格 */
.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--s5) var(--s4);
  align-items: start;
  transition: opacity var(--ease);
}

.grid.busy {
  opacity: 0.6;
}

.grid > :nth-child(6n + 1),
.grid > :nth-child(6n + 6) {
  grid-column: span 4;
}

.grid > :nth-child(6n + 2),
.grid > :nth-child(6n + 5) {
  grid-column: span 5;
}

.grid > :nth-child(6n + 3),
.grid > :nth-child(6n + 4) {
  grid-column: span 3;
}

.card-move {
  transition: transform 0.55s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.card-enter-active {
  transition: opacity 0.5s ease calc(var(--i, 0) * 0.05s), transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) calc(var(--i, 0) * 0.05s);
}

.card-enter-from {
  opacity: 0;
  transform: translateY(18px);
}

/* 離開的卡片直接拿掉：留著會把格線撐亂 */
.card-leave-active {
  display: none;
}

/* 中等寬度：兩張一列 */
@media (max-width: 64rem) {
  .grid > :nth-child(n) {
    grid-column: span 6;
  }
}

/* 窄螢幕：一張一列 */
@media (max-width: 36rem) {
  .grid {
    gap: var(--s4);
  }

  .grid > :nth-child(n) {
    grid-column: span 12;
  }
}
</style>
