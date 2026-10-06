<script setup>
// 購物車。上面一排是「掛在桿子上的衣服」（探索的意象，純裝飾）；下面的品項、數量、單價、小計一律傳統（交易區守慣例）。
// 列裡的庫存、顏色名、尺寸選項都向 API 重新要，不信購物車裡存的快照：商品下架、庫存不夠都要以當下為準。
import '@fontsource/space-mono/400.css'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getProducts } from '@/api'
import GarmentImage from '@/components/GarmentImage.vue'
import { FREE_SHIPPING_FROM, SHIPPING_FEE, formatPrice } from '@/products/labels'
import { useCart } from '@/stores/cart'

const router = useRouter()
const { lines, subtotal, setQty, setSize, remove, restore } = useCart()
const products = ref(new Map()) // productId → 商品（API 的當下資料）
const status = ref('loading')
// 這一列被系統調整過的說明（庫存不夠、沒庫存），key 是列本身
const notices = reactive(new WeakMap())
const removed = ref(null) // 剛刪掉的那一列，給「復原」用
let undoTimer = 0

const keyOf = (colour, size) => `${colour}-${size}`

async function load() {
  const ids = [...new Set(lines.map((line) => line.productId))]
  if (!ids.length) {
    status.value = 'ready'
    return
  }
  status.value = 'loading'
  try {
    const list = await getProducts({ ids })
    products.value = new Map(list.map((product) => [product.productId, product]))
    status.value = 'ready'
    clampToStock()
  } catch {
    status.value = 'error'
  }
}

// 購物車裡出現了還沒拿過資料的商品（第一次進來、或復原了一列）才去要
watch(
  () => lines.map((line) => line.productId),
  (ids) => {
    if (ids.some((id) => !products.value.has(id))) load()
  },
  { immediate: true },
)

const rows = computed(() =>
  lines.map((line) => {
    const product = products.value.get(line.productId) ?? null
    const colour = product ? (product.colours.find((entry) => entry.code === line.colour) ?? product.colours[0]) : null
    const sizeOptions = product ? product.sizes.map((code) => ({ code, stock: product.stock[keyOf(colour.code, code)] ?? 0 })) : []
    const stock = product && line.size ? (product.stock[keyOf(colour.code, line.size)] ?? 0) : null
    return {
      line,
      product,
      colour,
      sizeOptions,
      stock,
      // 商品資料回來了卻沒有這一件：下架了
      gone: status.value === 'ready' && !product,
      notice: notices.get(line) ?? '',
    }
  }),
)

// 數量超過庫存就調低，並在那一列說明；完全沒庫存的不動數量，但結帳按不下去
function clampToStock() {
  for (const row of rows.value) {
    if (row.stock === null) continue
    if (row.stock === 0) notices.set(row.line, '這個尺寸目前沒有庫存，請改尺寸或移除。')
    else if (row.line.qty > row.stock) {
      setQty(row.line, row.stock)
      notices.set(row.line, `庫存只剩 ${row.stock} 件，數量已調整。`)
    }
  }
}

const missingSize = computed(() => rows.value.filter((row) => row.product && !row.line.size).length)
const ready = computed(() => status.value === 'ready' && rows.value.length > 0 && rows.value.every((row) => row.product && row.line.size && row.stock > 0))
const shipping = computed(() => (subtotal.value >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE))
const total = computed(() => subtotal.value + shipping.value)

function changeSize(row, size) {
  if (!size) return
  notices.delete(row.line)
  setSize(row.line, size)
  clampToStock()
}

function step(row, delta) {
  const max = row.stock ?? 99
  const next = Math.min(max, Math.max(1, row.line.qty + delta))
  if (next !== row.line.qty) {
    notices.delete(row.line)
    setQty(row.line, next)
  }
}

function onQtyInput(row, event) {
  const value = Math.floor(Number(event.target.value))
  const max = row.stock ?? 99
  notices.delete(row.line)
  setQty(row.line, Number.isFinite(value) ? Math.min(max, Math.max(1, value)) : 1)
  // 輸入超過上限被調回去時，輸入框要顯示調整後的值
  event.target.value = row.line.qty
}

// 移除不先問，但給幾秒可以復原（刪錯一列的代價小，問一次反而煩）
function removeLine(row) {
  const index = remove(row.line)
  removed.value = { line: row.line, index, name: row.line.name }
  clearTimeout(undoTimer)
  undoTimer = setTimeout(() => (removed.value = null), 6000)
}

function undo() {
  if (!removed.value) return
  restore(removed.value.line, removed.value.index)
  removed.value = null
  clearTimeout(undoTimer)
}

function checkout() {
  if (ready.value) router.push({ name: 'checkout' })
}

onBeforeUnmount(() => clearTimeout(undoTimer))
</script>

<template>
  <h1 class="title">購物車</h1>

  <template v-if="lines.length">
    <!-- 掛在桿子上：同一件買兩件就掛兩個衣架（最多畫三個） -->
    <section v-if="status === 'ready'" class="rail" aria-hidden="true">
      <ul>
        <li v-for="row in rows.filter((entry) => entry.product)" :key="`${row.line.productId}-${row.line.colour}-${row.line.size}`" class="hanger-group">
          <span v-for="n in Math.min(row.line.qty, 3)" :key="n" class="hanger" :style="{ '--n': n - 1 }">
            <span class="hook"></span>
            <GarmentImage :kind="row.product.kind" :colour="row.colour.hex" :fabric="row.product.fabric" :height="112" />
          </span>
          <span v-if="row.line.qty > 1" class="times">×{{ row.line.qty }}</span>
        </li>
      </ul>
    </section>

    <p v-if="status === 'error'" class="state">
      商品資料沒有載入成功。<button type="button" class="link" @click="load">再試一次</button>
    </p>

    <ul class="lines" aria-label="購物車品項" :aria-busy="status === 'loading'">
      <li v-for="row in rows" :key="`${row.line.productId}-${row.line.colour}-${row.line.size}`" class="line" :class="{ gone: row.gone }">
        <div class="thumb">
          <GarmentImage v-if="row.product" :kind="row.product.kind" :colour="row.colour.hex" :fabric="row.product.fabric" :height="96" />
        </div>

        <div class="what">
          <RouterLink :to="{ name: 'product', params: { id: row.line.productId }, query: row.line.colour ? { colour: row.line.colour } : {} }" class="name">{{ row.line.name }}</RouterLink>
          <p class="meta">{{ row.line.brand }}<template v-if="row.colour">・{{ row.colour.name }}</template></p>

          <p v-if="row.gone" class="notice">這件商品已下架，請移除。</p>
          <p v-else-if="row.product && row.product.sizes.length === 1" class="size-text">單一尺寸</p>
          <label v-else-if="row.product" class="size-pick" :class="{ missing: !row.line.size }">
            <span>尺寸</span>
            <select :value="row.line.size ?? ''" :aria-invalid="!row.line.size" @change="changeSize(row, $event.target.value)">
              <option value="" disabled>請選尺寸</option>
              <option v-for="option in row.sizeOptions" :key="option.code" :value="option.code" :disabled="option.stock === 0">
                {{ option.code }}{{ option.stock === 0 ? '（無庫存）' : '' }}
              </option>
            </select>
          </label>
          <p v-if="row.notice" class="notice">{{ row.notice }}</p>
        </div>

        <div class="money">
          <p class="unit num">{{ formatPrice(row.line.price) }}</p>
          <div class="stepper" :aria-label="`${row.line.name} 的數量`">
            <button type="button" aria-label="減一件" :disabled="row.gone || row.line.qty <= 1" @click="step(row, -1)">−</button>
            <input type="number" inputmode="numeric" min="1" :max="row.stock ?? 99" :value="row.line.qty" :disabled="row.gone" :aria-label="`${row.line.name} 的數量`" @change="onQtyInput(row, $event)" />
            <button type="button" aria-label="加一件" :disabled="row.gone || (row.stock !== null && row.line.qty >= row.stock)" @click="step(row, 1)">＋</button>
          </div>
          <p class="line-total num">{{ formatPrice(row.line.price * row.line.qty) }}</p>
          <button type="button" class="link remove" @click="removeLine(row)">移除<span class="visually-hidden">「{{ row.line.name }}」</span></button>
        </div>
      </li>
    </ul>

    <p v-if="removed" class="undo" role="status">
      已移除「{{ removed.name }}」。<button type="button" class="link" @click="undo">復原</button>
    </p>

    <section class="summary" aria-label="金額">
      <dl>
        <dt>小計</dt>
        <dd class="num">{{ formatPrice(subtotal) }}</dd>
        <dt>運費</dt>
        <dd class="num">{{ shipping ? formatPrice(shipping) : '免運' }}</dd>
        <dt class="total">合計</dt>
        <dd class="total num">{{ formatPrice(total) }}</dd>
      </dl>
      <p v-if="shipping" class="hint">再買 <span class="num">{{ formatPrice(FREE_SHIPPING_FROM - subtotal) }}</span> 免運。</p>
      <button type="button" class="btn primary" :disabled="!ready" @click="checkout">前往結帳</button>
      <p v-if="missingSize" class="hint">還有 {{ missingSize }} 件沒選尺寸。</p>
      <RouterLink :to="{ name: 'outfits' }" class="continue">繼續逛</RouterLink>
    </section>
  </template>

  <div v-else class="empty">
    <p>購物車是空的。</p>
    <RouterLink class="btn" :to="{ name: 'outfits' }">看全部穿搭</RouterLink>
  </div>
</template>

<style scoped>
.title {
  margin-block: var(--s3) var(--s3);
  font-size: var(--fs-3);
}

.num {
  font-family: 'Space Mono', monospace;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

/* ── 桿子 ── */
.rail {
  position: relative;
  margin-bottom: var(--s3);
  padding: var(--s2) var(--s2) 0;
  border-top: 3px solid var(--ink);
  overflow-x: auto;
}

.rail ul {
  display: flex;
  gap: var(--s3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.hanger-group {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  padding-right: calc(var(--s2) * 1);
}

.hanger {
  position: relative;
  display: grid;
  justify-items: center;
  margin-top: 0.4rem;
  /* 第二、三件往右後方疊一點 */
  margin-left: calc(var(--n) * -3.4rem);
  transform: translateY(calc(var(--n) * -0.2rem));
  opacity: calc(1 - var(--n) * 0.18);
}

.hook {
  width: 0.6rem;
  height: 0.9rem;
  margin-top: -0.6rem;
  border: 1.5px solid var(--ink);
  border-bottom: 0;
  border-radius: 0.3rem 0.3rem 0 0;
}

.times {
  position: absolute;
  right: 0;
  bottom: 0.2rem;
  padding: 0 0.4em;
  border-radius: 999px;
  background: var(--ink);
  color: var(--surface);
  font-size: var(--fs-0);
  font-variant-numeric: tabular-nums;
}

/* ── 品項 ── */
.lines {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--line);
}

.line {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr) auto;
  gap: var(--s2) var(--s3);
  padding: var(--s3) 0;
  border-bottom: 1px solid var(--line);
}

.line.gone .thumb,
.line.gone .name,
.line.gone .meta {
  opacity: 0.55;
}

.thumb {
  display: grid;
  place-items: center;
  height: 6rem;
}

.what {
  display: grid;
  align-content: start;
  gap: var(--s1);
}

.name {
  color: inherit;
  font-weight: 500;
  text-underline-offset: 0.3em;
}

.meta,
.size-text {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.size-pick {
  display: inline-flex;
  align-items: center;
  gap: var(--s1);
  font-size: var(--fs-0);
}

.size-pick span {
  color: var(--ink-soft);
}

.size-pick select {
  padding: 0.2rem var(--s1);
  border: 1px solid var(--field-line);
  background: var(--surface);
}

/* 還沒選尺寸：外框變成提醒色，字也說 */
.size-pick.missing select {
  border-color: #9b2c2c;
}

.notice {
  color: #9b2c2c;
  font-size: var(--fs-0);
}

.money {
  display: grid;
  justify-items: end;
  align-content: start;
  gap: var(--s1);
  text-align: right;
}

.unit {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.line-total {
  font-weight: 700;
}

.stepper {
  display: inline-flex;
  border: 1px solid var(--field-line);
}

.stepper button {
  width: 2.2rem;
  border: 0;
  background: var(--surface);
  cursor: pointer;
}

.stepper button:disabled {
  color: var(--ink-soft);
  cursor: not-allowed;
}

.stepper input {
  width: 2.6rem;
  padding: 0.25rem 0;
  border: 0;
  border-inline: 1px solid var(--line);
  text-align: center;
  font-variant-numeric: tabular-nums;
  appearance: textfield;
  -moz-appearance: textfield;
}

.stepper input::-webkit-inner-spin-button,
.stepper input::-webkit-outer-spin-button {
  appearance: none;
  margin: 0;
}

.link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-soft);
  font-size: var(--fs-0);
  text-decoration: underline;
  text-underline-offset: 0.3em;
  cursor: pointer;
}

.undo {
  margin-top: var(--s2);
  font-size: var(--fs-0);
}

/* ── 金額 ── */
.summary {
  display: grid;
  justify-items: end;
  gap: var(--s2);
  margin-top: var(--s3);
  padding: var(--s3);
  background: var(--surface);
  border: 1px solid var(--line);
}

.summary dl {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--s1) var(--s3);
  width: 100%;
  max-width: 20rem;
  margin: 0;
}

.summary dt {
  color: var(--ink-soft);
}

.summary dd {
  margin: 0;
  text-align: right;
}

.summary .total {
  margin-top: var(--s1);
  padding-top: var(--s2);
  border-top: 1px solid var(--line);
  color: var(--ink);
  font-weight: 700;
  font-size: var(--fs-2);
}

.hint {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.primary {
  padding: var(--s2) var(--s4);
  font-weight: 700;
}

.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.continue {
  font-size: var(--fs-0);
  text-underline-offset: 0.3em;
}

.state,
.empty {
  display: grid;
  justify-items: start;
  gap: var(--s2);
  padding: var(--s3) 0;
  color: var(--ink-soft);
}

/* 很窄的時候：金額那一欄換到下一列 */
@media (max-width: 30rem) {
  .line {
    grid-template-columns: 4rem minmax(0, 1fr);
  }

  .money {
    grid-column: 1 / -1;
    grid-template-columns: auto auto;
    justify-content: space-between;
    justify-items: start;
  }

  .remove {
    grid-column: 1 / -1;
  }
}
</style>
