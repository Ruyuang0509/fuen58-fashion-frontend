<script setup>
// 你看過的（第十五輪子輪 2）：本機的瀏覽紀錄——單品一段、穿搭一段，右上角可以清掉。不需要登入，不進後端。
import { computed, ref, watch } from 'vue'
import { getOutfits, getProducts } from '@/api'
import AccountNav from '@/components/AccountNav.vue'
import OutfitCard from '@/components/OutfitCard.vue'
import ProductCard from '@/components/ProductCard.vue'
import { useHistory } from '@/stores/history'
import { useSession } from '@/stores/session'

const history = useHistory()
const { loggedIn } = useSession()
const products = ref([])
const outfits = ref([])
const status = ref('loading')

const productIds = computed(() => history.products.value.map((entry) => entry.id))
const outfitIds = computed(() => history.outfits.value.map((entry) => entry.id))
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
    status.value = 'ready'
  } catch {
    if (ticket === latest) status.value = 'error'
  }
}
watch(() => [productIds.value.join(','), outfitIds.value.join(',')].join('|'), load, { immediate: true })
</script>

<template>
  <AccountNav v-if="loggedIn" />
  <header class="head">
    <div>
      <h1>你看過的</h1>
      <p v-if="status === 'ready'" class="lead">{{ products.length }} 件單品、{{ outfits.length }} 套穿搭。只存在這個瀏覽器。</p>
    </div>
    <button v-if="!empty && status === 'ready'" type="button" class="clear" @click="history.clear()">清除紀錄</button>
  </header>

  <p v-if="status === 'loading'" class="state" aria-busy="true">載入中…</p>

  <div v-else-if="status === 'error'" class="state">
    <p>紀錄沒有載入成功。</p>
    <button type="button" class="btn" @click="load">再試一次</button>
  </div>

  <div v-else-if="empty" class="state">
    <p>還沒有紀錄。看過的單品與穿搭會留在這裡。</p>
    <RouterLink class="btn" :to="{ name: 'outfits' }">看全部穿搭</RouterLink>
  </div>

  <template v-else>
    <section v-if="products.length" class="section history-products" aria-label="看過的單品">
      <h2 class="section-title">單品</h2>
      <div class="grid">
        <ProductCard v-for="product in products" :key="product.productId" :product="product" />
      </div>
    </section>

    <section v-if="outfits.length" class="section history-outfits" aria-label="看過的穿搭">
      <h2 class="section-title">穿搭</h2>
      <div class="outfit-list">
        <OutfitCard v-for="outfit in outfits" :key="outfit.id" :outfit="outfit" />
      </div>
    </section>
  </template>
</template>

<style scoped>
.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--s2) var(--s3);
  flex-wrap: wrap;
  margin-block: var(--s3) var(--s4);
}

.head h1 {
  font-size: var(--fs-3);
}

.lead {
  margin-top: var(--s1);
  color: var(--ink-soft);
}

.clear {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-soft);
  font-size: var(--fs-0);
  text-decoration: underline;
  text-underline-offset: 0.3em;
  cursor: pointer;
}

.clear:hover,
.clear:focus-visible {
  color: var(--ink);
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

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
  gap: var(--s3);
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
</style>
