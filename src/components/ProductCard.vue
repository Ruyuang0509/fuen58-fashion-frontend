<script setup>
// 單品格的一張卡：圖、品牌、名稱、價格、有幾個顏色。整張是連到商品頁的連結。
import { computed } from 'vue'
import GarmentImage from '@/components/GarmentImage.vue'
import { formatPrice } from '@/products/labels'
import { accentOf } from '@/theme/themes'

const props = defineProps({
  product: { type: Object, required: true },
})

const first = computed(() => props.product.colours[0])
const accent = computed(() => accentOf(props.product.themeCodes[0]))
</script>

<template>
  <RouterLink :to="{ name: 'product', params: { id: product.productId } }" class="card" :style="{ '--card-accent': accent }">
    <div class="photo">
      <GarmentImage :kind="product.kind" :colour="first.hex" :fabric="product.fabric" :height="200" />
    </div>
    <p class="brand">{{ product.brand }}</p>
    <h3 class="name">{{ product.name }}</h3>
    <p class="meta">
      <span class="num">{{ formatPrice(product.price) }}</span>
      <span v-if="product.colours.length > 1" class="colours" :aria-label="`${product.colours.length} 色`">
        <i v-for="colour in product.colours" :key="colour.code" :style="{ background: colour.hex }"></i>
      </span>
    </p>
  </RouterLink>
</template>

<style scoped>
.card {
  display: grid;
  gap: var(--s1);
  color: inherit;
  text-decoration: none;
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
.card:focus-visible .photo {
  background: color-mix(in srgb, var(--card-accent) 18%, white);
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
