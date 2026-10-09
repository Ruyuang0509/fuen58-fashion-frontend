<script setup>
// 「出了點問題」（第十七輪子輪 2）：沒接住的錯誤落到這裡，不留白頁、不留半頁。
// 自己畫整個畫面、不套頂欄——錯誤可能就是頂欄丟的。兩條路：重新載入這一頁、回入口（都是整頁重載，狀態從頭來）。
import { SITE_NAME } from '@/config'

defineProps({
  fatal: { type: Object, required: true }, // { message, where, stack, at }
})

const reload = () => window.location.reload()
const home = () => window.location.assign(import.meta.env.BASE_URL)
const dev = import.meta.env.DEV
</script>

<template>
  <div class="error-screen" role="alert">
    <p class="brand">{{ SITE_NAME }}</p>
    <h1 tabindex="-1">出了點問題</h1>
    <p class="lead">這一頁壞掉了，不是你做錯什麼。重新載入通常就好；還是不行的話，回入口再走一次。</p>
    <div class="actions">
      <button type="button" class="btn reload" @click="reload">重新載入這一頁</button>
      <button type="button" class="btn quiet home" @click="home">回入口</button>
    </div>
    <!-- 開發版把錯誤印出來；正式版只在主控台 -->
    <details v-if="dev" class="detail">
      <summary>錯誤內容（開發版才顯示）</summary>
      <pre>{{ fatal.where ? `[${fatal.where}] ` : '' }}{{ fatal.message }}
{{ fatal.stack }}</pre>
    </details>
  </div>
</template>

<style scoped>
.error-screen {
  display: grid;
  gap: var(--s2);
  max-width: var(--column-max);
  min-height: 100vh;
  margin-inline: auto;
  padding: var(--s4) var(--s3);
  align-content: center;
}

.brand {
  font-family: 'Noto Serif TC', serif;
  color: var(--ink-soft);
}

h1 {
  font-size: var(--fs-3);
}

h1:focus {
  outline: none;
}

.lead {
  color: var(--ink-soft);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
  margin-top: var(--s2);
}

.quiet {
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--field-line);
}

.detail {
  margin-top: var(--s3);
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.detail pre {
  overflow: auto;
  max-height: 16rem;
  padding: var(--s2);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
