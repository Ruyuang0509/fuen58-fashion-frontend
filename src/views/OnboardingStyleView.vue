<script setup>
// 偏好調查（第十五輪子輪 4；規格 09 §5.1）。註冊成功後進來，三步，每一步都能略過：
//   1 給誰穿：四顆大鈕＋「先不選」。
//   2 挑至少三套你會穿的：一開始每條路線一套、共 8 套人形；每挑一套，從相鄰的兩條路線（themes.js 的 THEME_NEIGHBOURS）
//     各補一套還沒出現的、插在它後面（GSAP Flip 重排，新的淡進來）。不足三套時按鈕停用、底下說還差幾套。
//   3 風格組成比例：一條路線色的橫條與「34% 街頭・33% 戶外・33% 龐克」（TasteBar）；存進會員的 preferences；
//     「開始逛」回原本要去的網址，「重新挑」回第 2 步。
// 像 Spotify 第一次登入挑歌手：不填表、不打字，看到順眼的點一下就好。
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getOutfits, getThemes } from '@/api'
import Icon from '@/components/Icon.vue'
import OutfitLook from '@/components/OutfitLook.vue'
import TasteBar from '@/components/TasteBar.vue'
import { AUDIENCES } from '@/filters/options'
import { Flip, gsap, reducedMotion } from '@/motion/gsap'
import { useTaste } from '@/stores/taste'
import { normaliseWeights } from '@/taste/profile'
import { THEME_NEIGHBOURS, accentOf } from '@/theme/themes'

const MIN_PICKS = 3
const START_PER_THEME = 1 // 一開始每條路線幾套
const ADD_PER_PICK = 2 // 每挑一套補幾套（相鄰的兩條路線各一套）

const route = useRoute()
const router = useRouter()
const taste = useTaste()

const step = ref(1)
const audience = ref('') // '' 是先不選
const busy = ref(false) // 第 1 步按下去之後在要資料
const themes = ref([])
const all = ref([]) // 全部穿搭
const preferred = ref([]) // 合「給誰穿」的那些；沒選就等於全部
const pool = ref([]) // 現在畫面上的幾套
const picked = reactive(new Set())
const status = ref('loading') // loading | ready | error
const saving = ref('') // '' | saving | saved | error
const gridEl = ref(null)

const audienceOptions = AUDIENCES.filter((option) => option.value)
const nameOf = (code) => themes.value.find((theme) => theme.code === code)?.name ?? code

// 回哪裡：只接受站內路徑，沒給就回首頁。選了給誰穿而且是回首頁或全部穿搭，順手把 ?for= 帶上——第 1 步的答案馬上有用
const target = computed(() => {
  const value = route.query.redirect
  const path = typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'
  if (audience.value && (path === '/' || path === '/outfits')) return `${path}?for=${audience.value}`
  return path
})

onMounted(async () => {
  try {
    const [themeList, outfitList] = await Promise.all([getThemes(), getOutfits()])
    themes.value = themeList
    all.value = outfitList
    status.value = 'ready'
  } catch {
    status.value = 'error'
  }
})

// 某條路線的穿搭：合給誰穿的排前面，其他的留著當候補（小孩只有一套，不然湊不到 8 套）
function ofTheme(code) {
  const mine = preferred.value.filter((outfit) => outfit.themeCode === code)
  const rest = all.value.filter((outfit) => outfit.themeCode === code && !mine.includes(outfit))
  return [...mine, ...rest]
}

async function chooseAudience(value) {
  busy.value = true
  audience.value = value
  try {
    preferred.value = value ? await getOutfits({ audience: value }) : all.value
  } catch {
    preferred.value = all.value
  }
  pool.value = themes.value.flatMap((theme) => ofTheme(theme.code).slice(0, START_PER_THEME))
  picked.clear()
  busy.value = false
  step.value = 2
}

async function toggle(outfit) {
  if (picked.has(outfit.id)) {
    picked.delete(outfit.id)
    return
  }
  picked.add(outfit.id)
  // 從相鄰的路線補進還沒出現的：挑了街頭就補一套龐克、一套戶外，插在這一套後面
  const shown = new Set(pool.value.map((item) => item.id))
  const additions = []
  for (const code of THEME_NEIGHBOURS[outfit.themeCode] ?? []) {
    const next = ofTheme(code).find((item) => !shown.has(item.id))
    if (next) {
      additions.push(next)
      shown.add(next.id)
    }
    if (additions.length >= ADD_PER_PICK) break
  }
  if (!additions.length) return
  // Flip：先記每張的位置，再改資料，畫完後從舊位置滑到新位置；新進來的淡入
  const state = reducedMotion() || !gridEl.value ? null : Flip.getState(gridEl.value.querySelectorAll('.pick-tile'))
  const at = pool.value.findIndex((item) => item.id === outfit.id)
  pool.value = [...pool.value.slice(0, at + 1), ...additions, ...pool.value.slice(at + 1)]
  if (!state) return
  await nextTick()
  Flip.from(state, {
    targets: gridEl.value.querySelectorAll('.pick-tile'),
    duration: 0.5,
    ease: 'power2.out',
    onEnter: (elements) => gsap.fromTo(elements, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'power2.out' }),
  })
}

// 權重 = 各路線被挑的套數 ÷ 總數，兩位小數、總和 1
const weights = computed(() => {
  const counts = {}
  for (const id of picked) {
    const outfit = all.value.find((item) => item.id === id)
    if (outfit) counts[outfit.themeCode] = (counts[outfit.themeCode] ?? 0) + 1
  }
  return normaliseWeights(counts, themes.value.map((theme) => theme.code))
})

async function save(data) {
  saving.value = 'saving'
  try {
    await taste.savePreferences(data)
    saving.value = 'saved'
  } catch {
    saving.value = 'error'
  }
}

function finish() {
  if (picked.size < MIN_PICKS) return
  step.value = 3
  save({ audience: audience.value || null, themes: weights.value, pickedOutfitIds: [...picked] })
}

// 先不挑：只有選了給誰穿才有東西要存
async function skipPicks() {
  if (audience.value) await save({ audience: audience.value, themes: {}, pickedOutfitIds: [] })
  router.push(target.value)
}

function again() {
  step.value = 2
}
</script>

<template>
  <div class="quiz">
    <ol class="steps" aria-label="步驟">
      <li :class="{ on: step === 1, done: step > 1 }" :aria-current="step === 1 ? 'step' : undefined"><span class="n">1</span>給誰穿</li>
      <li :class="{ on: step === 2, done: step > 2 }" :aria-current="step === 2 ? 'step' : undefined"><span class="n">2</span>挑三套</li>
      <li :class="{ on: step === 3 }" :aria-current="step === 3 ? 'step' : undefined"><span class="n">3</span>你的比例</li>
    </ol>

    <p v-if="status === 'loading'" class="state" aria-busy="true">載入中…</p>

    <div v-else-if="status === 'error'" class="state">
      <p>穿搭沒有載入成功。</p>
      <RouterLink class="btn" :to="target">先去逛</RouterLink>
    </div>

    <section v-else-if="step === 1" class="step" aria-labelledby="q1">
      <h1 id="q1">先問一下：這些穿搭，給誰穿？</h1>
      <p class="lead">之後會先給你看合的。隨時都能改。</p>
      <div class="audiences">
        <button v-for="option in audienceOptions" :key="option.value" type="button" class="big" :disabled="busy" @click="chooseAudience(option.value)">{{ option.label }}</button>
      </div>
      <button type="button" class="link" :disabled="busy" @click="chooseAudience('')">先不選</button>
    </section>

    <section v-else-if="step === 2" class="step" aria-labelledby="q2">
      <h1 id="q2">挑至少三套你會穿的</h1>
      <p class="lead">不用想太久，看到順眼的就點。每挑一套，相近的路線會再多幾套給你看。</p>
      <div ref="gridEl" class="picks">
        <button
          v-for="outfit in pool"
          :key="outfit.id"
          type="button"
          class="pick-tile"
          :class="{ on: picked.has(outfit.id) }"
          :aria-pressed="picked.has(outfit.id)"
          :data-flip-id="`pick-${outfit.id}`"
          :data-theme="outfit.themeCode"
          :style="{ '--tint': accentOf(outfit.themeCode) }"
          @click="toggle(outfit)"
        >
          <span class="look"><OutfitLook :outfit="outfit" :height="190" :caption="false" :sway="false" /></span>
          <span class="tile-text"><strong>{{ outfit.title }}</strong><span class="route">{{ nameOf(outfit.themeCode) }}</span></span>
          <span class="tick" aria-hidden="true"><Icon name="check" /></span>
        </button>
      </div>
      <div class="foot">
        <p class="status" role="status">已挑 <span class="num">{{ picked.size }}</span> 套<template v-if="picked.size < MIN_PICKS">，再挑 {{ MIN_PICKS - picked.size }} 套就能看結果</template></p>
        <div class="actions">
          <button type="button" class="btn primary" :disabled="picked.size < MIN_PICKS" @click="finish">看我的比例</button>
          <button type="button" class="link" @click="skipPicks">先不挑，直接開始逛</button>
        </div>
      </div>
    </section>

    <section v-else class="step result" aria-labelledby="q3">
      <h1 id="q3">你的風格組成</h1>
      <TasteBar :weights="weights" :themes="themes" />
      <p class="lead">之後的穿搭會先照這個比例排——喜歡的路線排前面。在會員中心的「我的偏好」可以重挑，也可以關掉。</p>
      <!-- 身形（第十六輪子輪 2）：不插在三步裡，從這裡連過去，一樣可以略過 -->
      <p class="body-ask">也填一下身形？<RouterLink :to="{ name: 'onboarding-body', query: route.query }">三十秒，之後商品頁會有尺寸建議</RouterLink></p>
      <p v-if="saving === 'error'" class="error" role="alert">偏好沒有存成功。<button type="button" class="link" @click="finish">再試一次</button></p>
      <p v-else-if="saving === 'saving'" class="soft" aria-busy="true">正在存…</p>
      <div class="actions">
        <RouterLink class="btn primary" :to="target">開始逛</RouterLink>
        <button type="button" class="link" @click="again">重新挑</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.quiz {
  max-width: 64rem;
  margin-inline: auto;
  padding-block: var(--s3) var(--s5);
}

/* 三步的進度：小圓圈加字，現在這一步實心 */
.steps {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2) var(--s3);
  margin: 0 0 var(--s4);
  padding: 0;
  list-style: none;
  color: var(--ink-soft);
  font-size: var(--fs-0);
  letter-spacing: 0.08em;
}

.steps li {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.steps .n {
  display: grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  border: 1px solid var(--line);
  border-radius: 50%;
  font-family: 'Space Mono', monospace;
  font-size: 0.8rem;
}

.steps li.on {
  color: var(--ink);
}

.steps li.on .n {
  border-color: var(--ink);
  background: var(--ink);
  color: var(--surface);
}

.steps li.done .n {
  border-color: var(--ink);
}

h1 {
  font-size: var(--fs-3);
  letter-spacing: 0.04em;
}

.lead {
  max-width: 34em;
  margin: var(--s2) 0 var(--s3);
  color: var(--ink-soft);
}

/* 第 1 步：四顆大鈕 */
.audiences {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--s2);
  margin-bottom: var(--s3);
}

.big {
  padding: var(--s4) var(--s2);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  font-size: var(--fs-2);
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: border-color var(--ease), background-color var(--ease), transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.big:hover,
.big:focus-visible {
  border-color: var(--ink);
  transform: translateY(-3px);
}

.big:disabled {
  cursor: progress;
  opacity: 0.6;
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

/* 第 2 步：人形的格子 */
.picks {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr));
  gap: var(--s2);
}

.pick-tile {
  position: relative;
  display: grid;
  gap: var(--s1);
  padding: var(--s2);
  border: 2px solid transparent;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--tint) 10%, white);
  color: inherit;
  text-align: center;
  cursor: pointer;
  transition: border-color var(--ease), background-color var(--ease), transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.pick-tile:hover {
  transform: translateY(-3px);
  background: color-mix(in srgb, var(--tint) 16%, white);
}

/* 挑到的：路線色的框，右上角一個勾 */
.pick-tile.on {
  border-color: var(--tint);
  background: color-mix(in srgb, var(--tint) 18%, white);
}

.look {
  display: grid;
  place-items: center;
}

.tile-text {
  display: grid;
  gap: 0.1rem;
}

.tile-text strong {
  font-size: var(--fs-0);
  font-weight: 600;
}

.route {
  color: var(--ink-soft);
  font-size: 0.78rem;
  letter-spacing: 0.1em;
}

.tick {
  position: absolute;
  top: var(--s1);
  right: var(--s1);
  display: grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  background: var(--tint);
  color: var(--on-accent);
  opacity: 0;
  transform: scale(0.6);
  transition: opacity var(--ease), transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.pick-tile.on .tick {
  opacity: 1;
  transform: scale(1);
}

/* 底下那列黏在視窗底：格子越挑越多，按鈕一直看得到 */
.foot {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--s2) var(--s3);
  margin-top: var(--s3);
  padding: var(--s2) 0;
  background: color-mix(in srgb, var(--bg) 94%, transparent);
}

.status {
  margin: 0;
  color: var(--ink-soft);
}

.num {
  font-family: 'Space Mono', monospace;
  color: var(--ink);
}

.actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--s2) var(--s3);
}

.primary {
  padding: var(--s2) var(--s4);
  font-weight: 700;
}

.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 第 3 步 */
.result .taste {
  max-width: 40rem;
  margin-block: var(--s3);
}

.error {
  color: #9b2c2c; /* 與頁面底 7.1:1（check-contrast 有量） */
}

.body-ask {
  margin: 0 0 var(--s3);
  color: var(--ink-soft);
}

.body-ask a {
  margin-left: 0.3em;
  color: var(--ink);
  text-underline-offset: 0.3em;
}

.soft {
  color: var(--ink-soft);
}

.state {
  display: grid;
  justify-items: start;
  gap: var(--s2);
  padding: var(--s4) 0;
  color: var(--ink-soft);
}

@media (max-width: 36rem) {
  .audiences {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .big {
    padding: var(--s3) var(--s2);
  }

  .picks {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--s1);
  }

  .pick-tile {
    padding: var(--s1);
  }
}
</style>
