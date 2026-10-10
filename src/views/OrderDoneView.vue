<script setup>
// 完成頁集中呈現訂單結果，讓買家立即核對付款、商品與收件資訊。
// 第十七輪子輪 3（功能規劃 4「下單完成：一段簡短的完成動畫，可跳過」）：剛從結帳過來才播——訂單裡畫得出來的衣服
// 一件件落進提袋，提袋晃一下，再出一行「收到了」。1.6 秒上下、右上角可跳過、Esc 也行；減少動態時直接出最後的畫面；
// 播完的畫面和跳過的畫面是同一個（動畫結束把行內樣式清掉，剩下的就是 CSS 的靜態版）。重新整理不再播。
import '@fontsource/space-mono/400.css'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GarmentImage from '@/components/GarmentImage.vue'
import { getProducts } from '@/api'
import {
  PAYMENT_METHODS,
  formatDateTime,
  getOrder,
} from '@/api/account'
import { gsap, reducedMotion } from '@/motion/gsap'
import { formatPrice } from '@/products/labels'
import { useSession } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const { token, logout } = useSession()

const order = ref(null)
const status = ref('loading')
const products = ref(new Map())
// 剛下單（結帳頁留了記號）才播；idle 還沒開始｜playing 播放中｜done 靜止
const celebrating = ref(false)
const animState = ref('idle')
const stage = ref(null)
let timeline = null
let loadVersion = 0

const note = computed(() => {
  if (!order.value) return ''
  if (order.value.status === '已付款') {
    return '付款完成，我們會盡快出貨；出貨進度看訂單明細。'
  }
  if (order.value.payment.method === 'cod') {
    return '貨到付款：商品送到時再付款。'
  }
  // 付款沒成功、留在待付款：期限由後端算（payBy），逾時會自動取消
  if (order.value.payBy) {
    return `這張訂單還沒有付款：請在 ${formatDateTime(order.value.payBy)} 前付款（下單後 15 分鐘內），逾時會自動取消。`
  }
  return '這張訂單還沒有付款。'
})

const itemCount = computed(() => order.value?.items.reduce((sum, item) => sum + item.qty, 0) ?? 0)

// 提袋裡的衣服：訂單裡畫得出來的（有款式圖的）單品，最多四件
const garments = computed(() => {
  if (!order.value) return []
  const list = []
  for (const item of order.value.items) {
    const product = products.value.get(item.productId)
    if (!product?.kind) continue
    const colour = product.colours.find((entry) => entry.code === item.colour) ?? product.colours[0]
    list.push({ key: `${item.productId}-${item.colour}-${item.size}`, kind: product.kind, fabric: product.fabric, hex: colour?.hex ?? '#cccccc', name: item.name })
    if (list.length === 4) break
  }
  return list
})
// 每件在袋子裡的左右位置：依件數置中散開
const slotStyle = (index) => ({ '--dx': `${(index - (garments.value.length - 1) / 2) * 26}px`, zIndex: index + 1 })

const sizeText = (item) => (
  item.size === 'F' ? '單一尺寸' : item.size
)

const flagKey = () => `celebrate:${route.params.orderId}`
function takeFlag() {
  try {
    const value = sessionStorage.getItem(flagKey())
    if (value) sessionStorage.removeItem(flagKey())
    return !!value
  } catch {
    return false
  }
}

function settle() {
  animState.value = 'done'
  const parts = stage.value?.querySelectorAll('.drop, .bag-front, .celebrate-note') ?? []
  // 清掉行內樣式（含 transform-origin）：剩下的就是 CSS 的靜態畫面，和沒播過的一樣
  gsap.set(parts, { clearProps: 'all' })
  timeline?.kill()
  timeline = null
}

function skip() {
  if (animState.value !== 'playing') return
  if (timeline) timeline.progress(1)
  else settle()
}

async function play() {
  await nextTick()
  const items = stage.value ? [...stage.value.querySelectorAll('.drop')] : []
  const front = stage.value?.querySelector('.bag-front')
  const caption = stage.value?.querySelector('.celebrate-note')
  if (!items.length || reducedMotion()) {
    animState.value = 'done'
    return
  }
  animState.value = 'playing'
  timeline = gsap.timeline({ onComplete: settle })
  // 衣服從上面落下來（每件錯開一點、帶一點歪），落地擺正
  timeline.fromTo(items, { y: -190, rotation: (i) => (i % 2 ? 9 : -9), opacity: 0 }, { y: 0, rotation: 0, opacity: 1, duration: 0.7, ease: 'power2.in', stagger: 0.12 }, 0)
  // 最後一件落地：提袋往下壓一下再彈回
  const landed = 0.7 + 0.12 * (items.length - 1)
  if (front) timeline.fromTo(front, { scaleY: 1, transformOrigin: '50% 100%' }, { scaleY: 0.955, duration: 0.12, ease: 'power1.out', yoyo: true, repeat: 1 }, landed - 0.05)
  // 一行字
  if (caption) timeline.fromTo(caption, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }, landed + 0.15)
}

const onKey = (event) => {
  if (event.key === 'Escape') skip()
}

const load = async () => {
  const version = ++loadVersion
  status.value = 'loading'
  products.value = new Map()
  celebrating.value = takeFlag()
  animState.value = 'idle'

  try {
    const found = await getOrder(token.value, route.params.orderId)
    if (version !== loadVersion) return

    if (!found) {
      order.value = null
      status.value = 'missing'
      return
    }

    order.value = found
    status.value = 'ready'
    try {
      const ids = [...new Set(found.items.map((item) => item.productId))]
      const list = await getProducts({ ids })
      if (version !== loadVersion) return
      products.value = new Map(list.map((product) => [product.productId, product]))
    } catch {
      // 衣服畫不出來就沒有那段動畫，其餘照舊
    }
    if (celebrating.value) play()
    else animState.value = 'done'
  } catch (error) {
    if (version !== loadVersion) return
    if (error?.code === 'UNAUTHORIZED') {
      await logout()
      await router.replace({
        name: 'login',
        query: { redirect: route.fullPath },
      })
      return
    }

    status.value = 'error'
  }
}

onMounted(() => {
  load()
  window.addEventListener('keydown', onKey)
})

watch(() => route.params.orderId, load)

onBeforeUnmount(() => {
  loadVersion += 1
  window.removeEventListener('keydown', onKey)
  timeline?.kill()
})
</script>

<template>
  <h1 class="title">
    {{ status === 'missing' ? '找不到這張訂單' : '訂單已成立' }}
  </h1>

  <p v-if="status === 'loading'" class="state">
    載入中…
  </p>

  <p v-else-if="status === 'error'" class="state">
    訂單資料沒有載入成功。
    <button type="button" class="link" @click="load">
      再試一次
    </button>
  </p>

  <div v-else-if="status === 'missing'" class="state">
    <p>網址可能打錯了，或這張訂單不屬於這個帳號。</p>
    <RouterLink :to="{ name: 'account-orders' }">
      看訂單紀錄
    </RouterLink>
  </div>

  <template v-else-if="order">
    <!-- 提袋：訂單裡的衣服站在袋子裡（後片在衣服後面、前片在前面，衣服露出一截）；剛下單才有落下來的動畫 -->
    <section v-if="garments.length" ref="stage" class="celebrate" :data-state="animState" aria-label="訂單裡的衣服">
      <button v-if="animState === 'playing'" type="button" class="link skip-anim" @click="skip">跳過</button>
      <div class="bag" aria-hidden="true">
        <svg class="bag-back" viewBox="0 0 320 230" width="320" height="230">
          <path d="M130 96c0-30 60-30 60 0" fill="none" stroke="var(--field-line)" stroke-width="2" />
          <path d="M100 96h120l-6 118H106Z" fill="var(--surface)" stroke="var(--field-line)" stroke-width="2" stroke-linejoin="round" />
        </svg>
        <div class="garments">
          <div v-for="(garment, index) in garments" :key="garment.key" class="slot" :style="slotStyle(index)">
            <div class="drop">
              <GarmentImage :kind="garment.kind" :colour="garment.hex" :fabric="garment.fabric" :height="96" :alt="garment.name" />
            </div>
          </div>
        </div>
        <svg class="bag-front" viewBox="0 0 320 230" width="320" height="230">
          <path d="M100 118h120l-6 96H106Z" fill="var(--surface)" stroke="var(--field-line)" stroke-width="2" stroke-linejoin="round" />
          <path d="M112 136h96" fill="none" stroke="var(--line)" stroke-width="2" />
        </svg>
      </div>
      <p class="celebrate-note">收到了，共 {{ itemCount }} 件。</p>
    </section>

    <p class="lead">
      謝謝你的訂購。{{ note }}
    </p>

    <section class="panel facts" aria-label="訂單資訊">
      <p>
        訂單編號
        <span class="order-id num">{{ order.id }}</span>
      </p>
      <p>
        狀態
        <span class="order-status">{{ order.status }}</span>
      </p>
      <p class="meta">
        下單時間 {{ formatDateTime(order.createdAt) }}・{{ PAYMENT_METHODS[order.payment.method] ?? order.payment.method }}
      </p>
    </section>

    <ul class="done-items" aria-label="訂購商品">
      <li
        v-for="item in order.items"
        :key="`${item.productId}-${item.colour}-${item.size}`"
      >
        <span class="what">
          {{ item.name }}・{{ item.colourName }}・{{ sizeText(item) }} × {{ item.qty }}
        </span>
        <span class="num">
          {{ formatPrice(item.price * item.qty) }}
        </span>
      </li>
    </ul>

    <dl class="amounts">
      <div class="row">
        <dt>小計</dt>
        <dd class="num">{{ formatPrice(order.subtotal) }}</dd>
      </div>
      <div class="row">
        <dt>運費</dt>
        <dd class="num">
          {{ order.shipping ? formatPrice(order.shipping) : '免運' }}
        </dd>
      </div>
      <div class="row total">
        <dt>合計</dt>
        <dd class="num">{{ formatPrice(order.total) }}</dd>
      </div>
    </dl>

    <section class="ship" aria-label="收件資訊">
      <p class="label">寄到</p>
      <p>{{ order.address.recipient }}　{{ order.address.phone }}</p>
      <p class="where">
        {{ order.address.postalCode }} {{ order.address.city }}{{ order.address.district }}{{ order.address.street }}
      </p>
    </section>

    <div class="actions">
      <!-- 還沒付款的：主按鈕是去付款（在訂單明細裡付） -->
      <RouterLink
        v-if="order.payBy"
        :to="{ name: 'account-order', params: { id: order.id } }"
        class="btn primary pay-link"
      >
        去付款
      </RouterLink>
      <RouterLink
        :to="{ name: 'account-order', params: { id: order.id } }"
        class="detail-link"
      >
        看訂單明細
      </RouterLink>
      <RouterLink :to="{ name: 'outfits' }" :class="order.payBy ? 'detail-link' : 'btn primary'">
        繼續逛
      </RouterLink>
    </div>
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

.state {
  display: grid;
  justify-items: start;
  gap: var(--s2);
  padding: var(--s3) 0;
  color: var(--ink-soft);
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

.primary {
  padding: var(--s2) var(--s4);
  font-weight: 700;
}

.hint {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.label {
  color: var(--ink-soft);
  font-size: var(--fs-0);
  letter-spacing: 0.08em;
}

.panel {
  display: grid;
  gap: var(--s3);
  padding: var(--s3);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

/* 提袋的舞台：320×230，置中；衣服與前片的位置全在 CSS，動畫只動 transform 與 opacity（.drop 是每件的外框；GarmentImage 自己的根也叫 .garment，別撞名） */
.celebrate {
  position: relative;
  display: grid;
  justify-items: center;
  gap: var(--s1);
  margin-bottom: var(--s3);
}

.skip-anim {
  position: absolute;
  right: 0;
  top: 0;
}

.bag {
  position: relative;
  width: 320px;
  max-width: 100%;
  height: 230px;
  overflow: hidden;
}

.bag svg {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translateX(-50%);
}

.garments {
  position: absolute;
  inset: 0;
}

.slot {
  position: absolute;
  left: 50%;
  top: 100px;
  transform: translateX(calc(-50% + var(--dx, 0px)));
}

.drop {
  display: block;
  line-height: 0;
}

.celebrate-note {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.lead {
  margin-bottom: var(--s3);
}

.facts {
  gap: var(--s1);
}

.facts p {
  overflow-wrap: anywhere;
}

.order-id {
  overflow-wrap: anywhere;
}

.order-status {
  padding: 0 var(--s1);
  border: 1px solid var(--field-line);
  font-size: var(--fs-0);
}

.meta {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.done-items {
  margin: var(--s3) 0 var(--s2);
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--line);
}

.done-items li {
  display: flex;
  justify-content: space-between;
  gap: var(--s2);
  padding: var(--s1) 0;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-0);
}

.done-items .what {
  min-width: 0;
  overflow-wrap: anywhere;
}

.done-items .num {
  flex: none;
}

.amounts {
  display: grid;
  gap: var(--s1);
  width: 100%;
  max-width: 20rem;
  margin: 0 0 0 auto;
}

.amounts .row {
  display: flex;
  justify-content: space-between;
  gap: var(--s3);
}

.amounts dt {
  color: var(--ink-soft);
}

.amounts dd {
  margin: 0;
}

.amounts .total {
  margin-top: var(--s1);
  padding-top: var(--s2);
  border-top: 1px solid var(--line);
  font-size: var(--fs-2);
  font-weight: 700;
}

.amounts .total dt {
  color: var(--ink);
}

.ship {
  display: grid;
  gap: 0.1rem;
  margin-top: var(--s3);
}

.where {
  color: var(--ink-soft);
  font-size: var(--fs-0);
  overflow-wrap: anywhere;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s2) var(--s3);
  margin-top: var(--s3);
}

.detail-link {
  font-size: var(--fs-0);
  text-underline-offset: 0.3em;
}

@media (max-width: 30rem) {
  .panel {
    padding: var(--s2);
  }
}
</style>
