<script setup>
// 服飾平面款式圖（flat）：成衣業畫版型用的正面線稿。全部由程式畫，不是圖片檔。
// 線條顏色跟著 CSS 的 color 走（currentColor），填色由 --flat-fill 決定，
// 所以同一張圖可以是線稿，也可以是色塊。路徑資料在 src/garments/flats.js。
import { computed } from 'vue'
import { FLAT_BOX, FLATS } from '@/garments/flats'

const props = defineProps({
  kind: { type: String, required: true }, // coat | top | trousers | skirt | beanie
  // seams：畫不畫縫線、口袋、摺線這些細節。色塊風格會關掉。
  seams: { type: Boolean, default: true },
})

const flat = computed(() => FLATS[props.kind])
</script>

<template>
  <svg v-if="flat" class="flat" :viewBox="`0 0 ${FLAT_BOX.width} ${FLAT_BOX.height}`" role="img" :aria-label="kind" focusable="false">
    <path class="body" :d="flat.body" />
    <g v-if="seams" class="seam">
      <path v-for="d in flat.seams" :key="d" :d="d" />
      <path v-for="d in flat.stitches" :key="d" class="stitch" :d="d" />
      <circle v-for="[cx, cy] in flat.dots" :key="`${cx}-${cy}`" :cx="cx" :cy="cy" r="1.6" />
    </g>
  </svg>
</template>

<style scoped>
.flat {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.flat path,
.flat circle {
  fill: none;
  stroke: currentColor;
  stroke-width: var(--flat-stroke, 1.2);
  stroke-linejoin: round;
  stroke-linecap: round;
  /* 圖放大縮小時線寬不跟著變 */
  vector-effect: non-scaling-stroke;
}

.flat .body {
  fill: var(--flat-fill, none);
}

.flat .seam path,
.flat .seam circle {
  stroke-width: var(--flat-seam-stroke, 0.8);
  opacity: var(--flat-seam-opacity, 0.75);
}

/* 車縫線：虛線 */
.flat .stitch {
  stroke-dasharray: 2.5 2.5;
}
</style>
