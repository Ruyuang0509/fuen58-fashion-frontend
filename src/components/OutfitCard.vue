<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import FavButton from '@/components/FavButton.vue'
import OutfitLook from '@/components/OutfitLook.vue'
import { useFlyToCart } from '@/composables/useFlyToCart'
import { rememberLook } from '@/motion/lookFlip'
import { useCart } from '@/stores/cart'
import { accentOf } from '@/theme/themes'

const props = defineProps({
  outfit: { type: Object, required: true },
  themeName: { type: String, default: '' },
  // 一句話列選的尺寸（可以多選，第十五輪子輪 3 起是陣列；空的代表沒選）
  preferredSize: { type: [String, Array], default: '' },
})

const { add } = useCart()
const { fly } = useFlyToCart()
const root = ref(null)
const price = new Intl.NumberFormat('zh-TW')
const total = computed(() => props.outfit.items.reduce((sum, item) => sum + item.price, 0))
// 滑過單品清單的哪一件：那一列亮起來，人形裡那一件也提出來（2026-10-06 使用者：讓買家更直觀知道自己點到啥）
const hovered = ref(null)

// 加入購物車後短暫顯示的回饋文字
const feedback = ref('')
let feedbackTimer = null

function sizeFor(item) {
  if (item.sizes.length === 1) return item.sizes[0]
  // 選了好幾個尺寸時，挑這件有的第一個
  const wanted = [].concat(props.preferredSize).filter(Boolean)
  return wanted.find((size) => item.sizes.includes(size)) ?? null
}

function addAll() {
  // 顏色用這套穿搭選的那個
  for (const item of props.outfit.items) add(item, sizeFor(item), item.colourCode ?? null)
  fly(root.value?.querySelector('.photo img'))
  feedback.value = `已加入 ${props.outfit.items.length} 件`
  clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => (feedback.value = ''), 2000)
}

onBeforeUnmount(() => clearTimeout(feedbackTimer))
</script>

<template>
  <article ref="root" class="card" :data-theme="outfit.themeCode" :style="{ '--card-accent': accentOf(outfit.themeCode) }">
    <!-- 穿搭的樣子：三件疊成人形（正式版換成照片，版面不變）；底是主題色加大量白；整塊連到這套的頁面。點了之後衣服從這裡飛到穿搭頁 -->
    <RouterLink :to="{ name: 'outfit', params: { id: outfit.id } }" class="photo" :aria-label="`看這套：${outfit.title}`" @click="rememberLook(outfit, $event.currentTarget)">
      <OutfitLook :outfit="outfit" :height="220" :caption="false" :highlight="hovered" />
    </RouterLink>

    <div class="body">
      <h3><RouterLink :to="{ name: 'outfit', params: { id: outfit.id } }" class="title" @click="rememberLook(outfit, root)">{{ outfit.title }}</RouterLink></h3>
      <p class="meta">{{ themeName }} · {{ outfit.items.length }} 件 · NT$ {{ price.format(total) }}</p>

      <ul class="items">
        <li v-for="item in outfit.items" :key="item.productId" :class="{ hl: item.productId === hovered }" @pointerenter="hovered = item.productId" @pointerleave="hovered = null">
          <RouterLink :to="{ name: 'product', params: { id: item.productId }, query: item.colourCode ? { colour: item.colourCode } : {} }" class="item-name">{{ item.name }}</RouterLink>
          <span class="brand">{{ item.brand }}<template v-if="item.colourName">・{{ item.colourName }}</template></span>
          <span class="price">NT$ {{ price.format(item.price) }}</span>
        </li>
      </ul>

      <div class="actions">
        <button type="button" class="btn" @click="addAll">整套加入購物車</button>
        <FavButton kind="outfits" :id="outfit.id" label="收藏這套" :name="outfit.title" />
        <!-- role="status"：讀屏會把這段文字唸出來，不用搶走焦點 -->
        <span class="feedback" role="status">{{ feedback }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.card {
  background: var(--surface);
  border-top: 4px solid var(--card-accent);
  border-radius: var(--radius);
  overflow: hidden;
}

.photo {
  display: grid;
  place-items: center;
  aspect-ratio: 4 / 5;
  padding: var(--s2);
  /* 主題色加大量白，只當底；滑過去深一點 */
  background: color-mix(in srgb, var(--card-accent) 12%, white);
  transition: background-color 0.4s ease;
}

.photo:hover,
.photo:focus-visible {
  background: color-mix(in srgb, var(--card-accent) 20%, white);
}

.body {
  padding: var(--s3) var(--s3) var(--s3);
}

.title {
  color: inherit;
  text-decoration: none;
  background-image: linear-gradient(currentColor, currentColor);
  background-repeat: no-repeat;
  background-size: 0 1px;
  background-position: 0 100%;
  transition: background-size 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.title:hover,
.title:focus-visible {
  background-size: 100% 1px;
}

.meta {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.items {
  margin: var(--s2) 0;
  padding: 0;
  list-style: none;
}

/* 每一件是一列；滑過整列亮起來（底色是主題色加大量白），名稱底下的線畫出來 */
.items li {
  display: grid;
  grid-template-columns: 1fr auto;
  column-gap: var(--s2);
  margin-inline: calc(-1 * var(--s2));
  padding: var(--s1) var(--s2);
  border-top: 1px solid var(--line);
  border-radius: var(--radius-sm);
  transition: background-color 0.25s ease;
}

.items li.hl {
  background: color-mix(in srgb, var(--card-accent) 10%, white);
  border-top-color: transparent;
}

.items li.hl + li {
  border-top-color: transparent;
}

.item-name {
  color: inherit;
  text-decoration: none;
  background-image: linear-gradient(currentColor, currentColor);
  background-repeat: no-repeat;
  background-size: 0 1px;
  background-position: 0 100%;
  transition: background-size 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  justify-self: start;
}

.items li.hl .item-name,
.item-name:focus-visible {
  background-size: 100% 1px;
}

.brand {
  grid-column: 1;
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

/* 金額靠右、數字等寬，上下列才對得齊 */
.price {
  grid-column: 2;
  grid-row: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--s2);
}

.feedback {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}
</style>
