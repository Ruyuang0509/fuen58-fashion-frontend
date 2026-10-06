// 入口與家族頁共用：八個風格家族，一家族一件單品。
//   theme   主題代碼（對應 mock 的主題清單）
//   kind    款式圖；colour 布色；fabric 布料（render.js 用）
//   key     帶動整個畫面的顏色
//   x, y    在入口畫面上的位置（比例）；scale 大小
//   warm    這件有多保暖（0 冷 1 暖）；rain 下雨天穿它合不合適——原型用的粗略值，正式規則在後端
//   subs    子風格的暫定清單（Claude 依日系平台常見分類擬的，正式清單要全組決定）
export const FAMILIES = [
  { theme: 'street', kind: 'trousers', colour: '#4a5566', fabric: 'cotton', key: '#55657a', x: 0.12, y: 0.36, scale: 1.05, warm: 0.6, rain: 0.7, subs: ['街頭', '運動', 'Y2K', '美式休閒'] },
  { theme: 'ryousan', kind: 'blouse', colour: '#f6f0ea', fabric: 'cotton', key: '#f1b7c7', x: 0.31, y: 0.26, scale: 0.9, warm: 0.2, rain: 0.3, subs: ['量產型', '地雷系', '女孩風', '韓系甜美'] },
  { theme: 'punk', kind: 'jacket', colour: '#2b272c', fabric: 'leather', key: '#4a3a46', x: 0.5, y: 0.38, scale: 0.95, warm: 0.7, rain: 0.8, subs: ['龐克', '哥德', '搖滾', '視覺系'] },
  { theme: 'outdoor', kind: 'vest', colour: '#e8b53a', fabric: 'nylon', key: '#5f9a63', x: 0.7, y: 0.26, scale: 0.95, warm: 0.7, rain: 1.0, subs: ['戶外', '工裝', '軍裝', '機能'] },
  { theme: 'formal', kind: 'coat', colour: '#c6a06a', fabric: 'wool', key: '#3a4f86', x: 0.89, y: 0.4, scale: 1.05, warm: 0.9, rain: 0.5, subs: ['正式', '上班', '學院', '保守優雅'] },
  { theme: 'minimal', kind: 'top', colour: '#e8e3d9', fabric: 'cotton', key: '#d8d3ca', x: 0.24, y: 0.7, scale: 0.9, warm: 0.1, rain: 0.4, subs: ['簡約', '乾淨俐落', '自然', '無性別'] },
  { theme: 'lolita', kind: 'dress', colour: '#7a2f45', fabric: 'satin', key: '#a0688f', x: 0.44, y: 0.72, scale: 0.95, warm: 0.3, rain: 0.2, subs: ['蘿莉塔', '古典', '甜系', '哥德蘿莉'] },
  { theme: 'vintage', kind: 'skirt', colour: '#9a6a3c', fabric: 'denim', key: '#b98a52', x: 0.65, y: 0.7, scale: 0.9, warm: 0.4, rain: 0.5, subs: ['復古', '古著混搭', '波希米亞', '昭和'] },
]
