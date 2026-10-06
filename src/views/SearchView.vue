<script setup>
// 搜尋結果：關鍵字在網址（?q=），比對名稱、品牌、標籤、所屬主題。沒有結果時不留空白，給同路線的單品。
import '@fontsource/space-mono/400.css'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getProducts, getThemes, searchProducts } from '@/api'
import ProductCard from '@/components/ProductCard.vue'
import { rememberedTheme } from '@/composables/useThemeAccent'

const route = useRoute()
const keyword = computed(() => String(route.query.q ?? '').trim())
const results = ref([])
const suggested = ref([])
const suggestedTheme = ref(null)
const status = ref('ready')
let latest = 0

async function load() {
  const ticket = ++latest
  if (!keyword.value) {
    results.value = []
    status.value = 'ready'
    return
  }
  status.value = 'loading'
  try {
    const found = await searchProducts(keyword.value)
    if (ticket !== latest) return
    results.value = found
    if (!found.length) {
      // 推薦的路線：最近進過的主題；沒有就第一個
      const themes = await getThemes()
      const theme = themes.find((entry) => entry.code === rememberedTheme()) ?? themes[0]
      const items = theme ? await getProducts({ theme: theme.code }) : []
      if (ticket !== latest) return
      suggestedTheme.value = theme ?? null
      suggested.value = items.slice(0, 6)
    }
    status.value = 'ready'
  } catch {
    if (ticket === latest) status.value = 'error'
  }
}

watch(keyword, load, { immediate: true })
</script>

<template>
  <header class="head">
    <h1>搜尋</h1>
    <p v-if="keyword" class="lead">
      「{{ keyword }}」<template v-if="status === 'ready'">，{{ results.length }} 件單品</template>
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
    <p>找不到和「{{ keyword }}」有關的單品。可以換個說法，或直接看穿搭。</p>
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
