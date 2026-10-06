<script setup>
// 地址簿採用單一表單與行內確認，讓新增、編輯和移除流程保持明確。
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AccountNav from '@/components/AccountNav.vue'
import {
  ApiError,
  addAddress,
  listAddresses,
  removeAddress,
  setDefaultAddress,
  updateAddress,
} from '@/api/account'
import { useSession } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const { token, logout } = useSession()

const addresses = ref([])
const status = ref('loading')
const editing = ref(null)
const form = reactive({
  recipient: '',
  phone: '',
  postalCode: '',
  city: '',
  district: '',
  street: '',
  isDefault: false,
})
const errors = reactive({
  recipient: '',
  phone: '',
  postalCode: '',
  city: '',
  district: '',
  street: '',
})
const formError = ref('')
const busy = ref(false)
const confirmingId = ref(null)
const notice = ref('')
const addButton = ref(null)

const FIELD_IDS = {
  recipient: 'address-recipient',
  phone: 'address-phone',
  postalCode: 'address-postal',
  city: 'address-city',
  district: 'address-district',
  street: 'address-street',
}

let noticeTimer = null

const handleUnauthorized = async (error) => {
  if (error?.code !== 'UNAUTHORIZED') return false

  await logout()
  await router.replace({
    name: 'login',
    query: { redirect: route.fullPath },
  })
  return true
}

const clearErrors = () => {
  Object.keys(errors).forEach((field) => {
    errors[field] = ''
  })
  formError.value = ''
}

const resetForm = () => {
  form.recipient = ''
  form.phone = ''
  form.postalCode = ''
  form.city = ''
  form.district = ''
  form.street = ''
  form.isDefault = addresses.value.length === 0
}

const say = (text) => {
  notice.value = text

  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.value = ''
    noticeTimer = null
  }, 3000)
}

const load = async () => {
  status.value = 'loading'

  try {
    addresses.value = await listAddresses(token.value)
    status.value = 'ready'
  } catch (error) {
    if (await handleUnauthorized(error)) return
    status.value = 'error'
  }
}

const openNew = async () => {
  resetForm()
  clearErrors()
  confirmingId.value = null
  editing.value = 'new'
  await nextTick()
  document.getElementById(FIELD_IDS.recipient)?.focus()
}

const openEdit = async (address) => {
  form.recipient = address.recipient
  form.phone = address.phone
  form.postalCode = address.postalCode
  form.city = address.city
  form.district = address.district
  form.street = address.street
  form.isDefault = address.isDefault
  clearErrors()
  confirmingId.value = null
  editing.value = address.id
  await nextTick()
  document.getElementById(FIELD_IDS.recipient)?.focus()
}

const closeForm = async () => {
  editing.value = null
  clearErrors()
  await nextTick()
  addButton.value?.focus()
}

const validate = () => {
  if (!form.recipient) {
    errors.recipient = '請填收件人'
  }

  if (!form.phone) {
    errors.phone = '請填手機號碼'
  } else if (!/^09\d{8}$/.test(form.phone.replace(/[\s-]/g, ''))) {
    errors.phone = '手機號碼要是 09 開頭的 10 位數字'
  }

  if (!/^\d{3}(\d{2,3})?$/.test(form.postalCode)) {
    errors.postalCode = '郵遞區號是 3、5 或 6 位數字'
  }

  if (!form.city) {
    errors.city = '請填縣市'
  }

  if (!form.district) {
    errors.district = '請填鄉鎮市區'
  }

  if (!form.street) {
    errors.street = '請填街道地址'
  }

  return Object.keys(FIELD_IDS).find((field) => errors[field]) ?? null
}

const save = async () => {
  clearErrors()
  const firstInvalid = validate()

  if (firstInvalid) {
    await nextTick()
    document.getElementById(FIELD_IDS[firstInvalid])?.focus()
    return
  }

  busy.value = true

  try {
    const data = { ...form }
    const wasNew = editing.value === 'new'

    if (wasNew) {
      await addAddress(token.value, data)
    } else {
      await updateAddress(token.value, editing.value, data)
    }

    addresses.value = await listAddresses(token.value)
    editing.value = null
    say(wasNew ? '已新增地址' : '已更新地址')
  } catch (error) {
    if (await handleUnauthorized(error)) return

    if (error instanceof ApiError && error.field && error.field in errors) {
      errors[error.field] = error.message
      await nextTick()
      document.getElementById(FIELD_IDS[error.field])?.focus()
    } else {
      formError.value = error instanceof ApiError
        ? error.message
        : '儲存沒有成功，請再試一次。'
    }
  } finally {
    busy.value = false
  }
}

const makeDefault = async (address) => {
  busy.value = true

  try {
    addresses.value = await setDefaultAddress(token.value, address.id)
    say('已設為預設地址')
  } catch (error) {
    if (await handleUnauthorized(error)) return
    say(error instanceof ApiError ? error.message : '設定沒有成功，請再試一次。')
  } finally {
    busy.value = false
  }
}

const askRemove = async (address) => {
  confirmingId.value = address.id
  await nextTick()
  document.getElementById(`keep-address-${address.id}`)?.focus()
}

const remove = async (address) => {
  busy.value = true

  try {
    addresses.value = await removeAddress(token.value, address.id)
    confirmingId.value = null

    if (editing.value === address.id) {
      await closeForm()
    }

    say('已移除地址')
  } catch (error) {
    if (await handleUnauthorized(error)) return
    say(error instanceof ApiError ? error.message : '移除沒有成功，請再試一次。')
  } finally {
    busy.value = false
  }
}

const defaultLocked = () => {
  if (editing.value === 'new') return addresses.value.length === 0

  return addresses.value.some((address) => (
    address.id === editing.value && address.isDefault
  ))
}

onMounted(load)

onBeforeUnmount(() => {
  if (noticeTimer) clearTimeout(noticeTimer)
})
</script>

<template>
  <AccountNav />
  <h1 class="title">地址簿</h1>
  <p class="saved" role="status">{{ notice }}</p>

  <p v-if="status === 'loading'" class="state">載入中…</p>

  <p v-else-if="status === 'error'" class="state">
    地址沒有載入成功。
    <button type="button" class="link" @click="load">再試一次</button>
  </p>

  <template v-else>
    <div v-if="addresses.length" class="addresses">
      <article
        v-for="address in addresses"
        :key="address.id"
        class="address"
        :class="{ default: address.isDefault }"
      >
        <h2 class="who">
          {{ address.recipient }}
          <span v-if="address.isDefault" class="badge">預設</span>
        </h2>
        <p class="phone">{{ address.phone }}</p>
        <p class="where">
          {{ address.postalCode }} {{ address.city }}{{ address.district }}{{ address.street }}
        </p>

        <div class="row-actions">
          <template v-if="confirmingId === address.id">
            <p class="confirm">確定要移除這個地址嗎？</p>
            <button
              type="button"
              class="btn confirm-remove"
              :disabled="busy"
              @click="remove(address)"
            >
              確定移除
            </button>
            <button
              :id="`keep-address-${address.id}`"
              type="button"
              class="link keep-address"
              @click="confirmingId = null"
            >
              先不要
            </button>
          </template>

          <template v-else>
            <button
              v-if="!address.isDefault"
              type="button"
              class="link set-default"
              :disabled="busy"
              @click="makeDefault(address)"
            >
              設為預設<span class="visually-hidden">：{{ address.recipient }}，{{ address.street }}</span>
            </button>
            <button
              type="button"
              class="link edit-address"
              @click="openEdit(address)"
            >
              編輯<span class="visually-hidden">：{{ address.recipient }}，{{ address.street }}</span>
            </button>
            <button
              type="button"
              class="link remove-address"
              @click="askRemove(address)"
            >
              移除<span class="visually-hidden">：{{ address.recipient }}，{{ address.street }}</span>
            </button>
          </template>
        </div>
      </article>
    </div>

    <div v-else class="empty">
      <p>還沒有收件地址。</p>
    </div>

    <button
      v-if="editing === null"
      ref="addButton"
      type="button"
      class="btn add-address"
      @click="openNew"
    >
      新增地址
    </button>

    <form
      v-if="editing !== null"
      class="address panel"
      novalidate
      @submit.prevent="save"
    >
      <h2 class="form-title">{{ editing === 'new' ? '新增地址' : '編輯地址' }}</h2>

      <div class="field">
        <label for="address-recipient">收件人</label>
        <input
          id="address-recipient"
          v-model.trim="form.recipient"
          type="text"
          autocomplete="name"
          :aria-invalid="errors.recipient ? 'true' : undefined"
          :aria-describedby="errors.recipient ? 'address-recipient-error' : undefined"
        />
        <p
          v-if="errors.recipient"
          id="address-recipient-error"
          class="field-error"
          role="alert"
        >
          {{ errors.recipient }}
        </p>
      </div>

      <div class="field">
        <label for="address-phone">手機</label>
        <input
          id="address-phone"
          v-model.trim="form.phone"
          type="tel"
          autocomplete="tel"
          inputmode="tel"
          :aria-invalid="errors.phone ? 'true' : undefined"
          :aria-describedby="errors.phone ? 'address-phone-error' : undefined"
        />
        <p
          v-if="errors.phone"
          id="address-phone-error"
          class="field-error"
          role="alert"
        >
          {{ errors.phone }}
        </p>
      </div>

      <div class="split">
        <div class="field">
          <label for="address-postal">郵遞區號</label>
          <input
            id="address-postal"
            v-model.trim="form.postalCode"
            type="text"
            autocomplete="postal-code"
            inputmode="numeric"
            :aria-invalid="errors.postalCode ? 'true' : undefined"
            :aria-describedby="errors.postalCode ? 'address-postal-error' : undefined"
          />
          <p
            v-if="errors.postalCode"
            id="address-postal-error"
            class="field-error"
            role="alert"
          >
            {{ errors.postalCode }}
          </p>
        </div>

        <div class="field">
          <label for="address-city">縣市</label>
          <input
            id="address-city"
            v-model.trim="form.city"
            type="text"
            autocomplete="address-level1"
            :aria-invalid="errors.city ? 'true' : undefined"
            :aria-describedby="errors.city ? 'address-city-error' : undefined"
          />
          <p
            v-if="errors.city"
            id="address-city-error"
            class="field-error"
            role="alert"
          >
            {{ errors.city }}
          </p>
        </div>

        <div class="field">
          <label for="address-district">鄉鎮市區</label>
          <input
            id="address-district"
            v-model.trim="form.district"
            type="text"
            autocomplete="address-level2"
            :aria-invalid="errors.district ? 'true' : undefined"
            :aria-describedby="errors.district ? 'address-district-error' : undefined"
          />
          <p
            v-if="errors.district"
            id="address-district-error"
            class="field-error"
            role="alert"
          >
            {{ errors.district }}
          </p>
        </div>
      </div>

      <div class="field">
        <label for="address-street">街道地址</label>
        <input
          id="address-street"
          v-model.trim="form.street"
          type="text"
          autocomplete="street-address"
          :aria-invalid="errors.street ? 'true' : undefined"
          :aria-describedby="errors.street ? 'address-street-error' : undefined"
        />
        <p
          v-if="errors.street"
          id="address-street-error"
          class="field-error"
          role="alert"
        >
          {{ errors.street }}
        </p>
      </div>

      <div>
        <div class="check">
          <input
            id="address-default"
            v-model="form.isDefault"
            type="checkbox"
            :disabled="defaultLocked()"
          />
          <label for="address-default">設為預設地址</label>
        </div>
        <p v-if="defaultLocked()" class="hint">
          {{ editing === 'new'
            ? '第一個地址會是預設地址。'
            : '預設地址要換成別的地址時，到那個地址按「設為預設」。' }}
        </p>
      </div>

      <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
      <p class="saved" role="status"></p>

      <div class="actions">
        <button type="submit" class="btn primary" :disabled="busy">儲存地址</button>
        <button type="button" class="link cancel-edit" @click="closeForm">取消</button>
      </div>
    </form>
  </template>
</template>

<style scoped>
.title {
  margin-block: var(--s3) var(--s3);
  font-size: var(--fs-3);
}

.panel {
  display: grid;
  gap: var(--s3);
  padding: var(--s3);
  background: var(--surface);
  border: 1px solid var(--line);
}

.field {
  display: grid;
  gap: var(--s1);
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

.saved {
  min-height: 1.6em;
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2) var(--s3);
}

fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.addresses {
  display: grid;
  gap: var(--s2);
  margin-bottom: var(--s3);
}

article.address {
  display: grid;
  gap: var(--s1);
  padding: var(--s2) var(--s3);
  background: var(--surface);
  border: 1px solid var(--line);
}

article.address.default {
  border-color: var(--field-line);
}

.who {
  font-size: var(--fs-1);
}

.badge {
  margin-left: var(--s2);
  padding: 0 var(--s1);
  border: 1px solid var(--field-line);
  font-size: var(--fs-0);
  font-weight: 400;
  color: var(--ink-soft);
  vertical-align: middle;
}

.phone,
.where {
  color: var(--ink-soft);
  font-size: var(--fs-0);
  overflow-wrap: anywhere;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s1) var(--s3);
  margin-top: var(--s1);
}

.confirm {
  width: 100%;
  color: var(--ink);
  font-size: var(--fs-0);
}

.split {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--s2);
}

form.address {
  margin-top: var(--s3);
}

.form-title {
  font-size: var(--fs-2);
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

.link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.primary {
  padding: var(--s2) var(--s4);
  font-weight: 700;
}

.primary:disabled,
.confirm-remove:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hint {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.state,
.empty {
  display: grid;
  justify-items: start;
  gap: var(--s2);
  padding: var(--s3) 0;
  color: var(--ink-soft);
}

@media (max-width: 30rem) {
  .panel {
    padding: var(--s2);
  }

  .split {
    grid-template-columns: minmax(0, 1fr);
  }

  article.address {
    padding-inline: var(--s2);
  }
}
</style>
