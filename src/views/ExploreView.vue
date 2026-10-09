<script setup>
// 探索區的殼：首頁、路線頁、全部穿搭、活動頁共用這一個 SkyPage，天空裡的內容由子路由換
// （HomeHero、ThemeHero、OutfitsHero、CampaignHero）。底下的店（一句話篩選列＋穿搭）也在這裡，四頁共用；
// 標題跟著頁面變，活動頁只列那檔活動的穿搭與單品，首頁最後多兩排單品（新上架、熱銷）。
// 這樣從首頁點進路線、或在店裡換風格，天空不重建、頂欄不重畫——以前會像網頁刷新（第十四輪使用者回報）。
import { computed, onMounted, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getCampaign, getCampaigns, getProducts, getThemes } from '@/api'
import HomeShelves from '@/components/HomeShelves.vue'
import OutfitStage from '@/components/OutfitStage.vue'
import ProductCard from '@/components/ProductCard.vue'
import SentenceBar from '@/components/SentenceBar.vue'
import SkyPage from '@/components/SkyPage.vue'
import WeekStrip from '@/components/WeekStrip.vue'
import { useFilters } from '@/composables/useFilters'
import { useExploreSky } from '@/stores/explore'
import { useTaste } from '@/stores/taste'
import { useWeather } from '@/stores/weather'

const route = useRoute()
const { sky } = useExploreSky()
const { filters } = useFilters()
const { profile, forYou, setForYou, nameOf } = useTaste()
// 天氣（第十六輪子輪 1）：整站共用的 store；天空、子頁的一行字都讀它
const { weather } = useWeather()
const page = ref(null)
const themes = ref([])
const count = ref(null)
const activeCampaigns = ref([])
const campaign = ref(null)
const campaignProducts = ref([])

// 子頁要量天空（首頁的 probe）或要今天的天氣，從這裡拿
provide('skyPage', page)
provide('today', weather)

onMounted(async () => {
  const [themeResult, campaignResult] = await Promise.allSettled([getThemes(), getCampaigns({ active: true, placement: 'stage' })])
  if (themeResult.status === 'fulfilled') themes.value = themeResult.value
  if (campaignResult.status === 'fulfilled') activeCampaigns.value = campaignResult.value
})

// 活動頁：殼自己也要那檔活動（標題、只列哪幾套、哪幾件單品）。連續換頁時只採用最後一次的結果
let latest = 0
watch(
  () => (route.name === 'campaign' ? String(route.params.code) : null),
  async (code) => {
    const ticket = ++latest
    if (!code) {
      campaign.value = null
      campaignProducts.value = []
      return
    }
    try {
      const found = await getCampaign(code)
      if (ticket !== latest) return
      campaign.value = found
      const items = found ? await getProducts({ ids: found.productIds }) : []
      if (ticket !== latest) return
      campaignProducts.value = items
    } catch {
      if (ticket !== latest) return
      campaign.value = null
      campaignProducts.value = []
    }
  },
  { immediate: true },
)

const title = computed(() => {
  if (route.name === 'theme') {
    const name = themes.value.find((theme) => theme.code === route.params.code)?.name
    return name ? `${name}路線的穿搭` : '這條路線的穿搭'
  }
  if (route.name === 'campaign') return campaign.value ? `${campaign.value.title}的穿搭` : '這檔活動的穿搭'
  return route.name === 'outfits' ? '全部的穿搭' : '今天全部的穿搭'
})

// 舞台裡插哪些活動：首頁與全部穿搭插全部進行中的，路線頁只插同路線的，活動頁不插
const tiles = computed(() => {
  if (route.name === 'campaign') return []
  if (route.name === 'theme') return activeCampaigns.value.filter((item) => item.themeCode === route.params.code)
  return activeCampaigns.value
})
// 活動頁的店只列這檔活動的穿搭；其他頁不限
const stageIds = computed(() => (route.name === 'campaign' ? (campaign.value?.outfitIds ?? []) : null))
const waiting = computed(() => route.name === 'campaign' && !campaign.value)

// 全部穿搭的天空矮，一句話列早一點收合
const offsetExtra = computed(() => (route.name === 'outfits' ? 200 : 320))

// 為你排（第十五輪子輪 4）：舞台說它現在是照喜好排的，標題就多一格「，照你的喜好排」；
// 底下一行是理由（「你挑了 3 套街頭，街頭的排前面。」）和關掉的鈕；關著的時候那行說「照原本的順序」並給開回來的鈕。
// 選了風格或在活動頁就沒有這一行：那裡本來就不照喜好排
const sorted = ref(false)
const tasteLine = computed(() => !!profile.value && !filters.value.style && route.name !== 'campaign')
const reason = computed(() => {
  const top = profile.value?.reasons[0]
  return top ? `${top.text}，${nameOf(top.code)}的排前面。` : ''
})
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
          <!-- 首頁多一排「這一週穿什麼」（第十六輪子輪 1） -->
          <WeekStrip v-if="route.name === 'home'" />
          <div class="shop-head">
            <h2 class="shop-title">{{ title }}<span v-if="count !== null" class="count">　{{ count }} 套</span><span v-if="sorted" class="for-you">，照你的喜好排</span></h2>
            <p v-if="tasteLine" class="taste-line">
              <template v-if="forYou">{{ reason }}</template>
              <template v-else>照原本的順序。</template>
              <button type="button" class="taste-toggle" @click="setForYou(!forYou)">{{ forYou ? '不要照喜好排' : '照我的喜好排' }}</button>
            </p>
          </div>
          <OutfitStage :campaigns="tiles" :ids="stageIds" :waiting="waiting" @count="count = $event" @sorted="sorted = $event" />

          <section v-if="route.name === 'campaign' && campaignProducts.length" class="campaign-items" aria-label="這檔活動的單品">
            <h2 class="shop-title">這檔活動的單品<span class="count">　{{ campaignProducts.length }} 件</span></h2>
            <div class="items-grid">
              <ProductCard v-for="item in campaignProducts" :key="item.productId" :product="item" />
            </div>
          </section>

          <HomeShelves v-if="route.name === 'home'" />
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

/* 標題與底下的為你排那一行一組；標題自己的下邊距交給這一組 */
.shop-head {
  margin-bottom: var(--s4);
}

.shop-head .shop-title {
  margin-bottom: 0;
}

.taste-line {
  margin: var(--s1) 0 0;
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.taste-toggle {
  margin-left: var(--s2);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 0.3em;
  cursor: pointer;
}

.campaign-items {
  margin-top: var(--s5);
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: var(--s3);
}
</style>
