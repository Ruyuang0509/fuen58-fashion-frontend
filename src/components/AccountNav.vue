<script setup>
// 會員中心的分頁列（第十五輪子輪 2 改成帶圖示：項目從三個變五個，手機上橫向可捲；子輪 4 加「我的偏好」成六個）。
// 收藏與看過的不需要登入也能用，它們有自己的網址，這裡只是從會員中心也到得了。
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '@/components/Icon.vue'
import { useSession } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const { user, logout } = useSession()

// 兩組：帳號的（要登入）、不必登入也有的。桌機上六個放不進 38rem 的欄，就照這兩組換行；手機上一列橫向捲
const groups = [
  [
    { name: 'account', label: '個人資料', icon: 'user' },
    { name: 'account-addresses', label: '地址簿', icon: 'pin' },
    { name: 'account-orders', label: '訂單紀錄', icon: 'bag' },
    { name: 'account-style', label: '我的偏好', icon: 'palette' },
  ],
  [
    { name: 'favorites', label: '收藏', icon: 'heart' },
    { name: 'history', label: '看過的', icon: 'clock' },
  ],
]

const section = computed(() => (
  route.name === 'account-order' ? 'account-orders' : route.name
))

// 手機上分頁列會橫向捲：目前這一頁的分頁要在看得到的地方（六個之後，第四個起在 390 寬會被切掉）。
// 只動列自己的 scrollLeft，不用 scrollIntoView——那會連頁面一起捲
const list = ref(null)
function reveal() {
  const ul = list.value
  const item = ul?.querySelector('a.current')?.parentElement
  if (!ul || !item || ul.scrollWidth <= ul.clientWidth) return
  ul.scrollLeft = Math.max(0, item.offsetLeft - (ul.clientWidth - item.offsetWidth) / 2)
}
onMounted(reveal)
watch(section, () => nextTick(reveal))

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
    <ul ref="list">
      <template v-for="(group, g) in groups" :key="g">
        <li v-for="link in group" :key="link.name">
          <RouterLink
            :to="{ name: link.name }"
            :class="{ current: section === link.name }"
            :aria-current="section === link.name ? 'page' : undefined"
          >
            <Icon :name="link.icon" />
            <span>{{ link.label }}</span>
          </RouterLink>
        </li>
        <!-- 兩組之間換行（桌機）；手機一列不換行，這個不顯示 -->
        <li v-if="g === 0" class="break" aria-hidden="true"></li>
      </template>
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

/* 分頁列：桌機照兩組換成兩列（六個放不進 38rem 的欄）；手機上不換行、一列橫向可捲 */
ul {
  position: relative;
  display: flex;
  flex-wrap: wrap;
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

.break {
  flex-basis: 100%;
  height: 0;
}

@media (max-width: 36rem) {
  ul {
    flex-wrap: nowrap;
  }

  .break {
    display: none;
  }
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
