<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSession } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const { user, logout } = useSession()

const links = [
  { name: 'account', label: '個人資料' },
  { name: 'account-addresses', label: '地址簿' },
  { name: 'account-orders', label: '訂單紀錄' },
]

const section = computed(() => (
  route.name === 'account-order' ? 'account-orders' : route.name
))

function signOut() {
  // 登入狀態會同步清除，不必等後端完成才換頁
  logout()
  router.push('/')
}
</script>

<template>
  <nav class="account-nav" aria-label="會員中心">
    <div class="head">
      <p v-if="user" class="who">
        <span class="name">{{ user.name }}</span> 的會員中心
      </p>
      <button type="button" class="logout" @click="signOut">
        登出
      </button>
    </div>
    <ul>
      <li v-for="link in links" :key="link.name">
        <RouterLink
          :to="{ name: link.name }"
          :class="{ current: section === link.name }"
        >
          {{ link.label }}
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.account-nav {
  display: grid;
  gap: var(--s2);
  margin-top: var(--s3);
  padding-bottom: var(--s2);
  border-bottom: 1px solid var(--line);
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s2);
}

.who {
  color: var(--ink-soft);
  font-size: var(--fs-0);
  overflow-wrap: anywhere;
}

.name {
  color: var(--ink);
  font-weight: 700;
}

.logout {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-soft);
  font-size: var(--fs-0);
  text-decoration: underline;
  text-underline-offset: 0.3em;
  cursor: pointer;
}

ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s3);
  margin: 0;
  padding: 0;
  list-style: none;
}

a {
  color: inherit;
  text-decoration: none;
}

/* 目前所在的分頁：用底線標示，不只靠顏色 */
a.current {
  text-decoration: underline;
  text-underline-offset: 0.4em;
}
</style>
