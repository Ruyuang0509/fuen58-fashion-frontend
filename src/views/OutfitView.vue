<script setup>
// 一套穿搭的頁面（第十一輪新頁；站的瀏覽單位就是穿搭，所以它要有自己的一頁）。
// 天空是今天的，染這條路線的顏色。左邊說「今天為什麼是這套」（用天氣對每件的厚薄與布料算出來的幾句話），
// 右邊是這套掛在天空下。底下是三件單品：選尺寸、換一件（同路線同類別的別件），整套加入購物車。
// 滑過單品清單的某一件，上面人形裡那一件會提出來。
import '@fontsource/space-mono/400.css'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getOutfit, getOutfits, getProducts, getThemes, getWeather } from '@/api'
import GarmentImage from '@/components/GarmentImage.vue'
import Icon from '@/components/Icon.vue'
import OutfitLook from '@/components/OutfitLook.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import SiteHeader from '@/components/SiteHeader.vue'
import SkyPage from '@/components/SkyPage.vue'
import { useFlyToCart } from '@/composables/useFlyToCart'
import { CATEGORY_NAMES, formatPrice } from '@/products/labels'
import { fitReason } from '@/products/weatherFit'
import { useCart } from '@/stores/cart'
import { accentOf } from '@/theme/themes'

const route = useRoute()
const { add } = useCart()
const { fly } = useFlyToCart()

const outfit = ref(null)
const products = ref(new Map()) // productId → 商品細節（厚薄、庫存、布料）
const weather = ref(null)
const themes = ref([])
const others = ref([])
const status = ref('loading') // loading | ready | missing | error

const pieces = ref([]) // 目前這套的單品（可以換）
const sizes = ref({}) // productId → 選的尺寸
const highlight = ref(null)
const swapping = ref(null) // 正在換第幾件
const alternatives = ref([])
const feedback = ref('')
let feedbackTimer = 0
const look = ref(null)

const themeName = computed(() => themes.value.find((item) => item.code === outfit.value?.themeCode)?.name ?? '')
const accent = computed(() => accentOf(outfit.value?.themeCode))
const total = computed(() => pieces.value.reduce((sum, piece) => sum + piece.price, 0))
// 單品加上細節；顏色用這套穿搭選的
const detailed = computed(() => pieces.value.map((piece) => ({ ...(products.value.get(piece.productId) ?? {}), ...piece })))
const reason = computed(() => fitReason(detailed.value, weather.value))
const lookOutfit = computed(() => ({ ...outfit.value, items: pieces.value }))
const conditionText = computed(() => ({ rain: '有雨', cloudy: '多雲', clear: '晴' })[weather.value?.condition] ?? '')
const missingSizes = computed(() => pieces.value.filter((piece) => !sizes.value[piece.productId]).length)

const stockOf = (piece, size) => products.value.get(piece.productId)?.stock?.[`${piece.colourCode}-${size}`] ?? 0
const sizeOptions = (piece) => piece.sizes.map((code) => ({ code, stock: stockOf(piece, code) }))

let latest = 0
async function load(id) {
  const ticket = ++latest
  status.value = 'loading'
  swapping.value = null
  alternatives.value = []
  try {
    const [found, today, themeList] = await Promise.all([getOutfit(id), getWeather(), getThemes()])
    if (ticket !== latest) return
    themes.value = themeList
    weather.value = today
    if (!found) {
      status.value = 'missing'
      return
    }
    outfit.value = found
    pieces.value = found.items.map((item) => ({ ...item }))
    // 單一尺寸的直接選好
    sizes.value = Object.fromEntries(found.items.map((item) => [item.productId, item.sizes.length === 1 ? item.sizes[0] : '']))
    const list = await getProducts({ ids: found.items.map((item) => item.productId) })
    if (ticket !== latest) return
    products.value = new Map(list.map((product) => [product.productId, product]))
    status.value = 'ready'
    const same = await getOutfits({ style: found.themeCode })
    if (ticket !== latest) return
    others.value = same.filter((entry) => entry.id !== found.id).slice(0, 4)
  } catch {
    if (ticket === latest) status.value = 'error'
  }
}
watch(() => route.params.id, load, { immediate: true })

// 換一件：同路線、同類別、不在這套裡的商品
async function openSwap(index) {
  if (swapping.value === index) {
    swapping.value = null
    return
  }
  swapping.value = index
  const piece = pieces.value[index]
  const list = await getProducts({ theme: outfit.value.themeCode, exclude: pieces.value.map((entry) => entry.productId) })
  alternatives.value = list.filter((product) => product.category === piece.category)
}

function swapTo(product) {
  const index = swapping.value
  if (index === null) return
  const way = product.colours[0]
  const old = pieces.value[index]
  pieces.value[index] = {
    productId: product.productId,
    name: product.name,
    brand: product.brand,
    brandCode: product.brandCode,
    category: product.category,
    price: product.price,
    sizes: product.sizes,
    kind: product.kind,
    fabric: product.fabric,
    colour: way.hex,
    colourCode: way.code,
    colourName: way.name,
  }
  products.value.set(product.productId, product)
  delete sizes.value[old.productId]
  sizes.value[product.productId] = product.sizes.length === 1 ? product.sizes[0] : ''
  swapping.value = null
  alternatives.value = []
}

function addAll() {
  for (const piece of pieces.value) add(piece, sizes.value[piece.productId] || null, piece.colourCode)
  fly(look.value?.$el?.querySelector('img'))
  feedback.value = missingSizes.value ? `已加入 ${pieces.value.length} 件；${missingSizes.value} 件還沒選尺寸，到購物車選。` : `已加入 ${pieces.value.length} 件`
  clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => (feedback.value = ''), 4000)
}

onBeforeUnmount(() => clearTimeout(feedbackTimer))
</script>

<template>
  <SkyPage v-if="status === 'ready' || (status === 'loading' && outfit)" class="outfit-page" :weather="weather" :tint="accent" height="86svh" min-height="38rem" skip-target="#pieces" skip-label="跳到單品">
    <template #hero>
      <div class="say">
        <p class="eyebrow">
          <RouterLink :to="{ name: 'theme', params: { code: outfit.themeCode } }">{{ themeName }}路線</RouterLink>
          <span class="sep">　／　</span>
          <template v-if="weather">今天 <span class="num">{{ weather.temperature }}°</span>，濕度 <span class="num">{{ weather.humidity }}%</span><template v-if="conditionText">，{{ conditionText }}</template>。</template>
        </p>
        <h1 class="line">{{ outfit.title }}</h1>
        <!-- 今天為什麼是這套：規則拼出來的幾句話，不是生成的 -->
        <ul v-if="reason.lines.length" class="reason" :class="reason.verdict">
          <li v-for="(sentence, i) in reason.lines" :key="i">{{ sentence }}</li>
        </ul>
        <p class="total">整套 <span class="num">{{ formatPrice(total) }}</span><span class="soft">　{{ pieces.length }} 件</span></p>
      </div>

      <div class="figure">
        <OutfitLook ref="look" :outfit="lookOutfit" :height="460" :caption="false" :highlight="highlight" />
      </div>
    </template>

    <template #default>
      <section id="pieces" class="pieces">
        <div class="pieces-inner">
          <h2 class="section-title">這套的單品</h2>
          <ul class="list">
            <li v-for="(piece, index) in pieces" :key="piece.productId" class="piece" :class="{ hl: piece.productId === highlight }" @pointerenter="highlight = piece.productId" @pointerleave="highlight = null">
              <RouterLink :to="{ name: 'product', params: { id: piece.productId }, query: { colour: piece.colourCode } }" class="thumb">
                <GarmentImage :kind="piece.kind" :colour="piece.colour" :fabric="piece.fabric" :height="110" />
              </RouterLink>
              <div class="what">
                <p class="cat">{{ CATEGORY_NAMES[piece.category] }}</p>
                <RouterLink :to="{ name: 'product', params: { id: piece.productId }, query: { colour: piece.colourCode } }" class="name">{{ piece.name }}</RouterLink>
                <p class="meta">{{ piece.brand }}・{{ piece.colourName }}</p>
                <label v-if="piece.sizes.length > 1" class="size-pick">
                  <span>尺寸</span>
                  <select v-model="sizes[piece.productId]">
                    <option value="">到購物車再選</option>
                    <option v-for="option in sizeOptions(piece)" :key="option.code" :value="option.code" :disabled="option.stock === 0">{{ option.code }}{{ option.stock === 0 ? '（無庫存）' : '' }}</option>
                  </select>
                </label>
                <p v-else class="meta">單一尺寸</p>
              </div>
              <div class="side">
                <p class="price num">{{ formatPrice(piece.price) }}</p>
                <button type="button" class="link swap" :aria-expanded="swapping === index" @click="openSwap(index)">
                  <Icon name="swap" />換一件
                </button>
              </div>

              <!-- 換一件：同路線同類別的別件，點一件就換上去 -->
              <div v-if="swapping === index" class="alternatives">
                <p v-if="!alternatives.length" class="soft">這條路線沒有別的{{ CATEGORY_NAMES[piece.category] }}了。</p>
                <button v-for="product in alternatives" :key="product.productId" type="button" class="alt" @click="swapTo(product)">
                  <GarmentImage :kind="product.kind" :colour="product.colours[0].hex" :fabric="product.fabric" :height="96" />
                  <span class="alt-name">{{ product.name }}</span>
                  <span class="alt-meta">{{ product.brand }}　<span class="num">{{ formatPrice(product.price) }}</span></span>
                </button>
              </div>
            </li>
          </ul>

          <div class="actions">
            <p class="sum">整套 <span class="num">{{ formatPrice(total) }}</span></p>
            <button type="button" class="btn primary" @click="addAll">整套加入購物車</button>
            <span class="feedback" role="status">{{ feedback }}</span>
          </div>
        </div>
      </section>

      <section v-if="others.length" class="others">
        <div class="pieces-inner">
          <h2 class="section-title">{{ themeName }}路線的其他穿搭</h2>
          <div class="row">
            <RouterLink v-for="entry in others" :key="entry.id" :to="{ name: 'outfit', params: { id: entry.id } }" class="look-link">
              <OutfitLook :outfit="entry" :height="240" />
            </RouterLink>
          </div>
        </div>
      </section>
    </template>
  </SkyPage>

  <template v-else>
    <SiteHeader />
    <main class="state">
      <template v-if="status === 'loading'">
        <p class="soft">載入中…</p>
      </template>
      <template v-else-if="status === 'error'">
        <p>這套穿搭沒有載入成功。</p>
        <button type="button" class="btn" @click="load(route.params.id)">再試一次</button>
      </template>
      <template v-else>
        <h1>找不到這套穿搭</h1>
        <RouterLink class="btn" :to="{ name: 'outfits' }">看全部穿搭</RouterLink>
      </template>
    </main>
    <SiteFooter />
  </template>
</template>

<style scoped>
.num {
  font-family: 'Space Mono', monospace;
  letter-spacing: -0.02em;
}

.soft {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

/* ── 天空裡 ── */
.say {
  position: absolute;
  left: 2.4rem;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  gap: 0.9rem;
  max-width: 32rem;
}

.eyebrow {
  margin: 0;
  color: var(--fg-soft);
  font-size: 0.95rem;
  letter-spacing: 0.1em;
}

.eyebrow a {
  border-bottom: 1px solid var(--line-soft);
  transition: border-color 0.25s ease;
}

.eyebrow a:hover,
.eyebrow a:focus-visible {
  border-color: var(--fg);
}

.sep {
  opacity: 0.6;
}

.line {
  margin: 0;
  font-weight: 600;
  font-size: clamp(2.2rem, 4.6vw, 3.6rem);
  line-height: 1.3;
  letter-spacing: 0.08em;
}

.reason {
  margin: 0.4rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.35rem;
  font-family: 'Noto Sans TC', sans-serif;
  font-size: 1rem;
  line-height: 1.7;
  color: var(--fg-soft);
}

.reason li {
  padding-left: 1.1em;
  text-indent: -1.1em;
}

.reason li::before {
  content: '— ';
  opacity: 0.6;
}

.total {
  margin: 0.4rem 0 0;
  font-size: 1.1rem;
}

.total .soft {
  color: var(--fg-soft);
  font-size: 0.85rem;
  letter-spacing: 0.1em;
}

.figure {
  position: absolute;
  right: 8vw;
  top: 48%;
  transform: translateY(-54%);
}

/* ── 單品 ── */
.pieces-inner {
  max-width: 64rem;
  margin-inline: auto;
  padding: var(--s5) var(--s3);
}

.section-title {
  margin: 0 0 var(--s4);
  font-size: var(--fs-2);
  font-weight: 400;
  letter-spacing: 0.12em;
  color: var(--ink-soft);
}

.list {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--line);
}

.piece {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr) auto;
  gap: var(--s2) var(--s4);
  align-items: center;
  padding: var(--s3) var(--s2);
  border-bottom: 1px solid var(--line);
  transition: background-color 0.3s ease;
}

.piece.hl {
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

.thumb {
  display: grid;
  place-items: center;
  height: 7rem;
}

.what {
  display: grid;
  gap: 0.25rem;
}

.cat {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--fs-0);
  letter-spacing: 0.12em;
}

.name {
  color: inherit;
  font-size: var(--fs-2);
  font-weight: 500;
  text-decoration: none;
  background-image: linear-gradient(currentColor, currentColor);
  background-repeat: no-repeat;
  background-size: 0 1px;
  background-position: 0 100%;
  transition: background-size 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.name:hover,
.name:focus-visible {
  background-size: 100% 1px;
}

.meta {
  margin: 0;
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.size-pick {
  display: inline-flex;
  align-items: center;
  gap: var(--s1);
  margin-top: var(--s1);
  font-size: var(--fs-0);
}

.size-pick span {
  color: var(--ink-soft);
}

.size-pick select {
  padding: 0.2rem var(--s1);
  border: 1px solid var(--field-line);
  background: var(--surface);
}

.side {
  display: grid;
  justify-items: end;
  gap: var(--s2);
}

.price {
  margin: 0;
  font-size: var(--fs-1);
}

.link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-soft);
  font-size: var(--fs-0);
  text-decoration: underline;
  text-underline-offset: 0.3em;
  cursor: pointer;
  transition: color var(--ease);
}

.link:hover,
.link:focus-visible {
  color: var(--ink);
}

.alternatives {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: var(--s3);
  padding: var(--s2) 0 var(--s1);
}

.alt {
  display: grid;
  justify-items: center;
  gap: 0.3rem;
  width: 9rem;
  padding: var(--s2);
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: border-color var(--ease), background-color var(--ease);
}

.alt:hover,
.alt:focus-visible {
  border-color: var(--line);
  background: var(--surface);
}

.alt-name {
  font-size: var(--fs-0);
  text-align: center;
}

.alt-meta {
  color: var(--ink-soft);
  font-size: 0.75rem;
}

.actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--s3);
  margin-top: var(--s4);
}

.sum {
  margin: 0;
  font-size: var(--fs-2);
}

.primary {
  padding: var(--s2) var(--s4);
  font-weight: 700;
}

.feedback {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

/* ── 其他穿搭 ── */
.others .row {
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
  .look-link {
    transition: none;
  }
}

@media (max-width: 52rem) {
  .say {
    position: static;
    transform: none;
  }

  .figure {
    position: static;
    transform: none;
    display: grid;
    justify-items: center;
    margin-top: 1.6rem;
  }

  .piece {
    grid-template-columns: 5.5rem minmax(0, 1fr);
  }

  .side {
    grid-column: 1 / -1;
    grid-template-columns: auto auto;
    justify-content: space-between;
    justify-items: start;
  }
}
</style>
