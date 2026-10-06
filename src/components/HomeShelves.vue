<script setup>
// 首頁下半的兩排單品（第十五輪；功能規劃 1.2 的「新品、熱銷各一排」是必做）。
// 只在首頁、穿搭格子之後：店不該在一片格子之後就結束。橫向可捲，一次看得到五到六件；「看全部」去單品頁照同一個排序排。
// 熱銷那排每張卡左上有一個大號等寬數字——排名用假資料的 sold 排，數字不當事實宣傳（規格 1.6）。
import '@fontsource/space-mono/400.css'
import { onMounted, ref } from 'vue'
import { getProducts } from '@/api'
import ProductCard from '@/components/ProductCard.vue'

const fresh = ref([])
const popular = ref([])
const status = ref('loading')

onMounted(async () => {
  try {
    const [newest, hottest] = await Promise.all([getProducts({ sort: 'new' }), getProducts({ sort: 'popular' })])
    fresh.value = newest.slice(0, 8)
    popular.value = hottest.slice(0, 8)
    status.value = 'ready'
  } catch {
    status.value = 'error'
  }
})
</script>

<template>
  <section v-if="status === 'ready'" class="shelves" aria-label="單品">
    <div class="shelf">
      <header class="shelf-head">
        <h2>新上架</h2>
        <RouterLink :to="{ name: 'search', query: { sort: 'new' } }">看全部</RouterLink>
      </header>
      <div class="row">
        <ProductCard v-for="product in fresh" :key="product.productId" :product="product" />
      </div>
    </div>

    <div class="shelf">
      <header class="shelf-head">
        <h2>熱銷</h2>
        <RouterLink :to="{ name: 'search', query: { sort: 'popular' } }">看全部</RouterLink>
      </header>
      <ol class="row ranked">
        <li v-for="(product, i) in popular" :key="product.productId">
          <span class="rank" aria-hidden="true">{{ i + 1 }}</span>
          <ProductCard :product="product" />
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.shelves {
  display: grid;
  gap: var(--s5);
  margin-top: var(--s5);
}

/* grid item 預設不能比內容窄：橫向可捲的那一排會把整頁撐出 600px（實測），要放它縮 */
.shelf {
  min-width: 0;
}

.shelf-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s2);
  margin-bottom: var(--s3);
}

.shelf-head h2 {
  margin: 0;
  font-size: var(--fs-2);
  font-weight: 400;
  letter-spacing: 0.12em;
  color: var(--ink-soft);
}

.shelf-head a {
  color: var(--ink);
  font-size: var(--fs-0);
  letter-spacing: 0.1em;
  text-decoration: none;
  border-bottom: 1px solid currentColor;
  padding-bottom: 0.1rem;
}

/* 一排橫向可捲：每張卡寬度固定，捲到卡的邊緣停 */
.row {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: clamp(10rem, 18vw, 13rem);
  gap: var(--s3);
  margin: 0;
  padding: 0 0 var(--s2);
  list-style: none;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
}

.row > * {
  scroll-snap-align: start;
}

.ranked li {
  position: relative;
}

.rank {
  position: absolute;
  top: -0.25rem;
  left: 0.5rem;
  z-index: 1;
  font-family: 'Space Mono', monospace;
  font-size: var(--fs-3);
  line-height: 1;
  color: var(--ink);
}
</style>
