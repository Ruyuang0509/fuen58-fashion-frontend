<script setup>
// 購物車預覽：最多四列（圖、名稱、顏色・尺寸 × 件數、金額）、小計、看購物車／去結帳。空的就說空的。
// 商品圖要商品資料（款式、布料、顏色 hex），打開時才去要；列裡的名稱與價格用購物車存的快照。
import { computed, ref, watch } from 'vue'
import { getProducts } from '@/api'
import GarmentImage from '@/components/GarmentImage.vue'
import { formatPrice } from '@/products/labels'
import { useCart } from '@/stores/cart'

const { lines, count, subtotal } = useCart()
const products = ref(new Map())
const shown = computed(() => lines.slice(0, 4))
const more = computed(() => lines.length - shown.value.length)

let latest = 0
async function load() {
  const ids = [...new Set(lines.map((line) => line.productId))].filter((id) => !products.value.has(id))
  if (!ids.length) return
  const ticket = ++latest
  try {
    const list = await getProducts({ ids })
    if (ticket !== latest) return
    const next = new Map(products.value)
    list.forEach((product) => next.set(product.productId, product))
    products.value = next
  } catch {
    // 拿不到圖就只顯示文字
  }
}
watch(() => lines.map((line) => line.productId).join(','), load, { immediate: true })

const productOf = (line) => products.value.get(line.productId) ?? null
const colourOf = (line) => {
  const product = productOf(line)
  return product ? (product.colours.find((entry) => entry.code === line.colour) ?? product.colours[0]) : null
}
const sizeText = (line) => (line.size ? (line.size === 'F' ? '單一尺寸' : line.size) : '尺寸未選')
</script>

<template>
  <div class="cart-peek">
    <template v-if="lines.length">
      <p class="peek-title">購物車裡有 {{ count }} 件</p>
      <ul class="peek-list">
        <li v-for="line in shown" :key="`${line.productId}-${line.colour}-${line.size}`">
          <span class="thumb">
            <GarmentImage v-if="productOf(line)" :kind="productOf(line).kind" :colour="colourOf(line).hex" :fabric="productOf(line).fabric" :height="56" />
          </span>
          <span class="what">
            <span class="name">{{ line.name }}</span>
            <span class="sub">{{ colourOf(line)?.name ?? line.brand }}・{{ sizeText(line) }} × {{ line.qty }}</span>
          </span>
          <span class="num">{{ formatPrice(line.price * line.qty) }}</span>
        </li>
      </ul>
      <p v-if="more > 0" class="more">還有 {{ more }} 列，到購物車看全部。</p>
      <p class="sum">小計 <span class="num">{{ formatPrice(subtotal) }}</span></p>
      <div class="peek-actions">
        <RouterLink class="btn" to="/cart">看購物車</RouterLink>
        <RouterLink class="btn go" to="/checkout">去結帳</RouterLink>
      </div>
    </template>
    <template v-else>
      <p class="peek-title">購物車是空的。</p>
      <p class="hint">在穿搭卡按「整套加入購物車」，或到商品頁選尺寸加入。</p>
      <RouterLink class="btn" :to="{ name: 'outfits' }">看全部穿搭</RouterLink>
    </template>
  </div>
</template>

<style scoped>
.peek-title {
  margin: 0 0 var(--s2);
  font-weight: 700;
}

.peek-list {
  display: grid;
  gap: var(--s2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.peek-list li {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--s2);
}

.thumb {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3.6rem;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--accent) 10%, white);
}

.thumb :deep(img) {
  max-width: 100%;
  height: auto;
}

.what {
  display: grid;
  min-width: 0;
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub,
.more,
.hint {
  color: var(--ink-soft);
}

.num {
  font-family: 'Space Mono', monospace;
  white-space: nowrap;
}

.more {
  margin: var(--s2) 0 0;
}

.sum {
  display: flex;
  justify-content: space-between;
  margin: var(--s2) 0;
  padding-top: var(--s2);
  border-top: 1px solid var(--line);
}

.peek-actions {
  display: flex;
  gap: var(--s2);
}

.peek-actions .btn,
.cart-peek > .btn {
  padding: 0.45rem 1rem;
  font-size: var(--fs-0);
}

.go {
  font-weight: 700;
}

.hint {
  margin: 0 0 var(--s2);
}
</style>
