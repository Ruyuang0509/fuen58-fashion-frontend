import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AUDIENCES, CATEGORIES, OCCASIONS, SIZES } from '@/filters/options'

// 篩選條件只存在網址裡，不另外存一份狀態：
// 重新整理、上一頁、把連結貼給別人，看到的都是同一組條件。
//   風格 → 路徑 /themes/:code（單選：它也是天空的時刻）
//   給誰穿 → ?for=（單選：語意已含中性）
//   場合、類別、尺寸 → ?occasion=work,date 這樣逗號分隔，可以多選、任一符合（第十五輪子輪 3）
//   合今天的 → ?fit=today（第十六輪子輪 1：一句話列的第一格；只有這一個值）
const QUERY_KEYS = { audience: 'for', occasion: 'occasion', category: 'category', size: 'size', fit: 'fit' }
const MULTI = new Set(['occasion', 'category', 'size'])
const OPTIONS = { audience: AUDIENCES, occasion: OCCASIONS, category: CATEGORIES, size: SIZES }

/** 查詢字串的值拆成字串陣列：'a,b'、['a', 'b']、['a,b', 'c'] 都行；去掉空的與重複的 */
export function splitList(raw) {
  const values = (Array.isArray(raw) ? raw : [raw]).flatMap((value) => String(value ?? '').split(',')).map((value) => value.trim()).filter(Boolean)
  return [...new Set(values)]
}

/** 同上，但只留選項裡有的值（網址帶 ?occasion=foo 這種不認得的就丟掉） */
export function listFrom(raw, options) {
  const known = new Set(options.filter((option) => option.value).map((option) => option.value))
  return splitList(raw).filter((value) => known.has(value))
}

const oneFrom = (raw, options) => listFrom(raw, options)[0] ?? ''

export function useFilters() {
  const route = useRoute()
  const router = useRouter()

  const filters = computed(() => ({
    style: route.name === 'theme' ? String(route.params.code) : '',
    audience: oneFrom(route.query.for, AUDIENCES),
    occasion: listFrom(route.query.occasion, OCCASIONS),
    category: listFrom(route.query.category, CATEGORIES),
    size: listFrom(route.query.size, SIZES),
    fit: route.query.fit === 'today' ? 'today' : '',
  }))

  /**
   * 改一格條件。多選的格給陣列（或逗號字串），單選的給字串；空的代表不限。
   */
  function setFilter(key, value) {
    if (key === 'style') {
      // 換風格等於換主題頁；清掉風格就回到全部穿搭。其他條件原樣帶著走
      const target = value ? { name: 'theme', params: { code: value } } : { name: 'outfits' }
      return router.push({ ...target, query: route.query })
    }
    const queryKey = QUERY_KEYS[key] ?? key
    const query = { ...route.query }
    const values = MULTI.has(key) ? listFrom(value, OPTIONS[key]) : (value ? [String(value)] : [])
    if (values.length) query[queryKey] = values.join(',')
    else delete query[queryKey]
    // replace：調一格條件不該在瀏覽紀錄裡多一筆，否則按上一頁要按很多次
    return router.replace({ query })
  }

  return { filters, setFilter }
}
