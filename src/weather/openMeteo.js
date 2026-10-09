// Open-Meteo（第十六輪子輪 1）：免金鑰、瀏覽器可直接打（回應標頭 access-control-allow-origin: *，2026-10-10 實測）、
// 非商業用途免費（每日 10,000 次以下），資料 CC BY 4.0 要標來源（頁尾有）。
// 只是過渡：功能規劃 6.1 要後端定時抓氣象署資料再快取，後端做好 /api/weather 之後，api/index.js 的 getWeather 改打後端，
// 回的形狀一樣（契約 §13）。這個檔只管「打 Open-Meteo、把回應整理成站內的形狀」。
const BASE = 'https://api.open-meteo.com/v1/forecast'
const CURRENT = ['temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'precipitation', 'weather_code', 'is_day']
const DAILY = ['temperature_2m_max', 'temperature_2m_min', 'precipitation_probability_max', 'weather_code']

export function forecastUrl({ lat, lon, days = 7 }) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: CURRENT.join(','),
    daily: DAILY.join(','),
    timezone: 'Asia/Taipei',
    forecast_days: String(days),
  })
  return `${BASE}?${params}`
}

// WMO 天氣代碼 → 站內的三種天（天空畫法只分這三種）：0–1 晴；2–3 多雲、45／48 霧也算多雲；
// 51 以上全是會淋濕的（毛毛雨、雨、凍雨、雪、陣雨、雷雨）→ 雨
export function conditionOf(code) {
  const n = Number(code)
  if (!Number.isFinite(n)) return 'cloudy'
  if (n <= 1) return 'clear'
  if (n <= 3 || n === 45 || n === 48) return 'cloudy'
  return 'rain'
}

/** 打一次預報；逾時或 HTTP 錯誤都丟錯，由呼叫端決定退路 */
export async function fetchForecast({ lat, lon, days = 7, timeoutMs = 5000 }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(forecastUrl({ lat, lon, days }), { signal: controller.signal })
    if (!response.ok) throw new Error(`open-meteo ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

const whole = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) throw new Error('open-meteo: missing value')
  return Math.round(n)
}

/** Open-Meteo 的回應 → 站內形狀（契約 §13）。欄位缺了就丟錯，讓呼叫端走快取或示範值，不讓 NaN 進畫面 */
export function toWeather(raw, city, fetchedAt = new Date().toISOString()) {
  const current = raw?.current
  const daily = raw?.daily
  if (!current || !daily || !Array.isArray(daily.time)) throw new Error('open-meteo: bad shape')
  const forecast = daily.time.map((date, i) => ({
    date,
    high: whole(daily.temperature_2m_max[i]),
    low: whole(daily.temperature_2m_min[i]),
    rainChance: Number.isFinite(Number(daily.precipitation_probability_max?.[i])) ? Math.round(Number(daily.precipitation_probability_max[i])) : 0,
    condition: conditionOf(daily.weather_code[i]),
  }))
  return {
    city: city.name,
    cityCode: city.code,
    temperature: whole(current.temperature_2m),
    humidity: whole(current.relative_humidity_2m),
    apparent: whole(current.apparent_temperature),
    condition: conditionOf(current.weather_code),
    isDay: Number(current.is_day) === 1,
    // current.time 是臺北時間、沒有秒和時區：補成完整的 ISO
    observedAt: typeof current.time === 'string' ? `${current.time}:00+08:00` : fetchedAt,
    fetchedAt,
    source: 'open-meteo',
    stale: false,
    forecast,
  }
}
