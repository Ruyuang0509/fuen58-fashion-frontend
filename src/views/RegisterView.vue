<script setup>
// 註冊頁即時提示密碼強度，正式驗證仍集中在送出流程。
import { computed, nextTick, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ApiError,
  PASSWORD_RULE,
  isEmail,
  isStrongPassword,
} from '@/api/account'
import { useSession } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const { register } = useSession()

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirm: '',
})

const errors = reactive({
  name: '',
  email: '',
  password: '',
  confirm: '',
})

const formError = ref('')
const busy = ref(false)

// 只接受站內路徑，避免被帶去別的網站
const target = () => {
  const value = route.query.redirect
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/account'
}

const loginLink = computed(() => ({
  name: 'login',
  query: typeof route.query.redirect === 'string'
    ? { redirect: route.query.redirect }
    : {},
}))

// 強度只是提示，真正的門檻是 PASSWORD_RULE
const strength = computed(() => {
  const value = form.password

  if (!value) {
    return ''
  }

  if (!isStrongPassword(value)) {
    return '弱'
  }

  const kinds = [
    /[a-z]/,
    /[A-Z]/,
    /\d/,
    /[^a-zA-Z\d]/,
  ].filter((pattern) => pattern.test(value)).length

  return value.length >= 12 && kinds >= 3 ? '強' : '可以'
})

const fieldIds = {
  name: 'register-name',
  email: 'register-email',
  password: 'register-password',
  confirm: 'register-confirm',
}

const firstErrorField = () => {
  return ['name', 'email', 'password', 'confirm'].find((field) => errors[field])
}

const focusField = async (field) => {
  if (!field || !fieldIds[field]) {
    return
  }

  await nextTick()
  document.getElementById(fieldIds[field])?.focus()
}

const submit = async () => {
  errors.name = ''
  errors.email = ''
  errors.password = ''
  errors.confirm = ''
  formError.value = ''

  if (!form.name.trim()) {
    errors.name = '請填姓名'
  }

  if (!form.email) {
    errors.email = '請填電子郵件'
  } else if (!isEmail(form.email)) {
    errors.email = '電子郵件格式不對'
  }

  if (!isStrongPassword(form.password)) {
    errors.password = PASSWORD_RULE
  }

  if (!form.confirm) {
    errors.confirm = '請再輸入一次密碼'
  } else if (form.confirm !== form.password) {
    errors.confirm = '兩次輸入的密碼不一樣'
  }

  const invalidField = firstErrorField()

  if (invalidField) {
    await focusField(invalidField)
    return
  }

  busy.value = true

  try {
    await register({
      email: form.email,
      password: form.password,
      name: form.name,
    })
    await router.push(target())
  } catch (error) {
    if (error instanceof ApiError && error.field && error.field in errors) {
      errors[error.field] = error.message
      await focusField(error.field)
    } else {
      formError.value = error instanceof ApiError
        ? error.message
        : '註冊沒有成功，請再試一次。'
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <h1 class="title">註冊</h1>

  <form class="register panel" novalidate @submit.prevent="submit">
    <div class="field">
      <label for="register-name">姓名</label>
      <input
        id="register-name"
        v-model.trim="form.name"
        type="text"
        autocomplete="name"
        :aria-invalid="errors.name ? 'true' : undefined"
        :aria-describedby="errors.name ? 'register-name-error' : undefined"
      />
      <p
        v-if="errors.name"
        id="register-name-error"
        class="field-error"
        role="alert"
      >
        {{ errors.name }}
      </p>
    </div>

    <div class="field">
      <label for="register-email">電子郵件</label>
      <input
        id="register-email"
        v-model.trim="form.email"
        type="email"
        autocomplete="username"
        inputmode="email"
        :aria-invalid="errors.email ? 'true' : undefined"
        :aria-describedby="errors.email ? 'register-email-error' : undefined"
      />
      <p
        v-if="errors.email"
        id="register-email-error"
        class="field-error"
        role="alert"
      >
        {{ errors.email }}
      </p>
    </div>

    <div class="field">
      <label for="register-password">密碼</label>
      <input
        id="register-password"
        v-model="form.password"
        type="password"
        autocomplete="new-password"
        :aria-invalid="errors.password ? 'true' : undefined"
        :aria-describedby="errors.password ? 'register-password-hint register-password-error' : 'register-password-hint'"
      />
      <p id="register-password-hint" class="hint">
        {{ PASSWORD_RULE }}
      </p>
      <p
        v-if="strength"
        class="strength"
        :class="`is-${strength === '弱' ? 'weak' : strength === '強' ? 'strong' : 'ok'}`"
      >
        密碼強度：{{ strength }}
      </p>
      <p
        v-if="errors.password"
        id="register-password-error"
        class="field-error"
        role="alert"
      >
        {{ errors.password }}
      </p>
    </div>

    <div class="field">
      <label for="register-confirm">再輸入一次密碼</label>
      <input
        id="register-confirm"
        v-model="form.confirm"
        type="password"
        autocomplete="new-password"
        :aria-invalid="errors.confirm ? 'true' : undefined"
        :aria-describedby="errors.confirm ? 'register-confirm-error' : undefined"
      />
      <p
        v-if="errors.confirm"
        id="register-confirm-error"
        class="field-error"
        role="alert"
      >
        {{ errors.confirm }}
      </p>
    </div>

    <p v-if="formError" class="form-error" role="alert">
      {{ formError }}
    </p>

    <div class="actions">
      <button type="submit" class="btn primary" :disabled="busy">
        建立帳號
      </button>
    </div>
  </form>

  <p class="switch">
    已經有帳號了？<RouterLink :to="loginLink">登入</RouterLink>
  </p>
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

.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.strength {
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.strength.is-weak {
  color: #9b2c2c;
}

.strength.is-strong {
  color: var(--ink);
  font-weight: 700;
}

.switch {
  margin-top: var(--s3);
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.switch a {
  color: var(--ink);
  text-underline-offset: 0.3em;
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
