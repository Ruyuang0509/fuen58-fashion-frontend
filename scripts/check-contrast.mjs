// 計算全站文字／背景組合的對比度（WCAG 2 的相對亮度公式），有不合格的就以非零結束。
// 顏色直接讀 src/styles/tokens.css 與 src/theme/themes.js，不另外抄一份。
// 用法：npm run check:contrast
import { readFileSync } from 'node:fs'
import { DEFAULT_ACCENT, THEME_VISUALS } from '../src/theme/themes.js'

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
const token = (name) => {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))
  if (!match) throw new Error(`tokens.css 裡找不到 --${name}`)
  return match[1]
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const hex = (channels) => '#' + channels.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')
const linear = (c) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4)
const luminance = (color) => {
  const [r, g, b] = rgb(color).map(linear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
// 對應 CSS 的 color-mix(in srgb, color P%, white)
const tintOnWhite = (color, percent) => hex(rgb(color).map((c) => (c * percent + 255 * (100 - percent)) / 100))
// 對應 CSS 的 color-mix(in srgb, color P%, base)
const mixOn = (color, base, percent) => hex(rgb(color).map((c, i) => (c * percent + rgb(base)[i] * (100 - percent)) / 100))

// 先確認量尺本身是對的：一組已知答案、一組已知不合格。量尺壞了就不往下量。
const blackOnWhite = contrast('#000000', '#ffffff')
const greyOnWhite = contrast('#777777', '#ffffff')
if (Math.abs(blackOnWhite - 21) > 0.01 || !(greyOnWhite < 4.5)) {
  console.error(`量尺自我檢查失敗：黑白 ${blackOnWhite.toFixed(2)}（應為 21），#777 對白 ${greyOnWhite.toFixed(2)}（應低於 4.5）`)
  process.exit(2)
}

const TEXT = 4.5 // 一般文字（AA）
const UI = 3 // 辨識控制項所需的非文字資訊

const pairs = [
  ['主要文字／頁面底', token('ink'), token('bg'), TEXT],
  ['主要文字／卡片底', token('ink'), token('surface'), TEXT],
  ['次要文字／頁面底', token('ink-soft'), token('bg'), TEXT],
  ['次要文字／卡片底', token('ink-soft'), token('surface'), TEXT],
  ['表單邊框／卡片底', token('field-line'), token('surface'), UI],
  ['表單邊框／頁面底', token('field-line'), token('bg'), UI],
]

const accents = { 預設: DEFAULT_ACCENT, ...Object.fromEntries(Object.entries(THEME_VISUALS).map(([code, v]) => [code, v.accent])) }
for (const [name, accent] of Object.entries(accents)) {
  pairs.push([`${name}：按鈕文字／強調色`, token('on-accent'), accent, TEXT])
  pairs.push([`${name}：強調色的底線與外框／頁面底`, accent, token('bg'), UI])
  pairs.push([`${name}：佔位圖上的次要文字`, token('ink-soft'), tintOnWhite(accent, 12), TEXT])
  // 頁尾（第十五輪）：底色是頁面底染 6% 路線色，上面是次要文字
  pairs.push([`${name}：頁尾次要文字／頁尾底`, token('ink-soft'), mixOn(accent, token('bg'), 6), TEXT])
}

let failed = 0
for (const [label, fg, bg, min] of pairs) {
  const ratio = contrast(fg, bg)
  const ok = ratio >= min
  if (!ok) failed += 1
  console.log(`${ok ? '合格  ' : '不合格'} ${ratio.toFixed(2).padStart(5)}  (門檻 ${min})  ${fg} on ${bg}  ${label}`)
}
console.log(`\n共 ${pairs.length} 組，不合格 ${failed} 組`)
process.exit(failed ? 1 : 0)
