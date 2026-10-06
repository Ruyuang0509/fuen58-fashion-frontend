<script setup>
// 句子裡的一格（第十五輪子輪 3）：取代原生 <select>，因為要能多選——「上班或約會」「S 或 M」。
// 看起來還是一句話裡粗體加底線的那幾個字；點開是一張勾選清單（role=listbox），鍵盤：方向鍵移、空白鍵或 Enter 勾、Esc 關、Tab 離開也關；
// 手機（≤ 36rem）變成底部面板。多選時清單不自動關（讓人一次勾好幾個），有「好了」；單選選完就關。
// 片語：沒選 → 那格的「不限」說法；一個 → 它的 label；兩個以上 → 用 short 連成「A、B 或 C」（英數字之間加空白）。
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Icon from '@/components/Icon.vue'

const props = defineProps({
  options: { type: Array, required: true }, // [{ value, label, short?, swatch? }]，value 空字串是「不限」
  modelValue: { type: [String, Array], default: '' },
  multi: { type: Boolean, default: false },
  label: { type: String, required: true }, // 這一格叫什麼（給讀屏：「場合」「尺寸」）
})
const emit = defineEmits(['update:modelValue', 'open'])

let counter = 0
const id = `clause-${(counter += 1)}-${Math.random().toString(36).slice(2, 7)}`
const open = ref(false)
const active = ref(0)
const root = ref(null)
const button = ref(null)
const list = ref(null)

const selected = computed(() => {
  if (props.multi) return Array.isArray(props.modelValue) ? props.modelValue : props.modelValue ? [String(props.modelValue)] : []
  return props.modelValue ? [String(props.modelValue)] : []
})
const chosen = computed(() => props.options.filter((option) => option.value && selected.value.includes(option.value)))
const isOn = (option) => (option.value === '' ? chosen.value.length === 0 : selected.value.includes(option.value))

const text = computed(() => {
  if (!chosen.value.length) return props.options.find((option) => option.value === '')?.label ?? ''
  if (chosen.value.length === 1) return chosen.value[0].label
  const tokens = chosen.value.map((option) => option.short || option.label)
  const joiner = tokens.some((token) => /^[A-Za-z0-9]+$/.test(token)) ? ' 或 ' : '或'
  return `${tokens.slice(0, -1).join('、')}${joiner}${tokens.at(-1)}`
})

function show() {
  emit('open')
  open.value = true
  const first = props.options.findIndex(isOn)
  active.value = first < 0 ? 0 : first
  nextTick(() => list.value?.focus())
}

function hide(focusButton = true) {
  if (!open.value) return
  open.value = false
  if (focusButton) button.value?.focus()
}

function choose(option) {
  if (!props.multi) {
    emit('update:modelValue', option.value)
    hide()
    return
  }
  if (option.value === '') {
    emit('update:modelValue', [])
    return
  }
  const next = selected.value.includes(option.value) ? selected.value.filter((value) => value !== option.value) : [...selected.value, option.value]
  emit('update:modelValue', next)
}

function onListKey(event) {
  const total = props.options.length
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    active.value = (active.value + 1) % total
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    active.value = (active.value - 1 + total) % total
  } else if (event.key === 'Home') {
    event.preventDefault()
    active.value = 0
  } else if (event.key === 'End') {
    event.preventDefault()
    active.value = total - 1
  } else if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault()
    choose(props.options[active.value])
  } else if (event.key === 'Escape') {
    event.preventDefault()
    hide()
  } else if (event.key === 'Tab') {
    hide(false)
  }
}

function onButtonKey(event) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!open.value) show()
  }
}

// 點到格子外面就關；用 capture 階段聽，點到別格的按鈕時這格先關
function onDocumentPointer(event) {
  if (open.value && root.value && !root.value.contains(event.target)) hide(false)
}
watch(open, (value) => {
  if (value) document.addEventListener('pointerdown', onDocumentPointer, true)
  else document.removeEventListener('pointerdown', onDocumentPointer, true)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointer, true))
</script>

<template>
  <span ref="root" class="picker" :class="{ open }">
    <button
      ref="button"
      type="button"
      class="pick"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="`${id}-list`"
      @click="open ? hide() : show()"
      @keydown="onButtonKey"
    >
      <span class="visually-hidden">{{ label }}：</span>{{ text }}<Icon name="down" class="chev" />
    </button>

    <div v-if="open" class="pop">
      <div class="backdrop" aria-hidden="true" @click="hide(false)"></div>
      <ul
        :id="`${id}-list`"
        ref="list"
        class="list"
        role="listbox"
        :aria-label="label"
        :aria-multiselectable="multi ? 'true' : undefined"
        :aria-activedescendant="`${id}-${active}`"
        tabindex="-1"
        @keydown="onListKey"
      >
        <li
          v-for="(option, i) in options"
          :id="`${id}-${i}`"
          :key="option.value"
          role="option"
          class="option"
          :class="{ active: i === active, on: isOn(option) }"
          :aria-selected="isOn(option)"
          @pointermove="active = i"
          @click="choose(option)"
        >
          <span class="mark" aria-hidden="true"><Icon v-if="isOn(option)" name="check" /></span>
          <i v-if="option.swatch" class="swatch" :style="{ background: option.swatch }" aria-hidden="true"></i>
          <span>{{ option.label }}</span>
        </li>
      </ul>
      <button v-if="multi" type="button" class="done" @click="hide()">好了</button>
    </div>
  </span>
</template>

<style scoped>
.picker {
  position: relative;
  display: inline-block;
}

/* 句子裡的那幾個字：粗體、底下一條強調色的線、小小的箭頭 */
.pick {
  all: unset;
  cursor: pointer;
  display: inline-flex;
  align-items: baseline;
  gap: 0.15em;
  padding: 0 var(--s1);
  border-bottom: 2px solid var(--accent);
  font: inherit;
  font-weight: 700;
  color: inherit;
  white-space: nowrap;
}

.pick:hover,
.pick:focus-visible,
.open .pick {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.pick:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.chev {
  font-size: 0.6em;
  transform: translateY(-0.1em);
  transition: transform 0.25s ease;
}

.open .chev {
  transform: translateY(-0.1em) rotate(180deg);
}

.pop {
  position: absolute;
  top: calc(100% + 0.35rem);
  left: 0;
  z-index: 30;
  display: grid;
  gap: 0.3rem;
  min-width: 12rem;
}

.backdrop {
  display: none;
}

.list {
  margin: 0;
  padding: 0.4rem;
  list-style: none;
  max-height: 60vh;
  overflow: auto;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  box-shadow: 0 14px 36px rgba(31, 29, 26, 0.14);
  font-size: var(--fs-1);
  font-weight: 400;
  line-height: 1.6;
  color: var(--ink);
}

.list:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.7rem 0.35rem 0.5rem;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  cursor: pointer;
}

/* 鍵盤走到的那一項：淡淡的底；已勾的：粗體加勾 */
.option.active {
  background: color-mix(in srgb, var(--accent) 12%, white);
}

.option.on {
  font-weight: 700;
}

.mark {
  display: inline-grid;
  place-items: center;
  width: 1.1em;
  color: var(--accent);
}

.swatch {
  width: 0.9em;
  height: 0.9em;
  border-radius: 50%;
  border: 1px solid rgba(31, 29, 26, 0.25);
}

.done {
  justify-self: end;
  padding: 0.3rem 0.9rem;
  border: 1px solid var(--field-line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: var(--fs-0);
  font-weight: 400;
  letter-spacing: 0.1em;
  cursor: pointer;
}

.done:hover,
.done:focus-visible {
  border-color: var(--ink);
}

@media (prefers-reduced-motion: reduce) {
  .chev {
    transition: none;
  }
}

/* 手機：底部面板，後面壓一層暗 */
@media (max-width: 36rem) {
  .pop {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 40;
    gap: 0;
  }

  .backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(31, 29, 26, 0.35);
  }

  .list {
    position: relative;
    max-height: 60vh;
    padding: var(--s2) var(--s3) var(--s3);
    border: 0;
    border-radius: var(--radius) var(--radius) 0 0;
    box-shadow: 0 -12px 36px rgba(31, 29, 26, 0.18);
  }

  .option {
    padding: 0.6rem 0.5rem;
    white-space: normal;
  }

  .done {
    position: relative;
    justify-self: stretch;
    padding: var(--s2);
    border: 0;
    border-top: 1px solid var(--line);
    border-radius: 0;
  }
}
</style>
