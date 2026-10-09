<script setup>
// 身形資料（第十六輪子輪 2）：會員中心的一頁。身高、體重，三圍選填；只用來算尺寸建議，不公開。
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { formatDate } from '@/api/account'
import AccountNav from '@/components/AccountNav.vue'
import BodyForm from '@/components/BodyForm.vue'
import { describeBody } from '@/products/sizeAdvice'
import { useBody } from '@/stores/body'
import { useSession } from '@/stores/session'

const route = useRoute()
const { body } = useBody()
const { user } = useSession()

const updatedAt = computed(() => user.value?.body?.updatedAt ?? null)
// 從商品頁過來的，存完可以回去
const back = computed(() => {
  const value = route.query.redirect
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : ''
})
</script>

<template>
  <AccountNav />
  <header class="head">
    <h1>身形</h1>
    <p class="lead">商品頁的「建議尺寸」用這些算：以模特兒的身高體重為基準，有三圍再和尺寸表逐項比。只有你看得到。</p>
  </header>

  <section class="panel" aria-labelledby="body-title">
    <h2 id="body-title" class="section-title">你的身形</h2>
    <p v-if="body" class="now">現在是 <strong>{{ describeBody(body) }}</strong><template v-if="updatedAt">，{{ formatDate(updatedAt) }} 填的</template>。</p>
    <p v-else class="soft">還沒填。填了之後每件商品會多一行「建議 M」和為什麼。</p>
    <BodyForm />
    <p v-if="back" class="back"><RouterLink :to="back">回到剛才的商品</RouterLink></p>
  </section>
</template>

<style scoped>
.head {
  display: grid;
  gap: var(--s1);
  margin-block: var(--s3) var(--s3);
}

.head h1 {
  font-size: var(--fs-3);
}

.lead,
.soft {
  color: var(--ink-soft);
}

.panel {
  display: grid;
  gap: var(--s2);
  padding: var(--s3);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
}

.section-title {
  margin: 0;
  font-size: var(--fs-2);
  font-weight: 400;
  letter-spacing: 0.12em;
  color: var(--ink-soft);
}

.now {
  margin: 0;
}

.back {
  margin: 0;
  font-size: var(--fs-0);
}

.back a {
  color: var(--ink);
  text-underline-offset: 0.3em;
}

@media (max-width: 30rem) {
  .panel {
    padding: var(--s2);
  }
}
</style>
