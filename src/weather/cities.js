// 可以選的縣市（第十六輪子輪 1）：代表座標取市中心附近，Open-Meteo 會對到最近的預報格點。
// 順序就是清單的順序：北到南，再東部。功能規劃 6.1 說「手動選縣市、記住上次選擇」，所以只做縣市，不做鄉鎮。
export const CITIES = [
  { code: 'taipei', name: '臺北', lat: 25.04, lon: 121.56 },
  { code: 'newtaipei', name: '新北', lat: 25.01, lon: 121.46 },
  { code: 'keelung', name: '基隆', lat: 25.13, lon: 121.74 },
  { code: 'taoyuan', name: '桃園', lat: 24.99, lon: 121.31 },
  { code: 'hsinchu', name: '新竹', lat: 24.8, lon: 120.97 },
  { code: 'taichung', name: '臺中', lat: 24.15, lon: 120.67 },
  { code: 'changhua', name: '彰化', lat: 24.08, lon: 120.54 },
  { code: 'chiayi', name: '嘉義', lat: 23.48, lon: 120.45 },
  { code: 'tainan', name: '臺南', lat: 22.99, lon: 120.21 },
  { code: 'kaohsiung', name: '高雄', lat: 22.63, lon: 120.3 },
  { code: 'pingtung', name: '屏東', lat: 22.68, lon: 120.49 },
  { code: 'yilan', name: '宜蘭', lat: 24.76, lon: 121.75 },
  { code: 'hualien', name: '花蓮', lat: 23.99, lon: 121.6 },
  { code: 'taitung', name: '臺東', lat: 22.76, lon: 121.14 },
]

export const DEFAULT_CITY = 'taipei'

export const cityOf = (code) => CITIES.find((city) => city.code === code) ?? CITIES[0]

// 兩點的球面距離（公里）；找最近的縣市用，精度不重要
function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** 離這個座標最近的縣市（瀏覽器定位用；在臺灣以外會回最近的那個，畫面照樣能用） */
export function nearestCity(lat, lon) {
  let best = CITIES[0]
  let bestDistance = Infinity
  for (const city of CITIES) {
    const distance = distanceKm(lat, lon, city.lat, city.lon)
    if (distance < bestDistance) {
      best = city
      bestDistance = distance
    }
  }
  return best
}
