<script setup>
// 品牌頁：一句介紹加上這個品牌的全部單品（功能規劃 3.2「品牌頁沿用列表元件，加上品牌介紹」）。品牌一律虛構。
import '@fontsource/noto-serif-tc/600.css'
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getBrand, getProducts } from '@/api'
import ProductCard from '@/components/ProductCard.vue'

const route = useRoute()
const brand = ref(null)
const products = ref([])
const status = ref('loading') // loading | ready | missing | error
let latest = 0

async function load(code) {
  const ticket = ++latest
  status.value = 'loading'
  try {
    const [found, list] = await Promise.all([getBrand(code), getProducts({ brand: code, sort: 'new' })])
    if (ticket !== latest) return
    brand.value = found
    products.value = list
    status.value = found ? 'ready' : 'missing'
  } catch {
    if (ticket === latest) status.value = 'error'
  }
}

watch(() => route.params.id, load, { immediate: true })
</script>

<template>
  <template v-if="status === 'ready'">
    <header class="head">
      <p class="eyebrow">品牌</p>
      <h1>{{ brand.name }}</h1>
      <p class="intro">{{ brand.intro }}</p>
      <p class="soft">自 {{ brand.since }} 年</p>
    </header>
    <section aria-label="這個品牌的單品">
      <h2 class="section-title">全部單品，{{ products.length }} 件</h2>
      <p v-if="!products.length" class="soft">這個品牌目前沒有上架的單品。</p>
      <div v-else class="grid">
        <ProductCard v-for="product in products" :key="product.productId" :product="product" />
      </div>
    </section>
  </template>

  <p v-else-if="status === 'loading'" class="state">載入中…</p>

  <div v-else-if="status === 'error'" class="state">
    <p>品牌沒有載入成功。</p>
    <button type="button" class="btn" @click="load(route.params.id)">再試一次</button>
  </div>

  <div v-else class="state">
    <h1>找不到這個品牌</h1>
    <RouterLink class="btn" :to="{ name: 'outfits' }">看全部穿搭</RouterLink>
  </div>
</template>

<style scoped>
.head {
  display: grid;
  gap: var(--s1);
  max-width: 36em;
  margin-block: var(--s3) var(--s4);
}

.eyebrow,
.soft {
  color: var(--ink-soft);
  font-size: var(--fs-0);
  letter-spacing: 0.1em;
}

.head h1 {
  font-family: 'Noto Serif TC', serif;
  font-size: var(--fs-4);
  font-weight: 600;
}

.intro {
  margin-top: var(--s1);
  font-size: var(--fs-2);
  line-height: 1.6;
}

.section-title {
  margin-bottom: var(--s3);
  font-size: var(--fs-2);
  font-weight: 400;
  letter-spacing: 0.12em;
  color: var(--ink-soft);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: var(--s3);
}

.state {
  display: grid;
  justify-items: start;
  gap: var(--s2);
  padding: var(--s4) 0;
  color: var(--ink-soft);
}

.state h1 {
  color: var(--ink);
}
</style>
