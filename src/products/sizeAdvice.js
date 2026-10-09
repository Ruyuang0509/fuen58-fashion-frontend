// 尺寸建議（第十六輪子輪 2；規格 15 §4.2）。純函式，規則式，不是模型——發表時就叫「規則式推薦」。
// 兩個算法：
//   1. 以模特兒為基準（每件商品都有「模特兒 170 cm／56 kg 穿 M」）：身高每差 12 公分、體重每差 8 公斤各算一級，
//      從模特兒穿的尺寸往上下移。好處是每個人都看得懂、也反駁得了。
//   2. 有三圍而且尺寸表有對應的欄：把平量換成圍度和身體比，鬆份夠的裡面挑最小的。三圍比身高體重準，有就以它為準。
// 門檻都是設計假設（沒有真人資料可校），寫在這裡、也寫在畫面上。
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const STEP_HEIGHT = 12 // 公分一級
const STEP_WEIGHT = 8 // 公斤一級
const TOO_FAR = 3 // 差三級以上就不猜了
// 尺寸表的欄 → 身體的哪一圍；胸寬是平量的半圍，要 ×2
const MEASURES = [
  { column: '胸寬', key: 'chest', name: '胸圍', scale: 2, ease: 6 },
  { column: '腰圍', key: 'waist', name: '腰圍', scale: 1, ease: 2 },
  { column: '臀圍', key: 'hips', name: '臀圍', scale: 1, ease: 4 },
]

const number = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** 身形資料整理成數字；身高體重都沒有就回 null */
export function cleanBody(body) {
  if (!body || typeof body !== 'object') return null
  const clean = {
    height: number(body.height),
    weight: number(body.weight),
    chest: number(body.chest),
    waist: number(body.waist),
    hips: number(body.hips),
  }
  return clean.height || clean.weight || clean.chest || clean.waist || clean.hips ? clean : null
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function describeDiff(dh, dw) {
  const parts = []
  if (dh) parts.push(`${dh > 0 ? '高' : '矮'} ${Math.abs(dh)} 公分`)
  if (dw) parts.push(`${dw > 0 ? '重' : '輕'} ${Math.abs(dw)} 公斤`)
  return parts.length ? `比模特兒${parts.join('、')}` : '和模特兒差不多'
}

// 算法 1：模特兒基準
function fromModel(sizes, fit, height, weight) {
  const dh = Math.round(height - fit.height)
  const dw = Math.round(weight - fit.weight)
  const offset = Math.round(dh / STEP_HEIGHT + dw / STEP_WEIGHT)
  const who = `模特兒 ${fit.height} cm／${fit.weight} kg 穿 ${fit.size}；你 ${Math.round(height)} cm／${Math.round(weight)} kg`
  if (Math.abs(offset) >= TOO_FAR) {
    return { far: true, text: `${who}，差距大，建議直接看尺寸表。` }
  }
  const base = sizes.indexOf(fit.size)
  const index = clamp(base + offset, 0, sizes.length - 1)
  const clipped = base + offset !== index
  const size = sizes[index]
  const alternatives = []
  if (index > 0) alternatives.push({ size: sizes[index - 1], note: '想合身一點' })
  if (index < sizes.length - 1) alternatives.push({ size: sizes[index + 1], note: '想寬鬆一點' })
  return {
    size,
    basis: 'model',
    fit: '合身',
    text: `${who}，${describeDiff(dh, dw)}，建議 ${size}${clipped ? `（已經是最${index === 0 ? '小' : '大'}的尺寸）` : ''}。`,
    alternatives,
  }
}

// 算法 2：三圍對尺寸表
function fromMeasure(product, sizes, body) {
  const columns = product.measure?.columns ?? []
  const rows = product.measure?.rows ?? {}
  const usable = MEASURES.filter((entry) => columns.includes(entry.column) && body[entry.key])
  if (!usable.length) return null
  const candidates = sizes
    .filter((size) => Array.isArray(rows[size]))
    .map((size) => {
      const slacks = usable.map((entry) => {
        const garment = Number(rows[size][columns.indexOf(entry.column)]) * entry.scale
        return { entry, garment, slack: garment - body[entry.key] - entry.ease }
      })
      return { size, slacks, worst: Math.min(...slacks.map((item) => item.slack)) }
    })
  if (!candidates.length) return null
  const fits = candidates.filter((candidate) => candidate.worst >= 0)
  const chosen = fits[0] ?? candidates[candidates.length - 1]
  const tight = !fits.length
  const fitWord = tight ? '偏緊' : chosen.worst < 4 ? '合身' : chosen.worst < 10 ? '寬鬆' : '很寬鬆'
  const detail = chosen.slacks.map((item) => `${item.entry.name} ${item.garment} 公分`).join('、')
  const names = usable.map((entry) => entry.name).join('、')
  const alternatives = []
  const index = sizes.indexOf(chosen.size)
  if (!tight && index > 0) alternatives.push({ size: sizes[index - 1], note: '想合身一點' })
  if (index < sizes.length - 1) alternatives.push({ size: sizes[index + 1], note: '想寬鬆一點' })
  return {
    size: chosen.size,
    basis: 'measure',
    fit: fitWord,
    text: tight
      ? `依你的${names}，每個尺寸都偏緊，最接近的是 ${chosen.size}（${detail}）。`
      : `依你的${names}，建議 ${chosen.size}（這件的${detail}，${fitWord}）。`,
    alternatives,
  }
}

/**
 * 給一件商品、一份身形，回建議；不建議時回 null 或 { far: true, text }。
 * 不建議：單一尺寸（F）、童裝、尺寸不是 XS–XXL、沒有模特兒資料也沒有可比的三圍。
 * @returns {{ size: string, basis: 'model'|'measure', fit: string, text: string, alternatives: { size: string, note: string }[], also?: string } | { far: true, text: string } | null}
 */
export function adviseSize(product, rawBody) {
  const body = cleanBody(rawBody)
  if (!product || !body) return null
  const sizes = (product.sizes ?? []).filter((size) => SIZE_ORDER.includes(size))
  if (sizes.length < 2) return null
  const fit = product.fit
  const byModel = fit && body.height && body.weight && sizes.includes(fit.size) ? fromModel(sizes, fit, body.height, body.weight) : null
  const byMeasure = fromMeasure(product, sizes, body)
  if (byMeasure) {
    // 三圍為準；身高體重算出來不一樣就附註
    const also = byModel && !byModel.far && byModel.size !== byMeasure.size ? `依身高體重會是 ${byModel.size}。` : ''
    return { ...byMeasure, also }
  }
  return byModel
}

/** 畫面上「你 168 cm／58 kg」這種說法 */
export function describeBody(rawBody) {
  const body = cleanBody(rawBody)
  if (!body) return ''
  const parts = []
  if (body.height) parts.push(`${body.height} cm`)
  if (body.weight) parts.push(`${body.weight} kg`)
  const girths = ['chest', 'waist', 'hips'].filter((key) => body[key]).map((key) => `${{ chest: '胸', waist: '腰', hips: '臀' }[key]} ${body[key]}`)
  return [parts.join('／'), girths.join('・')].filter(Boolean).join('，')
}
