<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ErrorScreen from '@/components/ErrorScreen.vue'
import SentenceBar from '@/components/SentenceBar.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import SiteHeader from '@/components/SiteHeader.vue'
import { useThemeAccent } from '@/composables/useThemeAccent'
import { useFatal } from '@/stores/fatal'

const route = useRoute()
// 兩個區共用同一個框架，只差在主內容的寬度和有沒有一句話列
const isExplore = computed(() => route.meta.zone === 'explore')
// 沒接住的錯誤：整個畫面換成「出了點問題」（main.js 把錯誤報進來）
const { fatal } = useFatal()

useThemeAccent()
</script>

<template>
  <ErrorScreen v-if="fatal" :fatal="fatal" />
  <!-- bare：這一頁自己畫全部畫面，不套全站框架 -->
  <RouterView v-else-if="route.meta.bare" />
  <template v-else>
    <a class="skip" href="#main">跳到主要內容</a>
    <SiteHeader />
    <SentenceBar v-if="route.meta.sentence" />
    <main id="main" tabindex="-1" :class="isExplore ? 'stage' : 'column'">
      <RouterView />
    </main>
    <SiteFooter />
  </template>
  <!-- 換頁的播報（main.js 寫進來）：讀屏知道到了哪一頁 -->
  <div id="route-announcer" class="visually-hidden" aria-live="polite" aria-atomic="true"></div>
</template>

<style scoped>
main {
  margin-inline: auto;
  padding: var(--s3);
  /* 內容很少時，頁尾也貼在視窗底部 */
  min-height: calc(100vh - var(--header-h) - 8rem);
}

/* 換頁時焦點會落在 main（還沒有 h1 的那一瞬間）：不畫外框 */
main:focus {
  outline: none;
}

.stage {
  max-width: var(--stage-max);
}

.column {
  max-width: var(--column-max);
}

/* 鍵盤使用者按第一下 Tab 才會出現，用來跳過頂欄 */
.skip {
  position: absolute;
  left: var(--s2);
  top: -4rem;
  z-index: 30;
  padding: var(--s1) var(--s2);
  background: var(--surface);
}

.skip:focus {
  top: var(--s1);
}
</style>
