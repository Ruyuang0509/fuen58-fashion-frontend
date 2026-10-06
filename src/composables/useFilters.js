import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// 篩選條件只存在網址裡，不另外存一份狀態：
// 重新整理、上一頁、把連結貼給別人，看到的都是同一組條件。
//   風格 → 路徑 /themes/:code
//   場合、類別、尺寸 → 查詢字串 ?occasion=&category=&size=
const one = (value) => (Array.isArray(value) ? value[0] : value) ?? ''

export function useFilters() {
  const route = useRoute()
  const router = useRouter()

  const filters = computed(() => ({
    style: route.name === 'theme' ? String(route.params.code) : '',
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
    const query = { ...route.query }
    if (value) query[key] = value
    else delete query[key]
    // replace：調一格條件不該在瀏覽紀錄裡多一筆，否則按上一頁要按很多次
    return router.replace({ query })
  }

  return { filters, setFilter }
}
