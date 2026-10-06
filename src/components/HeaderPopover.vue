<script setup>
// 頂欄圖示的預覽（2026-10-06 使用者：「右上的 icon 們增加 link 以外的作用，比如購物車 hover 或點開為小視窗能預覽購物車」）。
// 包住一個頂欄的連結：滑鼠滑到（停 120 ms）或鍵盤 Tab 到就打開底下的小面板，滑走（寬限 220 ms，從圖示移到面板不會關）、焦點離開、Esc 都會關。
// 點圖示本身還是原本的連結。只在桌機（≥ 48rem）開：手機沒有 hover，點下去就是要去那一頁；觸控的 pointerenter 也不算。
import { onBeforeUnmount, ref } from 'vue'

defineProps({
  label: { type: String, required: true }, // 面板叫什麼（給讀屏：「購物車預覽」）
  wide: { type: Boolean, default: false }, // 內容是兩欄（八條路線）時放寬，路線的一句話才不會被截掉
})

const open = ref(false)
const root = ref(null)
let showTimer = 0
let hideTimer = 0

const enabled = () => window.matchMedia('(min-width: 48rem)').matches

function show(event) {
  if (!enabled() || event?.pointerType === 'touch') return
  clearTimeout(hideTimer)
  clearTimeout(showTimer)
  showTimer = setTimeout(() => (open.value = true), 120)
}

function hide(delay = 220) {
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => (open.value = false), delay)
}

function onFocusIn() {
  if (!enabled()) return
  clearTimeout(hideTimer)
  open.value = true
}

function onFocusOut(event) {
  if (!root.value?.contains(event.relatedTarget)) hide(0)
}

function onKey(event) {
  if (event.key !== 'Escape' || !open.value) return
  hide(0)
  root.value?.querySelector('a, button')?.focus()
}

onBeforeUnmount(() => {
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
})
</script>

<template>
  <div ref="root" class="peek" :class="{ open }" @pointerenter="show" @pointerleave="hide()" @focusin="onFocusIn" @focusout="onFocusOut" @keydown="onKey">
    <slot name="trigger" />
    <Transition name="peek">
      <div v-if="open" class="peek-panel" :class="{ wide }" role="group" :aria-label="label">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.peek {
  position: relative;
}

.peek-panel {
  position: absolute;
  top: calc(100% + 0.15rem);
  right: 0;
  z-index: 40;
  width: max-content;
  min-width: 16rem;
  max-width: 22rem;
  padding: var(--s3);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 16px 40px rgba(31, 29, 26, 0.14);
  text-align: left;
  font-size: var(--fs-0);
  letter-spacing: 0;
  line-height: var(--lh);
}

.peek-panel.wide {
  max-width: 30rem;
}

.peek-enter-active,
.peek-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.peek-enter-from,
.peek-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .peek-enter-active,
  .peek-leave-active {
    transition: none;
  }
}
</style>
