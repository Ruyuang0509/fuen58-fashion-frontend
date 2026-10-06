<script setup>
// 路線（主題）頁：這條路線自己的時刻。天空用這個路線的時刻（幾點、什麼天），不用今天的天氣；
// 從一條路線換到另一條，太陽與雲會慢慢移過去，不是切換。底下是一句話篩選列和這條路線全部的穿搭。
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getOutfits, getThemes } from '@/api'
import Icon from '@/components/Icon.vue'
import OutfitLook from '@/components/OutfitLook.vue'
import OutfitStage from '@/components/OutfitStage.vue'
import SentenceBar from '@/components/SentenceBar.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import SiteHeader from '@/components/SiteHeader.vue'
import SkyPage from '@/components/SkyPage.vue'
import { accentOf, momentOf } from '@/theme/themes'

const route = useRoute()
const themes = ref([])
const looks = ref([])
const loaded = ref(false)
const count = ref(null)
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// 用 computed：從一個主題換到另一個主題時，Vue Router 沿用同一個元件、只換網址參數
const code = computed(() => String(route.params.code))
const theme = computed(() => themes.value.find((item) => item.code === code.value))
const moment = computed(() => momentOf(code.value))
const others = computed(() => themes.value.filter((item) => item.code !== code.value))

let latest = 0
async function load() {
  const ticket = ++latest
  try {
    const [themeList, mine] = await Promise.all([getThemes(), getOutfits({ style: code.value })])
    if (ticket !== latest) return
    themes.value = themeList
    looks.value = mine.slice(0, 3)
  } catch {
    themes.value = []
  }
  loaded.value = true
}
watch(code, load, { immediate: true })

function toList() {
  document.getElementById('list')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
}
</script>

<template>
  <SkyPage v-if="theme && moment" class="theme-page" :weather="moment.weather" :hour="moment.hour" :tint="accentOf(code)" height="78svh" min-height="32rem" skip-target="#list" skip-label="跳到穿搭">
    <template #hero>
      <div class="say">
        <p class="moment">{{ theme.name }}路線的時刻<span class="sep">　／　</span>{{ moment.line }}</p>
        <h1 class="line">{{ theme.name }}</h1>
        <p class="tagline">{{ theme.tagline }}</p>
        <nav class="others" aria-label="其他路線">
          <span class="others-label">換一條路線</span>
          <RouterLink v-for="item in others" :key="item.code" :to="{ name: 'theme', params: { code: item.code } }">{{ item.name }}</RouterLink>
        </nav>
      </div>

      <section class="looks" aria-label="這條路線的穿搭">
        <TransitionGroup name="look" tag="div" class="row">
          <RouterLink v-for="(outfit, i) in looks" :key="outfit.id" :to="{ name: 'outfit', params: { id: outfit.id } }" class="look-link" :style="{ '--i': i }">
            <OutfitLook :outfit="outfit" :height="250" />
          </RouterLink>
        </TransitionGroup>
      </section>

      <button type="button" class="down" @click="toList">往下，看這條路線全部的穿搭<Icon name="down" /></button>
    </template>

    <template #default="{ heroHeight }">
      <div id="list" class="shop">
        <SentenceBar :offset="heroHeight + 320" />
        <main class="stage">
          <h2 class="shop-title">{{ theme.name }}路線的穿搭<span v-if="count !== null" class="count">　{{ count }} 套</span></h2>
          <OutfitStage @count="count = $event" />
        </main>
      </div>
    </template>
  </SkyPage>

  <template v-else-if="loaded">
    <SiteHeader />
    <main class="state">
      <h1>找不到這條路線</h1>
      <p>網址可能打錯了，或這條路線已經收起來。</p>
      <RouterLink class="btn" :to="{ name: 'outfits' }">看全部穿搭</RouterLink>
    </main>
    <SiteFooter />
  </template>
</template>

<style scoped>
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
  font-size: clamp(2.6rem, 6vw, 4.6rem);
  line-height: 1.2;
  letter-spacing: 0.12em;
}

.tagline {
  margin: 0;
  color: var(--fg-soft);
  font-size: 1.15rem;
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

.look-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
  position: absolute;
}

.look-enter-from {
  opacity: 0;
  transform: translateY(26px);
}

.look-leave-to {
  opacity: 0;
  transform: translateY(14px);
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

.state {
  display: grid;
  justify-items: start;
  gap: var(--s2);
  max-width: var(--column-max);
  margin-inline: auto;
  padding: var(--s5) var(--s3);
  min-height: 50vh;
}

@media (prefers-reduced-motion: reduce) {
  .look-enter-active,
  .look-leave-active,
  .look-link,
  .down .icon {
    transition: none;
  }
}

@media (max-width: 52rem) {
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
