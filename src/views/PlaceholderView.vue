<script setup>
import { useRoute } from 'vue-router'

// 還沒做的頁面共用這個畫面，內容全部來自路由的 meta
const route = useRoute()
const ZONE_NAMES = { explore: '探索區', transaction: '交易區' }
</script>

<template>
  <h1>{{ route.meta.title }}</h1>
  <p class="tags">{{ ZONE_NAMES[route.meta.zone] }} · 層級：{{ route.meta.level }}</p>
  <p>{{ route.meta.note }}</p>
  <p class="todo">這一頁還沒做。</p>
  <RouterLink class="btn" to="/">回入口</RouterLink>
</template>

<style scoped>
h1 {
  margin-block: var(--s3) var(--s2);
}

p {
  margin-bottom: var(--s2);
}

.tags,
.todo {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}
</style>
