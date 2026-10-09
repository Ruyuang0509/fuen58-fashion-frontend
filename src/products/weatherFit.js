// 「這套合不合今天」：用今天的溫度、有沒有雨，對照每件的厚薄等級與布料。
// 門檻是前端暫定的（功能規劃 6.1 說由後台的對照表決定），句子是規則拼的，不是生成的。
// 第十六輪子輪 1：加 fitVerdict（一句話列的「合今天的」、穿搭卡的小標、這一週的挑法都用它）與「太厚」的判定。
// 副檔名要寫：驗收腳本用 Node 直接載入這個檔，Node 不會自己補 .js（Vite 兩種都認）
import { WARMTH } from './labels.js'

// 幾度該穿多厚（1 薄～5 厚）
export const wantedWarmth = (temperature) => (temperature >= 26 ? 1 : temperature >= 22 ? 2 : temperature >= 16 ? 3 : temperature >= 10 ? 4 : 5)

/** 上半身最厚的那一層的等級；沒有外套也沒有上衣（或都沒標厚薄）回 0 */
export const heaviestUpper = (items) => Math.max(0, ...items.filter((entry) => entry.category === 'outer' || entry.category === 'top').map((entry) => entry.warmth ?? 0))

/**
 * 判定：最厚的那一層對上今天要的厚度，差多少。
 *   ≤ −2 → 'cold' 會冷；−1 → 'light' 偏薄（進出室內剛好，仍算合）；0～+1 → 'ok' 剛好；≥ +2 → 'warm' 太厚。
 * 沒有天氣、或這套沒有上半身的衣服 → null（不說話）。
 */
export function fitVerdict(items, weather) {
  if (!weather || !Number.isFinite(Number(weather.temperature))) return null
  const heaviest = heaviestUpper(items)
  if (!heaviest) return null
  const diff = heaviest - wantedWarmth(Number(weather.temperature))
  if (diff <= -2) return 'cold'
  if (diff === -1) return 'light'
  if (diff <= 1) return 'ok'
  return 'warm'
}

// 一句話列「合今天的」留下哪些：剛好與偏薄
export const fitsToday = (verdict) => verdict === 'ok' || verdict === 'light'

// 穿搭卡上的小標
export const VERDICT_TEXT = { ok: '合今天', light: '偏薄', cold: '會冷', warm: '太厚' }

const CATEGORY_WORD = { outer: '外層', top: '上身', bottom: '下身' }

// 外層的面料吸不吸水
export const shedsWater = (entry) => !!entry && (entry.fabric === 'nylon' || entry.fabric === 'leather' || (entry.features ?? []).includes('防潑水'))

/**
 * 穿搭頁的「今天為什麼是這套」：每一層一句，整體一句，有雨再一句。
 * @param {Array} items  已展開的單品（要有 category、name、warmth、fabric、features）
 * @param {object|null} weather  { temperature, humidity, condition }
 * @returns {{ verdict: 'ok'|'light'|'cold'|'warm'|null, lines: string[] }}
 */
export function fitReason(items, weather) {
  if (!weather) return { verdict: null, lines: [] }
  const lines = []

  // 每一層一句：是什麼、多厚、適合幾度
  for (const category of ['outer', 'top', 'bottom']) {
    const item = items.find((entry) => entry.category === category)
    if (!item) continue
    const warmth = WARMTH[item.warmth]
    lines.push(warmth ? `${CATEGORY_WORD[category]}是${item.name}，${warmth.label}，適合 ${warmth.range}。` : `${CATEGORY_WORD[category]}是${item.name}。`)
  }

  // 整體：上半身最厚的那層對上今天要的厚度
  const verdict = fitVerdict(items, weather)
  const degrees = `今天 ${weather.temperature}°`
  if (verdict === 'ok') {
    const diff = heaviestUpper(items) - wantedWarmth(Number(weather.temperature))
    lines.push(diff === 0 ? `${degrees}，這個厚度剛好。` : `${degrees}，這個厚度夠，熱了外層可以脫。`)
  } else if (verdict === 'light') {
    lines.push(`${degrees}，偏薄一點，進出室內剛好。`)
  } else if (verdict === 'cold') {
    lines.push(`${degrees}，這樣會冷，建議再加一件。`)
  } else if (verdict === 'warm') {
    lines.push(`${degrees}，這樣會熱，外層可以不穿。`)
  }

  // 雨：看外層的面料吸不吸水
  if (weather.condition === 'rain') {
    const outer = items.find((entry) => entry.category === 'outer')
    if (!outer) lines.push('有雨，這套沒有外層，記得帶傘。')
    else if (shedsWater(outer)) lines.push(`有雨，${outer.name}的面料不吸水，淋到不會馬上滲。`)
    else lines.push(`有雨，${outer.name}會吸水，記得帶傘。`)
  }

  return { verdict, lines }
}
