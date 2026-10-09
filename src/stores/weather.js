import { computed, ref, watch } from 'vue'
import { getWeather } from '@/api'
import { CITIES, DEFAULT_CITY, cityOf, nearestCity } from '@/weather/cities'

// 天氣（第十六輪子輪 1）：整站一份——天空、頂欄、一句話列、這一週、穿搭頁的理由都讀這裡。
// 縣市記在 localStorage 的 city（預設臺北）；換縣市就重新要一次天氣（api/index.js 的 getWeather 自己管快取與退路）。
// 開發版的覆蓋（localStorage weatherDemo）在 api/index.js 的 getWeather 裡認，這裡不另外處理。
const CITY_KEY = 'city'

function storedCity() {
  try {
    const value = localStorage.getItem(CITY_KEY)
    if (CITIES.some((city) => city.code === value)) return value
  } catch {
    // 儲存空間不能用：用預設
  }
  return DEFAULT_CITY
}

const city = ref(storedCity())
const weather = ref(null)
const status = ref('idle') // idle | loading | ready

// 連續換縣市時只採用最後一次的結果
let ticket = 0
async function load() {
  const mine = ++ticket
  status.value = 'loading'
  const target = cityOf(city.value)
  let result
  try {
    result = await getWeather({ city: target.code })
  } catch {
    // getWeather 自己有退路，這裡只是保險
    result = null
  }
  if (mine !== ticket) return
  weather.value = result
  status.value = 'ready'
}

function setCity(code) {
  if (!CITIES.some((entry) => entry.code === code) || code === city.value) return
  city.value = code
  try {
    localStorage.setItem(CITY_KEY, code)
  } catch {
    // 存不了就只在這次有效
  }
}

watch(city, load, { immediate: true })

/** 瀏覽器定位 → 最近的縣市。沒有定位、被拒絕、逾時都回 false，縣市不動 */
function locate() {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const found = nearestCity(position.coords.latitude, position.coords.longitude)
        setCity(found.code)
        resolve(true)
      },
      () => resolve(false),
      { timeout: 8000, maximumAge: 10 * 60 * 1000 },
    )
  })
}

const cityName = computed(() => cityOf(city.value).name)

if (import.meta.env.DEV && typeof window !== 'undefined') {
  // 開發與驗收用：看現在的天氣是真的、快取的還是示範的
  window.__weather = {
    probe: () => (weather.value ? { ...weather.value, forecast: weather.value.forecast?.length ?? 0, city: city.value, status: status.value } : { status: status.value }),
  }
}

export function useWeather() {
  return {
    weather,
    city,
    cityName,
    cities: CITIES,
    status,
    setCity,
    locate,
    refresh: load,
  }
}
