// 「今天為什麼是這套」：用今天的溫度、有沒有雨，對照每件的厚薄等級與布料，寫成幾句理由。
// 門檻是前端暫定的（功能規劃 6.1 說由後台的對照表決定），句子是規則拼的，不是生成的。
import { WARMTH } from './labels'

// 幾度該穿多厚（1 薄～5 厚）
export const wantedWarmth = (temperature) => (temperature >= 26 ? 1 : temperature >= 22 ? 2 : temperature >= 16 ? 3 : temperature >= 10 ? 4 : 5)

const CATEGORY_WORD = { outer: '外層', top: '上身', bottom: '下身' }

/**
 * @param {Array} items  已展開的單品（要有 category、name、warmth、fabric、features）
 * @param {object|null} weather  { temperature, humidity, condition }
 * @returns {{ verdict: 'ok'|'light'|'cold'|null, lines: string[] }}
 */
export function fitReason(items, weather) {
  if (!weather) return { verdict: null, lines: [] }
  const want = wantedWarmth(weather.temperature)
  const lines = []

  // 每一層一句：是什麼、多厚、適合幾度
  for (const category of ['outer', 'top', 'bottom']) {
    const item = items.find((entry) => entry.category === category)
    if (!item) continue
    const warmth = WARMTH[item.warmth]
    lines.push(warmth ? `${CATEGORY_WORD[category]}是${item.name}，${warmth.label}，適合 ${warmth.range}。` : `${CATEGORY_WORD[category]}是${item.name}。`)
  }

  // 整體：上半身最厚的那層對上今天要的厚度
  const upper = items.filter((entry) => entry.category === 'outer' || entry.category === 'top')
  const heaviest = Math.max(0, ...upper.map((entry) => entry.warmth ?? 0))
  let verdict = 'ok'
  if (heaviest === 0) {
    verdict = null
  } else if (heaviest >= want) {
    lines.push(`今天 ${weather.temperature}°，這個厚度夠。`)
  } else if (heaviest === want - 1) {
    verdict = 'light'
    lines.push(`今天 ${weather.temperature}°，偏薄一點，進出室內剛好。`)
  } else {
    verdict = 'cold'
    lines.push(`今天 ${weather.temperature}°，這樣會冷，建議再加一件。`)
  }

  // 雨：看外層的面料吸不吸水
  if (weather.condition === 'rain') {
    const outer = items.find((entry) => entry.category === 'outer')
    const shedsWater = (entry) => entry && (entry.fabric === 'nylon' || entry.fabric === 'leather' || (entry.features ?? []).includes('防潑水'))
    if (!outer) lines.push('有雨，這套沒有外層，記得帶傘。')
    else if (shedsWater(outer)) lines.push(`有雨，${outer.name}的面料不吸水，淋到不會馬上滲。`)
    else lines.push(`有雨，${outer.name}會吸水，記得帶傘。`)
  }

  return { verdict, lines }
}
