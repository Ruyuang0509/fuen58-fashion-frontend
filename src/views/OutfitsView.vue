<script setup>
// 全部穿搭：同一片天空（今天的），矮一點；底下是一句話篩選列與全部的穿搭。
import { computed, onMounted, ref } from 'vue'
import { getThemes, getWeather } from '@/api'
import OutfitStage from '@/components/OutfitStage.vue'
import SentenceBar from '@/components/SentenceBar.vue'
import SkyPage from '@/components/SkyPage.vue'

const weather = ref(null)
const themes = ref([])
const count = ref(null)

onMounted(async () => {
  const [weatherResult, themeResult] = await Promise.allSettled([getWeather(), getThemes()])
  if (weatherResult.status === 'fulfilled') weather.value = weatherResult.value
  if (themeResult.status === 'fulfilled') themes.value = themeResult.value
})

const conditionText = computed(() => ({ rain: '有雨', cloudy: '多雲', clear: '晴' })[weather.value?.condition] ?? '')
</script>

<template>
  <SkyPage class="outfits-page" :weather="weather" height="54svh" min-height="24rem" skip-target="#list" skip-label="跳到穿搭">
    <template #hero>
      <div class="say">
        <p v-if="weather" class="today">{{ weather.city }}，<span class="num">{{ weather.temperature }}°</span><template v-if="conditionText">，{{ conditionText }}</template>。</p>
        <h1 class="line">全部的穿搭</h1>
        <p class="tagline">
          <template v-if="themes.length">{{ themes.length }} 條路線</template><template v-if="count !== null">，{{ count }} 套</template>。用下面那句話篩。
        </p>
      </div>
    </template>

    <template #default="{ heroHeight }">
      <div id="list" class="shop">
        <SentenceBar :offset="heroHeight + 200" />
        <main class="stage">
          <OutfitStage @count="count = $event" />
        </main>
      </div>
    </template>
  </SkyPage>
</template>

<style scoped>
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

.stage {
  max-width: var(--stage-max);
  margin-inline: auto;
  padding: var(--s4) var(--s3) var(--s5);
  min-height: 60vh;
}

@media (max-width: 52rem) {
  .say {
    position: static;
  }
}
</style>
