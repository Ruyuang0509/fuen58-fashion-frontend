// 一句話列與單品列表各格的選項。value 是送給 API 的值，空字串代表不限；
// label 是放進句子裡的說法，short 是收合成摘要、或多選時連成「A 或 B」用的短稱。
// 風格那一格的選項來自 API 的主題清單，品牌來自品牌清單，不寫在這裡。

// 給誰穿（2026-10-06 使用者要求加：男、女、中性、小孩）。選女生會連中性的一起出現，選男生也是；中性只給中性；小孩只給小孩
export const AUDIENCES = [
  { value: '', label: '不限誰', short: '' },
  { value: 'women', label: '女生', short: '女' },
  { value: 'men', label: '男生', short: '男' },
  { value: 'unisex', label: '中性', short: '中性' },
  { value: 'kids', label: '小孩', short: '小孩' },
]

// 可以多選（第十五輪子輪 3）：選了兩個句子讀成「上班或約會」
export const OCCASIONS = [
  { value: '', label: '哪裡都去', short: '' },
  { value: 'work', label: '去上班', short: '上班' },
  { value: 'date', label: '去約會', short: '約會' },
  { value: 'weekend', label: '過假日', short: '假日' },
  { value: 'outdoor', label: '去戶外', short: '戶外' },
]

// 可以多選：「找外套或鞋襪」
export const CATEGORIES = [
  { value: '', label: '整套穿搭', short: '' },
  { value: 'outer', label: '外套', short: '外套' },
  { value: 'top', label: '上衣', short: '上衣' },
  { value: 'bottom', label: '下身', short: '下身' },
  { value: 'shoes', label: '鞋襪', short: '鞋襪' },
  { value: 'acc', label: '配件', short: '配件' },
]

// 單品列表用的類別：第一項是「全部單品」而不是「整套穿搭」
export const PRODUCT_CATEGORIES = [{ value: '', label: '全部單品', short: '' }, ...CATEGORIES.slice(1)]

// 可以多選：「尺寸 S 或 M」。F 是單一尺寸；110／120／130 是童裝
export const SIZES = [
  { value: '', label: '不限', short: '' },
  { value: 'S', label: 'S', short: 'S' },
  { value: 'M', label: 'M', short: 'M' },
  { value: 'L', label: 'L', short: 'L' },
  { value: 'XL', label: 'XL', short: 'XL' },
  { value: 'F', label: '單一尺寸', short: 'F' },
  { value: '110', label: '110', short: '110' },
  { value: '120', label: '120', short: '120' },
  { value: '130', label: '130', short: '130' },
]

// 價格三檔預設（第十五輪子輪 3）：句子裡讀得順；滑桿塞不進句子。min／max 是給 API 的 priceMin／priceMax
export const PRICES = [
  { value: '', label: '不限價格', short: '', min: null, max: null },
  { value: 'lt2000', label: '兩千以下', short: '＜2,000', min: null, max: 1999 },
  { value: '2000-4000', label: '兩千到四千', short: '2,000–4,000', min: 2000, max: 4000 },
  { value: 'gt4000', label: '四千以上', short: '＞4,000', min: 4001, max: null },
]

export const STOCKS = [
  { value: '', label: '有貨沒貨都看', short: '' },
  { value: '1', label: '只看有貨', short: '有貨' },
]

export const SORTS = [
  { value: 'new', label: '新上架', short: '新上架' },
  { value: 'popular', label: '熱銷', short: '熱銷' },
  { value: 'price-asc', label: '價格低到高', short: '低到高' },
  { value: 'price-desc', label: '價格高到低', short: '高到低' },
]
