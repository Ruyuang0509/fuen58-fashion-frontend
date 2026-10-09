<script setup>
// 身形的表單（第十六輪子輪 2）：會員中心「身形」、註冊後的「也填身形」、商品頁的「輸入身高體重看建議」三處共用。
// compact 只有身高體重（商品頁）；完整版多三圍（選填）。交易區守慣例：看得見的欄位標籤、錯誤訊息貼在欄位旁、一個主按鈕。
// 存的事交給 stores/body.js（登入的進帳號、訪客存本機）；後端的 ApiError 帶 field 就貼回那個欄位。
import { nextTick, reactive, ref, watch } from 'vue'
import { ApiError } from '@/api/account'
import { useBody } from '@/stores/body'

const props = defineProps({
  compact: { type: Boolean, default: false },
  // inline：放在別的表單裡面（商品頁的購買區塊）時用——不能再包一層 <form>（巢狀表單；第一次跑 shop-check 時
  // 「加入購物車」的 button[type=submit] 被這裡的按鈕搶走），改成 div 加 type=button，Enter 鍵自己接
  inline: { type: Boolean, default: false },
  submitLabel: { type: String, default: '儲存' },
})
const emit = defineEmits(['saved', 'cleared'])

const { body, save, clear } = useBody()

const FIELDS = [
  { key: 'height', label: '身高', unit: 'cm', min: 100, max: 230, required: true },
  { key: 'weight', label: '體重', unit: 'kg', min: 25, max: 200, required: true },
  { key: 'chest', label: '胸圍', unit: 'cm', min: 50, max: 160 },
  { key: 'waist', label: '腰圍', unit: 'cm', min: 40, max: 160 },
  { key: 'hips', label: '臀圍', unit: 'cm', min: 50, max: 170 },
]
const fields = props.compact ? FIELDS.slice(0, 2) : FIELDS

let counter = 0
const id = `body-${(counter += 1)}`
const form = reactive(Object.fromEntries(FIELDS.map((field) => [field.key, body.value?.[field.key] ?? ''])))
const errors = reactive(Object.fromEntries(FIELDS.map((field) => [field.key, ''])))
const formError = ref('')
const busy = ref(false)
const saved = ref('')
let savedTimer = 0

// 外面存好（例如登入後併進帳號）表單跟著更新；使用者正在打字時不蓋
watch(body, (value) => {
  if (busy.value) return
  for (const field of FIELDS) form[field.key] = value?.[field.key] ?? ''
})

async function focusField(key) {
  await nextTick()
  document.getElementById(`${id}-${key}`)?.focus()
}

async function submit() {
  for (const field of FIELDS) errors[field.key] = ''
  formError.value = ''
  saved.value = ''
  let firstBad = ''
  for (const field of fields) {
    const raw = String(form[field.key]).trim()
    const value = Number(raw)
    if (!raw) {
      if (field.required) errors[field.key] = `請填${field.label}`
    } else if (!Number.isFinite(value) || value < field.min || value > field.max) {
      errors[field.key] = `${field.label}要在 ${field.min}–${field.max} 之間`
    }
    if (errors[field.key] && !firstBad) firstBad = field.key
  }
  if (firstBad) {
    focusField(firstBad)
    return
  }
  busy.value = true
  try {
    const result = await save(Object.fromEntries(fields.map((field) => [field.key, String(form[field.key]).trim() === '' ? null : Number(form[field.key])])))
    saved.value = '已儲存。'
    clearTimeout(savedTimer)
    savedTimer = setTimeout(() => (saved.value = ''), 3000)
    emit('saved', result)
  } catch (error) {
    if (error instanceof ApiError && error.field && error.field in errors) {
      errors[error.field] = error.message
      focusField(error.field)
    } else {
      formError.value = error instanceof ApiError ? error.message : '沒有存成功，請再試一次。'
    }
  } finally {
    busy.value = false
  }
}

async function wipe() {
  busy.value = true
  try {
    await clear()
    for (const field of FIELDS) form[field.key] = ''
    emit('cleared')
  } catch {
    formError.value = '沒有清成功，請再試一次。'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <component :is="inline ? 'div' : 'form'" class="body-form" :class="{ compact }" :novalidate="!inline || undefined" @submit.prevent="submit">
    <div class="fields">
      <div v-for="field in fields" :key="field.key" class="field">
        <label :for="`${id}-${field.key}`">{{ field.label }}<span v-if="!field.required" class="optional">（選填）</span></label>
        <span class="with-unit">
          <input
            :id="`${id}-${field.key}`"
            v-model="form[field.key]"
            type="number"
            inputmode="decimal"
            :min="field.min"
            :max="field.max"
            step="1"
            :aria-invalid="errors[field.key] ? 'true' : undefined"
            :aria-describedby="errors[field.key] ? `${id}-${field.key}-error` : undefined"
            @keydown.enter.prevent="submit"
          />
          <span class="unit">{{ field.unit }}</span>
        </span>
        <p v-if="errors[field.key]" :id="`${id}-${field.key}-error`" class="field-error" role="alert">{{ errors[field.key] }}</p>
      </div>
    </div>
    <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
    <div class="actions">
      <button :type="inline ? 'button' : 'submit'" class="btn primary" :disabled="busy" @click="inline && submit()">{{ submitLabel }}</button>
      <button v-if="!compact && body" type="button" class="link" :disabled="busy" @click="wipe">清掉身形</button>
      <span class="status" role="status">{{ saved }}</span>
    </div>
  </component>
</template>

<style scoped>
.body-form {
  display: grid;
  gap: var(--s2);
}

.fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
  gap: var(--s2) var(--s3);
}

.field {
  display: grid;
  gap: var(--s1);
}

.field label {
  color: var(--ink-soft);
  font-size: var(--fs-0);
  letter-spacing: 0.08em;
}

.optional {
  letter-spacing: 0;
}

.with-unit {
  display: flex;
  align-items: center;
  gap: var(--s1);
}

.field input {
  width: 100%;
  min-width: 0;
  padding: var(--s1) var(--s2);
  border: 1px solid var(--field-line);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-variant-numeric: tabular-nums;
}

.field input[aria-invalid='true'] {
  border-color: #9b2c2c;
}

.unit {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.field-error,
.form-error {
  margin: 0;
  color: #9b2c2c; /* 與卡片底 7.6:1（check-contrast 有量） */
  font-size: var(--fs-0);
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

.compact .primary {
  padding: var(--s1) var(--s3);
  font-weight: 400;
}

.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.status {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}
</style>
