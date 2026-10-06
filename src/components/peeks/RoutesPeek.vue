<script setup>
// 「全部穿搭」的預覽：八條路線直接列出來（各帶自己的顏色點），不用先進去再換；底下是全部穿搭與全部單品。
import { onMounted, ref } from 'vue'
import { getThemes } from '@/api'
import { accentOf } from '@/theme/themes'

const themes = ref([])
onMounted(async () => {
  try {
    themes.value = await getThemes()
  } catch {
    themes.value = []
  }
})
</script>

<template>
  <div class="routes-peek">
    <p class="peek-title">八條路線</p>
    <ul class="routes">
      <li v-for="theme in themes" :key="theme.code">
        <RouterLink :to="{ name: 'theme', params: { code: theme.code } }">
          <i class="dot" :style="{ background: accentOf(theme.code) }" aria-hidden="true"></i>
          <span class="name">{{ theme.name }}</span>
          <span class="tagline">{{ theme.tagline }}</span>
        </RouterLink>
      </li>
    </ul>
    <div class="peek-actions">
      <RouterLink class="btn" :to="{ name: 'outfits' }">全部穿搭</RouterLink>
      <RouterLink class="btn ghost" :to="{ name: 'products' }">全部單品</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.peek-title {
  margin: 0 0 var(--s2);
  font-weight: 700;
}

.routes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.2rem var(--s2);
  margin: 0 0 var(--s2);
  padding: 0;
  list-style: none;
}

.routes a {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: 0.5rem;
  align-items: center;
  padding: 0.35rem 0.5rem;
  border-radius: var(--radius-sm);
  color: var(--ink);
  text-decoration: none;
}

.routes a:hover,
.routes a:focus-visible {
  background: color-mix(in srgb, var(--accent) 10%, white);
}

.dot {
  grid-row: 1 / 3;
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
}

.name {
  font-weight: 700;
}

.tagline {
  grid-column: 2;
  color: var(--ink-soft);
  font-size: 0.75rem;
  white-space: nowrap;
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
