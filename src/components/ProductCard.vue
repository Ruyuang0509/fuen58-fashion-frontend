<script setup>
// 單品格的一張卡：圖、品牌、名稱、價格、有幾個顏色，右上角一顆收藏的愛心。
// 第十五輪子輪 2 把根元素從 <a> 改成 <article>：按鈕不能放在連結裡；圖和名稱各自是連到商品頁的連結。
import { computed } from 'vue'
import FavButton from '@/components/FavButton.vue'
import GarmentImage from '@/components/GarmentImage.vue'
import { formatPrice } from '@/products/labels'
import { accentOf } from '@/theme/themes'

const props = defineProps({
  product: { type: Object, required: true },
})

const first = computed(() => props.product.colours[0])
const accent = computed(() => accentOf(props.product.themeCodes[0]))
const to = computed(() => ({ name: 'product', params: { id: props.product.productId } }))
</script>

<template>
  <article class="card" :style="{ '--card-accent': accent }">
    <RouterLink :to="to" class="photo" :aria-label="`看這件：${product.name}`">
      <GarmentImage :kind="product.kind" :colour="first.hex" :fabric="product.fabric" :height="200" />
    </RouterLink>
    <FavButton class="card-fav" kind="products" :id="product.productId" :colour="first.code" :name="product.name" />
    <p class="brand">{{ product.brand }}</p>
    <h3 class="name"><RouterLink :to="to" class="name-link">{{ product.name }}</RouterLink></h3>
    <p class="meta">
      <span class="num">{{ formatPrice(product.price) }}</span>
      <span v-if="product.colours.length > 1" class="colours" :aria-label="`${product.colours.length} 色`">
        <i v-for="colour in product.colours" :key="colour.code" :style="{ background: colour.hex }"></i>
      </span>
    </p>
  </article>
</template>

<style scoped>
.card {
  position: relative;
  display: grid;
  gap: var(--s1);
  color: inherit;
}

.photo {
  display: grid;
  place-items: center;
  aspect-ratio: 4 / 5;
  padding: var(--s2);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--card-accent) 12%, white);
  transition: background-color var(--ease);
}

.card:hover .photo,
.photo:focus-visible {
  background: color-mix(in srgb, var(--card-accent) 18%, white);
}

.photo:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* 愛心在圖的右上角：滑過卡片才出現；已收藏的一直在；觸控裝置沒有滑過，所以一直在 */
.card-fav {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  opacity: 0;
  transition: opacity var(--ease), border-color var(--ease), color var(--ease);
}

.card:hover .card-fav,
.card:focus-within .card-fav,
.card-fav.on {
  opacity: 1;
}

@media (hover: none) {
  .card-fav {
    opacity: 1;
  }
}

.brand {
  margin-top: var(--s1);
  color: var(--ink-soft);
  font-size: var(--fs-0);
  letter-spacing: 0.08em;
}

.name {
  font-size: var(--fs-1);
  font-weight: 500;
}

/* 名稱連結：底線從左畫出來（和穿搭卡同一套） */
.name-link {
  color: inherit;
  text-decoration: none;
  background-image: linear-gradient(currentColor, currentColor);
  background-repeat: no-repeat;
  background-size: 0 1px;
  background-position: 0 100%;
  transition: background-size 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.card:hover .name-link,
.name-link:focus-visible {
  background-size: 100% 1px;
}

.meta {
  display: flex;
  align-items: center;
  gap: var(--s2);
}

.num {
  font-family: 'Space Mono', monospace;
  font-size: var(--fs-0);
  letter-spacing: -0.02em;
}

/* 顏色點：純資訊，不是可按的 */
.colours {
  display: inline-flex;
  gap: 0.25rem;
}

.colours i {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  border: 1px solid rgba(31, 29, 26, 0.25);
}
</style>
