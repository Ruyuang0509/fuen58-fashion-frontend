<script setup>
// 全站的線條圖示：一套 24×24、1.6 粗的描邊，顏色跟著文字（currentColor），大小跟著字級（1em）。
// 自己畫而不用圖示套件：只要十來個，而且要和天空、款式圖同一種「細線」的語彙。
defineProps({
  name: { type: String, required: true },
})

const PATHS = {
  search: ['M11 4.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Z', 'M15.8 15.8 21 21'],
  hanger: ['M12 3.5a2.2 2.2 0 1 1 2.2 2.2c-1.3 0-2.2.9-2.2 2.1V9', 'M12 9 3.2 15.6c-.7.5-.3 1.6.6 1.6h16.4c.9 0 1.3-1.1.6-1.6L12 9Z'],
  bag: ['M6.5 8.5h11l.9 12H5.6l.9-12Z', 'M9 8.5V7a3 3 0 0 1 6 0v1.5'],
  user: ['M12 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z', 'M4.5 20a7.5 7.5 0 0 1 15 0'],
  camera: ['M4 8h3l1.5-2h7L17 8h3v11H4V8Z', 'M12 10.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z'],
  sun: ['M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z', 'M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4'],
  cloud: ['M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.3 11.6 3.5 3.5 0 0 0 7 18.5Z'],
  rain: ['M7 15.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.3 8.6 3.5 3.5 0 0 0 7 15.5Z', 'M9 18l-1 3M13 18l-1 3M17 18l-1 3'],
  moon: ['M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z'],
  down: ['M12 4v16', 'M6 14l6 6 6-6'],
  swap: ['M4 7h13l-3-3', 'M20 17H7l3 3'],
  close: ['M6 6l12 12M18 6 6 18'],
  plus: ['M12 5v14M5 12h14'],
  arrow: ['M4 12h15', 'M13 6l6 6-6 6'],
  up: ['M12 20V4', 'M6 10l6-6 6 6'],
}
</script>

<template>
  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path v-for="(d, i) in PATHS[name] ?? []" :key="i" :d="d" />
  </svg>
</template>

<style scoped>
.icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  vertical-align: -0.125em;
  flex: none;
}
</style>
