<script setup>
// 一件商品的圖。現在是程式畫的：有款式圖的畫款式圖（打光過），沒有的畫一塊布料近拍。
// 正式上線時這個元件換成 <img :src="product.image">，用它的地方都不用改。
import { computed } from 'vue'
import { renderGarment, renderSwatch } from '@/garments/render'

const props = defineProps({
  // 款式代碼（coat、top…）；沒有就畫布料近拍
  kind: { type: String, default: null },
  colour: { type: String, default: '#cccccc' },
  fabric: { type: String, default: 'cotton' },
  // 畫出來的高度（像素），寬跟著款式圖的比例
  height: { type: Number, default: 300 },
  alt: { type: String, default: '' },
})

// 畫的解析度比顯示的高一些，放大看不糊；上限避免畫太大張
const px = computed(() => Math.min(1400, Math.round(props.height * 1.6)))
const src = computed(() =>
  props.kind
    ? renderGarment(props.kind, { colour: props.colour, fabric: props.fabric, px: px.value })
    : renderSwatch({ colour: props.colour, fabric: props.fabric, px: px.value }),
)
</script>

<template>
  <img :src="src" :alt="alt" :class="['garment', { swatch: !kind }]" :style="{ '--h': `${height}px` }" draggable="false" />
</template>

<style scoped>
.garment {
  display: block;
  height: var(--h);
  width: auto;
  max-width: 100%;
  object-fit: contain;
  filter: drop-shadow(0 14px 20px rgba(20, 24, 40, 0.24));
}

/* 布料近拍：正方形，比款式圖小一點，不然會像一個色塊 */
.garment.swatch {
  height: calc(var(--h) * 0.72);
  filter: drop-shadow(0 10px 16px rgba(20, 24, 40, 0.22));
}
</style>
