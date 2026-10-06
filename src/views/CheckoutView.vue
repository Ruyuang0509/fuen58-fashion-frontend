<script setup>
// 結帳頁把收件與付款分成兩步，讓下單流程清楚且可返回修改。
import '@fontsource/space-mono/400.css'
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getProducts } from '@/api'
import {
  ApiError,
  PAYMENT_METHODS,
  addAddress,
  createOrder,
  listAddresses,
  payOrder,
} from '@/api/account'
import {
  FREE_SHIPPING_FROM,
  SHIPPING_FEE,
  formatPrice,
} from '@/products/labels'
import { useCart } from '@/stores/cart'
import { useSession } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const { lines, subtotal, clear } = useCart()
const { token, logout } = useSession()

const status = ref('loading')
const products = ref(new Map())
const addresses = ref([])
const step = ref(1)
const choice = ref(null)
const fresh = reactive({
  recipient: '',
  phone: '',
  postalCode: '',
  city: '',
  district: '',
  street: '',
})
const saveToBook = ref(true)
const errors = reactive({
  recipient: '',
  phone: '',
  postalCode: '',
  city: '',
  district: '',
  street: '',
  payment: '',
})
const payment = ref('')
const formError = ref('')
const placing = ref(false)
const placed = ref(false)

const CO_IDS = {
  recipient: 'co-recipient',
  phone: 'co-phone',
  postalCode: 'co-postal',
  city: 'co-city',
  district: 'co-district',
  street: 'co-street',
}

const rows = computed(() => lines.map((line) => {
  const product = products.value.get(line.productId) ?? null
  const colour = product
    ? (product.colours.find((item) => item.code === line.colour) ?? product.colours[0])
    : null

  return {
    line,
    product,
    colour,
    sizeText: product && product.sizes.length === 1 ? '單一尺寸' : line.size,
  }
}))

const blocked = computed(() => (
  status.value === 'ready'
  && rows.value.some((row) => !row.product || !row.line.size)
))

// 金額規則和購物車頁同一套；正式以後端重算為準。
const shipping = computed(() => (
  subtotal.value >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE
))
const total = computed(() => subtotal.value + shipping.value)

const chosenAddress = computed(() => (
  choice.value === 'new'
    ? { ...fresh }
    : addresses.value.find((address) => address.id === choice.value) ?? null
))

const clearErrors = () => {
  Object.keys(errors).forEach((key) => {
    errors[key] = ''
  })
  formError.value = ''
}

const handleUnauthorized = async (error) => {
  if (error?.code !== 'UNAUTHORIZED') return false

  await logout()
  await router.replace({
    name: 'login',
    query: { redirect: route.fullPath },
  })
  return true
}

const load = async () => {
  if (!lines.length) return

  status.value = 'loading'

  try {
    const [list, saved] = await Promise.all([
      getProducts({
        ids: [...new Set(lines.map((line) => line.productId))],
      }),
      listAddresses(token.value),
    ])

    products.value = new Map(list.map((product) => [product.productId, product]))
    addresses.value = saved
    choice.value = (saved.find((address) => address.isDefault) ?? saved[0])?.id ?? 'new'
    status.value = 'ready'
  } catch (error) {
    if (await handleUnauthorized(error)) return
    status.value = 'error'
  }
}

const validateFresh = () => {
  if (!fresh.recipient) {
    errors.recipient = '請填收件人'
  }

  if (!fresh.phone) {
    errors.phone = '請填手機號碼'
  } else if (!/^09\d{8}$/.test(fresh.phone.replace(/[\s-]/g, ''))) {
    errors.phone = '手機號碼要是 09 開頭的 10 位數字'
  }

  if (!/^\d{3}(\d{2,3})?$/.test(fresh.postalCode)) {
    errors.postalCode = '郵遞區號是 3、5 或 6 位數字'
  }

  if (!fresh.city) {
    errors.city = '請填縣市'
  }

  if (!fresh.district) {
    errors.district = '請填鄉鎮市區'
  }

  if (!fresh.street) {
    errors.street = '請填街道地址'
  }

  return Object.values(CO_IDS).every((id) => {
    const key = Object.keys(CO_IDS).find((name) => CO_IDS[name] === id)
    return !errors[key]
  })
}

const focusFirstFreshError = async () => {
  const firstKey = Object.keys(CO_IDS).find((key) => errors[key])
  if (!firstKey) return

  await nextTick()
  document.getElementById(CO_IDS[firstKey])?.focus()
}

const toPayment = async () => {
  clearErrors()

  if (choice.value === null) {
    formError.value = '請選收件地址'
    return
  }

  if (choice.value === 'new' && !validateFresh()) {
    await focusFirstFreshError()
    return
  }

  step.value = 2
  await nextTick()
  document.getElementById('step2-title')?.focus()
}

const backToAddress = async () => {
  step.value = 1
  formError.value = ''
  await nextTick()
  document.getElementById('step1-title')?.focus()
}

const placeOrder = async () => {
  clearErrors()

  if (!payment.value) {
    errors.payment = '請選付款方式'
    await nextTick()
    document.querySelector('.checkout-step2 input[name="payment"]')?.focus()
    return
  }

  placing.value = true

  try {
    const items = rows.value.map(({ line, colour }) => ({
      productId: line.productId,
      name: line.name,
      brand: line.brand,
      colour: colour.code,
      colourName: colour.name,
      size: line.size,
      qty: line.qty,
      price: line.price,
    }))
    const address = choice.value === 'new' ? { ...fresh } : null

    let order = await createOrder(token.value, {
      items,
      addressId: address ? null : choice.value,
      address,
      payment: { method: payment.value },
    })

    if (payment.value !== 'cod') {
      try {
        order = await payOrder(token.value, order.id, {
          method: payment.value,
        })
      } catch (error) {
        if (error?.code === 'UNAUTHORIZED') throw error
        // 訂單已成立；付款失敗時留在待付款，訂單頁看得到。
      }
    }

    if (address && saveToBook.value) {
      try {
        await addAddress(token.value, {
          ...address,
          isDefault: false,
        })
      } catch (error) {
        if (error?.code === 'UNAUTHORIZED') throw error
        // 存地址失敗不影響已成立的訂單。
      }
    }

    // 先顯示成立狀態，清空購物車時才不會閃出空購物車。
    placed.value = true
    clear()
    await router.push({
      name: 'checkout-done',
      params: { orderId: order.id },
    })
  } catch (error) {
    if (await handleUnauthorized(error)) return
    formError.value = error instanceof ApiError
      ? error.message
      : '下單沒有成功，請再試一次。'
  } finally {
    placing.value = false
  }
}

onMounted(load)
</script>

<template>
  <h1 class="title">結帳</h1>

  <p v-if="placed" class="state" role="status">
    訂單已成立，正在打開訂單…
  </p>

  <div v-else-if="!lines.length" class="empty">
    <p>購物車是空的。</p>
    <RouterLink class="btn" :to="{ name: 'outfits' }">
      看全部穿搭
    </RouterLink>
  </div>

  <p v-else-if="status === 'loading'" class="state">
    載入中…
  </p>

  <p v-else-if="status === 'error'" class="state">
    結帳資料沒有載入成功。
    <button type="button" class="link" @click="load">
      再試一次
    </button>
  </p>

  <div v-else-if="blocked" class="state">
    <p class="notice">
      購物車裡有商品還沒選尺寸或已經下架，請先回購物車處理。
    </p>
    <RouterLink :to="{ name: 'cart' }">
      回購物車
    </RouterLink>
  </div>

  <template v-else>
    <ol class="steps" aria-label="結帳步驟">
      <li
        :aria-current="step === 1 ? 'step' : undefined"
        :class="{ on: step === 1 }"
      >
        <span class="num">1</span> 收件資訊
      </li>
      <li
        :aria-current="step === 2 ? 'step' : undefined"
        :class="{ on: step === 2 }"
      >
        <span class="num">2</span> 付款
      </li>
    </ol>

    <form
      v-if="step === 1"
      class="checkout-step1 panel"
      novalidate
      @submit.prevent="toPayment"
    >
      <h2 id="step1-title" class="step-title" tabindex="-1">
        收件資訊
      </h2>

      <fieldset>
        <legend>寄到哪裡</legend>
        <div class="options">
          <label
            v-for="address in addresses"
            :key="address.id"
            class="address-option"
          >
            <input
              v-model="choice"
              type="radio"
              name="address"
              :value="address.id"
            />
            <span class="option-text">
              <span class="who">
                {{ address.recipient }}　{{ address.phone }}
                <span v-if="address.isDefault" class="badge">預設</span>
              </span>
              <span class="where">
                {{ address.postalCode }} {{ address.city }}{{ address.district }}{{ address.street }}
              </span>
            </span>
          </label>

          <label class="address-option new-address">
            <input
              v-model="choice"
              type="radio"
              name="address"
              value="new"
            />
            <span class="option-text">用新地址</span>
          </label>
        </div>
      </fieldset>

      <div v-if="choice === 'new'" class="new-fields">
        <div class="field">
          <label for="co-recipient">收件人</label>
          <input
            id="co-recipient"
            v-model.trim="fresh.recipient"
            type="text"
            autocomplete="name"
            :aria-invalid="errors.recipient ? 'true' : undefined"
            :aria-describedby="errors.recipient ? 'co-recipient-error' : undefined"
          />
          <p
            v-if="errors.recipient"
            id="co-recipient-error"
            class="field-error"
            role="alert"
          >
            {{ errors.recipient }}
          </p>
        </div>

        <div class="field">
          <label for="co-phone">手機</label>
          <input
            id="co-phone"
            v-model.trim="fresh.phone"
            type="tel"
            autocomplete="tel"
            inputmode="tel"
            :aria-invalid="errors.phone ? 'true' : undefined"
            :aria-describedby="errors.phone ? 'co-phone-error' : undefined"
          />
          <p
            v-if="errors.phone"
            id="co-phone-error"
            class="field-error"
            role="alert"
          >
            {{ errors.phone }}
          </p>
        </div>

        <div class="split">
          <div class="field">
            <label for="co-postal">郵遞區號</label>
            <input
              id="co-postal"
              v-model.trim="fresh.postalCode"
              type="text"
              autocomplete="postal-code"
              inputmode="numeric"
              :aria-invalid="errors.postalCode ? 'true' : undefined"
              :aria-describedby="errors.postalCode ? 'co-postal-error' : undefined"
            />
            <p
              v-if="errors.postalCode"
              id="co-postal-error"
              class="field-error"
              role="alert"
            >
              {{ errors.postalCode }}
            </p>
          </div>

          <div class="field">
            <label for="co-city">縣市</label>
            <input
              id="co-city"
              v-model.trim="fresh.city"
              type="text"
              autocomplete="address-level1"
              :aria-invalid="errors.city ? 'true' : undefined"
              :aria-describedby="errors.city ? 'co-city-error' : undefined"
            />
            <p
              v-if="errors.city"
              id="co-city-error"
              class="field-error"
              role="alert"
            >
              {{ errors.city }}
            </p>
          </div>

          <div class="field">
            <label for="co-district">鄉鎮市區</label>
            <input
              id="co-district"
              v-model.trim="fresh.district"
              type="text"
              autocomplete="address-level2"
              :aria-invalid="errors.district ? 'true' : undefined"
              :aria-describedby="errors.district ? 'co-district-error' : undefined"
            />
            <p
              v-if="errors.district"
              id="co-district-error"
              class="field-error"
              role="alert"
            >
              {{ errors.district }}
            </p>
          </div>
        </div>

        <div class="field">
          <label for="co-street">街道地址</label>
          <input
            id="co-street"
            v-model.trim="fresh.street"
            type="text"
            autocomplete="street-address"
            :aria-invalid="errors.street ? 'true' : undefined"
            :aria-describedby="errors.street ? 'co-street-error' : undefined"
          />
          <p
            v-if="errors.street"
            id="co-street-error"
            class="field-error"
            role="alert"
          >
            {{ errors.street }}
          </p>
        </div>

        <div class="check">
          <input id="co-save" v-model="saveToBook" type="checkbox" />
          <label for="co-save">存進地址簿</label>
        </div>
      </div>

      <p v-if="formError" class="form-error" role="alert">
        {{ formError }}
      </p>

      <div class="actions">
        <RouterLink :to="{ name: 'cart' }" class="link-back">
          回購物車
        </RouterLink>
        <button type="submit" class="btn primary next">
          下一步
        </button>
      </div>
    </form>

    <form
      v-else
      class="checkout-step2 panel"
      novalidate
      @submit.prevent="placeOrder"
    >
      <h2 id="step2-title" class="step-title" tabindex="-1">
        付款
      </h2>

      <section class="recap" aria-label="寄送資訊">
        <p class="label">寄到</p>
        <p>{{ chosenAddress?.recipient }}　{{ chosenAddress?.phone }}</p>
        <p class="where">
          {{ chosenAddress?.postalCode }} {{ chosenAddress?.city }}{{ chosenAddress?.district }}{{ chosenAddress?.street }}
        </p>
      </section>

      <ul class="summary-lines" aria-label="訂購商品">
        <li
          v-for="row in rows"
          :key="`${row.line.productId}-${row.line.colour}-${row.line.size}`"
        >
          <span class="what">
            {{ row.line.name }}・{{ row.colour?.name }}・{{ row.sizeText }} × {{ row.line.qty }}
          </span>
          <span class="num">
            {{ formatPrice(row.line.price * row.line.qty) }}
          </span>
        </li>
      </ul>

      <dl class="amounts">
        <div class="row">
          <dt>小計</dt>
          <dd class="num">{{ formatPrice(subtotal) }}</dd>
        </div>
        <div class="row">
          <dt>運費</dt>
          <dd class="num">
            {{ shipping ? formatPrice(shipping) : '免運' }}
          </dd>
        </div>
        <div class="row total">
          <dt>合計</dt>
          <dd class="num">{{ formatPrice(total) }}</dd>
        </div>
      </dl>

      <fieldset
        class="payment"
        :aria-describedby="errors.payment ? 'payment-error' : undefined"
      >
        <legend>付款方式</legend>
        <label
          v-for="(label, code) in PAYMENT_METHODS"
          :key="code"
          class="pay-option"
        >
          <input
            v-model="payment"
            type="radio"
            name="payment"
            :value="code"
          />
          {{ label }}
        </label>
        <p
          v-if="errors.payment"
          id="payment-error"
          class="field-error"
          role="alert"
        >
          {{ errors.payment }}
        </p>
      </fieldset>

      <p v-if="formError" class="form-error" role="alert">
        {{ formError }}
      </p>

      <div class="actions">
        <button type="button" class="link back" @click="backToAddress">
          回上一步
        </button>
        <button
          type="submit"
          class="btn primary place-order"
          :disabled="placing"
        >
          確認下單
        </button>
      </div>
    </form>
  </template>
</template>

<style scoped>
.title {
  margin-block: var(--s3) var(--s3);
  font-size: var(--fs-3);
}

.num {
  font-family: 'Space Mono', monospace;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-soft);
  font-size: var(--fs-0);
  text-decoration: underline;
  text-underline-offset: 0.3em;
  cursor: pointer;
}

.hint {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.notice {
  color: #9b2c2c;
  font-size: var(--fs-0);
}

.primary {
  padding: var(--s2) var(--s4);
  font-weight: 700;
}

.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.state,
.empty {
  display: grid;
  justify-items: start;
  gap: var(--s2);
  padding: var(--s3) 0;
  color: var(--ink-soft);
}

.panel {
  display: grid;
  gap: var(--s3);
  padding: var(--s3);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.field {
  display: grid;
  gap: var(--s1);
  min-width: 0;
}

.field label,
legend,
.label {
  font-size: var(--fs-0);
  color: var(--ink-soft);
  letter-spacing: 0.08em;
}

.field input,
.field select {
  width: 100%;
  min-width: 0;
  padding: var(--s1) var(--s2);
  border: 1px solid var(--field-line);
  border-radius: 0;
  background: var(--surface);
}

.field input[aria-invalid='true'] {
  border-color: #9b2c2c;
}

.field-error,
.form-error {
  color: #9b2c2c;
  font-size: var(--fs-0);
}

.check {
  display: flex;
  align-items: center;
  gap: var(--s1);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s2) var(--s3);
}

fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.steps {
  display: flex;
  gap: var(--s3);
  margin: 0 0 var(--s3);
  padding: 0;
  list-style: none;
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.steps .on {
  color: var(--ink);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 0.4em;
}

.step-title {
  font-size: var(--fs-2);
}

.step-title:focus {
  outline: none;
}

.step-title:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.options {
  display: grid;
  gap: var(--s1);
}

.address-option,
.pay-option {
  display: flex;
  align-items: flex-start;
  gap: var(--s2);
  padding: var(--s2);
  border: 1px solid var(--line);
  background: var(--surface);
  cursor: pointer;
  border-radius: var(--radius);
}

.address-option:has(input:checked),
.pay-option:has(input:checked) {
  border-color: var(--ink);
}

.address-option input,
.pay-option input {
  flex: none;
  margin-top: 0.35em;
}

.option-text {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.who {
  font-weight: 500;
}

.where {
  color: var(--ink-soft);
  font-size: var(--fs-0);
  overflow-wrap: anywhere;
}

.badge {
  margin-left: var(--s2);
  padding: 0 var(--s1);
  border: 1px solid var(--field-line);
  color: var(--ink-soft);
  font-size: var(--fs-0);
  font-weight: 400;
}

.new-fields {
  display: grid;
  gap: var(--s2);
}

.split {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--s2);
}

.payment {
  display: grid;
  gap: var(--s1);
}

.summary-lines {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--line);
}

.summary-lines li {
  display: flex;
  justify-content: space-between;
  gap: var(--s2);
  padding: var(--s1) 0;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-0);
}

.summary-lines .what {
  min-width: 0;
  overflow-wrap: anywhere;
}

.summary-lines .num {
  flex: none;
}

.amounts {
  display: grid;
  gap: var(--s1);
  width: 100%;
  max-width: 20rem;
  margin: 0 0 0 auto;
}

.amounts .row {
  display: flex;
  justify-content: space-between;
  gap: var(--s3);
}

.amounts dt {
  color: var(--ink-soft);
}

.amounts dd {
  margin: 0;
}

.amounts .total {
  margin-top: var(--s1);
  padding-top: var(--s2);
  border-top: 1px solid var(--line);
  font-size: var(--fs-2);
  font-weight: 700;
}

.amounts .total dt {
  color: var(--ink);
}

.link-back {
  color: var(--ink-soft);
  font-size: var(--fs-0);
  text-underline-offset: 0.3em;
}

.recap {
  display: grid;
  gap: 0.1rem;
}

@media (max-width: 30rem) {
  .panel {
    padding: var(--s2);
  }

  .split {
    grid-template-columns: minmax(0, 1fr);
  }

  .steps {
    gap: var(--s2);
  }

  .summary-lines li {
    align-items: flex-start;
  }
}
</style>
