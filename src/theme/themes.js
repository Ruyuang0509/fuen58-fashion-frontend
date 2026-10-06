// 每個風格主題在前端的視覺定義，以主題代碼對應後端給的主題清單。
// 主題的名稱、說明、排序來自 API；顏色與「時刻」定義在這裡。
// 這些主題是暫定的，正式清單要全組決定。
//
// accent 要同時當「白字的底色」和「底色上的文字色」，所以兩種對比度都要過；
// 改色後跑 npm run check:contrast。
//
// moment：這個路線自己的時刻——主題頁的天空用它，不用今天的天氣。
//   hour 幾點；weather 那時候的天（給 sky.js 算雲雨霧）；line 一句話。
export const THEME_VISUALS = {
  minimal: { accent: '#3f4a54', moment: { hour: 10, weather: { condition: 'clear', humidity: 45, temperature: 20 }, line: '早上十點，天很乾淨。' } },
  street: { accent: '#a8281f', moment: { hour: 18, weather: { condition: 'cloudy', humidity: 70, temperature: 24 }, line: '傍晚六點，雲壓得低。' } },
  vintage: { accent: '#7a4e17', moment: { hour: 17, weather: { condition: 'clear', humidity: 55, temperature: 22 }, line: '下午五點，光斜斜的。' } },
  outdoor: { accent: '#2c6238', moment: { hour: 7, weather: { condition: 'rain', humidity: 92, temperature: 15 }, line: '早上七點，山腳有霧，在下雨。' } },
  formal: { accent: '#2b3f7a', moment: { hour: 9, weather: { condition: 'clear', humidity: 50, temperature: 19 }, line: '早上九點，進會議室之前。' } },
  // 2026-10-06 使用者提到風格不止五種，對標日系平台，先加三個試版面
  punk: { accent: '#5b1f2a', moment: { hour: 21, weather: { condition: 'rain', humidity: 88, temperature: 18 }, line: '晚上九點，雨還在下。' } },
  lolita: { accent: '#6a3f7a', moment: { hour: 15, weather: { condition: 'clear', humidity: 50, temperature: 23 }, line: '下午三點，茶會開始。' } },
  ryousan: { accent: '#9b3b5e', moment: { hour: 14, weather: { condition: 'cloudy', humidity: 60, temperature: 25 }, line: '下午兩點，商店街正熱鬧。' } },
}

export const DEFAULT_ACCENT = '#3f4a54'

export function accentOf(themeCode) {
  return THEME_VISUALS[themeCode]?.accent ?? DEFAULT_ACCENT
}

export function momentOf(themeCode) {
  return THEME_VISUALS[themeCode]?.moment ?? null
}
