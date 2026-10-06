<script setup>
// 訂單明細以固定區塊呈現交易資訊，並用行內確認避免誤觸重要操作。
import '@fontsource/space-mono/400.css'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AccountNav from '@/components/AccountNav.vue'
import GarmentImage from '@/components/GarmentImage.vue'
import { getProducts } from '@/api'
import {
  PAYMENT_METHODS,
  ApiError,
  cancelOrder,
  confirmReceipt,
  formatDateTime,
  getOrder,
} from '@/api/account'
import { formatPrice } from '@/products/labels'
import { useSession } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const { token, logout } = useSession()

const order = ref(null)
const status = ref('loading')
const products = ref(new Map())
const confirming = ref('')
const busy = ref(false)
const actionError = ref('')
const notice = ref('')

let loadVersion = 0
let mounted = true

const currentOrder = computed(() => order.value)

const handleUnauthorized = async (error) => {
  if (error?.code !== 'UNAUTHORIZED') return false

  await logout()
  await router.replace({
    name: 'login',
    query: { redirect: route.fullPath },
  })
  return true
}

const loadProducts = async (found, version) => {
  try {
    const ids = [...new Set(found.items.map((item) => item.productId))]
    const foundProducts = await getProducts({ ids })

    if (!mounted || version !== loadVersion) return

    products.value = new Map(
      foundProducts.map((product) => [product.productId, product]),
    )
  } catch {
    // 縮圖不是交易資訊，失敗時保留文字內容即可。
  }
}

const load = async () => {
  const version = ++loadVersion
  status.value = 'loading'
  order.value = null
  products.value = new Map()
  confirming.value = ''
  actionError.value = ''
  notice.value = ''

  try {
    const found = await getOrder(token.value, route.params.id)

    if (!mounted || version !== loadVersion) return

    if (!found) {
      status.value = 'missing'
      return
    }

    order.value = found
    status.value = 'ready'
    loadProducts(found, version)
  } catch (error) {
    if (!mounted || version !== loadVersion) return
    if (await handleUnauthorized(error)) return
    status.value = 'error'
  }
}

const look = (item) => {
  const product = products.value.get(item.productId)
  if (!product) return null

  const colour = product.colours.find((entry) => entry.code === item.colour)
    ?? product.colours[0]

  if (!colour) return null

  return {
    kind: product.kind,
    fabric: product.fabric,
    hex: colour.hex,
  }
}

const sizeText = (item) => item.size === 'F' ? '單一尺寸' : item.size

const ask = async (kind) => {
  confirming.value = kind
  actionError.value = ''
  await nextTick()

  const id = kind === 'cancel' ? 'keep-order' : 'keep-receipt'
  document.getElementById(id)?.focus()
}

const cancel = async () => {
  if (!order.value) return

  busy.value = true
  actionError.value = ''

  try {
    order.value = await cancelOrder(token.value, order.value.id)
    confirming.value = ''
    notice.value = '訂單已取消。'
  } catch (error) {
    if (await handleUnauthorized(error)) return
    actionError.value = error instanceof ApiError
      ? error.message
      : '取消沒有成功，請再試一次。'
  } finally {
    busy.value = false
  }
}

const confirmReceived = async () => {
  if (!order.value) return

  busy.value = true
  actionError.value = ''

  try {
    order.value = await confirmReceipt(token.value, order.value.id)
    confirming.value = ''
    notice.value = '已確認收貨，訂單完成。'
  } catch (error) {
    if (await handleUnauthorized(error)) return
    actionError.value = error instanceof ApiError
      ? error.message
      : '確認收貨沒有成功，請再試一次。'
  } finally {
    busy.value = false
  }
}

onMounted(load)

watch(
  () => route.params.id,
  () => {
    load()
  },
)

onBeforeUnmount(() => {
  mounted = false
  loadVersion += 1
})
</script>

<template>
  <AccountNav />
  <h1 class="title">訂單明細</h1>

  <p v-if="status === 'loading'" class="state">載入中…</p>

  <p v-else-if="status === 'error'" class="state">
    訂單沒有載入成功。
    <button type="button" class="link" @click="load">再試一次</button>
  </p>

  <div v-else-if="status === 'missing'" class="state">
    <p>找不到這張訂單。</p>
    <RouterLink :to="{ name: 'account-orders' }">回訂單紀錄</RouterLink>
  </div>

  <template v-else-if="currentOrder">
    <section class="head panel" aria-label="訂單狀態">
      <p class="id-line">
        <span class="label">訂單編號</span>
        <span class="num">{{ currentOrder.id }}</span>
      </p>
      <p class="meta">下單時間 {{ formatDateTime(currentOrder.createdAt) }}</p>
      <p class="status-line">
        <span class="label">狀態</span>
        <span class="order-status">{{ currentOrder.status }}</span>
      </p>

      <div v-if="currentOrder.status === '待付款'" class="order-actions">
        <template v-if="confirming === 'cancel'">
          <p class="confirm">確定要取消這張訂單嗎？取消後不能復原。</p>
          <button
            type="button"
            class="btn confirm-cancel"
            :disabled="busy"
            @click="cancel"
          >
            確定取消
          </button>
          <button
            id="keep-order"
            type="button"
            class="link keep-order"
            @click="confirming = ''"
          >
            先不要
          </button>
        </template>

        <button
          v-else
          type="button"
          class="btn quiet cancel-order"
          @click="ask('cancel')"
        >
          取消訂單
        </button>
      </div>

      <div v-else-if="currentOrder.status === '已送達'" class="order-actions">
        <template v-if="confirming === 'receipt'">
          <p class="confirm">確定已經收到全部商品了嗎？確認後訂單就完成了。</p>
          <button
            type="button"
            class="btn confirm-receipt-yes"
            :disabled="busy"
            @click="confirmReceived"
          >
            確定收到了
          </button>
          <button
            id="keep-receipt"
            type="button"
            class="link confirm-receipt-no"
            @click="confirming = ''"
          >
            先不要
          </button>
        </template>

        <button
          v-else
          type="button"
          class="btn confirm-receipt"
          @click="ask('receipt')"
        >
          確認收貨
        </button>
      </div>

      <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
      <p class="saved" role="status">{{ notice }}</p>
    </section>

    <section class="block" aria-labelledby="items-title">
      <h2 id="items-title" class="section-title">商品</h2>
      <ul class="items">
        <li
          v-for="item in currentOrder.items"
          :key="`${item.productId}-${item.colour}-${item.size}`"
          class="item"
        >
          <div class="thumb">
            <GarmentImage
              v-if="look(item)"
              :kind="look(item).kind"
              :colour="look(item).hex"
              :fabric="look(item).fabric"
              :height="72"
            />
          </div>
          <div class="what">
            <p class="name">{{ item.name }}</p>
            <p class="meta">
              {{ item.brand }}・{{ item.colourName }}・{{ sizeText(item) }}
            </p>
          </div>
          <div class="money">
            <p class="unit num">{{ formatPrice(item.price) }} × {{ item.qty }}</p>
            <p class="line-total num">{{ formatPrice(item.price * item.qty) }}</p>
          </div>
        </li>
      </ul>
    </section>

    <section class="summary" aria-label="金額">
      <dl>
        <dt>小計</dt>
        <dd class="num">{{ formatPrice(currentOrder.subtotal) }}</dd>
        <dt>運費</dt>
        <dd class="num">{{ currentOrder.shipping ? formatPrice(currentOrder.shipping) : '免運' }}</dd>
        <dt class="total">合計</dt>
        <dd class="total num">{{ formatPrice(currentOrder.total) }}</dd>
      </dl>
      <p class="hint">
        付款方式：{{ PAYMENT_METHODS[currentOrder.payment.method] ?? currentOrder.payment.method }}<template v-if="currentOrder.payment.paidAt">，{{ formatDateTime(currentOrder.payment.paidAt) }} 付款</template>
      </p>
    </section>

    <section class="block" aria-labelledby="ship-title">
      <h2 id="ship-title" class="section-title">收件資訊</h2>
      <p>{{ currentOrder.address.recipient }}　{{ currentOrder.address.phone }}</p>
      <p class="where">
        {{ currentOrder.address.postalCode }} {{ currentOrder.address.city }}{{ currentOrder.address.district }}{{ currentOrder.address.street }}
      </p>
    </section>

    <section class="block" aria-labelledby="history-title">
      <h2 id="history-title" class="section-title">訂單進度</h2>
      <ol class="history">
        <li
          v-for="entry in currentOrder.history"
          :key="`${entry.status}-${entry.at}`"
        >
          <span class="step-status">{{ entry.status }}</span>
          <time :datetime="entry.at">{{ formatDateTime(entry.at) }}</time>
        </li>
      </ol>
    </section>

    <p class="back">
      <RouterLink :to="{ name: 'account-orders' }">回訂單紀錄</RouterLink>
    </p>
  </template>
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

.panel {
  display: grid;
  gap: var(--s3);
  padding: var(--s3);
  background: var(--surface);
  border: 1px solid var(--line);
}

.label {
  font-size: var(--fs-0);
  color: var(--ink-soft);
  letter-spacing: 0.08em;
}

.form-error {
  color: #9b2c2c;
  font-size: var(--fs-0);
}

.saved {
  min-height: 1.6em;
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.quiet {
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--field-line);
}

.head {
  margin-bottom: var(--s3);
}

.id-line,
.status-line {
  overflow-wrap: anywhere;
}

.meta {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.order-status {
  padding: 0 var(--s1);
  border: 1px solid var(--field-line);
  font-size: var(--fs-0);
}

.order-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2) var(--s3);
}

.confirm {
  width: 100%;
  font-size: var(--fs-0);
}

.confirm-cancel:disabled,
.confirm-receipt-yes:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.block {
  margin-top: var(--s3);
}

.section-title {
  margin-bottom: var(--s2);
  font-size: var(--fs-2);
}

.items {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--line);
}

.item {
  display: grid;
  grid-template-columns: 4rem minmax(0, 1fr) auto;
  gap: var(--s2) var(--s3);
  align-items: center;
  padding: var(--s2) 0;
  border-bottom: 1px solid var(--line);
}

.thumb {
  display: grid;
  place-items: center;
  height: 4.5rem;
}

.what {
  min-width: 0;
}

.name,
.what .meta {
  overflow-wrap: anywhere;
}

.money {
  text-align: right;
}

.unit {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.line-total {
  font-weight: 700;
}

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

.where {
  color: var(--ink-soft);
  overflow-wrap: anywhere;
}

.history {
  margin: 0;
  padding-left: 1.4em;
}

.history li {
  padding: var(--s1) 0;
}

.history time {
  margin-left: var(--s2);
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.back {
  margin-top: var(--s3);
  font-size: var(--fs-0);
}

.state {
  display: grid;
  justify-items: start;
  gap: var(--s2);
  padding: var(--s3) 0;
  color: var(--ink-soft);
}

@media (max-width: 30rem) {
  .panel {
    padding: var(--s2);
  }

  .item {
    grid-template-columns: 3.5rem minmax(0, 1fr);
  }

  .money {
    grid-column: 2;
    text-align: left;
  }

  .summary {
    padding: var(--s2);
  }

  .history time {
    display: block;
    margin-left: 0;
  }
}
</style>
