<script setup>
// 舞台裡的活動插卡（第十五輪）：不做橫幅輪播，活動像雜誌的夾頁一樣插在穿搭格子裡，佔一格、吃格子的寬度循環。
// 底是活動所屬路線的顏色、字是白的（路線色本來就當白字的底色用，對比度在 scripts/check-contrast.mjs 裡量）；
// 右邊放它第一套穿搭的人形，和旁邊的穿搭卡是同一種畫法。
import '@fontsource/noto-serif-tc/600.css'
import '@fontsource/space-mono/400.css'
import { computed } from 'vue'
import Icon from '@/components/Icon.vue'
import OutfitLook from '@/components/OutfitLook.vue'
import { accentOf } from '@/theme/themes'

const props = defineProps({
  campaign: { type: Object, required: true },
})

const look = computed(() => props.campaign.outfits?.[0] ?? null)
const monthDay = (iso) => {
  const [, month, day] = iso.split('-')
  return `${+month}/${+day}`
}
const period = computed(() => `${monthDay(props.campaign.startsAt)}–${monthDay(props.campaign.endsAt)}`)
</script>

<template>
  <RouterLink :to="{ name: 'campaign', params: { code: campaign.code } }" class="campaign-tile" :style="{ '--tile': accentOf(campaign.themeCode) }">
    <!-- 多一層 inner：容器查詢只能問祖先，插卡自己是容器，排版要改在它的子層 -->
    <div class="inner">
      <div class="text">
        <p class="kicker">活動<span class="period">{{ period }}</span></p>
        <h3 class="title">{{ campaign.title }}</h3>
        <p class="tagline">{{ campaign.tagline }}</p>
        <span class="more">看這檔活動<Icon name="arrow" /></span>
      </div>
      <div v-if="look" class="look" aria-hidden="true">
        <OutfitLook :outfit="look" :height="190" :caption="false" />
      </div>
    </div>
  </RouterLink>
</template>

<style scoped>
.campaign-tile {
  container-type: inline-size;
  display: block;
  min-height: 20rem;
  padding: var(--s3);
  border-radius: var(--radius);
  background: var(--tile);
  color: var(--on-accent);
  text-decoration: none;
  transition: background-color 0.4s ease, transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* 字在左上、人形在右下；插卡被撐到整列的高度時 inner 跟著撐滿 */
.inner {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: var(--s2);
  height: 100%;
  min-height: calc(20rem - 2 * var(--s3));
}

/* 插卡落在窄格子時（手機、或格子的寬度循環給到窄格）：人形改到字的下面，不然字只剩兩三個字一行 */
@container (max-width: 24rem) {
  .inner {
    grid-template-columns: minmax(0, 1fr);
  }

  .look {
    justify-self: center;
  }
}

.campaign-tile:hover,
.campaign-tile:focus-visible {
  background: color-mix(in srgb, var(--tile) 86%, black);
  transform: translateY(-4px);
}

.campaign-tile:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 3px;
}

/* min-width: 0 是關鍵：全站 h3 是 word-break: keep-all，標題的最小寬度等於整行，grid item 預設不會比它窄，
   會把字撐出插卡（實測 390 寬時撐到 420px）；放它縮，標題才會在空格或冒號後面換行 */
.text {
  display: grid;
  grid-template-columns: minmax(0, 1fr); /* 隱含的 auto 欄會長到標題的最小寬度；寫死成可縮到 0 的一欄 */
  gap: var(--s2);
  align-self: start;
  min-width: 0;
}

/* 「活動」與期間可以分兩行，但期間本身不拆（10/3–10/20 斷在連字號後面很難讀） */
.kicker {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--s2);
  margin: 0;
  font-size: var(--fs-0);
  letter-spacing: 0.16em;
}

.period {
  font-family: 'Space Mono', monospace;
  letter-spacing: 0;
  white-space: nowrap;
}

.title {
  margin: 0;
  min-width: 0; /* 同上：讓它在空格或冒號後面換行，而不是撐寬整張插卡 */
  font-family: 'Noto Serif TC', serif;
  font-size: var(--fs-3);
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: 0.04em;
}

.tagline {
  margin: 0;
  max-width: 20em;
  line-height: 1.6;
}

.more {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  justify-self: start;
  margin-top: var(--s2);
  padding-bottom: 0.1rem;
  border-bottom: 1px solid currentColor;
  font-size: var(--fs-0);
  letter-spacing: 0.12em;
}

.more .icon {
  transition: transform 0.3s ease;
}

.campaign-tile:hover .more .icon {
  transform: translateX(3px);
}

.look {
  align-self: end;
}

@media (prefers-reduced-motion: reduce) {
  .campaign-tile,
  .more .icon {
    transition: none;
  }
}

@media (max-width: 36rem) {
  .campaign-tile {
    grid-template-columns: minmax(0, 1fr);
  }

  .look {
    justify-self: center;
  }
}
</style>
