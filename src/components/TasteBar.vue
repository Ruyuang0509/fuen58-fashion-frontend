<script setup>
// 風格組成比例（第十五輪子輪 4）：一條用路線色拼成的橫條，底下一行「34% 街頭・33% 戶外・33% 龐克」
// （功能規劃 6.3 借 Stitch Fix 的呈現）。調查的結果頁、會員中心「我的偏好」都用這一個：
// 權重給它、路線清單給它（要名稱與順序），它只負責畫。
import { computed } from 'vue'
import { rankWeights } from '@/taste/profile'
import { accentOf } from '@/theme/themes'

const props = defineProps({
  // { code: weight }，權重加起來 1
  weights: { type: Object, required: true },
  // 路線清單（名稱、順序）
  themes: { type: Array, default: () => [] },
  // 讀屏讀的名稱
  label: { type: String, default: '風格組成' },
})

const segments = computed(() => rankWeights(props.weights, props.themes.map((theme) => theme.code)).map(({ code, weight }) => ({
  code,
  name: props.themes.find((theme) => theme.code === code)?.name ?? code,
  pct: Math.round(weight * 100),
  accent: accentOf(code),
})))

const text = computed(() => segments.value.map((segment) => `${segment.pct}% ${segment.name}`).join('・'))
</script>

<template>
  <div class="taste">
    <!-- 橫條本身是一張圖，讀屏讀底下那行字就夠了 -->
    <div class="bar" role="img" :aria-label="`${label}：${text}`">
      <span v-for="segment in segments" :key="segment.code" class="seg" :data-code="segment.code" :style="{ flexGrow: segment.pct, background: segment.accent }">
        <span v-if="segment.pct >= 14" class="seg-name">{{ segment.name }}</span>
      </span>
    </div>
    <p class="text">
      <template v-for="(segment, i) in segments" :key="segment.code"><template v-if="i">・</template><span class="num">{{ segment.pct }}%</span> {{ segment.name }}</template>
    </p>
  </div>
</template>

<style scoped>
.taste {
  display: grid;
  gap: var(--s2);
}

.bar {
  display: flex;
  height: 2.4rem;
  border-radius: 999px;
  overflow: hidden;
  transform-origin: 0 50%;
  animation: grow 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

/* 一出現就從左邊長出來（系統設定減少動態時 base.css 把動畫時間歸零） */
@keyframes grow {
  from {
    transform: scaleX(0.2);
    opacity: 0;
  }
  to {
    transform: scaleX(1);
    opacity: 1;
  }
}

/* 每一段的寬度就是它的百分比（flex-grow）；路線色都夠深，上面放白字（themes.js 的註解；check-contrast 有量） */
.seg {
  display: grid;
  place-items: center;
  flex-basis: 0;
  min-width: 0;
  color: var(--on-accent);
  font-size: var(--fs-0);
  letter-spacing: 0.08em;
  transition: flex-grow 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.seg + .seg {
  border-left: 2px solid var(--surface);
}

.seg-name {
  padding-inline: 0.4rem;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.text {
  margin: 0;
  color: var(--ink-soft);
}

.num {
  font-family: 'Space Mono', monospace;
  color: var(--ink);
}
</style>
