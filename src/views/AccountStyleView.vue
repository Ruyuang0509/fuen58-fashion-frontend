<script setup>
// 我的偏好（第十五輪子輪 4）：會員中心的一頁。
// 上半是你在調查裡挑的（風格組成比例、給誰穿、重新挑、清掉）；
// 下半是站方照你目前的紀錄推測的（調查＋收藏＋看過的，taste/profile.js）、每條路線的理由，和「照你的喜好排」的開關。
// 推測怎麼算寫在畫面上：使用者看得到自己為什麼被排成這樣，才會信（功能規劃 6.3）。
import { computed, onMounted, ref } from 'vue'
import { getThemes } from '@/api'
import { formatDate } from '@/api/account'
import AccountNav from '@/components/AccountNav.vue'
import TasteBar from '@/components/TasteBar.vue'
import { AUDIENCES } from '@/filters/options'
import { useTaste } from '@/stores/taste'

const { profile, preferences, forYou, setForYou, clearPreferences } = useTaste()
const themes = ref([])
const clearing = ref('') // '' | busy | error

// 路線名稱載入失敗（第十七輪子輪 2）：比例還是畫得出來（用代碼），但要說一聲、能再試
const themesFailed = ref(false)
async function loadThemes() {
  themesFailed.value = false
  try {
    themes.value = await getThemes()
  } catch {
    themes.value = []
    themesFailed.value = true
  }
}
onMounted(loadThemes)

const hasPicks = computed(() => !!preferences.value && Object.keys(preferences.value.themes ?? {}).length > 0)
const audienceLabel = computed(() => AUDIENCES.find((option) => option.value === (preferences.value?.audience ?? ''))?.label ?? '不限誰')
const quizLink = { name: 'onboarding-style', query: { redirect: '/account/style' } }

async function clear() {
  clearing.value = 'busy'
  try {
    await clearPreferences()
    clearing.value = ''
  } catch {
    clearing.value = 'error'
  }
}
</script>

<template>
  <AccountNav />
  <header class="head">
    <h1>我的偏好</h1>
    <p class="lead">穿搭預設照你的喜好排：喜歡的路線排前面。這一頁看得到是怎麼算的，也能改。</p>
    <p v-if="themesFailed" class="lead failed" role="status">路線名稱沒有載入成功，下面先用代碼顯示。<button type="button" class="link retry" @click="loadThemes">再試一次</button></p>
  </header>

  <section class="panel picked-panel" aria-labelledby="picked-title">
    <h2 id="picked-title" class="section-title">你挑的</h2>
    <template v-if="hasPicks">
      <TasteBar :weights="preferences.themes" :themes="themes" />
      <p class="meta"><span class="piece">給誰穿：{{ audienceLabel }}</span><span class="piece">挑了 {{ preferences.pickedOutfitIds.length }} 套</span><span class="piece">{{ formatDate(preferences.updatedAt) }}</span></p>
      <div class="actions">
        <RouterLink class="btn" :to="quizLink">重新挑</RouterLink>
        <button type="button" class="link" :disabled="clearing === 'busy'" @click="clear">清掉偏好</button>
        <span v-if="clearing === 'error'" class="error" role="alert">沒有清成功，再試一次。</span>
      </div>
    </template>
    <template v-else>
      <p class="soft">
        還沒挑過。花半分鐘挑三套你會穿的，之後的穿搭會先照你的喜好排。
        <template v-if="preferences?.audience">（給誰穿已經選了：{{ audienceLabel }}）</template>
      </p>
      <div class="actions">
        <RouterLink class="btn" :to="quizLink">去挑三套</RouterLink>
      </div>
    </template>
  </section>

  <section class="panel guess-panel" aria-labelledby="guess-title">
    <h2 id="guess-title" class="section-title">照你的紀錄推測</h2>
    <template v-if="profile">
      <TasteBar :weights="profile.weights" :themes="themes" label="推測的風格組成" />
      <ul class="reasons">
        <li v-for="reason in profile.reasons" :key="reason.code">{{ reason.text }}</li>
      </ul>
      <p class="meta">挑的一套算 1、收藏的算 0.6、看過的算 0.2；加起來再換成比例。</p>
    </template>
    <p v-else class="soft">還沒有可以推測的紀錄。挑過、收藏過或看過幾套之後，這裡會出現一條。</p>
    <p class="toggle-row">
      穿搭「照你的喜好排」現在是<strong>{{ forYou ? '開' : '關' }}</strong>。
      <button type="button" class="link taste-toggle" @click="setForYou(!forYou)">{{ forYou ? '關掉' : '開啟' }}</button>
    </p>
  </section>
</template>

<style scoped>
.head {
  display: grid;
  gap: var(--s1);
  margin-block: var(--s3) var(--s3);
}

.head h1 {
  font-size: var(--fs-3);
}

.lead,
.soft,
.meta {
  color: var(--ink-soft);
}

.meta {
  font-size: var(--fs-0);
}

/* 三小段各自不斷行，窄的時候整段掉下去，不會把日期切成兩行 */
.piece {
  white-space: nowrap;
}

.piece + .piece::before {
  content: '·';
  margin-inline: var(--s2);
}

.panel {
  display: grid;
  gap: var(--s2);
  padding: var(--s3);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
}

.panel + .panel {
  margin-top: var(--s3);
}

.section-title {
  margin: 0;
  font-size: var(--fs-2);
  font-weight: 400;
  letter-spacing: 0.12em;
  color: var(--ink-soft);
}

.actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--s2) var(--s3);
}

.link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-soft);
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 0.3em;
  cursor: pointer;
}

.link:hover,
.link:focus-visible {
  color: var(--ink);
}

.reasons {
  margin: 0;
  padding-left: 1.2em;
}

.toggle-row {
  margin: 0;
  padding-top: var(--s2);
  border-top: 1px solid var(--line);
}

.toggle-row strong {
  margin-inline: 0.2em;
}

.toggle-row .link {
  margin-left: var(--s2);
  color: var(--ink);
}

.error {
  color: #9b2c2c; /* 與卡片底 7.6:1（check-contrast 有量） */
  font-size: var(--fs-0);
}

@media (max-width: 30rem) {
  .panel {
    padding: var(--s2);
  }
}
</style>
