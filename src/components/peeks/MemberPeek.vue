<script setup>
// 會員預覽：登入了就是一個小選單（個人資料、訂單、我的偏好、看過的、登出）；沒登入就是登入／註冊兩顆鈕。
import { useRouter } from 'vue-router'
import Icon from '@/components/Icon.vue'
import { useSession } from '@/stores/session'

const router = useRouter()
const { user, loggedIn, logout } = useSession()

const links = [
  { name: 'account', label: '個人資料', icon: 'user' },
  { name: 'account-orders', label: '訂單紀錄', icon: 'bag' },
  { name: 'account-style', label: '我的偏好', icon: 'palette' },
  { name: 'history', label: '看過的', icon: 'clock' },
]

function signOut() {
  logout()
  router.push('/')
}
</script>

<template>
  <div class="member-peek">
    <template v-if="loggedIn">
      <p class="peek-title">{{ user.name }}</p>
      <ul class="menu">
        <li v-for="link in links" :key="link.name">
          <RouterLink :to="{ name: link.name }"><Icon :name="link.icon" />{{ link.label }}</RouterLink>
        </li>
        <li><button type="button" class="logout" @click="signOut">登出</button></li>
      </ul>
    </template>
    <template v-else>
      <p class="peek-title">還沒登入</p>
      <p class="hint">登入後，收藏會跟著你的帳號走；結帳也要登入。</p>
      <div class="peek-actions">
        <RouterLink class="btn" :to="{ name: 'login' }">登入</RouterLink>
        <RouterLink class="btn ghost" :to="{ name: 'register' }">註冊</RouterLink>
      </div>
    </template>
  </div>
</template>

<style scoped>
.peek-title {
  margin: 0 0 var(--s2);
  font-weight: 700;
}

.menu {
  display: grid;
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.menu a,
.logout {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.4rem 0.5rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink);
  font: inherit;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.menu a:hover,
.menu a:focus-visible,
.logout:hover,
.logout:focus-visible {
  background: color-mix(in srgb, var(--accent) 10%, white);
}

.logout {
  margin-top: 0.3rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--line);
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  color: var(--ink-soft);
}

.hint {
  margin: 0 0 var(--s2);
  color: var(--ink-soft);
}

.peek-actions {
  display: flex;
  gap: var(--s2);
}

.btn {
  padding: 0.45rem 1rem;
  font-size: var(--fs-0);
}

.ghost {
  background: transparent;
  color: var(--ink);
  border: 1px solid var(--field-line);
}
</style>
