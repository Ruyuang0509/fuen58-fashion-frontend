<script setup>
// 完成頁集中呈現訂單結果，讓買家立即核對付款、商品與收件資訊。
import '@fontsource/space-mono/400.css'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  PAYMENT_METHODS,
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

const note = computed(() => {
  if (!order.value) return ''
  if (order.value.status === '已付款') {
    return '付款完成，我們會盡快出貨。'
  }
  if (order.value.payment.method === 'cod') {
    return '貨到付款：商品送到時再付款。'
  }
  return '這張訂單還沒有付款。'
})

const sizeText = (item) => (
  item.size === 'F' ? '單一尺寸' : item.size
)

const load = async () => {
  status.value = 'loading'

  try {
    const found = await getOrder(token.value, route.params.orderId)

    if (!found) {
      order.value = null
      status.value = 'missing'
      return
    }

    order.value = found
    status.value = 'ready'
  } catch (error) {
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

onMounted(load)
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
      <RouterLink
        :to="{ name: 'account-order', params: { id: order.id } }"
        class="detail-link"
      >
        看訂單明細
      </RouterLink>
      <RouterLink :to="{ name: 'outfits' }" class="btn primary">
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

  .done-items li {
    align-items: flex-start;
  }
}
</style>
