<script setup>
// 收藏頁（第十五輪子輪 2）。交易區、不需要登入：訪客的收藏存在這個瀏覽器，登入後會併進帳號。
// 單品可以直接選尺寸加入購物車（功能規劃 2「收藏清單：收藏商品、移除、直接加入購物車」）；穿搭連到穿搭頁整套加。
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { getOutfits, getProducts } from '@/api'
import AccountNav from '@/components/AccountNav.vue'
import GarmentImage from '@/components/GarmentImage.vue'
import OutfitCard from '@/components/OutfitCard.vue'
import { useFlyToCart } from '@/composables/useFlyToCart'
import { formatPrice } from '@/products/labels'
import { useCart } from '@/stores/cart'
import { useFavorites } from '@/stores/favorites'
import { useSession } from '@/stores/session'

const favorites = useFavorites()
const { loggedIn } = useSession()
const { add } = useCart()
const { fly } = useFlyToCart()

const products = ref([]) // 收藏的單品（商品細節）
const outfits = ref([]) // 收藏的穿搭（展開後）
const status = ref('loading')
const sizes = reactive({}) // productId → 選的尺寸
const errors = reactive({}) // productId → 錯誤訊息
const feedback = ref('')
let feedbackTimer = 0

const productIds = computed(() => favorites.products.value.map((entry) => entry.productId))
const outfitIds = computed(() => favorites.outfits.value.map((entry) => entry.outfitId))
const colourOf = (product) => {
  const wanted = favorites.products.value.find((entry) => entry.productId === product.productId)?.colour
  return product.colours.find((colour) => colour.code === wanted) ?? product.colours[0]
}
const stockOf = (product, size) => product.stock?.[`${colourOf(product).code}-${size}`] ?? 0
const empty = computed(() => status.value === 'ready' && !products.value.length && !outfits.value.length)

let latest = 0
async function load() {
  const ticket = ++latest
  try {
    const [productList, outfitList] = await Promise.all([
      productIds.value.length ? getProducts({ ids: productIds.value }) : [],
      outfitIds.value.length ? getOutfits({ ids: outfitIds.value }) : [],
    ])
    if (ticket !== latest) return
    products.value = productList
    outfits.value = outfitList
    for (const product of productList) {
      if (!(product.productId in sizes)) sizes[product.productId] = product.sizes.length === 1 ? product.sizes[0] : ''
    }
    status.value = 'ready'
  } catch {
    if (ticket === latest) status.value = 'error'
  }
}
watch(() => [productIds.value.join(','), outfitIds.value.join(',')].join('|'), load, { immediate: true })

function addToCart(product, event) {
  const size = sizes[product.productId]
  if (!size) {
    errors[product.productId] = '請先選尺寸。'
    return
  }
  errors[product.productId] = ''
  const colour = colourOf(product)
  add(product, size, colour.code, 1)
  fly(event.currentTarget.closest('li')?.querySelector('img'))
  feedback.value = `已加入購物車：${product.name}・${colour.name}・${size === 'F' ? '單一尺寸' : size}`
  clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => (feedback.value = ''), 3500)
}

function remove(kind, id) {
  favorites.toggle(kind, id)
}

onBeforeUnmount(() => clearTimeout(feedbackTimer))
</script>

<template>
  <AccountNav v-if="loggedIn" />
  <header class="head">
    <h1>收藏</h1>
    <p v-if="status === 'ready'" class="lead">
      {{ products.length }} 件單品、{{ outfits.length }} 套穿搭。
      <template v-if="!loggedIn">現在存在這個瀏覽器；<RouterLink :to="{ name: 'login', query: { redirect: '/favorites' } }">登入</RouterLink>後會併進你的帳號。</template>
    </p>
  </header>

  <p v-if="status === 'loading'" class="state" aria-busy="true">載入中…</p>

  <div v-else-if="status === 'error'" class="state">
    <p>收藏沒有載入成功。</p>
    <button type="button" class="btn" @click="load">再試一次</button>
  </div>

  <div v-else-if="empty" class="state">
    <p>還沒有收藏。逛的時候按愛心，之後在這裡找得到。</p>
    <RouterLink class="btn" :to="{ name: 'outfits' }">看全部穿搭</RouterLink>
  </div>

  <template v-else>
    <section v-if="products.length" class="section" aria-label="收藏的單品">
      <h2 class="section-title">單品</h2>
      <ul class="fav-list">
        <li v-for="product in products" :key="product.productId">
          <RouterLink class="thumb" :to="{ name: 'product', params: { id: product.productId }, query: { colour: colourOf(product).code } }">
            <GarmentImage :kind="product.kind" :colour="colourOf(product).hex" :fabric="product.fabric" :height="110" :alt="`${product.name}（${colourOf(product).name}）`" />
          </RouterLink>
          <div class="info">
            <RouterLink class="name" :to="{ name: 'product', params: { id: product.productId }, query: { colour: colourOf(product).code } }">{{ product.name }}</RouterLink>
            <p class="sub">{{ product.brand }}・{{ colourOf(product).name }}</p>
            <p class="num">{{ formatPrice(product.price) }}</p>
          </div>
          <div class="act">
            <label v-if="product.sizes.length > 1" class="size-pick">
              <span>尺寸</span>
              <select v-model="sizes[product.productId]" :aria-describedby="errors[product.productId] ? `err-${product.productId}` : undefined">
                <option value="">選尺寸</option>
                <option v-for="size in product.sizes" :key="size" :value="size" :disabled="stockOf(product, size) === 0">{{ size }}{{ stockOf(product, size) === 0 ? '（無庫存）' : '' }}</option>
              </select>
            </label>
            <span v-else class="size-pick"><span>尺寸</span><strong>單一尺寸</strong></span>
            <button type="button" class="btn" @click="addToCart(product, $event)">加入購物車</button>
            <button type="button" class="remove" @click="remove('products', product.productId)">移除</button>
            <p v-if="errors[product.productId]" :id="`err-${product.productId}`" class="error" role="alert">{{ errors[product.productId] }}</p>
          </div>
        </li>
      </ul>
      <p class="feedback" role="status">{{ feedback }}</p>
    </section>

    <section v-if="outfits.length" class="section fav-outfits" aria-label="收藏的穿搭">
      <h2 class="section-title">穿搭</h2>
      <div class="outfit-list">
        <OutfitCard v-for="outfit in outfits" :key="outfit.id" :outfit="outfit" />
      </div>
    </section>
  </template>
</template>

<style scoped>
.head {
  display: grid;
  gap: var(--s1);
  margin-block: var(--s3) var(--s4);
}

.head h1 {
  font-size: var(--fs-3);
}

.lead {
  color: var(--ink-soft);
}

.lead a {
  color: var(--ink);
  text-underline-offset: 0.3em;
}

.section + .section {
  margin-top: var(--s4);
}

.section-title {
  margin-bottom: var(--s3);
  font-size: var(--fs-2);
  font-weight: 400;
  letter-spacing: 0.12em;
  color: var(--ink-soft);
}

.fav-list {
  display: grid;
  gap: var(--s2);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* 一列：圖、說明、動作；窄的時候動作掉到下一行 */
.fav-list li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--s2) var(--s3);
  padding: var(--s3);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
}

.thumb {
  display: grid;
  place-items: center;
  width: 6.4rem;
  padding: var(--s1);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--accent) 10%, white);
}

.thumb :deep(img) {
  max-width: 100%;
  height: auto;
}

.info {
  display: grid;
  align-content: start;
  gap: 0.2rem;
}

.name {
  color: inherit;
  font-weight: 500;
  text-decoration: none;
  text-underline-offset: 0.3em;
}

.name:hover,
.name:focus-visible {
  text-decoration: underline;
}

.sub {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.num {
  font-family: 'Space Mono', monospace;
  font-size: var(--fs-0);
}

.act {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--s2) var(--s3);
}

.size-pick {
  display: inline-flex;
  align-items: center;
  gap: var(--s1);
  font-size: var(--fs-0);
  color: var(--ink-soft);
}

.size-pick select {
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--field-line);
  background: var(--surface);
  color: var(--ink);
}

.size-pick strong {
  color: var(--ink);
}

.remove {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-soft);
  font-size: var(--fs-0);
  text-decoration: underline;
  text-underline-offset: 0.3em;
  cursor: pointer;
}

.remove:hover,
.remove:focus-visible {
  color: var(--ink);
}

.error {
  flex-basis: 100%;
  margin: 0;
  color: #9b2c2c; /* 與卡片底 7.6:1（check-contrast 有量） */
  font-size: var(--fs-0);
}

.feedback {
  min-height: 1.5em;
  margin-top: var(--s2);
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.outfit-list {
  display: grid;
  gap: var(--s3);
}

.state {
  display: grid;
  justify-items: start;
  gap: var(--s2);
  padding: var(--s3) 0;
  color: var(--ink-soft);
}

@media (max-width: 36rem) {
  .thumb {
    width: 5.2rem;
  }
}
</style>
