<script setup>
// 訂單明細（第十輪）。第十七輪子輪 1：進度改成狀態機的時間線、待付款顯示付款期限與倒數、可以在這裡付款、
// 完成後接身形與試穿間。重要操作（付款、取消、確認收貨）都先在行內確認，不跳視窗。
import '@fontsource/space-mono/400.css'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AccountNav from '@/components/AccountNav.vue'
import GarmentImage from '@/components/GarmentImage.vue'
import Icon from '@/components/Icon.vue'
import { getProducts } from '@/api'
import {
  PAYMENT_METHODS,
  ApiError,
  cancelOrder,
  confirmReceipt,
  formatDateTime,
  getOrder,
  payOrder,
} from '@/api/account'
import { FITTING_SLOTS } from '@/fitting/link'
import { buildTimeline, cancelReasonText, isCod, statusTone } from '@/orders/status'
import { formatPrice } from '@/products/labels'
import { useSession } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const { token, logout } = useSession()

const order = ref(null)
const status = ref('loading')
const products = ref(new Map())
// 行內確認的哪一種正開著：pay 選付款方式｜cancel 確認取消｜receipt 確認收貨
const mode = ref('')
const payMethod = ref('')
const busy = ref(false)
const actionError = ref('')
const notice = ref('')
// 倒數用的「現在」，每 30 秒更新
const now = ref(Date.now())
let ticker = null
let expiredHandled = false

let loadVersion = 0
let mounted = true

const currentOrder = computed(() => order.value)

// 訂單頁能選的付款方式：貨到付款是下單時才能選的
const PAY_CHOICES = Object.fromEntries(Object.entries(PAYMENT_METHODS).filter(([code]) => code !== 'cod'))

const payBy = computed(() => currentOrder.value?.payBy ?? null)
const minutesLeft = computed(() => (payBy.value ? Math.max(0, Math.ceil((Date.parse(payBy.value) - now.value) / 60000)) : 0))
const leftText = computed(() => (minutesLeft.value >= 1 ? `還剩 ${minutesLeft.value} 分` : '不到 1 分鐘'))

const timeline = computed(() => buildTimeline(currentOrder.value))

// 完成後：把這張訂單裡畫得出來的外層／上身／下身帶去試穿間（每類第一件）
const fittingLink = computed(() => {
  const found = currentOrder.value
  if (!found) return null
  const query = {}
  for (const item of found.items) {
    const product = products.value.get(item.productId)
    if (!product?.kind || !FITTING_SLOTS.includes(product.category) || query[product.category]) continue
    const colour = product.colours.find((entry) => entry.code === item.colour) ?? product.colours[0]
    if (colour) query[product.category] = `${product.productId}:${colour.code}`
  }
  return Object.keys(query).length ? { name: 'fitting', query } : null
})

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
  mode.value = ''
  actionError.value = ''
  notice.value = ''
  expiredHandled = false

  try {
    const found = await getOrder(token.value, route.params.id)

    if (!mounted || version !== loadVersion) return

    if (!found) {
      status.value = 'missing'
      return
    }

    order.value = found
    status.value = 'ready'
    now.value = Date.now()
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
  mode.value = kind
  actionError.value = ''
  await nextTick()

  const target = kind === 'pay'
    ? document.querySelector('.pay-options input')
    : document.getElementById(kind === 'cancel' ? 'keep-order' : 'keep-receipt')
  target?.focus()
}

// 把假 API 的錯誤貼在畫面上；不是 ApiError 的（例如網路）用一句通用的話
const act = async (run, fallback, done) => {
  if (!order.value) return

  busy.value = true
  actionError.value = ''

  try {
    order.value = await run()
    mode.value = ''
    notice.value = done
  } catch (error) {
    if (await handleUnauthorized(error)) return
    actionError.value = error instanceof ApiError ? error.message : fallback
    // 付款期限過了的訂單在假 API 裡已經被結算成已取消：重讀，畫面才會對
    if (error?.code === 'NOT_PAYABLE' || error?.code === 'NOT_CANCELLABLE') await reloadKeepingError()
  } finally {
    busy.value = false
  }
}

const reloadKeepingError = async () => {
  const keep = actionError.value
  await load()
  actionError.value = keep
}

const pay = async () => {
  if (!payMethod.value) {
    actionError.value = '請選付款方式'
    return
  }
  const method = payMethod.value
  await act(() => payOrder(token.value, order.value.id, { method }), '付款沒有成功，請再試一次。', '付款完成，我們會盡快出貨。')
}

const cancel = () => act(() => cancelOrder(token.value, order.value.id), '取消沒有成功，請再試一次。', '訂單已取消。')

const confirmReceived = () => act(() => confirmReceipt(token.value, order.value.id), '確認收貨沒有成功，請再試一次。', '已確認收貨，訂單完成。')

onMounted(() => {
  load()
  ticker = setInterval(() => {
    now.value = Date.now()
  }, 30000)
})

// 倒數到期：重讀一次，假 API 會把它結算成已取消（正式版是後端排程做的事）
watch(now, (value) => {
  if (!payBy.value || expiredHandled || status.value !== 'ready') return
  if (value >= Date.parse(payBy.value)) {
    expiredHandled = true
    load()
  }
})

watch(
  () => route.params.id,
  () => {
    load()
  },
)

onBeforeUnmount(() => {
  mounted = false
  loadVersion += 1
  if (ticker) clearInterval(ticker)
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
        <span class="order-status" :class="`tone-${statusTone(currentOrder.status)}`">{{ currentOrder.status }}</span>
        <span v-if="currentOrder.status === '已取消'" class="why">（{{ cancelReasonText(currentOrder) }}）</span>
      </p>

      <!-- 付款期限：後端算（payBy），前台只顯示與倒數；貨到付款沒有期限 -->
      <p v-if="payBy" class="deadline">
        付款期限 <time :datetime="payBy">{{ formatDateTime(payBy) }}</time>，{{ leftText }}。逾時會自動取消。
      </p>
      <p v-else-if="isCod(currentOrder) && currentOrder.status === '待付款'" class="meta">貨到付款：商品送到時再付款。</p>

      <div v-if="currentOrder.status === '待付款'" class="order-actions">
        <template v-if="mode === 'pay'">
          <fieldset class="pay-options">
            <legend>付款方式</legend>
            <label v-for="(label, code) in PAY_CHOICES" :key="code" class="pay-option">
              <input v-model="payMethod" type="radio" name="pay" :value="code" />
              {{ label }}
            </label>
          </fieldset>
          <button type="button" class="btn pay-submit" :disabled="busy" @click="pay">付款</button>
          <button id="keep-unpaid" type="button" class="link" @click="mode = ''">先不要</button>
        </template>

        <template v-else-if="mode === 'cancel'">
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
            @click="mode = ''"
          >
            先不要
          </button>
        </template>

        <template v-else>
          <button v-if="payBy" type="button" class="btn pay-now" @click="ask('pay')">去付款</button>
          <button type="button" class="btn quiet cancel-order" @click="ask('cancel')">取消訂單</button>
        </template>
      </div>

      <div v-else-if="currentOrder.status === '已送達'" class="order-actions">
        <template v-if="mode === 'receipt'">
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
            @click="mode = ''"
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

    <!-- 完成之後：接回站裡已有的功能，不是結束（功能規劃 4「確認收貨後提示」；穿搭牆藏著，先接身形與試穿間） -->
    <section v-if="currentOrder.status === '完成'" class="aftercare panel" aria-labelledby="aftercare-title">
      <h2 id="aftercare-title" class="section-title">收到了嗎？</h2>
      <p class="soft">合身嗎？身形有變就改一下，之後每件的「建議尺寸」會跟著變。</p>
      <div class="aftercare-links">
        <RouterLink :to="{ name: 'account-body' }" class="btn quiet body-link">更新身形</RouterLink>
        <RouterLink v-if="fittingLink" :to="fittingLink" class="btn quiet fitting-link">拿這幾件去試穿間搭別的</RouterLink>
      </div>
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

    <!-- 進度：狀態機的每一步（貨到付款少「已付款」），走過的有時間，目前的那一步標 aria-current -->
    <section class="block" aria-labelledby="history-title">
      <h2 id="history-title" class="section-title">訂單進度</h2>
      <ol class="timeline">
        <li
          v-for="node in timeline"
          :key="node.status"
          :class="[node.state, { cancelled: node.cancelled }]"
          :aria-current="node.state === 'current' ? 'step' : undefined"
        >
          <span class="dot" aria-hidden="true"><Icon v-if="node.state === 'done'" name="check" /></span>
          <span class="step-status">{{ node.status }}</span>
          <time v-if="node.at" :datetime="node.at">{{ formatDateTime(node.at) }}</time>
          <span v-if="node.note" class="note">{{ node.note }}</span>
        </li>
      </ol>
      <p class="demo-note">出貨與送達目前是示範用的模擬：付款（貨到付款是下單）2 分鐘後出貨、5 分鐘後送達，送達 7 天沒確認就自動完成。正式版由後台更新狀態。</p>
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
  border-radius: var(--radius);
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

.meta,
.soft {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.order-status {
  padding: 0 var(--s1);
  border: 1px solid var(--field-line);
  border-radius: var(--radius-sm);
  font-size: var(--fs-0);
}

/* 調子只是輔助，文字本身就說了狀態 */
.tone-wait {
  background: var(--tone-wait);
}

.tone-go {
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
}

.tone-done {
  background: var(--tone-done);
}

.tone-off {
  color: var(--ink-soft);
  background: var(--bg);
}

.why {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.deadline {
  font-size: var(--fs-0);
}

.deadline time {
  font-weight: 700;
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

.pay-options {
  display: grid;
  gap: var(--s1);
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
}

.pay-options legend {
  margin-bottom: var(--s1);
  font-size: var(--fs-0);
  color: var(--ink-soft);
}

.pay-option {
  display: flex;
  align-items: center;
  gap: var(--s1);
}

.pay-submit:disabled,
.confirm-cancel:disabled,
.confirm-receipt-yes:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.aftercare {
  margin-bottom: var(--s3);
  gap: var(--s2);
}

.aftercare-links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
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
  border-radius: var(--radius);
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

/* 時間線：左邊一條線串起每一步的點 */
.timeline {
  margin: 0;
  padding: 0;
  list-style: none;
}

.timeline li {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0 var(--s2);
  padding: var(--s1) 0 var(--s2) 2rem;
}

.timeline li::before {
  content: '';
  position: absolute;
  left: 0.55rem;
  top: 1.5rem;
  bottom: -0.1rem;
  width: 2px;
  background: var(--line);
}

.timeline li:last-child::before {
  display: none;
}

.dot {
  position: absolute;
  left: 0;
  top: 0.5rem;
  display: grid;
  place-items: center;
  width: 1.2rem;
  height: 1.2rem;
  border: 2px solid var(--field-line);
  border-radius: 50%;
  background: var(--surface);
  color: var(--on-accent);
  font-size: 0.7rem;
}

.timeline .done .dot {
  background: var(--accent);
  border-color: var(--accent);
}

.timeline .current .dot {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
}

.timeline .current .step-status {
  font-weight: 700;
}

.timeline .todo {
  color: var(--ink-soft);
}

.timeline .todo .dot {
  border-style: dashed;
}

.timeline .cancelled .dot {
  background: var(--field-line);
  border-color: var(--field-line);
  box-shadow: none;
}

.timeline time,
.timeline .note {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.timeline .note {
  grid-column: 1 / -1;
}

.demo-note {
  margin-top: var(--s2);
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

  .timeline li {
    grid-template-columns: 1fr;
  }
}
</style>
