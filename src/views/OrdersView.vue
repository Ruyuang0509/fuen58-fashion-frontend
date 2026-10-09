<script setup>
// 訂單紀錄（第十輪）：標準清單，快速辨識狀態、進明細。
// 第十七輪子輪 1：依狀態篩選（寫在網址 ?status=）、狀態小標分調子、待付款的列顯示付款期限。
import '@fontsource/space-mono/400.css'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AccountNav from '@/components/AccountNav.vue'
import { formatDate, formatDateTime, listOrders } from '@/api/account'
import { STATUS_FILTERS, isCod, statusTone } from '@/orders/status'
import { formatPrice } from '@/products/labels'
import { useSession } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const { token, logout } = useSession()

const orders = ref([])
const status = ref('loading')

const filter = computed(() => STATUS_FILTERS.find((entry) => entry.code === route.query.status) ?? STATUS_FILTERS[0])
const counts = computed(() => Object.fromEntries(STATUS_FILTERS.map((entry) => [entry.code, orders.value.filter(entry.match).length])))
const shown = computed(() => orders.value.filter(filter.value.match))

// 篩選寫進網址（重新整理、上一頁都保持）；全部就把 status 拿掉
const pick = (code) => {
  const { status: _dropped, ...rest } = route.query
  router.replace({ query: code ? { ...rest, status: code } : rest })
}

const load = async () => {
  status.value = 'loading'

  try {
    orders.value = await listOrders(token.value)
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

const itemCount = (order) => (
  order.items.reduce((sum, item) => sum + item.qty, 0)
)

onMounted(load)
</script>

<template>
  <AccountNav />
  <h1 class="title">訂單紀錄</h1>

  <p v-if="status === 'loading'" class="state">載入中…</p>

  <p v-else-if="status === 'error'" class="state">
    訂單沒有載入成功。
    <button type="button" class="link" @click="load">再試一次</button>
  </p>

  <template v-else-if="orders.length">
    <div class="status-filter" role="group" aria-label="依狀態篩選">
      <button
        v-for="entry in STATUS_FILTERS"
        :key="entry.code"
        type="button"
        :aria-pressed="entry.code === filter.code"
        @click="pick(entry.code)"
      >
        {{ entry.label }} <span class="count num">{{ counts[entry.code] }}</span>
      </button>
    </div>

    <ul v-if="shown.length" class="orders">
      <li v-for="order in shown" :key="order.id" class="order">
        <RouterLink
          :to="{ name: 'account-order', params: { id: order.id } }"
          class="order-link"
        >
          <span class="id num">{{ order.id }}</span>
          <span class="order-status" :class="`tone-${statusTone(order.status)}`">{{ order.status }}</span>
          <span class="date">
            {{ formatDate(order.createdAt) }}・共 {{ itemCount(order) }} 件<template v-if="isCod(order) && order.status === '待付款'">・貨到付款</template>
          </span>
          <span class="total num">{{ formatPrice(order.total) }}</span>
          <span v-if="order.payBy" class="deadline">付款期限 {{ formatDateTime(order.payBy) }}，逾時會自動取消</span>
        </RouterLink>
      </li>
    </ul>

    <div v-else class="empty">
      <p>沒有「{{ filter.label }}」的訂單。</p>
      <button type="button" class="link" @click="pick('')">看全部</button>
    </div>
  </template>

  <div v-else class="empty">
    <p>還沒有訂單。</p>
    <RouterLink class="btn" :to="{ name: 'outfits' }">看全部穿搭</RouterLink>
  </div>
</template>

<style scoped>
.title {
  margin-block: var(--s3) var(--s3);
  font-size: var(--fs-3);
}

.status-filter {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s1);
  margin-bottom: var(--s3);
}

.status-filter button {
  padding: var(--s1) var(--s2);
  border: 1px solid var(--field-line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink);
  font-size: var(--fs-0);
  cursor: pointer;
}

.status-filter button[aria-pressed='true'] {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
}

.status-filter .count {
  opacity: 0.8;
}

.orders {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--line);
}

.order-link {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--s1) var(--s3);
  padding: var(--s2) 0;
  border-bottom: 1px solid var(--line);
  color: inherit;
  text-decoration: none;
}

.id {
  text-decoration: underline;
  text-underline-offset: 0.3em;
  overflow-wrap: anywhere;
}

.order-status {
  justify-self: end;
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

.date {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.total {
  justify-self: end;
  font-weight: 700;
}

.deadline {
  grid-column: 1 / -1;
  font-size: var(--fs-0);
}

.order-link:hover .id {
  text-decoration-thickness: 2px;
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

.state,
.empty {
  display: grid;
  justify-items: start;
  gap: var(--s2);
  padding: var(--s3) 0;
  color: var(--ink-soft);
}

@media (max-width: 30rem) {
  .order-link {
    gap: var(--s1) var(--s2);
  }
}
</style>
