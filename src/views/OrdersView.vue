<script setup>
// 訂單紀錄維持標準清單結構，讓會員能快速辨識狀態並進入明細。
import '@fontsource/space-mono/400.css'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AccountNav from '@/components/AccountNav.vue'
import { formatDate, listOrders } from '@/api/account'
import { formatPrice } from '@/products/labels'
import { useSession } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const { token, logout } = useSession()

const orders = ref([])
const status = ref('loading')

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

  <ul v-else-if="orders.length" class="orders">
    <li v-for="order in orders" :key="order.id" class="order">
      <RouterLink
        :to="{ name: 'account-order', params: { id: order.id } }"
        class="order-link"
      >
        <span class="id num">{{ order.id }}</span>
        <span class="order-status">{{ order.status }}</span>
        <span class="date">{{ formatDate(order.createdAt) }}・共 {{ itemCount(order) }} 件</span>
        <span class="total num">{{ formatPrice(order.total) }}</span>
      </RouterLink>
    </li>
  </ul>

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
  font-size: var(--fs-0);
}

.date {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.total {
  justify-self: end;
  font-weight: 700;
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
