<script setup>
// 一套穿搭的「樣子」：把外套、上衣、下身三件疊成一個人形的輪廓，像掛在半空中的一套衣服。
// 單品圖現在是程式把款式圖打光畫出來的（render.js）；正式上線時每件換成商品去背照片，版面不變。
// 會動的三件事（第十一輪）：
//   1. 平常像掛著一樣慢慢晃（很小的幅度）；
//   2. 天空的風（SkyPage 給的 --wind）會把它推歪一點；
//   3. 滑過去會盪一下。系統設定減少動態時全部不動。
import { computed } from 'vue'
import { renderGarment } from '@/garments/render'

const props = defineProps({
  outfit: { type: Object, required: true },
  // 整套的高度（像素）；寬跟著算
  height: { type: Number, default: 300 },
  // 要不要帶標題、品牌、總價那一行（放進卡片時卡片自己有文字，就關掉）
  caption: { type: Boolean, default: true },
  // 要不要晃
  sway: { type: Boolean, default: true },
  // 把哪一件提出來（商品代碼）；穿搭頁滑過單品清單時用
  highlight: { type: Number, default: null },
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
  <figure class="look" :class="{ sway }" :style="{ '--h': `${height}px` }">
    <div class="swing">
      <div class="stack" aria-hidden="true">
        <img
          v-for="item in layers"
          :key="item.productId"
          :src="item.src"
          :class="['piece', item.category, { hl: item.productId === highlight }]"
          alt=""
          draggable="false"
        />
      </div>
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

/* 掛著的那一點在最上面：所有的晃都繞著它 */
.swing,
.stack {
  transform-origin: 50% 0;
}

.swing {
  width: 100%;
}

.look.sway .swing {
  animation: breathe 7s ease-in-out infinite alternate;
}

/* 滑過去：盪一下再回來 */
.look.sway:hover .swing {
  animation: swing 1.3s cubic-bezier(0.2, 0.8, 0.2, 1) 1;
}

/* 天空的風：推歪一點，風停了慢慢回正 */
.stack {
  position: relative;
  width: 100%;
  height: var(--h);
  transform: rotate(calc(var(--wind, 0) * 5deg));
  transition: transform 0.9s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes breathe {
  from {
    transform: rotate(-0.7deg);
  }
  to {
    transform: rotate(0.7deg);
  }
}

@keyframes swing {
  0% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(2.6deg);
  }
  55% {
    transform: rotate(-1.6deg);
  }
  80% {
    transform: rotate(0.7deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

/* 三件疊成一個人形：上衣在上半，外套蓋住上衣，下身接在腰的位置 */
.piece {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  object-fit: contain;
  filter: drop-shadow(0 18px 24px rgba(20, 24, 40, 0.28));
  pointer-events: none;
  transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.35s;
}

/* 被點名的那一件：往前提一點 */
.piece.hl {
  transform: translateX(-50%) translateY(-8px) scale(1.03);
  filter: drop-shadow(0 26px 30px rgba(20, 24, 40, 0.34)) brightness(1.04);
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

@media (prefers-reduced-motion: reduce) {
  .look.sway .swing,
  .look.sway:hover .swing {
    animation: none;
  }

  .stack {
    transform: none;
    transition: none;
  }
}
</style>
