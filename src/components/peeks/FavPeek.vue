<script setup>
// 收藏預覽：幾件單品、幾套穿搭，最近收的四件單品的圖（點了到商品頁），看全部收藏。
import { computed, ref, watch } from 'vue'
import { getProducts } from '@/api'
import GarmentImage from '@/components/GarmentImage.vue'
import { useFavorites } from '@/stores/favorites'

const favorites = useFavorites()
const recent = computed(() => favorites.products.value.slice(0, 4))
const details = ref(new Map())

let latest = 0
watch(
  () => recent.value.map((entry) => entry.productId).join(','),
  async () => {
    const ids = recent.value.map((entry) => entry.productId)
    if (!ids.length) return
    const ticket = ++latest
    try {
      const list = await getProducts({ ids })
      if (ticket === latest) details.value = new Map(list.map((product) => [product.productId, product]))
    } catch {
      // 拿不到圖就只顯示文字
    }
  },
  { immediate: true },
)

const colourOf = (entry) => {
  const product = details.value.get(entry.productId)
  return product ? (product.colours.find((colour) => colour.code === entry.colour) ?? product.colours[0]) : null
}
</script>

<template>
  <div class="fav-peek">
    <template v-if="favorites.count.value">
      <p class="peek-title">收藏了 {{ favorites.products.value.length }} 件單品、{{ favorites.outfits.value.length }} 套穿搭</p>
      <ul v-if="recent.length" class="thumbs">
        <li v-for="entry in recent" :key="entry.productId">
          <RouterLink v-if="details.get(entry.productId)" :to="{ name: 'product', params: { id: entry.productId }, query: { colour: colourOf(entry).code } }" :title="details.get(entry.productId).name">
            <GarmentImage :kind="details.get(entry.productId).kind" :colour="colourOf(entry).hex" :fabric="details.get(entry.productId).fabric" :height="64" :alt="details.get(entry.productId).name" />
          </RouterLink>
        </li>
      </ul>
      <RouterLink class="btn" :to="{ name: 'favorites' }">看全部收藏</RouterLink>
    </template>
    <template v-else>
      <p class="peek-title">還沒有收藏。</p>
      <p class="hint">逛的時候按愛心，單品和整套穿搭都能收；不用登入。</p>
      <RouterLink class="btn" :to="{ name: 'outfits' }">看全部穿搭</RouterLink>
    </template>
  </div>
</template>

<style scoped>
.peek-title {
  margin: 0 0 var(--s2);
  font-weight: 700;
}

.thumbs {
  display: flex;
  gap: var(--s2);
  margin: 0 0 var(--s2);
  padding: 0;
  list-style: none;
}

.thumbs a {
  display: grid;
  place-items: center;
  width: 3.4rem;
  height: 4rem;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--accent) 10%, white);
}

.thumbs :deep(img) {
  max-width: 100%;
  height: auto;
}

.hint {
  margin: 0 0 var(--s2);
  color: var(--ink-soft);
}

.btn {
  padding: 0.45rem 1rem;
  font-size: var(--fs-0);
}
</style>
