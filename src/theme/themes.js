// 每個風格主題在前端的視覺定義，以主題代碼對應後端給的主題清單。
// 主題的名稱、說明、排序來自 API；顏色（之後還有入口場景的圖樣）定義在這裡。
// 這些主題是暫定的，正式清單要全組決定。
//
// accent 要同時當「白字的底色」和「底色上的文字色」，所以兩種對比度都要過；
// 改色後跑 npm run check:contrast。
export const THEME_VISUALS = {
  minimal: { accent: '#3f4a54' },
  street: { accent: '#a8281f' },
  vintage: { accent: '#7a4e17' },
  outdoor: { accent: '#2c6238' },
  formal: { accent: '#2b3f7a' },
  // 2026-10-06 使用者提到風格不止五種，對標日系平台，先加三個試版面
  punk: { accent: '#5b1f2a' },
  lolita: { accent: '#6a3f7a' },
  ryousan: { accent: '#9b3b5e' },
}

export const DEFAULT_ACCENT = '#3f4a54'

export function accentOf(themeCode) {
  return THEME_VISUALS[themeCode]?.accent ?? DEFAULT_ACCENT
}
