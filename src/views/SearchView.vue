<script setup>
// 搜尋結果：關鍵字、排序、只看有貨都在網址（?q=&sort=&stock=1）；比對名稱、品牌、標籤、所屬主題。
// 排序與篩選不做側邊欄，接在標題那句話裡（和一句話列同一個做法）。沒有結果時不留空白，給同路線的單品。
import '@fontsource/space-mono/400.css'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getProducts, getThemes, searchProducts } from '@/api'
import ProductCard from '@/components/ProductCard.vue'
import { rememberedTheme } from '@/composables/useThemeAccent'

const SORTS = [
  { value: 'new', label: '新上架' },
  { value: 'popular', label: '熱銷' },
  { value: 'price-asc', label: '價格低到高' },
  { value: 'price-desc', label: '價格高到低' },
]

const route = useRoute()
const router = useRouter()
const one = (value) => (Array.isArray(value) ? value[0] : value) ?? ''
const keyword = computed(() => String(one(route.query.q)).trim())
const sort = computed(() => (SORTS.some((option) => option.value === one(route.query.sort)) ? one(route.query.sort) : 'new'))
const inStock = computed(() => one(route.query.stock) === '1')
const query = computed(() => ({ keyword: keyword.value, sort: sort.value, inStock: inStock.value }))

const results = ref([])
const suggested = ref([])
const suggestedTheme = ref(null)
const status = ref('ready')
let latest = 0

// 調一格條件不該在瀏覽紀錄裡多一筆，所以 replace
function setQuery(key, value) {
  const next = { ...route.query }
  if (value) next[key] = value
  else delete next[key]
  router.replace({ query: next })
}

async function load() {
  const ticket = ++latest
  if (!keyword.value) {
    results.value = []
    status.value = 'ready'
    return
  }
  status.value = 'loading'
  try {
    const found = await searchProducts(keyword.value, { sort: sort.value, inStock: inStock.value })
    if (ticket !== latest) return
    results.value = found
    if (!found.length) {
      // 推薦的路線：最近進過的主題；沒有就第一個
      const themes = await getThemes()
      const theme = themes.find((entry) => entry.code === rememberedTheme()) ?? themes[0]
      const items = theme ? await getProducts({ theme: theme.code, sort: 'new' }) : []
      if (ticket !== latest) return
      suggestedTheme.value = theme ?? null
      suggested.value = items.slice(0, 6)
    }
    status.value = 'ready'
  } catch {
    if (ticket === latest) status.value = 'error'
  }
}

watch(query, load, { immediate: true })
</script>

<template>
  <header class="head">
    <h1>搜尋</h1>
    <p v-if="keyword" class="lead">
      <span class="clause">「{{ keyword }}」<template v-if="status === 'ready'">，{{ results.length }} 件單品</template>，</span>
      <span class="clause">
        照
        <label>
          <span class="visually-hidden">排序</span>
          <select :value="sort" @change="setQuery('sort', $event.target.value === 'new' ? '' : $event.target.value)">
            <option v-for="option in SORTS" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        排，
      </span>
      <span class="clause">
        <label>
          <span class="visually-hidden">庫存</span>
          <select :value="inStock ? '1' : ''" @change="setQuery('stock', $event.target.value)">
            <option value="">有貨沒貨都看</option>
            <option value="1">只看有貨</option>
          </select>
        </label>
        。
      </span>
    </p>
    <p v-else class="lead">在上面的搜尋框輸入單品、品牌或路線的名字。</p>
  </header>

  <p v-if="status === 'loading'" class="state" aria-busy="true">搜尋中…</p>

  <div v-else-if="status === 'error'" class="state">
    <p>搜尋沒有成功。</p>
    <button type="button" class="btn" @click="load">再試一次</button>
  </div>

  <div v-else-if="results.length" class="grid">
    <ProductCard v-for="product in results" :key="product.productId" :product="product" />
  </div>

  <div v-else-if="keyword" class="empty">
    <p v-if="inStock">「{{ keyword }}」有關的單品現在都沒有貨。可以把「只看有貨」關掉，或直接看穿搭。</p>
    <p v-else>找不到和「{{ keyword }}」有關的單品。可以換個說法，或直接看穿搭。</p>
    <RouterLink class="btn" :to="{ name: 'outfits' }">看全部穿搭</RouterLink>
    <template v-if="suggested.length">
      <h2 class="section-title">
        <RouterLink :to="{ name: 'theme', params: { code: suggestedTheme.code } }">{{ suggestedTheme.name }}</RouterLink>路線的單品
      </h2>
      <div class="grid">
        <ProductCard v-for="product in suggested" :key="product.productId" :product="product" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--s2) var(--s3);
  margin-block: var(--s3) var(--s4);
}

.head h1 {
  font-size: var(--fs-3);
}

.lead {
  color: var(--ink-soft);
  font-size: var(--fs-2);
  line-height: 2;
}

.clause {
  display: inline-block;
  white-space: nowrap;
}

/* 和一句話列同一種下拉選單：只剩一條底線，寬度跟著選到的字 */
select {
  field-sizing: content;
  padding: 0 var(--s1);
  border: 0;
  border-bottom: 2px solid var(--accent);
  border-radius: 0;
  background: transparent;
  color: var(--ink);
  font-weight: 700;
  cursor: pointer;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: var(--s3);
}

.state,
.empty {
  display: grid;
  justify-items: start;
  gap: var(--s2);
  padding: var(--s3) 0;
  color: var(--ink-soft);
}

.empty .grid {
  width: 100%;
  color: var(--ink);
}

.section-title {
  margin-top: var(--s4);
  font-size: var(--fs-2);
  font-weight: 400;
  letter-spacing: 0.12em;
}

.section-title a {
  color: var(--ink);
  text-underline-offset: 0.3em;
}
</style>
