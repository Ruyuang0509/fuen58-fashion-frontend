<script setup>
// 試穿間（第十六輪子輪 3；功能規劃 6.5「加」的先試做版，停損日 11/23）。
// 把外層、上身、下身三件疊成人形（沿用 OutfitLook 的疊法），用一句話換件：
//   「外層穿［落肩混紡大衣］的［燕麥］，上身穿［厚磅印花短袖］的［骨白］，下身穿［寬管工作褲］的［石板藍］。」
// 每一格是 ClausePicker（和一句話列同一個元件）。狀態寫在網址（?outer=101:oat&top=…&bottom=…），可以直接貼給人；
// 也記在 localStorage，單品頁的「放進試穿間」會換掉對應的那一層、其他兩層照舊。
// 人形依身形略為縮放（示意），整套可以加入購物車（尺寸可以在這裡選，沒選的到購物車再補）。不做 3D、不做布料模擬。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getOutfit, getProducts } from '@/api'
import ClausePicker from '@/components/ClausePicker.vue'
import OutfitLook from '@/components/OutfitLook.vue'
import { useFlyToCart } from '@/composables/useFlyToCart'
import { readFitting, writeFitting } from '@/fitting/link'
import { Flip, reducedMotion } from '@/motion/gsap'
import { formatPrice } from '@/products/labels'
import { describeBody } from '@/products/sizeAdvice'
import { useBody } from '@/stores/body'
import { useCart } from '@/stores/cart'

const SLOTS = [
  { key: 'outer', word: '外層', required: false, none: '不穿外層' },
  { key: 'top', word: '上身', required: true },
  { key: 'bottom', word: '下身', required: true },
]
// 人形的基準：和模特兒試穿資訊同一個人（170 cm／56 kg）
const MODEL = { height: 170, weight: 56 }

const route = useRoute()
const router = useRouter()
const { add } = useCart()
const { fly } = useFlyToCart()
const { body } = useBody()

const catalogue = ref([]) // 畫得出來的單品（有款式圖、類別是外層／上身／下身）
const chosen = ref({ outer: null, top: null, bottom: null }) // 各層 { id, colour }
const sizes = ref({}) // productId → 選的尺寸
const status = ref('loading')
const feedback = ref('')
let feedbackTimer = 0
const line = ref(null)
const look = ref(null)

const byId = computed(() => new Map(catalogue.value.map((product) => [product.productId, product])))
const ofSlot = (key) => catalogue.value.filter((product) => product.category === key)

// 網址裡的一層：「101:oat」
const parseSlot = (value) => {
  if (typeof value !== 'string' || !value) return null
  const [id, colour] = value.split(':')
  return Number.isInteger(Number(id)) ? { id: Number(id), colour: colour || null } : null
}
const serialise = (entry) => (entry ? `${entry.id}:${entry.colour}` : '')

// 本機那一份的讀寫在 fitting/link.js（單品頁的「放進試穿間」也要讀它）
const readLocal = readFitting
const writeLocal = () => writeFitting(chosen.value)

// 把一層修成合法的：商品要在目錄裡、顏色要是它有的；不合法就退回預設
function normalise(key, entry) {
  if (!entry) return null
  const product = byId.value.get(entry.id)
  if (!product || product.category !== key) return null
  const colour = product.colours.some((item) => item.code === entry.colour) ? entry.colour : product.colours[0].code
  return { id: product.productId, colour }
}

function defaults() {
  const first = (key) => {
    const product = ofSlot(key)[0]
    return product ? { id: product.productId, colour: product.colours[0].code } : null
  }
  return { outer: null, top: first('top'), bottom: first('bottom') }
}

// 從一套穿搭帶進來：每一層取第一件
async function fromOutfit(id) {
  const outfit = await getOutfit(id)
  if (!outfit) return null
  const result = { outer: null, top: null, bottom: null }
  for (const item of outfit.items) {
    if (result[item.category] === undefined || result[item.category]) continue
    result[item.category] = { id: item.productId, colour: item.colourCode }
  }
  return result
}

onMounted(async () => {
  try {
    const all = await getProducts()
    catalogue.value = all.filter((product) => product.kind && SLOTS.some((slot) => slot.key === product.category))
    const query = route.query
    let start = null
    if (SLOTS.some((slot) => typeof query[slot.key] === 'string')) {
      start = Object.fromEntries(SLOTS.map((slot) => [slot.key, parseSlot(query[slot.key])]))
    } else if (typeof query.from === 'string') {
      start = await fromOutfit(query.from)
    }
    if (!start) start = readLocal()
    const fallback = defaults()
    chosen.value = Object.fromEntries(SLOTS.map((slot) => {
      const entry = normalise(slot.key, start?.[slot.key])
      return [slot.key, entry ?? (slot.required ? fallback[slot.key] : null)]
    }))
    status.value = 'ready'
    sync(true)
  } catch {
    status.value = 'error'
  }
})

// 狀態一變：寫網址（replace，不塞瀏覽紀錄）、寫本機
function sync(replaceFrom = false) {
  const query = {}
  for (const slot of SLOTS) {
    const value = serialise(chosen.value[slot.key])
    if (value) query[slot.key] = value
  }
  if (replaceFrom || JSON.stringify(query) !== JSON.stringify(Object.fromEntries(SLOTS.filter((slot) => route.query[slot.key]).map((slot) => [slot.key, route.query[slot.key]])))) {
    router.replace({ query })
  }
  writeLocal()
}

// 畫面上的三件（和 resolveOutfit 展開的單品同形，OutfitLook 才認得）
const pieces = computed(() => SLOTS.map((slot) => {
  const entry = chosen.value[slot.key]
  const product = entry ? byId.value.get(entry.id) : null
  if (!product) return null
  const way = product.colours.find((item) => item.code === entry.colour) ?? product.colours[0]
  const { productId, name, brand, brandCode, category, price, kind, fabric, warmth, features } = product
  return { productId, name, brand, brandCode, category, price, sizes: product.sizes, kind, fabric, warmth, features, colour: way.hex, colourCode: way.code, colourName: way.name, stock: product.stock }
}).filter(Boolean))

// 尺寸下拉要有東西顯示（「到購物車再選」）：新進來的件先給空字串，不然 select 是空白的
watch(pieces, (list) => {
  for (const piece of list) if (!(piece.productId in sizes.value)) sizes.value[piece.productId] = ''
}, { immediate: true })

const lookOutfit = computed(() => ({ id: 'fitting', title: '試穿間', items: pieces.value }))
const total = computed(() => pieces.value.reduce((sum, piece) => sum + piece.price, 0))

const productOptions = (slot) => [
  ...(slot.required ? [] : [{ value: '', label: slot.none, short: '' }]),
  ...ofSlot(slot.key).map((product) => ({ value: String(product.productId), label: product.name, short: product.name })),
]
const colourOptions = (key) => {
  const entry = chosen.value[key]
  const product = entry ? byId.value.get(entry.id) : null
  return product ? product.colours.map((item) => ({ value: item.code, label: item.name, short: item.name, swatch: item.hex })) : []
}

// 換件時整句重排有過程（和一句話列一樣，GSAP Flip）
let before = null
function capture() {
  if (reducedMotion() || !line.value) return
  before = Flip.getState(line.value.querySelectorAll('.clause'))
}
async function settle() {
  if (!before) return
  const state = before
  before = null
  await nextTick()
  if (line.value) Flip.from(state, { duration: 0.45, ease: 'power2.out' })
}

function pickProduct(key, value) {
  capture()
  const product = value ? byId.value.get(Number(value)) : null
  chosen.value = { ...chosen.value, [key]: product ? { id: product.productId, colour: product.colours[0].code } : null }
  sync()
  settle()
}

function pickColour(key, code) {
  const entry = chosen.value[key]
  if (!entry) return
  capture()
  chosen.value = { ...chosen.value, [key]: { ...entry, colour: code } }
  sync()
  settle()
}

const stockOf = (piece, size) => piece.stock?.[`${piece.colourCode}-${size}`] ?? 0

function addAll() {
  for (const piece of pieces.value) {
    const product = byId.value.get(piece.productId)
    const size = piece.sizes.length === 1 ? piece.sizes[0] : (sizes.value[piece.productId] || null)
    add(product, size, piece.colourCode, 1)
  }
  fly(look.value?.$el?.querySelector('img'))
  feedback.value = `已加入 ${pieces.value.length} 件${pieces.value.some((piece) => piece.sizes.length > 1 && !sizes.value[piece.productId]) ? '，尺寸到購物車再補' : ''}`
  clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => (feedback.value = ''), 3500)
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(location.href)
    feedback.value = '已複製這一套的網址'
  } catch {
    feedback.value = '複製不了，直接複製網址列也可以'
  }
  clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => (feedback.value = ''), 3500)
}

// 人形依身形略為縮放：高矮照身高、胖瘦照體重／身高的比，各自夾在一個小範圍內——只是示意，不是真的版型
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const scale = computed(() => {
  if (!body.value?.height || !body.value?.weight) return null
  return {
    x: clamp((body.value.weight / body.value.height) / (MODEL.weight / MODEL.height), 0.88, 1.18),
    y: clamp(body.value.height / MODEL.height, 0.9, 1.1),
  }
})
const scaleStyle = computed(() => (scale.value ? { transform: `scale(${scale.value.x.toFixed(3)}, ${scale.value.y.toFixed(3)})` } : undefined))

// 網址被外面改（例如單品頁「放進試穿間」）也要跟
watch(() => SLOTS.map((slot) => route.query[slot.key]).join('|'), () => {
  if (status.value !== 'ready') return
  const next = Object.fromEntries(SLOTS.map((slot) => [slot.key, normalise(slot.key, parseSlot(route.query[slot.key]))]))
  if (SLOTS.some((slot) => serialise(next[slot.key]) !== serialise(chosen.value[slot.key]))) {
    chosen.value = Object.fromEntries(SLOTS.map((slot) => [slot.key, next[slot.key] ?? (slot.required ? chosen.value[slot.key] : null)]))
    writeLocal()
  }
})

onBeforeUnmount(() => clearTimeout(feedbackTimer))
</script>

<template>
  <div class="fitting">
    <header class="head">
      <h1>試穿間</h1>
      <p class="lead">三件疊在一起看，想換哪一件就換；這一套的網址可以直接貼給人。</p>
    </header>

    <p v-if="status === 'loading'" class="state" aria-busy="true">載入中…</p>
    <div v-else-if="status === 'error'" class="state"><p>單品沒有載入成功。</p><RouterLink class="btn" :to="{ name: 'outfits' }">看全部穿搭</RouterLink></div>

    <div v-else class="room">
      <section class="figure" aria-label="人形">
        <div class="stand" :style="scaleStyle">
          <OutfitLook ref="look" :outfit="lookOutfit" :height="440" :caption="false" />
        </div>
        <p v-if="scale" class="scale-note">人形照你的身形（{{ describeBody(body) }}）略為縮放，只是示意。</p>
        <p v-else class="scale-note">填了身形（會員中心，或商品頁輸入身高體重）人形會照高矮胖瘦略為縮放。</p>
      </section>

      <section class="controls" aria-label="換件">
        <p ref="line" class="line">
          <template v-for="slot in SLOTS" :key="slot.key">
            <span class="clause" :data-slot="slot.key">
              <template v-if="chosen[slot.key] || slot.required">{{ slot.word }}穿</template>
              <ClausePicker :label="slot.word" :options="productOptions(slot)" :model-value="chosen[slot.key] ? String(chosen[slot.key].id) : ''" @update:model-value="pickProduct(slot.key, $event)" />
              <template v-if="chosen[slot.key]">
                的
                <ClausePicker :label="`${slot.word}的顏色`" :options="colourOptions(slot.key)" :model-value="chosen[slot.key].colour" @update:model-value="pickColour(slot.key, $event)" />
              </template>
              <template v-if="slot.key === 'bottom'">。</template><template v-else>，</template>
            </span>
          </template>
        </p>

        <ul class="pieces">
          <li v-for="piece in pieces" :key="piece.productId">
            <span class="swatch" :style="{ background: piece.colour }" aria-hidden="true"></span>
            <div class="piece-text">
              <RouterLink :to="{ name: 'product', params: { id: piece.productId }, query: { colour: piece.colourCode } }" class="name">{{ piece.name }}</RouterLink>
              <span class="sub">{{ piece.brand }}・{{ piece.colourName }}</span>
            </div>
            <label v-if="piece.sizes.length > 1" class="size-pick">
              <span>尺寸</span>
              <select v-model="sizes[piece.productId]">
                <option value="">到購物車再選</option>
                <option v-for="size in piece.sizes" :key="size" :value="size" :disabled="stockOf(piece, size) === 0">{{ size }}{{ stockOf(piece, size) === 0 ? '（無庫存）' : '' }}</option>
              </select>
            </label>
            <span v-else class="size-pick"><span>尺寸</span><strong>單一尺寸</strong></span>
            <span class="price num">{{ formatPrice(piece.price) }}</span>
          </li>
        </ul>

        <p class="total">整套 <span class="num">{{ formatPrice(total) }}</span><span class="soft">　{{ pieces.length }} 件</span></p>
        <div class="actions">
          <button type="button" class="btn primary" @click="addAll">整套加入購物車</button>
          <button type="button" class="link" @click="copyLink">複製這一套的網址</button>
          <span class="feedback" role="status">{{ feedback }}</span>
        </div>
        <p class="hint">穿搭頁的「拿這套去試穿間改」會把整套帶進來；單品頁的「放進試穿間」只換掉那一層。</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.fitting {
  padding-block: var(--s3) var(--s5);
}

.head {
  display: grid;
  gap: var(--s1);
  margin-bottom: var(--s4);
}

.head h1 {
  font-size: var(--fs-3);
  letter-spacing: 0.04em;
}

.lead,
.hint,
.scale-note,
.soft,
.sub,
.feedback {
  color: var(--ink-soft);
}

.room {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: var(--s4);
  align-items: start;
}

/* 人形：主題色加大量白的底，和卡片一樣 */
.figure {
  display: grid;
  justify-items: center;
  gap: var(--s2);
  padding: var(--s4) var(--s3);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--accent) 10%, white);
}

.stand {
  transform-origin: 50% 100%;
  transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.scale-note {
  margin: 0;
  font-size: var(--fs-0);
  text-align: center;
}

.controls {
  display: grid;
  gap: var(--s3);
}

/* 那一句：和一句話列同一種讀法，字大一點、行高鬆一點 */
.line {
  margin: 0;
  font-size: var(--fs-2);
  line-height: 2.1;
}

.clause {
  display: inline-block;
}

.pieces {
  display: grid;
  gap: var(--s2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.pieces li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--s2) var(--s3);
  padding: var(--s2) var(--s3);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
}

.swatch {
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  border: 1px solid rgba(31, 29, 26, 0.25);
}

.piece-text {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.name {
  color: inherit;
  text-decoration: none;
  font-weight: 500;
}

.name:hover,
.name:focus-visible {
  text-decoration: underline;
  text-underline-offset: 0.3em;
}

.sub {
  font-size: var(--fs-0);
}

.size-pick {
  display: inline-flex;
  align-items: center;
  gap: var(--s1);
  font-size: var(--fs-0);
  color: var(--ink-soft);
}

.size-pick select {
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--field-line);
  background: var(--surface);
  color: var(--ink);
}

.size-pick strong {
  color: var(--ink);
}

.num {
  font-family: 'Space Mono', monospace;
  letter-spacing: -0.02em;
}

.price {
  white-space: nowrap;
}

.total {
  margin: 0;
  font-size: var(--fs-2);
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

.feedback {
  font-size: var(--fs-0);
}

.hint {
  margin: 0;
  font-size: var(--fs-0);
}

.state {
  display: grid;
  justify-items: start;
  gap: var(--s2);
  padding: var(--s4) 0;
  color: var(--ink-soft);
}

@media (prefers-reduced-motion: reduce) {
  .stand {
    transition: none;
  }
}

@media (max-width: 56rem) {
  .room {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--s3);
  }

  .line {
    font-size: var(--fs-1);
  }

  .pieces li {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .size-pick,
  .price {
    grid-column: 2;
  }
}
</style>
