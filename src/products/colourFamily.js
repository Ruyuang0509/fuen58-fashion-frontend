// 色系（第十五輪子輪 3）：商品各自的顏色名（燕麥、石板藍、菸草…）太細，不能當篩選條件；
// 用 hex 算 HSL 再分成十一個色系，單品列表的「顏色」那一格選的是色系。
// 門檻是對著目前 48 個商品顏色調出來的（docs/12 有對照表）；新顏色進來若分錯，調這裡，不要在資料裡另標。
export const COLOUR_FAMILIES = [
  { value: 'black', label: '黑', swatch: '#26262a' },
  { value: 'white', label: '白', swatch: '#f3efe8' },
  { value: 'grey', label: '灰', swatch: '#8a8a86' },
  { value: 'beige', label: '米駝', swatch: '#c8b89a' },
  { value: 'brown', label: '棕', swatch: '#8a5a34' },
  { value: 'yellow', label: '黃', swatch: '#e8b53a' },
  { value: 'green', label: '綠', swatch: '#3f5a46' },
  { value: 'blue', label: '藍', swatch: '#3b4a6b' },
  { value: 'purple', label: '紫', swatch: '#d9cfe3' },
  { value: 'pink', label: '粉', swatch: '#f6d2dc' },
  { value: 'red', label: '紅', swatch: '#7a2f45' },
]

export const familyName = (value) => COLOUR_FAMILIES.find((family) => family.value === value)?.label ?? ''

function toHsl(hex) {
  const clean = String(hex).replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = d / (1 - Math.abs(2 * l - 1))
  let h
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h = (h * 60 + 360) % 360
  return { h, s, l }
}

/** 一個 hex 顏色屬於哪個色系（COLOUR_FAMILIES 的 value） */
export function familyOf(hex) {
  const { h, s, l } = toHsl(hex)
  if (!Number.isFinite(l)) return 'grey'
  if (l < 0.18) return 'black' // 黑、墨黑、炭黑
  if (l >= 0.87 && s < 0.6) return 'white' // 白、米白、象牙白、骨白、奶油
  if (s < 0.06) return 'grey' // 炭灰、鼠灰、岩灰
  if (h >= 15 && h < 60) {
    if (s >= 0.6) return 'yellow' // 芥黃
    return l >= 0.5 ? 'beige' : 'brown' // 亮的是米駝（燕麥、沙、麥、駝），暗的是棕（菸草、茶、鐵鏽、卡其）
  }
  if (h >= 60 && h < 75) return s < 0.25 && l < 0.5 ? 'green' : 'yellow' // 橄欖算綠
  if (h < 170) return 'green'
  if (h < 255) return 'blue' // 海軍藍、靛、石板藍、淺藍
  if (h < 300) return 'purple' // 薰衣草
  return l >= 0.7 ? 'pink' : 'red' // 櫻粉、淺粉；暗紅、酒紅
}
