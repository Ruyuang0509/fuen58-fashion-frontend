<script setup>
// 商品頁的尺寸建議（第十六輪子輪 2）：放在選尺寸的旁邊。
// 有身形 → 一行「建議 L」加依據（規則寫在畫面上），建議的尺寸沒貨會說；
// 沒身形 → 「輸入身高體重看建議」展開兩個欄位，填了馬上算（訪客存本機、登入的進帳號）。
// 不建議的商品（單一尺寸、童裝、沒有模特兒資料）整塊不出現。
import { computed, ref } from 'vue'
import BodyForm from '@/components/BodyForm.vue'
import { useSizeAdvice } from '@/composables/useSizeAdvice'
import { describeBody } from '@/products/sizeAdvice'
import { useSession } from '@/stores/session'

const props = defineProps({
  product: { type: Object, required: true },
  // 某個尺寸在目前顏色有沒有貨
  stockOf: { type: Function, default: () => 1 },
})

const { body, advice } = useSizeAdvice(() => props.product)
const { loggedIn } = useSession()
const editing = ref(false)

const advisable = computed(() => (props.product?.sizes ?? []).filter((size) => ['XS', 'S', 'M', 'L', 'XL', 'XXL'].includes(size)).length >= 2 && !!props.product?.fit)
const outOfStock = computed(() => !!advice.value?.size && props.stockOf(advice.value.size) === 0)
const alternatives = computed(() => (advice.value?.alternatives ?? []).map((entry) => `${entry.note}選 ${entry.size}`).join('，'))
</script>

<template>
  <div v-if="advisable" class="size-advice" :class="{ has: !!advice }">
    <template v-if="advice && !editing">
      <p v-if="advice.far" class="line">{{ advice.text }}</p>
      <p v-else class="line">
        <strong class="pick">建議 {{ advice.size }}</strong>
        <span class="why">{{ advice.text }}<template v-if="advice.also"> {{ advice.also }}</template><template v-if="alternatives">{{ alternatives }}。</template></span>
      </p>
      <p v-if="outOfStock && !advice.far" class="stock">建議的 {{ advice.size }} 這個顏色沒貨了。</p>
      <p class="meta">
        依你的身形 {{ describeBody(body) }}
        <template v-if="loggedIn">（<RouterLink :to="{ name: 'account-body' }">改身形</RouterLink>）</template>
        <template v-else>（<button type="button" class="link" @click="editing = true">改一下</button>）</template>
      </p>
    </template>
    <details v-else class="size-help" :open="editing || undefined">
      <summary>輸入身高體重看建議</summary>
      <p class="hint">只用來算這件該選哪個尺寸；{{ loggedIn ? '存在你的帳號' : '存在這個瀏覽器' }}，不公開。</p>
      <!-- 這塊在購買區塊的 <form> 裡面：inline 讓它不再包一層表單 -->
      <BodyForm compact inline submit-label="看建議" @saved="editing = false" />
    </details>
  </div>
</template>

<style scoped>
.size-advice {
  display: grid;
  gap: var(--s1);
  font-size: var(--fs-0);
}

.line {
  margin: 0;
  line-height: 1.6;
}

.pick {
  margin-right: var(--s2);
  color: var(--ink);
  font-weight: 700;
}

.why,
.meta,
.hint {
  color: var(--ink-soft);
}

.stock {
  margin: 0;
  color: #9b2c2c; /* 與卡片底 7.6:1（check-contrast 有量） */
}

.meta {
  margin: 0;
}

.meta a,
.link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 0.3em;
  cursor: pointer;
}

.size-help summary {
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 0.3em;
}

.size-help .hint {
  margin: var(--s1) 0 var(--s2);
}
</style>
