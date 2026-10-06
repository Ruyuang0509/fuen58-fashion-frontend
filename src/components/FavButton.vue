<script setup>
// 收藏的愛心（第十五輪子輪 2）：單品卡、商品頁、穿搭卡、穿搭頁都用這一顆。
// 收起來是描邊的心，收藏後填滿、換成強調色；按下去的那一刻跳一下，並有一顆小愛心飛到頂欄的「收藏」。
// 它是真的 <button aria-pressed>，不是連結裡的裝飾——所以單品卡的根元素改成 <article>，按鈕放在連結外面。
import { computed, onBeforeUnmount, ref } from 'vue'
import Icon from '@/components/Icon.vue'
import { useFlyToCart } from '@/composables/useFlyToCart'
import { useFavorites } from '@/stores/favorites'

const props = defineProps({
  kind: { type: String, required: true }, // products | outfits
  id: { type: Number, required: true },
  colour: { type: String, default: '' }, // 單品：收藏時看的顏色代碼
  name: { type: String, default: '' }, // 給讀屏聽的名字
  label: { type: String, default: '' }, // 要顯示文字時給（例如「收藏這套」）
  onLabel: { type: String, default: '已收藏' },
})

const { has, toggle } = useFavorites()
const { flyHeart } = useFlyToCart()
const root = ref(null)
const popping = ref(false)
let popTimer = 0

const on = computed(() => has(props.kind, props.id))
const text = computed(() => (on.value ? props.onLabel : props.label))
const spoken = computed(() => `${on.value ? '取消收藏' : '收藏'}${props.name ? `：${props.name}` : ''}`)

async function click() {
  const turnedOn = await toggle(props.kind, props.id, props.colour ? { colour: props.colour } : {})
  if (!turnedOn) return
  popping.value = true
  clearTimeout(popTimer)
  popTimer = setTimeout(() => (popping.value = false), 450)
  flyHeart(root.value?.querySelector('.icon'))
}

onBeforeUnmount(() => clearTimeout(popTimer))
</script>

<template>
  <button
    ref="root"
    type="button"
    class="fav"
    :class="{ on, popping, 'has-label': !!label }"
    :aria-pressed="on"
    :aria-label="label ? undefined : spoken"
    :title="label ? undefined : spoken"
    @click="click"
  >
    <Icon name="heart" />
    <span v-if="label" class="fav-text">{{ text }}</span>
  </button>
</template>

<style scoped>
.fav {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 2.4rem;
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--field-line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: var(--fs-0);
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: border-color var(--ease), color var(--ease), background-color var(--ease);
}

/* 只有圖示時是一顆圓的 */
.fav:not(.has-label) {
  width: 2.4rem;
  padding: 0;
}

.fav .icon {
  font-size: 1.15rem;
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.fav:hover,
.fav:focus-visible {
  border-color: var(--ink);
}

.fav:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.fav:active .icon {
  transform: scale(0.85);
}

/* 收藏後：強調色、填滿 */
.fav.on {
  color: var(--accent);
  border-color: var(--accent);
}

.fav.on :deep(.icon path) {
  fill: currentColor;
}

.fav.popping .icon {
  animation: pop 0.45s ease;
}

@keyframes pop {
  40% {
    transform: scale(1.4);
  }
}

@media (prefers-reduced-motion: reduce) {
  .fav,
  .fav .icon {
    transition: none;
    animation: none;
  }
}
</style>
