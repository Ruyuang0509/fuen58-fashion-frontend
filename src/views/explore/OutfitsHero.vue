<script setup>
// 全部穿搭的第一屏：矮一點的今天的天空，一句話說有幾條路線。穿搭與一句話列在 ExploreView。
import { computed, inject, onMounted, ref } from 'vue'
import { getThemes } from '@/api'
import { useExploreSky } from '@/stores/explore'

const { setSky } = useExploreSky()
setSky({ height: '54svh', minHeight: '24rem' })

const weather = inject('today', ref(null))
const themes = ref([])
onMounted(async () => {
  try {
    themes.value = await getThemes()
  } catch {
    themes.value = []
  }
})
const conditionText = computed(() => ({ rain: '有雨', cloudy: '多雲', clear: '晴' })[weather.value?.condition] ?? '')
</script>

<template>
  <div class="outfits-hero">
    <div class="say">
      <p v-if="weather" class="today">{{ weather.city }}，<span class="num">{{ weather.temperature }}°</span><template v-if="conditionText">，{{ conditionText }}</template>。</p>
      <h1 class="line">全部的穿搭</h1>
      <p class="tagline"><template v-if="themes.length">{{ themes.length }} 條路線。</template>用下面那句話篩：給誰穿、去哪裡、什麼風格、找哪一件、什麼尺寸。</p>
    </div>
  </div>
</template>

<style scoped>
.outfits-hero {
  position: absolute;
  inset: 0;
}

.say {
  position: absolute;
  left: 2.4rem;
  bottom: 26%;
  display: grid;
  gap: 0.6rem;
  max-width: 36rem;
}

.today {
  margin: 0;
  color: var(--fg-soft);
  font-size: 0.95rem;
  letter-spacing: 0.1em;
}

.num {
  font-family: 'Space Mono', monospace;
  font-size: 0.92em;
}

.line {
  margin: 0;
  font-weight: 600;
  font-size: clamp(2rem, 4.4vw, 3.4rem);
  line-height: 1.3;
  letter-spacing: 0.1em;
}

.tagline {
  margin: 0;
  color: var(--fg-soft);
  font-size: 1.05rem;
}

@media (max-width: 52rem) {
  .outfits-hero {
    position: static;
  }

  .say {
    position: static;
  }
}
</style>
