<script setup>
// 會員資料直接沿用登入狀態，避免非同步載入覆蓋使用者正在編輯的內容。
import { nextTick, onBeforeUnmount, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AccountNav from '@/components/AccountNav.vue'
import {
  ApiError,
  PASSWORD_RULE,
  changePassword,
  isStrongPassword,
  updateProfile,
} from '@/api/account'
import { useSession } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const { user, token, setUser, logout } = useSession()

// 直接用登入時拿到的資料，不再等一次 API；也不會在使用者打字時被非同步結果蓋掉
const profile = reactive({
  name: user.value?.name ?? '',
  phone: user.value?.phone ?? '',
  birthday: user.value?.birthday ?? '',
  gender: user.value?.gender ?? 'unsaid',
})

const today = new Date().toLocaleDateString('en-CA')

const GENDERS = [
  { value: 'female', label: '女' },
  { value: 'male', label: '男' },
  { value: 'other', label: '其他' },
  { value: 'unsaid', label: '不填' },
]

const profileErrors = reactive({
  name: '',
  phone: '',
  birthday: '',
})

const profileError = ref('')
const profileSaved = ref('')
const profileBusy = ref(false)
let profileSavedTimer = null

const passwords = reactive({
  current: '',
  next: '',
  confirm: '',
})

const passwordErrors = reactive({
  current: '',
  next: '',
  confirm: '',
})

const passwordError = ref('')
const passwordSaved = ref('')
const passwordBusy = ref(false)
let passwordSavedTimer = null

const profileFieldIds = {
  name: 'profile-name',
  phone: 'profile-phone',
  birthday: 'profile-birthday',
}

const passwordFieldIds = {
  current: 'password-current',
  next: 'password-next',
  confirm: 'password-confirm',
}

const focusField = async (id) => {
  if (!id) {
    return
  }

  await nextTick()
  document.getElementById(id)?.focus()
}

const handleUnauthorized = async (error) => {
  if (error?.code !== 'UNAUTHORIZED') {
    return false
  }

  await logout()
  await router.replace({
    name: 'login',
    query: { redirect: route.fullPath },
  })
  return true
}

const showProfileSaved = () => {
  if (profileSavedTimer) {
    clearTimeout(profileSavedTimer)
  }

  profileSaved.value = '已儲存'
  profileSavedTimer = setTimeout(() => {
    profileSaved.value = ''
    profileSavedTimer = null
  }, 3000)
}

const showPasswordSaved = () => {
  if (passwordSavedTimer) {
    clearTimeout(passwordSavedTimer)
  }

  passwordSaved.value = '密碼已更改'
  passwordSavedTimer = setTimeout(() => {
    passwordSaved.value = ''
    passwordSavedTimer = null
  }, 3000)
}

const saveProfile = async () => {
  profileErrors.name = ''
  profileErrors.phone = ''
  profileErrors.birthday = ''
  profileError.value = ''
  profileSaved.value = ''

  if (!profile.name.trim()) {
    profileErrors.name = '請填姓名'
  }

  const normalisedPhone = profile.phone.replace(/[\s-]/g, '')

  if (profile.phone && !/^09\d{8}$/.test(normalisedPhone)) {
    profileErrors.phone = '手機號碼要是 09 開頭的 10 位數字'
  }

  if (profile.birthday && profile.birthday > today) {
    profileErrors.birthday = '生日的日期不對'
  }

  const invalidField = ['name', 'phone', 'birthday'].find(
    (field) => profileErrors[field],
  )

  if (invalidField) {
    await focusField(profileFieldIds[invalidField])
    return
  }

  profileBusy.value = true

  try {
    const updated = await updateProfile(token.value, { ...profile })
    setUser(updated)
    profile.phone = updated.phone
    showProfileSaved()
  } catch (error) {
    if (await handleUnauthorized(error)) {
      return
    }

    if (
      error instanceof ApiError
      && error.field
      && error.field in profileErrors
    ) {
      profileErrors[error.field] = error.message
      await focusField(profileFieldIds[error.field])
    } else {
      profileError.value = error instanceof ApiError
        ? error.message
        : '個人資料沒有儲存成功，請再試一次。'
    }
  } finally {
    profileBusy.value = false
  }
}

const savePassword = async () => {
  passwordErrors.current = ''
  passwordErrors.next = ''
  passwordErrors.confirm = ''
  passwordError.value = ''
  passwordSaved.value = ''

  if (!passwords.current) {
    passwordErrors.current = '請填目前的密碼'
  }

  if (!isStrongPassword(passwords.next)) {
    passwordErrors.next = PASSWORD_RULE
  }

  if (!passwords.confirm) {
    passwordErrors.confirm = '請再輸入一次新密碼'
  } else if (passwords.confirm !== passwords.next) {
    passwordErrors.confirm = '兩次輸入的密碼不一樣'
  }

  const invalidField = ['current', 'next', 'confirm'].find(
    (field) => passwordErrors[field],
  )

  if (invalidField) {
    await focusField(passwordFieldIds[invalidField])
    return
  }

  passwordBusy.value = true

  try {
    await changePassword(token.value, {
      current: passwords.current,
      next: passwords.next,
    })
    passwords.current = ''
    passwords.next = ''
    passwords.confirm = ''
    showPasswordSaved()
  } catch (error) {
    if (await handleUnauthorized(error)) {
      return
    }

    if (
      error instanceof ApiError
      && (error.field === 'current' || error.field === 'next')
    ) {
      passwordErrors[error.field] = error.message
      await focusField(passwordFieldIds[error.field])
    } else {
      passwordError.value = error instanceof ApiError
        ? error.message
        : '密碼沒有更改成功，請再試一次。'
    }
  } finally {
    passwordBusy.value = false
  }
}

onBeforeUnmount(() => {
  if (profileSavedTimer) {
    clearTimeout(profileSavedTimer)
  }

  if (passwordSavedTimer) {
    clearTimeout(passwordSavedTimer)
  }
})
</script>

<template>
  <AccountNav />

  <h1 class="title">個人資料</h1>

  <form class="profile panel" novalidate @submit.prevent="saveProfile">
    <p class="readonly">
      <span class="label">登入帳號</span>
      <span class="email">{{ user?.email }}</span>
    </p>

    <div class="field">
      <label for="profile-name">姓名</label>
      <input
        id="profile-name"
        v-model.trim="profile.name"
        type="text"
        autocomplete="name"
        :aria-invalid="profileErrors.name ? 'true' : undefined"
        :aria-describedby="profileErrors.name ? 'profile-name-error' : undefined"
      />
      <p
        v-if="profileErrors.name"
        id="profile-name-error"
        class="field-error"
        role="alert"
      >
        {{ profileErrors.name }}
      </p>
    </div>

    <div class="field">
      <label for="profile-phone">手機</label>
      <input
        id="profile-phone"
        v-model.trim="profile.phone"
        type="tel"
        autocomplete="tel"
        inputmode="tel"
        :aria-invalid="profileErrors.phone ? 'true' : undefined"
        :aria-describedby="profileErrors.phone ? 'profile-phone-hint profile-phone-error' : 'profile-phone-hint'"
      />
      <p id="profile-phone-hint" class="hint">選填；收件時聯絡用。</p>
      <p
        v-if="profileErrors.phone"
        id="profile-phone-error"
        class="field-error"
        role="alert"
      >
        {{ profileErrors.phone }}
      </p>
    </div>

    <div class="field">
      <label for="profile-birthday">生日</label>
      <input
        id="profile-birthday"
        v-model="profile.birthday"
        type="date"
        autocomplete="bday"
        :max="today"
        :aria-invalid="profileErrors.birthday ? 'true' : undefined"
        :aria-describedby="profileErrors.birthday ? 'profile-birthday-hint profile-birthday-error' : 'profile-birthday-hint'"
      />
      <p id="profile-birthday-hint" class="hint">選填。</p>
      <p
        v-if="profileErrors.birthday"
        id="profile-birthday-error"
        class="field-error"
        role="alert"
      >
        {{ profileErrors.birthday }}
      </p>
    </div>

    <div class="field">
      <label for="profile-gender">性別</label>
      <select id="profile-gender" v-model="profile.gender">
        <option
          v-for="gender in GENDERS"
          :key="gender.value"
          :value="gender.value"
        >
          {{ gender.label }}
        </option>
      </select>
    </div>

    <p v-if="profileError" class="form-error" role="alert">
      {{ profileError }}
    </p>

    <div class="actions">
      <button type="submit" class="btn primary" :disabled="profileBusy">
        儲存
      </button>
      <p class="saved" role="status">{{ profileSaved }}</p>
    </div>
  </form>

  <form class="password panel" novalidate @submit.prevent="savePassword">
    <h2 class="section-title">更改密碼</h2>

    <div class="field">
      <label for="password-current">目前的密碼</label>
      <input
        id="password-current"
        v-model="passwords.current"
        type="password"
        autocomplete="current-password"
        :aria-invalid="passwordErrors.current ? 'true' : undefined"
        :aria-describedby="passwordErrors.current ? 'password-current-error' : undefined"
      />
      <p
        v-if="passwordErrors.current"
        id="password-current-error"
        class="field-error"
        role="alert"
      >
        {{ passwordErrors.current }}
      </p>
    </div>

    <div class="field">
      <label for="password-next">新密碼</label>
      <input
        id="password-next"
        v-model="passwords.next"
        type="password"
        autocomplete="new-password"
        :aria-invalid="passwordErrors.next ? 'true' : undefined"
        :aria-describedby="passwordErrors.next ? 'password-next-hint password-next-error' : 'password-next-hint'"
      />
      <p id="password-next-hint" class="hint">{{ PASSWORD_RULE }}</p>
      <p
        v-if="passwordErrors.next"
        id="password-next-error"
        class="field-error"
        role="alert"
      >
        {{ passwordErrors.next }}
      </p>
    </div>

    <div class="field">
      <label for="password-confirm">再輸入一次新密碼</label>
      <input
        id="password-confirm"
        v-model="passwords.confirm"
        type="password"
        autocomplete="new-password"
        :aria-invalid="passwordErrors.confirm ? 'true' : undefined"
        :aria-describedby="passwordErrors.confirm ? 'password-confirm-error' : undefined"
      />
      <p
        v-if="passwordErrors.confirm"
        id="password-confirm-error"
        class="field-error"
        role="alert"
      >
        {{ passwordErrors.confirm }}
      </p>
    </div>

    <p v-if="passwordError" class="form-error" role="alert">
      {{ passwordError }}
    </p>

    <div class="actions">
      <button type="submit" class="btn" :disabled="passwordBusy">
        更改密碼
      </button>
      <p class="saved" role="status">{{ passwordSaved }}</p>
    </div>
  </form>
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
  border-radius: var(--radius);
}

.field {
  display: grid;
  gap: var(--s1);
}

.field label,
legend,
.label {
  color: var(--ink-soft);
  font-size: var(--fs-0);
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

.field select {
  appearance: auto;
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

.hint {
  color: var(--ink-soft);
  font-size: var(--fs-0);
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

.primary {
  padding: var(--s2) var(--s4);
  font-weight: 700;
}

.primary:disabled,
.actions .btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.readonly {
  display: grid;
  gap: var(--s1);
}

.email {
  overflow-wrap: anywhere;
}

.password {
  margin-top: var(--s3);
}

.section-title {
  font-size: var(--fs-2);
}

fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

@media (max-width: 30rem) {
  .panel {
    padding: var(--s2);
  }
}
</style>
