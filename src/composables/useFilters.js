import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// 篩選條件只存在網址裡，不另外存一份狀態：
// 重新整理、上一頁、把連結貼給別人，看到的都是同一組條件。
//   風格 → 路徑 /themes/:code
//   給誰穿、場合、類別、尺寸 → 查詢字串 ?for=&occasion=&category=&size=
const one = (value) => (Array.isArray(value) ? value[0] : value) ?? ''

// 條件名 → 查詢字串的鍵（只有「給誰穿」的鍵名不一樣，網址上 for=women 比 audience=women 好讀）
const QUERY_KEYS = { audience: 'for', occasion: 'occasion', category: 'category', size: 'size' }

export function useFilters() {
  const route = useRoute()
  const router = useRouter()

  const filters = computed(() => ({
    style: route.name === 'theme' ? String(route.params.code) : '',
    audience: one(route.query.for),
    occasion: one(route.query.occasion),
    category: one(route.query.category),
    size: one(route.query.size),
  }))

  function setFilter(key, value) {
    if (key === 'style') {
      // 換風格等於換主題頁；清掉風格就回到全部穿搭。其他條件原樣帶著走。
      const target = value ? { name: 'theme', params: { code: value } } : { name: 'outfits' }
      return router.push({ ...target, query: route.query })
    }
    const queryKey = QUERY_KEYS[key] ?? key
    const query = { ...route.query }
    if (value) query[queryKey] = value
    else delete query[queryKey]
    // replace：調一格條件不該在瀏覽紀錄裡多一筆，否則按上一頁要按很多次
    return router.replace({ query })
  }

  return { filters, setFilter }
}
