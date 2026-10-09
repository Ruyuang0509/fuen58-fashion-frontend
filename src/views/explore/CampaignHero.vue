<script setup>
// 活動頁的第一屏（第十五輪）：一檔活動就是一條限時的路線——天空用它所屬路線的時刻，顏色也跟著；
// 第一屏放活動名、一句話、期間與最多三套穿搭。店的部分由 ExploreView 的殼接手（只列這檔活動的穿搭與單品）。
// 過期的活動照開（連結還會被人貼來貼去），只是多一行「已經結束」，而且不再出現在舞台與頁尾。
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getCampaign, getCampaigns } from '@/api'
import Icon from '@/components/Icon.vue'
import OutfitLook from '@/components/OutfitLook.vue'
import { gsap, reducedMotion } from '@/motion/gsap'
import { rememberLook } from '@/motion/lookFlip'
import { useExploreSky } from '@/stores/explore'
import { accentOf, momentOf } from '@/theme/themes'

const route = useRoute()
const { setSky } = useExploreSky()
const campaign = ref(null)
const others = ref([])
const loaded = ref(false)
const reduced = reducedMotion()

// 用 computed：從一檔活動換到另一檔，Vue Router 沿用同一個元件、只換網址參數
const code = computed(() => String(route.params.code))
const looks = computed(() => campaign.value?.outfits.slice(0, 3) ?? [])
const monthDay = (iso) => {
  const [, month, day] = iso.split('-')
  return `${+month}/${+day}`
}
const period = computed(() => (campaign.value ? `${monthDay(campaign.value.startsAt)}–${monthDay(campaign.value.endsAt)}` : ''))

// 天空：所屬路線的時刻；活動還沒拿到或找不到時只定高度，天氣用今天
watch(
  campaign,
  (value) => {
    const moment = value ? momentOf(value.themeCode) : null
    setSky(moment ? { hour: moment.hour, weather: moment.weather, tint: accentOf(value.themeCode), height: '78svh', minHeight: '32rem' } : { height: '78svh', minHeight: '32rem' })
  },
  { immediate: true },
)

let latest = 0
// 載入失敗和「找不到」是兩回事（第十七輪子輪 2）：失敗要能再試
const failed = ref(false)
async function load() {
  const ticket = ++latest
  failed.value = false
  try {
    const [found, active] = await Promise.all([getCampaign(code.value), getCampaigns({ active: true })])
    if (ticket !== latest) return
    campaign.value = found
    others.value = active.filter((item) => item.code !== code.value)
  } catch {
    if (ticket !== latest) return
    campaign.value = null
    others.value = []
    failed.value = true
  }
  loaded.value = true
}
watch(code, load, { immediate: true })

// 換一檔活動：天空慢慢移過去的同時，左邊的字一行行從下面浮上來（和路線頁同一套）
const sayEl = ref(null)
watch(code, async (next, previous) => {
  if (!previous || reduced) return
  await nextTick()
  if (sayEl.value) gsap.fromTo(sayEl.value.children, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.06, overwrite: 'auto' })
})

function toList() {
  document.getElementById('shop')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
}
</script>

<template>
  <div class="campaign-hero">
    <template v-if="campaign">
      <div ref="sayEl" class="say">
        <p class="moment">
          活動<span class="sep">　／　</span>{{ period }}
          <template v-if="!campaign.active"><span class="sep">　／　</span>已經結束</template>
        </p>
        <h1 class="line">{{ campaign.title }}</h1>
        <p class="tagline">{{ campaign.tagline }}</p>
        <p v-if="!campaign.active" class="ended">這檔活動已經結束；穿搭和單品還看得到，只是不再放在店裡推。</p>
        <nav v-if="others.length" class="others" aria-label="其他活動">
          <span class="others-label">其他活動</span>
          <RouterLink v-for="item in others" :key="item.code" :to="{ name: 'campaign', params: { code: item.code } }">{{ item.title }}</RouterLink>
        </nav>
      </div>

      <section class="looks" aria-label="這檔活動的穿搭">
        <TransitionGroup name="look" tag="div" class="row">
          <RouterLink v-for="(outfit, i) in looks" :key="outfit.id" :to="{ name: 'outfit', params: { id: outfit.id } }" class="look-link" :style="{ '--i': i }" @click="rememberLook(outfit, $event.currentTarget)">
            <OutfitLook :outfit="outfit" :height="250" />
          </RouterLink>
        </TransitionGroup>
      </section>

      <button type="button" class="down" @click="toList">往下，看這檔活動全部的穿搭<Icon name="down" /></button>
    </template>

    <div v-else-if="loaded && failed" class="say failed">
      <h1 class="line small">活動沒有載入成功</h1>
      <p class="tagline">連不上伺服器，或資料暫時拿不到。</p>
      <button type="button" class="btn retry" @click="load">再試一次</button>
    </div>

    <div v-else-if="loaded" class="say">
      <h1 class="line small">找不到這檔活動</h1>
      <p class="tagline">網址可能打錯了，或這檔活動已經收起來。</p>
      <RouterLink class="btn" :to="{ name: 'outfits' }">看全部穿搭</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.campaign-hero {
  position: absolute;
  inset: 0;
}

.say {
  position: absolute;
  left: 2.4rem;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  gap: 0.7rem;
  max-width: 34rem;
}

.moment {
  margin: 0;
  color: var(--fg-soft);
  font-size: 0.95rem;
  letter-spacing: 0.1em;
}

.sep {
  opacity: 0.6;
}

.line {
  margin: 0;
  font-weight: 600;
  font-size: clamp(2.2rem, 5vw, 3.8rem);
  line-height: 1.2;
  letter-spacing: 0.08em;
}

.line.small {
  font-size: clamp(1.8rem, 3.6vw, 2.6rem);
}

.tagline {
  margin: 0;
  color: var(--fg-soft);
  font-size: 1.15rem;
}

.ended {
  margin: 0;
  color: var(--fg-soft);
  font-size: 0.9rem;
}

.others {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 1.2rem;
  margin-top: 1.6rem;
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 0.9rem;
  letter-spacing: 0.14em;
}

.others-label {
  color: var(--fg-soft);
  font-size: 0.78rem;
}

.others a {
  color: var(--fg-soft);
  padding: 0.3rem 0;
  border-bottom: 1px solid transparent;
  transition: color 0.25s ease, border-color 0.25s ease;
}

.others a:hover,
.others a:focus-visible {
  color: var(--fg);
  border-color: var(--fg);
}

.looks {
  position: absolute;
  right: 2.4rem;
  bottom: 17%;
}

.row {
  display: flex;
  gap: 2rem;
  align-items: flex-end;
}

.look-link {
  transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.look-link:hover {
  transform: translateY(-6px);
}

.look-enter-active {
  transition: opacity 0.6s ease calc(var(--i) * 0.1s), transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) calc(var(--i) * 0.1s);
}

/* 離開的那幾套直接拿掉：留著淡出會和新進來的疊在一起 */
.look-leave-active {
  display: none;
}

.look-enter-from {
  opacity: 0;
  transform: translateY(26px);
}

.down {
  all: unset;
  cursor: pointer;
  position: absolute;
  left: 2.4rem;
  bottom: 1.6rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 0.8rem;
  letter-spacing: 0.16em;
  color: var(--ink-soft);
}

.down .icon {
  transition: transform 0.3s ease;
}

.down:hover .icon,
.down:focus-visible .icon {
  transform: translateY(3px);
}

@media (prefers-reduced-motion: reduce) {
  .look-enter-active,
  .look-link,
  .down .icon {
    transition: none;
  }
}

@media (max-width: 52rem) {
  .campaign-hero {
    position: static;
  }

  .say {
    position: static;
    transform: none;
  }

  .looks {
    position: static;
    width: 100%;
    margin-top: 1.6rem;
  }

  .row {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 0.5rem;
    scroll-snap-type: x mandatory;
  }

  .look-link {
    scroll-snap-align: start;
    flex: 0 0 auto;
  }

  .down {
    position: static;
    margin-top: 1.6rem;
  }
}
</style>
