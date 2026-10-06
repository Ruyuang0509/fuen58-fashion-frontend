<script setup>
import { computed, ref, watch } from 'vue'
import { getOutfits, getThemes } from '@/api'
import CampaignTile from '@/components/CampaignTile.vue'
import OutfitCard from '@/components/OutfitCard.vue'
import { useFilters } from '@/composables/useFilters'

const props = defineProps({
  // 舞台裡要插的活動（第十五輪）：最多兩張，插在第 3 張與第 9 張穿搭之後
  campaigns: { type: Array, default: () => [] },
  // 只列這幾套（活動頁）；null 代表不限
  ids: { type: Array, default: null },
  // 外面還在等資料（活動頁還沒拿到活動）：先顯示載入中，不要閃一下「沒有符合的穿搭」
  waiting: { type: Boolean, default: false },
})

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
  if (props.waiting) return
  const ticket = ++latest
  status.value = 'loading'
  try {
    const query = props.ids ? { ...filters.value, ids: props.ids } : filters.value
    const [outfitList, themeList] = await Promise.all([getOutfits(query), getThemes()])
    if (ticket !== latest) return
    outfits.value = outfitList
    themes.value = themeList
    status.value = 'ready'
    emit('count', outfitList.length)
  } catch {
    if (ticket === latest) status.value = 'error'
  }
}

// 網址上的條件、要列哪幾套一變就重新要資料；immediate 讓元件一出現就先要一次
watch([filters, () => props.ids, () => props.waiting], load, { immediate: true })

// 穿搭卡與活動插卡排成一列格子：第 n 張插卡放在第 AFTER[n] 張穿搭之後（穿搭不夠就放在最後）。
// 格子的寬度循環照常套在插卡身上，它看起來就像雜誌裡的夾頁，不是另開一條橫幅。
// 4 與 10 不是隨便挑的：寬度循環是 4-5-3／3-5-4，第 5 格與第 11 格都是最寬的那格（span 5），插卡落在那裡才放得下字和人形
const AFTER = [4, 10]
const cells = computed(() => {
  const cards = outfits.value
  if (!cards.length) return []
  const tiles = props.campaigns.slice(0, AFTER.length)
  const out = []
  let next = 0
  cards.forEach((outfit, i) => {
    out.push({ key: `outfit-${outfit.id}`, outfit })
    while (next < tiles.length && i + 1 === Math.min(AFTER[next], cards.length)) {
      out.push({ key: `campaign-${tiles[next].code}`, campaign: tiles[next] })
      next += 1
    }
  })
  return out
})

const propsFor = (cell) => (cell.outfit
  ? { outfit: cell.outfit, themeName: themeNames.value[cell.outfit.themeCode] ?? '', preferredSize: filters.value.size }
  : { campaign: cell.campaign })
</script>

<template>
  <section aria-label="穿搭" :aria-busy="status === 'loading' || waiting">
    <p v-if="(status === 'loading' || waiting) && !outfits.length" class="state">載入中…</p>

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
      <component
        :is="cell.outfit ? OutfitCard : CampaignTile"
        v-for="(cell, i) in cells"
        :key="cell.key"
        v-bind="propsFor(cell)"
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

/* grid item 預設的最小寬度是內容的最小寬度：插卡標題（全站 h3 是 keep-all）會把 12 條 1fr 軌道一起撐寬，
   手機上整列卡片變成 563px、跑出 390 的視窗（實測）。放每個格子縮到軌道的寬度，字在格子裡自己換行 */
.grid > * {
  min-width: 0;
}

/* 插卡撐滿那一列的高度（卡片各自高矮不一、對齊頂端）：夾頁應該是一整頁，不是一塊浮在半空的小方塊 */
.grid > .campaign-tile {
  align-self: stretch;
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

/* 中等寬度：兩張一列。欄距縮小：12 欄有 11 條欄距，3.2rem 的欄距加起來 563px，600px 寬的畫面放不下 */
@media (max-width: 64rem) {
  .grid {
    column-gap: var(--s3);
  }

  .grid > :nth-child(n) {
    grid-column: span 6;
  }
}

/* 窄螢幕：一張一列。欄距歸零——不然 11 條欄距就比 390px 的視窗寬，軌道塌成 0、每張卡都變 563px（第十五輪實測） */
@media (max-width: 36rem) {
  .grid {
    gap: var(--s4) 0;
  }

  .grid > :nth-child(n) {
    grid-column: span 12;
  }
}
</style>
