<script setup>
// 登入頁維持單純表單流程，讓錯誤與返回路徑都清楚可預期。
import { computed, nextTick, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/api/account'
import { useSession } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const { login } = useSession()

const form = reactive({
  email: '',
  password: '',
  remember: false,
})

const errors = reactive({
  email: '',
  password: '',
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

const registerLink = computed(() => ({
  name: 'register',
  query: typeof route.query.redirect === 'string'
    ? { redirect: route.query.redirect }
    : {},
}))

const submit = async () => {
  errors.email = ''
  errors.password = ''
  formError.value = ''

  if (!form.email) {
    errors.email = '請填電子郵件'
  }

  if (!form.password) {
    errors.password = '請填密碼'
  }

  if (errors.email || errors.password) {
    await nextTick()
    const id = errors.email ? 'login-email' : 'login-password'
    document.getElementById(id)?.focus()
    return
  }

  busy.value = true

  try {
    await login({
      email: form.email,
      password: form.password,
      remember: form.remember,
    })
    await router.push(target())
  } catch (error) {
    formError.value = error instanceof ApiError
      ? error.message
      : '登入沒有成功，請再試一次。'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <h1 class="title">登入</h1>

  <p class="demo-hint">課程專題的示範帳號：demo@example.com／demo1234</p>

  <form class="login panel" novalidate @submit.prevent="submit">
    <div class="field">
      <label for="login-email">電子郵件</label>
      <input
        id="login-email"
        v-model.trim="form.email"
        type="email"
        autocomplete="username"
        inputmode="email"
        :aria-invalid="errors.email ? 'true' : undefined"
        :aria-describedby="errors.email ? 'login-email-error' : undefined"
      />
      <p
        v-if="errors.email"
        id="login-email-error"
        class="field-error"
        role="alert"
      >
        {{ errors.email }}
      </p>
    </div>

    <div class="field">
      <label for="login-password">密碼</label>
      <input
        id="login-password"
        v-model="form.password"
        type="password"
        autocomplete="current-password"
        :aria-invalid="errors.password ? 'true' : undefined"
        :aria-describedby="errors.password ? 'login-password-error' : undefined"
      />
      <p
        v-if="errors.password"
        id="login-password-error"
        class="field-error"
        role="alert"
      >
        {{ errors.password }}
      </p>
    </div>

    <div>
      <div class="check">
        <input
          id="login-remember"
          v-model="form.remember"
          type="checkbox"
        />
        <label for="login-remember">記住登入</label>
      </div>
      <p class="hint">公用電腦請不要勾。</p>
    </div>

    <p v-if="formError" class="form-error" role="alert">
      {{ formError }}
    </p>

    <div class="actions">
      <button type="submit" class="btn primary" :disabled="busy">
        登入
      </button>
    </div>
  </form>

  <p class="switch">
    還沒有帳號？<RouterLink :to="registerLink">註冊</RouterLink>
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

.demo-hint {
  margin-bottom: var(--s3);
  padding: var(--s2) var(--s3);
  border: 1px dashed var(--field-line);
  background: var(--surface);
  color: var(--ink-soft);
  font-size: var(--fs-0);
  overflow-wrap: anywhere;
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
