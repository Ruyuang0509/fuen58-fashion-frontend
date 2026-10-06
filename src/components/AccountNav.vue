<script setup>
// 會員中心的分頁列（第十五輪子輪 2 改成帶圖示：項目從三個變五個，手機上橫向可捲）。
// 收藏與看過的不需要登入也能用，它們有自己的網址，這裡只是從會員中心也到得了。
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '@/components/Icon.vue'
import { useSession } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const { user, logout } = useSession()

const links = [
  { name: 'account', label: '個人資料', icon: 'user' },
  { name: 'account-addresses', label: '地址簿', icon: 'pin' },
  { name: 'account-orders', label: '訂單紀錄', icon: 'bag' },
  { name: 'favorites', label: '收藏', icon: 'heart' },
  { name: 'history', label: '看過的', icon: 'clock' },
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
          :aria-current="section === link.name ? 'page' : undefined"
        >
          <Icon :name="link.icon" />
          <span>{{ link.label }}</span>
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

/* 一列分頁：手機上不換行、橫向可捲 */
ul {
  display: flex;
  gap: var(--s2);
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-x: auto;
  scrollbar-width: none;
}

li {
  flex: none;
}

a {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.8rem;
  border: 1px solid transparent;
  border-radius: 999px;
  color: var(--ink-soft);
  font-size: var(--fs-0);
  letter-spacing: 0.06em;
  text-decoration: none;
  white-space: nowrap;
  transition: color var(--ease), border-color var(--ease), background-color var(--ease);
}

a .icon {
  font-size: 1.1rem;
}

a:hover,
a:focus-visible {
  color: var(--ink);
  border-color: var(--line);
}

/* 目前所在的分頁：有底、有框，不只靠顏色 */
a.current {
  color: var(--ink);
  border-color: var(--ink);
  background: var(--surface);
}
</style>
