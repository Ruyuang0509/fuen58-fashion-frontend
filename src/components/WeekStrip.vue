<script setup>
// 這一週穿什麼（第十六輪子輪 1）：七天的預報，每天一欄——星期、天氣、最高／最低溫、降雨機率、一套合那天溫度的穿搭。
// 挑法：那天的平均溫 → 要的厚度（weatherFit.wantedWarmth）→ 剛好（差 0～+1）的穿搭裡挑；下雨優先外層不吸水的；
// 有喜好推測就優先首選路線；七天不重複（挑過的扣分），都不合就放寬到偏薄。規則式，不是生成的。
import { computed, onMounted, ref } from 'vue'
import { getOutfits } from '@/api'
import Icon from '@/components/Icon.vue'
import OutfitLook from '@/components/OutfitLook.vue'
import { rememberLook } from '@/motion/lookFlip'
import { fitVerdict, shedsWater } from '@/products/weatherFit'
import { useTaste } from '@/stores/taste'
import { useWeather } from '@/stores/weather'
import { accentOf } from '@/theme/themes'

const { weather } = useWeather()
const { profile } = useTaste()
const outfits = ref([])

// 載入失敗（第十七輪子輪 2）：這一排是次要的，但也不留白——一句話加「再試一次」
const failed = ref(false)
async function load() {
  failed.value = false
  try {
    outfits.value = await getOutfits()
  } catch {
    outfits.value = []
    failed.value = true
  }
}
onMounted(load)

const weekday = new Intl.DateTimeFormat('zh-TW', { weekday: 'short', timeZone: 'Asia/Taipei' })
const dayLabel = (date, i) => (i === 0 ? '今天' : i === 1 ? '明天' : weekday.format(new Date(`${date}T12:00:00+08:00`)))
const dateLabel = (date) => {
  const [, month, day] = date.split('-')
  return `${Number(month)}/${Number(day)}`
}
const GLYPH = { clear: 'sun', cloudy: 'cloud', rain: 'rain' }
const CONDITION = { clear: '晴', cloudy: '多雲', rain: '有雨' }

const days = computed(() => {
  const list = weather.value?.forecast ?? []
  if (!list.length || !outfits.value.length) return []
  const used = new Set()
  const weights = profile.value?.weights ?? {}
  return list.slice(0, 7).map((day, i) => {
    const mean = (day.high + day.low) / 2
    const rainy = day.condition === 'rain' || day.rainChance >= 50
    const score = (outfit) => {
      const verdict = fitVerdict(outfit.items, { temperature: mean })
      if (!verdict || verdict === 'cold' || verdict === 'warm') return -Infinity
      let total = verdict === 'ok' ? 2 : 1
      if (rainy && shedsWater(outfit.items.find((item) => item.category === 'outer'))) total += 1
      total += weights[outfit.themeCode] ?? 0
      if (used.has(outfit.id)) total -= 5
      return total
    }
    const best = outfits.value
      .map((outfit) => ({ outfit, total: score(outfit) }))
      .filter((entry) => entry.total > -Infinity)
      .sort((a, b) => b.total - a.total || a.outfit.id - b.outfit.id)[0]?.outfit ?? null
    if (best) used.add(best.id)
    return { ...day, i, label: dayLabel(day.date, i), short: dateLabel(day.date), rainy, outfit: best }
  })
})
</script>

<template>
  <p v-if="failed" class="week-failed">這一週的穿搭沒有載入成功。<button type="button" class="retry" @click="load">再試一次</button></p>
  <section v-else-if="days.length" class="week" aria-label="這一週穿什麼">
    <div class="week-head">
      <h2 class="week-title">這一週穿什麼<span class="where">　{{ weather.city }}</span></h2>
      <p class="week-note">七天的預報，每天挑一套合那天溫度的。<template v-if="weather.source === 'demo'">（示範天氣）</template></p>
    </div>
    <ol class="days">
      <li v-for="day in days" :key="day.date" class="day" :class="{ today: day.i === 0 }" :style="{ '--tint': day.outfit ? accentOf(day.outfit.themeCode) : 'var(--line)' }">
        <p class="when"><strong>{{ day.label }}</strong><span class="date num">{{ day.short }}</span></p>
        <p class="sky" :aria-label="`${CONDITION[day.condition] ?? ''}，最高 ${day.high} 度、最低 ${day.low} 度${day.rainChance >= 30 ? `，降雨機率 ${day.rainChance}%` : ''}`">
          <Icon :name="GLYPH[day.condition] ?? 'cloud'" />
          <span class="num">{{ day.high }}°</span><span class="low num">{{ day.low }}°</span>
          <span v-if="day.rainChance >= 30" class="rain num">{{ day.rainChance }}%</span>
        </p>
        <RouterLink v-if="day.outfit" :to="{ name: 'outfit', params: { id: day.outfit.id } }" class="pick" :title="`看這套：${day.outfit.title}`" @click="rememberLook(day.outfit, $event.currentTarget)">
          <OutfitLook :outfit="day.outfit" :height="150" :caption="false" :sway="false" />
          <span class="pick-title">{{ day.outfit.title }}</span>
        </RouterLink>
        <p v-else class="none">沒有合這天的</p>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.week {
  margin-bottom: var(--s5);
}

.week-head {
  margin-bottom: var(--s3);
}

.week-title {
  margin: 0;
  font-size: var(--fs-2);
  font-weight: 400;
  letter-spacing: 0.12em;
  color: var(--ink-soft);
}

.where {
  font-size: 0.85em;
}

.week-note {
  margin: var(--s1) 0 0;
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.week-failed {
  margin: var(--s3) 0;
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.retry {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 0.3em;
  cursor: pointer;
}

/* 七欄一列；窄的時候改成橫向可滑（每欄固定寬，捲動吸附） */
.days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--s2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.day {
  display: grid;
  justify-items: center;
  align-content: start;
  gap: var(--s1);
  padding: var(--s2) var(--s1);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--tint) 8%, white);
  text-align: center;
}

/* 今天：路線色的框 */
.day.today {
  box-shadow: inset 0 0 0 2px var(--tint);
}

.when,
.sky,
.none {
  margin: 0;
}

.when {
  display: grid;
  line-height: 1.3;
}

.when strong {
  font-weight: 600;
}

.date {
  color: var(--ink-soft);
  font-size: 0.75rem;
}

.sky {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--ink);
}

.sky .icon {
  color: var(--ink-soft);
}

.low,
.rain {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.num {
  font-family: 'Space Mono', monospace;
  letter-spacing: -0.02em;
}

.pick {
  display: grid;
  justify-items: center;
  gap: var(--s1);
  margin-top: var(--s1);
  color: inherit;
  text-decoration: none;
  transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.pick:hover,
.pick:focus-visible {
  transform: translateY(-4px);
}

.pick-title {
  font-size: var(--fs-0);
  line-height: 1.3;
}

.none {
  margin-top: var(--s2);
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

@media (prefers-reduced-motion: reduce) {
  .pick {
    transition: none;
  }
}

@media (max-width: 64rem) {
  .days {
    grid-template-columns: none;
    grid-auto-flow: column;
    grid-auto-columns: minmax(8.5rem, 1fr);
    overflow-x: auto;
    padding-bottom: var(--s1);
    scroll-snap-type: x mandatory;
    scrollbar-width: thin;
  }

  .day {
    scroll-snap-align: start;
  }
}
</style>
