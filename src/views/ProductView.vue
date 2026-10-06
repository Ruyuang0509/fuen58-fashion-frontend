<script setup>
// 商品頁。上半部屬探索區（圖、說明、所屬穿搭、同路線單品），購買區塊守慣例：
// 看得見的欄位標籤、無庫存的尺寸不可選、錯誤訊息貼在欄位旁、一個畫面只有一個主按鈕、數字不做動畫。
// （介面方向筆記 2.1「交界」與 2.2 五條）
import '@fontsource/noto-serif-tc/600.css'
import '@fontsource/space-mono/400.css'
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getOutfitsWithProduct, getProduct, getProducts, getThemes } from '@/api'
import GarmentImage from '@/components/GarmentImage.vue'
import OutfitLook from '@/components/OutfitLook.vue'
import ProductCard from '@/components/ProductCard.vue'
import { useFlyToCart } from '@/composables/useFlyToCart'
import { CATEGORY_NAMES, formatPrice, warmthText } from '@/products/labels'
import { useCart } from '@/stores/cart'
import { accentOf } from '@/theme/themes'

const route = useRoute()
const router = useRouter()
const { add } = useCart()
const { fly } = useFlyToCart()

const product = ref(null)
const outfits = ref([])
const related = ref([])
const themes = ref([])
const status = ref('loading') // loading | ready | missing | error

// 選到的規格。顏色寫在網址（?colour=）：貼連結給人看到的是同一個顏色；尺寸與數量不寫。
const colourCode = computed(() => String(route.query.colour ?? ''))
const size = ref(null)
const qty = ref(1)
const sizeError = ref('')
const feedback = ref('')
let feedbackTimer = 0

const mainImage = ref(null)
const sizeField = ref(null)
const zoom = ref(null)

const colour = computed(() => product.value?.colours.find((entry) => entry.code === colourCode.value) ?? product.value?.colours[0] ?? null)
const accent = computed(() => accentOf(product.value?.themeCodes[0]))
const themeName = (code) => themes.value.find((theme) => theme.code === code)?.name ?? code
const oneSize = computed(() => product.value?.sizes.length === 1)

const stockOf = (sizeCode) => (product.value && colour.value ? (product.value.stock[`${colour.value.code}-${sizeCode}`] ?? 0) : 0)
const stockLeft = computed(() => (size.value ? stockOf(size.value) : 0))
const canAdd = computed(() => !!size.value && stockLeft.value > 0 && qty.value <= stockLeft.value)

const fitText = computed(() => {
  const fit = product.value?.fit
  if (!fit) return ''
  const who = `模特兒 ${fit.height} cm／${fit.weight} kg`
  return oneSize.value ? `${who}：${fit.note}` : `${who}，穿 ${fit.size}：${fit.note}`
})

// 連續換頁時，先送出的請求可能比較晚回來；只採用最後一次的結果
let latest = 0

async function load(id) {
  const ticket = ++latest
  status.value = 'loading'
  size.value = null
  qty.value = 1
  sizeError.value = ''
  try {
    const [item, themeList] = await Promise.all([getProduct(id), getThemes()])
    if (ticket !== latest) return
    themes.value = themeList
    if (!item) {
      product.value = null
      status.value = 'missing'
      return
    }
    product.value = item
    if (item.sizes.length === 1) size.value = item.sizes[0]
    status.value = 'ready'
    // 下面兩段是陪襯，晚一點到也沒關係
    const [inOutfits, others] = await Promise.all([
      getOutfitsWithProduct(id),
      getProducts({ theme: item.themeCodes[0], exclude: [item.productId] }),
    ])
    if (ticket !== latest) return
    outfits.value = inOutfits
    related.value = others.slice(0, 6)
  } catch {
    if (ticket === latest) status.value = 'error'
  }
}

watch(() => route.params.id, (id) => load(id), { immediate: true })

function pickColour(code) {
  router.replace({ query: { ...route.query, colour: code } })
  // 換了顏色之後，原本選的尺寸在這個顏色沒貨：取消選擇，讓人重選
  nextTick(() => {
    if (size.value && stockOf(size.value) === 0) size.value = null
  })
}

function pickSize(code) {
  size.value = code
  sizeError.value = ''
  if (qty.value > stockOf(code)) qty.value = Math.max(1, stockOf(code))
}

function step(delta) {
  const max = Math.max(1, stockLeft.value || 1)
  qty.value = Math.min(max, Math.max(1, qty.value + delta))
}

function onQtyInput(event) {
  const value = Math.floor(Number(event.target.value))
  const max = Math.max(1, stockLeft.value || 1)
  qty.value = Number.isFinite(value) ? Math.min(max, Math.max(1, value)) : 1
}

function addToCart() {
  if (!size.value) {
    sizeError.value = '請先選尺寸。'
    sizeField.value?.querySelector('input:not(:disabled)')?.focus()
    return
  }
  if (!canAdd.value) return
  add(product.value, size.value, colour.value.code, qty.value)
  fly(mainImage.value?.$el)
  feedback.value = `已加入購物車：${colour.value.name}・${oneSize.value ? '單一尺寸' : size.value} × ${qty.value}`
  clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => (feedback.value = ''), 3500)
}

function openZoom() {
  zoom.value?.showModal()
}

function closeZoom(event) {
  // 點到對話框本身（也就是周圍的暗處）才關；點到裡面的圖不關
  if (!event || event.target === zoom.value) zoom.value?.close()
}
</script>

<template>
  <article v-if="status === 'ready' && product" class="product" :style="{ '--tint': accent }">
    <div class="top">
      <!-- 圖：點了放大；底下每個顏色一張，點了換色 -->
      <section class="gallery" aria-label="商品圖">
        <figure class="main">
          <button type="button" class="zoom-btn" aria-label="放大看" @click="openZoom">
            <GarmentImage ref="mainImage" :kind="product.kind" :colour="colour.hex" :fabric="product.fabric" :height="520" :alt="`${product.name}（${colour.name}）`" />
          </button>
          <figcaption>{{ colour.name }}<span v-if="!product.kind" class="soft">　布料近拍</span></figcaption>
        </figure>
        <ul v-if="product.colours.length > 1" class="thumbs" aria-label="其他顏色">
          <li v-for="entry in product.colours" :key="entry.code">
            <button type="button" :class="{ on: entry.code === colour.code }" :aria-pressed="entry.code === colour.code" @click="pickColour(entry.code)">
              <GarmentImage :kind="product.kind" :colour="entry.hex" :fabric="product.fabric" :height="88" :alt="entry.name" />
            </button>
          </li>
        </ul>
      </section>

      <section class="info">
        <p class="brand">
          <RouterLink :to="{ name: 'brand', params: { id: product.brandCode } }">{{ product.brand }}</RouterLink>
          <span class="soft">　{{ CATEGORY_NAMES[product.category] }}</span>
        </p>
        <h1 class="name">{{ product.name }}</h1>
        <p class="price num">{{ formatPrice(product.price) }}</p>
        <p class="themes">
          走
          <template v-for="(code, i) in product.themeCodes" :key="code">
            <template v-if="i">、</template>
            <RouterLink :to="{ name: 'theme', params: { code } }">{{ themeName(code) }}</RouterLink>
          </template>
          路線
        </p>

        <p class="desc">{{ product.description }}</p>
        <dl class="facts">
          <dt>材質</dt>
          <dd>{{ product.material }}</dd>
          <dt>厚度</dt>
          <dd>{{ warmthText(product.warmth) }}</dd>
          <template v-if="product.features.length">
            <dt>機能</dt>
            <dd>{{ product.features.join('、') }}</dd>
          </template>
        </dl>

        <!-- 購買區塊：從這裡開始守慣例 -->
        <form class="buy" novalidate @submit.prevent="addToCart">
          <fieldset v-if="product.colours.length > 1" class="field">
            <legend>顏色<span class="chosen">{{ colour.name }}</span></legend>
            <div class="swatches">
              <label v-for="entry in product.colours" :key="entry.code" class="swatch" :class="{ on: entry.code === colour.code }">
                <input type="radio" name="colour" :value="entry.code" :checked="entry.code === colour.code" @change="pickColour(entry.code)" />
                <span class="chip" :style="{ background: entry.hex }" aria-hidden="true"></span>
                <span class="chip-name">{{ entry.name }}</span>
              </label>
            </div>
          </fieldset>
          <p v-else class="single">顏色<span class="chosen">{{ colour.name }}</span></p>

          <fieldset v-if="!oneSize" ref="sizeField" class="field" :aria-describedby="sizeError ? 'size-error' : undefined">
            <legend>尺寸<span v-if="size" class="chosen">{{ size }}</span></legend>
            <div class="sizes">
              <label v-for="entry in product.sizes" :key="entry" class="size" :class="{ on: entry === size, out: stockOf(entry) === 0 }">
                <input type="radio" name="size" :value="entry" :checked="entry === size" :disabled="stockOf(entry) === 0" @change="pickSize(entry)" />
                <span>{{ entry }}</span>
                <small v-if="stockOf(entry) === 0">無庫存</small>
              </label>
            </div>
            <p v-if="sizeError" id="size-error" class="error" role="alert">{{ sizeError }}</p>
          </fieldset>
          <p v-else class="single">尺寸<span class="chosen">單一尺寸</span></p>

          <!-- 試穿資訊放在選尺寸的旁邊（功能規劃 3.3，必） -->
          <p class="fit">{{ fitText }}</p>

          <details class="measure">
            <summary>尺寸表（平量，公分）</summary>
            <table>
              <thead>
                <tr>
                  <th scope="col">尺寸</th>
                  <th v-for="column in product.measure.columns" :key="column" scope="col">{{ column }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(values, code) in product.measure.rows" :key="code" :class="{ on: code === size }">
                  <th scope="row">{{ code === 'F' ? '單一尺寸' : code }}</th>
                  <td v-for="(value, i) in values" :key="i" class="num">{{ value }}</td>
                </tr>
              </tbody>
            </table>
            <p class="soft">平量有 1–2 公分的誤差。</p>
          </details>

          <div class="qty-row">
            <label for="qty">數量</label>
            <div class="stepper">
              <button type="button" aria-label="減一件" :disabled="qty <= 1" @click="step(-1)">−</button>
              <input id="qty" type="number" inputmode="numeric" min="1" :max="Math.max(1, stockLeft || 1)" :value="qty" @change="onQtyInput" />
              <button type="button" aria-label="加一件" :disabled="size && qty >= stockLeft" @click="step(1)">＋</button>
            </div>
            <span v-if="size && stockLeft > 0 && stockLeft <= 3" class="stock">這個尺寸還有 {{ stockLeft }} 件</span>
          </div>

          <div class="actions">
            <button type="submit" class="btn primary" :disabled="size && !canAdd">加入購物車</button>
            <span class="feedback" role="status">{{ feedback }}</span>
          </div>
        </form>
      </section>
    </div>

    <section v-if="outfits.length" class="section">
      <h2 class="section-title">這件出現在的穿搭</h2>
      <div class="looks">
        <RouterLink v-for="outfit in outfits" :key="outfit.id" :to="{ name: 'outfit', params: { id: outfit.id } }" class="look-link" :title="`看這套：${outfit.title}`">
          <OutfitLook :outfit="outfit" :height="260" />
        </RouterLink>
      </div>
    </section>

    <section v-if="related.length" class="section">
      <h2 class="section-title">同路線的其他單品</h2>
      <div class="grid">
        <ProductCard v-for="item in related" :key="item.productId" :product="item" />
      </div>
    </section>

    <!-- 放大看：原生 dialog，Esc 會關，點暗處也會關 -->
    <dialog ref="zoom" class="zoom" @click="closeZoom">
      <div class="zoom-body">
        <GarmentImage :kind="product.kind" :colour="colour.hex" :fabric="product.fabric" :height="820" :alt="`${product.name}（${colour.name}），放大`" />
        <button type="button" class="close" @click="closeZoom()">關閉</button>
      </div>
    </dialog>
  </article>

  <p v-else-if="status === 'loading'" class="state">載入中…</p>

  <div v-else-if="status === 'error'" class="state">
    <p>商品沒有載入成功。</p>
    <button type="button" class="btn" @click="load(route.params.id)">再試一次</button>
  </div>

  <div v-else class="state">
    <h1>找不到這件商品</h1>
    <p>它可能已經下架，或網址打錯了。</p>
    <RouterLink class="btn" :to="{ name: 'outfits' }">看全部穿搭</RouterLink>
  </div>
</template>

<style scoped>
.product {
  padding-top: var(--s3);
}

.top {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  gap: var(--s4);
  align-items: start;
}

/* ── 圖 ── */
.gallery {
  display: grid;
  gap: var(--s2);
}

.main {
  margin: 0;
  display: grid;
  gap: var(--s1);
}

.zoom-btn {
  all: unset;
  cursor: zoom-in;
  display: grid;
  place-items: center;
  aspect-ratio: 4 / 5;
  max-height: 40rem;
  padding: var(--s3);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--tint) 12%, white);
  transition: background-color var(--ease);
}

.zoom-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.main figcaption {
  color: var(--ink-soft);
  font-size: var(--fs-0);
  letter-spacing: 0.08em;
}

.thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.thumbs button {
  all: unset;
  cursor: pointer;
  display: grid;
  place-items: center;
  width: 5.2rem;
  height: 6.2rem;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--tint) 8%, white);
  border-bottom: 2px solid transparent;
}

.thumbs button.on {
  border-bottom-color: var(--ink);
}

.thumbs button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* ── 說明 ── */
.info {
  display: grid;
  gap: var(--s2);
}

.brand {
  color: var(--ink-soft);
  font-size: var(--fs-0);
  letter-spacing: 0.1em;
}

.brand a {
  color: inherit;
}

.soft {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.name {
  font-family: 'Noto Serif TC', serif;
  font-size: var(--fs-3);
  font-weight: 600;
  letter-spacing: 0.04em;
}

.num {
  font-family: 'Space Mono', monospace;
  letter-spacing: -0.02em;
}

.price {
  font-size: var(--fs-2);
}

.themes {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.themes a {
  color: var(--ink);
  text-underline-offset: 0.3em;
}

.desc {
  margin-top: var(--s1);
  max-width: 34em;
}

.facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--s1) var(--s2);
  margin: 0;
  font-size: var(--fs-0);
}

.facts dt {
  color: var(--ink-soft);
}

.facts dd {
  margin: 0;
}

/* ── 購買區塊 ── */
.buy {
  display: grid;
  gap: var(--s2);
  margin-top: var(--s2);
  padding: var(--s3);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
}

.field {
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}

legend,
.single {
  padding: 0;
  margin-bottom: var(--s1);
  font-size: var(--fs-0);
  color: var(--ink-soft);
  letter-spacing: 0.08em;
}

.chosen {
  margin-left: var(--s2);
  color: var(--ink);
  font-weight: 700;
  letter-spacing: 0;
}

/* 選項是真的單選鈕，只是把原本的圓點藏起來、用外框表示選到 */
.swatches,
.sizes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.swatch,
.size {
  position: relative;
  cursor: pointer;
}

.swatch input,
.size input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
}

.swatch {
  display: grid;
  justify-items: center;
  gap: 0.2rem;
  font-size: var(--fs-0);
}

.chip {
  display: block;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 50%;
  border: 1px solid rgba(31, 29, 26, 0.25);
  box-shadow: 0 0 0 2px var(--surface);
}

.swatch.on .chip {
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 3.5px var(--ink);
}

.swatch:has(input:focus-visible) .chip {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}

.size {
  display: grid;
  justify-items: center;
  min-width: 3.2rem;
  padding: var(--s1) var(--s2);
  border: 1px solid var(--field-line);
  border-radius: var(--radius-sm);
  background: var(--surface);
  line-height: 1.3;
}

.size.on {
  border-color: var(--ink);
  background: var(--ink);
  color: var(--surface);
}

.size.out {
  cursor: not-allowed;
  border-style: dashed;
  color: var(--ink-soft);
}

.size.out > span {
  text-decoration: line-through;
}

.size small {
  font-size: 0.7rem;
}

.size:has(input:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.error {
  margin-top: var(--s1);
  color: #9b2c2c; /* 與卡片底 7.6:1（check-contrast 有量） */
  font-size: var(--fs-0);
}

.fit {
  font-size: var(--fs-0);
  line-height: 1.5;
}

.measure summary {
  cursor: pointer;
  font-size: var(--fs-0);
  text-decoration: underline;
  text-underline-offset: 0.3em;
}

.measure table {
  width: 100%;
  margin-top: var(--s2);
  border-collapse: collapse;
  font-size: var(--fs-0);
}

.measure th,
.measure td {
  padding: var(--s1) var(--s2);
  border-top: 1px solid var(--line);
  text-align: left;
}

.measure td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.measure thead th {
  border-top: 0;
  color: var(--ink-soft);
  font-weight: 400;
}

.measure tr.on {
  background: color-mix(in srgb, var(--tint) 10%, white);
}

.measure .soft {
  margin-top: var(--s1);
}

.qty-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--s2);
  font-size: var(--fs-0);
}

.qty-row label {
  color: var(--ink-soft);
  letter-spacing: 0.08em;
}

.stepper {
  display: inline-flex;
  border: 1px solid var(--field-line);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.stepper button {
  width: 2.4rem;
  border: 0;
  background: var(--surface);
  cursor: pointer;
}

.stepper button:disabled {
  color: var(--ink-soft);
  cursor: not-allowed;
}

.stepper input {
  border-radius: 0;
  width: 3rem;
  padding: var(--s1) 0;
  border: 0;
  border-inline: 1px solid var(--line);
  text-align: center;
  font-variant-numeric: tabular-nums;
  appearance: textfield;
  -moz-appearance: textfield;
}

.stepper input::-webkit-inner-spin-button,
.stepper input::-webkit-outer-spin-button {
  appearance: none;
  margin: 0;
}

.stock {
  color: var(--ink-soft);
}

.actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--s2);
  margin-top: var(--s1);
}

.primary {
  padding: var(--s2) var(--s4);
  font-weight: 700;
}

.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.feedback {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

/* ── 下面兩段 ── */
.section {
  margin-top: var(--s4);
}

.section-title {
  margin-bottom: var(--s3);
  font-size: var(--fs-2);
  font-weight: 400;
  letter-spacing: 0.12em;
  color: var(--ink-soft);
}

.looks {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s4);
}

.look-link {
  color: inherit;
  text-decoration: none;
  transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.look-link:hover {
  transform: translateY(-6px);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: var(--s3);
}

/* ── 放大 ── */
.zoom {
  max-width: none;
  max-height: none;
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
}

.zoom::backdrop {
  background: rgba(31, 29, 26, 0.72);
}

.zoom-body {
  display: grid;
  place-items: center;
  gap: var(--s2);
  height: 100%;
  pointer-events: none;
}

.zoom-body > * {
  pointer-events: auto;
}

/* 放大的圖以視窗為限：高度不超過 86vh，寬跟著比例 */
.zoom-body :deep(img) {
  height: auto;
  max-height: 86vh;
  max-width: 92vw;
}

.close {
  padding: var(--s1) var(--s3);
  border: 1px solid var(--surface);
  border-radius: 999px;
  background: transparent;
  color: var(--surface);
  cursor: pointer;
}

.state {
  display: grid;
  justify-items: start;
  gap: var(--s2);
  padding: var(--s4) 0;
  color: var(--ink-soft);
}

.state h1 {
  color: var(--ink);
}

@media (prefers-reduced-motion: reduce) {
  .look-link {
    transition: none;
  }
}

/* 窄螢幕：一欄；購買區塊跟在圖後面 */
@media (max-width: 56rem) {
  .top {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--s3);
  }

  .zoom-btn {
    max-height: 30rem;
  }

  .zoom-body {
    padding: var(--s3);
  }
}
</style>
