import { computed, ref } from 'vue'

// 畫面模式（第十八輪子輪 1；功能規劃 1.1「一般模式：畫面上固定有切換鍵，可改用普通首頁；記住使用者的選擇」）。
//   auto    跟系統：系統設定減少動態就減少
//   reduce  減少動態：全站過渡與動畫歸零、GSAP 不跑、天空只畫一張
//   plain   一般模式：再加上不用 WebGL（天空退回 CSS 漸層）
// 記在 localStorage 的 motion；在 <html> 掛 reduce-motion class（base.css 的全域規則）與 data-motion。
// 很多元件在掛載時就記住了「要不要動」，所以改了模式整頁重載——頁尾的選單旁有寫。整站一份。
const KEY = 'motion'
export const MOTION_MODES = [
  { value: 'auto', label: '自動（跟系統）' },
  { value: 'reduce', label: '減少動態' },
  { value: 'plain', label: '一般模式（不用 WebGL）' },
]
const VALUES = MOTION_MODES.map((entry) => entry.value)

function stored() {
  try {
    const value = localStorage.getItem(KEY)
    return VALUES.includes(value) ? value : 'auto'
  } catch {
    return 'auto'
  }
}

const mode = ref(stored())

export const osReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** 要不要減少動態：使用者選了減少或一般，或系統設定減少 */
export const isReduced = () => mode.value !== 'auto' || osReducedMotion()

/** 一般模式：不用 WebGL */
export const isPlain = () => mode.value === 'plain'

function apply() {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('reduce-motion', mode.value !== 'auto')
  document.documentElement.dataset.motion = mode.value
}
apply()

export function useMotion() {
  const osReduced = computed(() => osReducedMotion())
  function set(next) {
    if (!VALUES.includes(next) || next === mode.value) return
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // 記不住就只有這一次有效（重載後回到 auto）
    }
    mode.value = next
    apply()
    window.location.reload()
  }
  return { mode, modes: MOTION_MODES, osReduced, set }
}
