<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FEATURES, SITE_NAME } from '@/config'
import { useCart } from '@/stores/cart'
import { useSession } from '@/stores/session'

// float：浮在首頁的天空上，沒有底色與底線，字色跟著外面；捲過天空後由外面把它關掉
defineProps({
  float: { type: Boolean, default: false },
})

const route = useRoute()
const router = useRouter()
const { count } = useCart()
// 登入後「會員」變成名字，連到會員中心；沒登入連到登入頁
const { user, loggedIn } = useSession()
// 搜尋框顯示網址上的關鍵字：在搜尋結果頁重新整理、按上一頁，框裡的字和結果一致
const keyword = ref(String(route.query.q ?? ''))
watch(() => route.query.q, (q) => (keyword.value = String(q ?? '')))

// 件數變了就跳一下（只是回饋；數字本身立刻更新，沒有延遲）
const bump = ref(false)
watch(count, () => {
  bump.value = false
  requestAnimationFrame(() => (bump.value = true))
})

function search() {
  const q = keyword.value.trim()
  if (q) router.push({ name: 'search', query: { q } })
}
</script>

<template>
  <header class="site-header" :class="{ float }">
    <RouterLink to="/" class="brand">{{ SITE_NAME }}</RouterLink>

    <form class="search" role="search" @submit.prevent="search">
      <label class="visually-hidden" for="site-search">搜尋單品或品牌</label>
      <input id="site-search" v-model="keyword" type="search" placeholder="搜尋單品、品牌" />
      <button type="submit">搜尋</button>
    </form>

    <!-- 「天氣穿搭」不另設連結：首頁第一屏就是它（2026-10-06 使用者裁決）；穿搭牆有內容前先不放 -->
    <nav class="links" aria-label="主要">
      <RouterLink :to="{ name: 'outfits' }">全部穿搭</RouterLink>
      <RouterLink v-if="FEATURES.wall" to="/wall">穿搭牆</RouterLink>
      <RouterLink to="/cart" class="cart-link">
        購物車<span v-if="count" class="count" :class="{ bump }">{{ count }}<span class="visually-hidden"> 件</span></span>
      </RouterLink>
      <RouterLink v-if="loggedIn" :to="{ name: 'account' }" class="member">{{ user.name || '會員' }}</RouterLink>
      <RouterLink v-else :to="{ name: 'login' }">會員</RouterLink>
    </nav>
  </header>
</template>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: var(--s3);
  min-height: var(--header-h);
  padding: 0 var(--s3);
  background: var(--bg);
  border-bottom: 1px solid var(--line);
}

/* 浮在天空上：透明、沒有線，顏色繼承；搜尋框只剩一條底線 */
.site-header.float {
  background: transparent;
  border-bottom-color: transparent;
  color: inherit;
}

.site-header.float .search input,
.site-header.float .search button {
  border-color: color-mix(in srgb, currentColor 55%, transparent);
  background: transparent;
  color: inherit;
}

.site-header.float .search input::placeholder {
  color: inherit;
  opacity: 0.7;
}

.site-header,
.site-header .search input,
.site-header .search button {
  transition: background-color var(--ease), border-color var(--ease), color var(--ease);
}

.brand {
  font-size: var(--fs-2);
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}

.search {
  display: flex;
  gap: var(--s1);
  margin-left: auto;
}

.search input {
  width: 14rem;
  padding: var(--s1) var(--s2);
  border: 1px solid var(--field-line);
  border-radius: 999px;
  background: var(--surface);
}

.search button {
  padding: var(--s1) var(--s2);
  border: 1px solid var(--field-line);
  border-radius: 999px;
  background: var(--surface);
  cursor: pointer;
}

.links {
  display: flex;
  gap: var(--s3);
  white-space: nowrap;
}

.links a {
  text-decoration: none;
}

/* 目前所在的頁面：用底線標示，不只靠顏色 */
.links a.router-link-active {
  text-decoration: underline;
  text-underline-offset: 0.4em;
}

.count {
  display: inline-block;
  min-width: 1.5em;
  margin-left: var(--s1);
  padding: 0 0.4em;
  border-radius: 999px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: var(--fs-0);
  text-align: center;
}

.count.bump {
  animation: bump 0.35s ease;
}

@keyframes bump {
  40% {
    transform: scale(1.3);
  }
}

/* 窄螢幕：搜尋框換到第二列，佔滿寬度 */
@media (max-width: 48rem) {
  .site-header {
    /* 兩列的頂欄太高，黏在上面會吃掉手機四分之一個畫面 */
    position: static;
    flex-wrap: wrap;
    gap: var(--s2);
    padding-block: var(--s2);
  }

  .links {
    margin-left: auto;
    gap: var(--s2);
  }

  .search {
    order: 3;
    width: 100%;
    margin-left: 0;
  }

  .search input {
    flex: 1;
    width: auto;
  }
}
</style>
