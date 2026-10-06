<script setup>
// 一套穿搭的「樣子」：把外套、上衣、下身三件疊成一個人形的輪廓，像掛在半空中的一套衣服。
// 單品圖現在是程式把款式圖打光畫出來的（render.js）；正式上線時每件換成商品去背照片，版面不變。
import { computed } from 'vue'
import { renderGarment } from '@/garments/render'

const props = defineProps({
  outfit: { type: Object, required: true },
  // 整套的高度（像素）；寬跟著算
  height: { type: Number, default: 300 },
  // 要不要帶標題、品牌、總價那一行（放進卡片時卡片自己有文字，就關掉）
  caption: { type: Boolean, default: true },
})

// 只畫有款式圖的三類；順序固定：上衣在最後面、外套蓋在上衣上、下身在最前面
const ORDER = ['top', 'outer', 'bottom']
const layers = computed(() => {
  const picked = ORDER.map((category) => props.outfit.items.find((item) => item.category === category && item.kind)).filter(Boolean)
  // 外層是連身裙時，下身（襯裙之類）在裙子裡面，不畫
  const outer = picked.find((item) => item.category === 'outer')
  return (outer?.kind === 'dress' ? picked.filter((item) => item.category !== 'bottom') : picked).map((item) => ({
      ...item,
      src: renderGarment(item.kind, { colour: item.colour, fabric: item.fabric ?? fabricOf(item.kind), px: 560 }),
    }))
})

// 商品資料沒給布料時，依款式猜一個
function fabricOf(kind) {
  return { jacket: 'leather', vest: 'nylon', coat: 'wool', skirt: 'satin', trousers: 'denim' }[kind] ?? 'cotton'
}

const total = computed(() => props.outfit.items.reduce((sum, item) => sum + item.price, 0))
const brands = computed(() => [...new Set(props.outfit.items.map((item) => item.brand))])
</script>

<template>
  <figure class="look" :style="{ '--h': `${height}px` }">
    <div class="stack" aria-hidden="true">
      <img v-for="item in layers" :key="item.productId" :src="item.src" :class="['piece', item.category]" alt="" draggable="false" />
    </div>
    <figcaption v-if="caption">
      <strong>{{ outfit.title }}</strong>
      <span class="meta">{{ brands.join('・') }}　<span class="num">NT$ {{ total.toLocaleString('zh-TW') }}</span></span>
    </figcaption>
  </figure>
</template>

<style scoped>
.look {
  margin: 0;
  display: grid;
  gap: 0.6rem;
  justify-items: center;
  width: calc(var(--h) * 0.62);
}

/* 三件疊成一個人形：上衣在上半，外套蓋住上衣，下身接在腰的位置 */
.stack {
  position: relative;
  width: 100%;
  height: var(--h);
}

.piece {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  object-fit: contain;
  filter: drop-shadow(0 18px 24px rgba(20, 24, 40, 0.28));
  pointer-events: none;
}

.piece.top {
  top: 0;
  height: 48%;
  z-index: 1;
}

.piece.outer {
  top: -2%;
  height: 56%;
  z-index: 2;
}

.piece.bottom {
  top: 42%;
  height: 58%;
  z-index: 3;
}

figcaption {
  display: grid;
  gap: 0.15rem;
  text-align: center;
  line-height: 1.4;
}

figcaption strong {
  font-weight: 600;
  font-size: 0.95rem;
}

.meta {
  font-size: 0.78rem;
  opacity: 0.75;
}

.num {
  font-family: 'Space Mono', monospace;
  letter-spacing: -0.02em;
}
</style>
