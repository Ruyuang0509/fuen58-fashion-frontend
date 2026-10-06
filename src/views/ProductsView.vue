<script setup>
// 單品列表（第十五輪子輪 3；取代第九輪的搜尋頁）。條件全在網址：
//   ?q=關鍵字 &category=outer &brand=wuan,banri &colour=grey,beige &price=lt2000 &size=S,M &stock=1 &sort=new
// 條件接在標題那句話裡，和一句話列同一個做法：「找〔外套〕，〔霧岸或半日〕的，〔灰或米駝〕色，〔兩千以下〕，尺寸〔S 或 M〕，〔只看有貨〕，照〔新上架〕排，共 N 件。」
// 品牌、顏色、尺寸可以多選；顏色是色系不是商品各自的色名（products/colourFamily.js）。沒有結果時不留空白，給同路線的單品。
import '@fontsource/space-mono/400.css'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getBrands, getProducts, getThemes } from '@/api'
import ClausePicker from '@/components/ClausePicker.vue'
import ProductCard from '@/components/ProductCard.vue'
import { listFrom, splitList } from '@/composables/useFilters'
import { rememberedTheme } from '@/composables/useThemeAccent'
import { PRICES, PRODUCT_CATEGORIES, SIZES, SORTS, STOCKS } from '@/filters/options'
import { COLOUR_FAMILIES } from '@/products/colourFamily'

const route = useRoute()
const router = useRouter()

const brands = ref([])
onMounted(async () => {
  try {
    brands.value = await getBrands()
  } catch {
    brands.value = []
  }
})
const brandOptions = computed(() => [{ value: '', label: '不限品牌', short: '' }, ...brands.value.map((brand) => ({ value: brand.code, label: brand.name, short: brand.name }))])
const colourOptions = [{ value: '', label: '不限顏色', short: '' }, ...COLOUR_FAMILIES.map((family) => ({ value: family.value, label: family.label, short: family.label, swatch: family.swatch }))]

// 網址 → 條件（不認得的值丟掉）
const one = (value) => (Array.isArray(value) ? value[0] : value) ?? ''
const keyword = computed(() => String(one(route.query.q)).trim())
const category = computed(() => (PRODUCT_CATEGORIES.some((option) => option.value === one(route.query.category)) ? one(route.query.category) : ''))
// 品牌清單是非同步來的，所以品牌代碼不對著清單驗，直接拆；不存在的代碼篩出來就是 0 件
const brandCodes = computed(() => splitList(route.query.brand))
const colours = computed(() => listFrom(route.query.colour, colourOptions))
const price = computed(() => PRICES.find((option) => option.value === one(route.query.price)) ?? PRICES[0])
const sizes = computed(() => listFrom(route.query.size, SIZES))
const inStock = computed(() => one(route.query.stock) === '1')
const sort = computed(() => (SORTS.some((option) => option.value === one(route.query.sort)) ? one(route.query.sort) : 'new'))
const filtered = computed(() => !!(keyword.value || category.value || brandCodes.value.length || colours.value.length || price.value.value || sizes.value.length || inStock.value))

// 調一格條件不該在瀏覽紀錄裡多一筆，所以 replace；排序是預設值就不寫進網址
function set(key, value) {
  const next = { ...route.query }
  const text = Array.isArray(value) ? value.join(',') : String(value ?? '')
  if (text && !(key === 'sort' && text === 'new')) next[key] = text
  else delete next[key]
  router.replace({ query: next })
}

const query = computed(() => ({
  q: keyword.value,
  category: category.value,
  brands: brandCodes.value,
  colours: colours.value,
  sizes: sizes.value,
  priceMin: price.value.min ?? undefined,
  priceMax: price.value.max ?? undefined,
  inStock: inStock.value,
  sort: sort.value,
}))

const results = ref([])
const suggested = ref([])
const suggestedTheme = ref(null)
const status = ref('loading')
let latest = 0

async function load() {
  const ticket = ++latest
  status.value = 'loading'
  try {
    const found = await getProducts(query.value)
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

watch(() => JSON.stringify(query.value), load, { immediate: true })
</script>

<template>
  <header class="head">
    <h1>{{ keyword ? '搜尋' : '單品' }}</h1>
    <p class="lead">
      <span v-if="keyword" class="clause">「{{ keyword }}」，</span>
      <span class="clause" data-slot="category">找 <ClausePicker label="類別" :options="PRODUCT_CATEGORIES" :model-value="category" @update:model-value="set('category', $event)" />，</span>
      <span class="clause" data-slot="brand"><ClausePicker label="品牌" :options="brandOptions" :model-value="brandCodes" multi @update:model-value="set('brand', $event)" /><template v-if="brandCodes.length">的</template>，</span>
      <span class="clause" data-slot="colour"><ClausePicker label="顏色" :options="colourOptions" :model-value="colours" multi @update:model-value="set('colour', $event)" /><template v-if="colours.length">色</template>，</span>
      <span class="clause" data-slot="price"><ClausePicker label="價格" :options="PRICES" :model-value="price.value" @update:model-value="set('price', $event)" />，</span>
      <span class="clause" data-slot="size">尺寸 <ClausePicker label="尺寸" :options="SIZES" :model-value="sizes" multi @update:model-value="set('size', $event)" />，</span>
      <span class="clause" data-slot="stock"><ClausePicker label="庫存" :options="STOCKS" :model-value="inStock ? '1' : ''" @update:model-value="set('stock', $event)" />，</span>
      <span class="clause" data-slot="sort">照 <ClausePicker label="排序" :options="SORTS" :model-value="sort" @update:model-value="set('sort', $event)" /> 排<template v-if="status === 'ready'">，<span class="total">共 {{ results.length }} 件</span></template>。</span>
    </p>
  </header>

  <p v-if="status === 'loading' && !results.length" class="state" aria-busy="true">載入中…</p>

  <div v-else-if="status === 'error'" class="state">
    <p>單品沒有載入成功。</p>
    <button type="button" class="btn" @click="load">再試一次</button>
  </div>

  <div v-else-if="results.length" class="grid" :class="{ busy: status === 'loading' }" :aria-busy="status === 'loading'">
    <ProductCard v-for="product in results" :key="product.productId" :product="product" />
  </div>

  <div v-else class="empty">
    <p v-if="keyword">找不到和「{{ keyword }}」有關、又符合這些條件的單品。可以換個說法、放寬條件，或直接看穿搭。</p>
    <p v-else>這組條件沒有符合的單品。放寬一兩格試試。</p>
    <div class="empty-actions">
      <RouterLink v-if="filtered" class="btn" :to="{ name: 'products' }">清除條件</RouterLink>
      <RouterLink class="btn" :to="{ name: 'outfits' }">看全部穿搭</RouterLink>
    </div>
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
  display: grid;
  gap: var(--s2);
  margin-block: var(--s3) var(--s4);
}

.head h1 {
  font-size: var(--fs-3);
}

.lead {
  color: var(--ink-soft);
  font-size: var(--fs-2);
  /* 句子換行時，每一列的格子之間要留得出空隙 */
  line-height: 2.1;
}

.clause {
  display: inline-block;
  white-space: nowrap;
}

.total {
  font-family: 'Space Mono', monospace;
  font-size: 0.85em;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: var(--s3);
  transition: opacity var(--ease);
}

.grid.busy {
  opacity: 0.6;
}

.state,
.empty {
  display: grid;
  justify-items: start;
  gap: var(--s2);
  padding: var(--s3) 0;
  color: var(--ink-soft);
}

.empty-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
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
