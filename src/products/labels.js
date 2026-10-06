// 商品資料在畫面上的說法。資料本身在 src/api/mock/products.json，後端做好後從 API 來。

// 厚薄等級（products.json 的 warmth，1 薄～5 厚）→ 一句話與適穿的溫度區間。
// 區間是前端暫定的對照表；功能規劃 5「天氣規則管理」說這張表之後由後台維護。
export const WARMTH = {
  1: { label: '薄', range: '22° 以上' },
  2: { label: '偏薄', range: '18°–28°' },
  3: { label: '中等', range: '12°–22°' },
  4: { label: '偏厚', range: '6°–16°' },
  5: { label: '厚', range: '12° 以下' },
}

export const warmthText = (level) => {
  const entry = WARMTH[level]
  return entry ? `${entry.label}，適合 ${entry.range}` : ''
}

// 類別代碼 → 名稱（和一句話列的選項一致，只是這裡沒有「整套穿搭」那一項）
export const CATEGORY_NAMES = { outer: '外套', top: '上衣', bottom: '下身', shoes: '鞋襪', acc: '配件' }

// 購物車的運費規則：固定運費，滿額免運（功能規劃 4「運費」）。兩個數字是前端暫定的，要全組決定。
export const SHIPPING_FEE = 80
export const FREE_SHIPPING_FROM = 2000

export const formatPrice = (value) => `NT$ ${new Intl.NumberFormat('zh-TW').format(value)}`
