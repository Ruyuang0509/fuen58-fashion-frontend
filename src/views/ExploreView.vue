<script setup>
// 探索區的殼：首頁、路線頁、全部穿搭共用這一個 SkyPage，天空裡的內容由子路由換（HomeHero、ThemeHero、OutfitsHero）。
// 底下的店（一句話篩選列＋穿搭）也在這裡，三頁共用；只有標題跟著頁面變。
// 這樣從首頁點進路線、或在店裡換風格，天空不重建、頂欄不重畫——以前會像網頁刷新（第十四輪使用者回報）。
import { computed, onMounted, provide, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getThemes, getWeather } from '@/api'
import OutfitStage from '@/components/OutfitStage.vue'
import SentenceBar from '@/components/SentenceBar.vue'
import SkyPage from '@/components/SkyPage.vue'
import { useExploreSky } from '@/stores/explore'

const route = useRoute()
const { sky } = useExploreSky()
const page = ref(null)
const weather = ref(null)
const themes = ref([])
const count = ref(null)

// 子頁要量天空（首頁的 probe）或要今天的天氣，從這裡拿
provide('skyPage', page)
provide('today', weather)

onMounted(async () => {
  const [weatherResult, themeResult] = await Promise.allSettled([getWeather(), getThemes()])
  if (weatherResult.status === 'fulfilled') weather.value = weatherResult.value
  if (themeResult.status === 'fulfilled') themes.value = themeResult.value
})

const title = computed(() => {
  if (route.name === 'theme') {
    const name = themes.value.find((theme) => theme.code === route.params.code)?.name
    return name ? `${name}路線的穿搭` : '這條路線的穿搭'
  }
  return route.name === 'outfits' ? '全部的穿搭' : '今天全部的穿搭'
})
// 全部穿搭的天空矮，一句話列早一點收合
const offsetExtra = computed(() => (route.name === 'outfits' ? 200 : 320))
</script>

<template>
  <SkyPage
    ref="page"
    class="explore"
    :weather="sky.weather ?? weather"
    :hour="sky.hour"
    :tint="sky.tint"
    :height="sky.height"
    :min-height="sky.minHeight"
    skip-target="#shop"
    skip-label="跳到穿搭"
  >
    <template #hero>
      <RouterView />
    </template>

    <template #default="{ heroHeight }">
      <div id="shop" class="shop">
        <SentenceBar :offset="heroHeight + offsetExtra" />
        <main class="stage">
          <h2 class="shop-title">{{ title }}<span v-if="count !== null" class="count">　{{ count }} 套</span></h2>
          <OutfitStage @count="count = $event" />
        </main>
      </div>
    </template>
  </SkyPage>
</template>

<style scoped>
.stage {
  max-width: var(--stage-max);
  margin-inline: auto;
  padding: var(--s4) var(--s3) var(--s5);
  min-height: 60vh;
}

.shop-title {
  margin: 0 0 var(--s4);
  font-size: var(--fs-2);
  font-weight: 400;
  letter-spacing: 0.12em;
  color: var(--ink-soft);
}

.count {
  font-family: 'Space Mono', monospace;
  font-size: 0.85em;
}
</style>
