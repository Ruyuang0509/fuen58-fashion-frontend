<script setup>
// 「最近看過」一排（第十五輪子輪 2）：商品頁放單品、穿搭頁放穿搭，排除正在看的這一件，最多 8 筆。
// 資料來自本機的瀏覽紀錄（stores/history.js）；沒有紀錄時整段不出現。
import { computed, ref, watch } from 'vue'
import { getOutfits, getProducts } from '@/api'
import OutfitLook from '@/components/OutfitLook.vue'
import ProductCard from '@/components/ProductCard.vue'
import { useHistory } from '@/stores/history'

const props = defineProps({
  kind: { type: String, required: true }, // products | outfits
  exclude: { type: Number, default: null },
  title: { type: String, default: '最近看過' },
})

const history = useHistory()
const ids = computed(() => history[props.kind].value.map((entry) => entry.id).filter((id) => id !== props.exclude).slice(0, 8))
const items = ref([])

let latest = 0
watch(
  () => ids.value.join(','),
  async () => {
    const ticket = ++latest
    if (!ids.value.length) {
      items.value = []
      return
    }
    try {
      const list = props.kind === 'products' ? await getProducts({ ids: ids.value }) : await getOutfits({ ids: ids.value })
      if (ticket === latest) items.value = list
    } catch {
      if (ticket === latest) items.value = []
    }
  },
  { immediate: true },
)
</script>

<template>
  <section v-if="items.length" class="recent" :aria-label="title">
    <h2 class="section-title">{{ title }}</h2>
    <div class="row">
      <template v-if="kind === 'products'">
        <ProductCard v-for="product in items" :key="product.productId" :product="product" />
      </template>
      <template v-else>
        <RouterLink v-for="outfit in items" :key="outfit.id" :to="{ name: 'outfit', params: { id: outfit.id } }" class="look-link">
          <OutfitLook :outfit="outfit" :height="220" />
        </RouterLink>
      </template>
    </div>
  </section>
</template>

<style scoped>
.recent {
  margin-top: var(--s4);
}

.section-title {
  margin-bottom: var(--s3);
  font-size: var(--fs-2);
  font-weight: 400;
  letter-spacing: 0.12em;
  color: var(--ink-soft);
}

/* 一排橫向可捲（和首頁的兩排單品同一個做法） */
.row {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: clamp(10rem, 18vw, 13rem);
  gap: var(--s3);
  padding-bottom: var(--s2);
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
}

.row > * {
  scroll-snap-align: start;
}

.look-link {
  color: inherit;
  text-decoration: none;
  transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.look-link:hover {
  transform: translateY(-6px);
}

@media (prefers-reduced-motion: reduce) {
  .look-link {
    transition: none;
  }
}
</style>
