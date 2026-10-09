<script setup>
// 註冊後的「也填身形？」（第十六輪子輪 2）：從偏好調查的結果頁連過來，可以略過；填了之後商品頁就有尺寸建議。
// 不插在三步調查裡（已經夠長），所以是獨立的一頁。
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BodyForm from '@/components/BodyForm.vue'

const route = useRoute()
const router = useRouter()

// 回哪裡：只接受站內路徑，沒給就回首頁
const target = computed(() => {
  const value = route.query.redirect
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'
})

function done() {
  router.push(target.value)
}
</script>

<template>
  <div class="body-quiz">
    <h1>也填一下身形？</h1>
    <p class="lead">身高、體重就夠（三圍選填）。只用來算每件商品該選哪個尺寸，不公開；三十秒，也可以先不填。</p>
    <div class="panel">
      <BodyForm submit-label="存好，開始逛" @saved="done" />
    </div>
    <p class="skip"><RouterLink :to="target">先不填，直接開始逛</RouterLink></p>
  </div>
</template>

<style scoped>
.body-quiz {
  display: grid;
  gap: var(--s3);
  padding-block: var(--s3) var(--s5);
}

h1 {
  font-size: var(--fs-3);
  letter-spacing: 0.04em;
}

.lead {
  margin: 0;
  max-width: 34em;
  color: var(--ink-soft);
}

.panel {
  padding: var(--s3);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
}

.skip {
  margin: 0;
  font-size: var(--fs-0);
}

.skip a {
  color: var(--ink-soft);
  text-underline-offset: 0.3em;
}

.skip a:hover,
.skip a:focus-visible {
  color: var(--ink);
}

@media (max-width: 30rem) {
  .panel {
    padding: var(--s2);
  }
}
</style>
