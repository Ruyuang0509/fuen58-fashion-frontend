// 一句話列各格的選項。value 是送給 API 的值，空字串代表不限；
// label 是放進句子裡的說法，short 是收合成摘要時用的短稱。
// 風格那一格的選項來自 API 的主題清單，不寫在這裡。

// 給誰穿（2026-10-06 使用者要求加：男、女、中性、小孩）。選女生會連中性的一起出現，選男生也是；中性只給中性；小孩只給小孩
export const AUDIENCES = [
  { value: '', label: '不限誰', short: '' },
  { value: 'women', label: '女生', short: '女' },
  { value: 'men', label: '男生', short: '男' },
  { value: 'unisex', label: '中性', short: '中性' },
  { value: 'kids', label: '小孩', short: '小孩' },
]

export const OCCASIONS = [
  { value: '', label: '哪裡都去', short: '' },
  { value: 'work', label: '去上班', short: '上班' },
  { value: 'date', label: '去約會', short: '約會' },
  { value: 'weekend', label: '過假日', short: '假日' },
  { value: 'outdoor', label: '去戶外', short: '戶外' },
]

export const CATEGORIES = [
  { value: '', label: '整套穿搭', short: '' },
  { value: 'outer', label: '外套', short: '外套' },
  { value: 'top', label: '上衣', short: '上衣' },
  { value: 'bottom', label: '下身', short: '下身' },
  { value: 'shoes', label: '鞋襪', short: '鞋襪' },
  { value: 'acc', label: '配件', short: '配件' },
]

export const SIZES = [
  { value: '', label: '不限', short: '' },
  { value: 'S', label: 'S', short: 'S' },
  { value: 'M', label: 'M', short: 'M' },
  { value: 'L', label: 'L', short: 'L' },
  { value: 'XL', label: 'XL', short: 'XL' },
]
