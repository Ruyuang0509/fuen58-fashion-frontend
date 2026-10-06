import { computed, ref, watch } from 'vue'
import { getOutfits, getProducts, getThemes } from '@/api'
import * as account from '@/api/account'
import { useFavorites } from '@/stores/favorites'
import { useHistory } from '@/stores/history'
import { useSession } from '@/stores/session'
import { buildProfile } from '@/taste/profile'

// 喜好（第十五輪子輪 4）：把會員的偏好調查、收藏、看過的三樣算成一份「推測」（taste/profile.js），
// 給穿搭舞台排序、商品頁「你可能也想看」、首頁第一個詞用。整站共用一份，宣告在模組最外層。
// 「照你的喜好排」可以關：記在 localStorage 的 forYou（'0' 是關；沒有這個鍵就是開）。存不了就只在這次有效。
const FOR_YOU_KEY = 'forYou'

const { user, token, setUser } = useSession()
const favorites = useFavorites()
const history = useHistory()

// 偏好跟著登入的會員資料走（account.js 的 publicUser 有帶）；訪客沒有
const preferences = computed(() => user.value?.preferences ?? null)

// 推測要知道每套穿搭屬哪條路線、每件單品屬哪些路線：第一次有訊號時才去要一次，之後一直用
const outfitsById = ref(null)
const productsById = ref(null)
const themes = ref([])
let loading = null
function load() {
  if (!loading) {
    loading = Promise.all([getOutfits(), getProducts(), getThemes()])
      .then(([outfitList, productList, themeList]) => {
        outfitsById.value = new Map(outfitList.map((outfit) => [outfit.id, outfit]))
        productsById.value = new Map(productList.map((product) => [product.productId, product]))
        themes.value = themeList
      })
      .catch(() => {
        // 拿不到就當作沒有推測；下次有人問再試
        loading = null
      })
  }
  return loading
}

const hasSignals = computed(() => !!(
  (preferences.value && (preferences.value.pickedOutfitIds?.length || Object.keys(preferences.value.themes ?? {}).length))
  || favorites.count.value
  || history.count.value
))
watch(hasSignals, (yes) => {
  if (yes) load()
}, { immediate: true })

/** 等資料就位：有訊號就等載入完（舞台排序前要等，不然卡片會先排一次再跳），沒有訊號馬上回 */
function whenReady() {
  return hasSignals.value && !outfitsById.value ? load() : Promise.resolve()
}

const profile = computed(() => {
  if (!hasSignals.value || !outfitsById.value) return null
  return buildProfile({
    preferences: preferences.value,
    favorites: { products: favorites.products.value, outfits: favorites.outfits.value },
    history: { products: history.products.value, outfits: history.outfits.value },
    outfitsById: outfitsById.value,
    productsById: productsById.value,
    themes: themes.value,
  })
})

// 為你排的開關
function readForYou() {
  try {
    return localStorage.getItem(FOR_YOU_KEY) !== '0'
  } catch {
    return true
  }
}
const forYou = ref(readForYou())
function setForYou(on) {
  forYou.value = !!on
  try {
    if (on) localStorage.removeItem(FOR_YOU_KEY)
    else localStorage.setItem(FOR_YOU_KEY, '0')
  } catch {
    // 存不了就只在這次有效
  }
}

/** 存整包偏好（調查的結果）；存好的那包同時更新登入狀態裡的會員資料 */
async function savePreferences(data) {
  const saved = await account.savePreferences(token.value, data)
  setUser({ ...user.value, preferences: saved })
  return saved
}

async function clearPreferences() {
  await account.clearPreferences(token.value)
  setUser({ ...user.value, preferences: null })
}

const nameOf = (code) => themes.value.find((theme) => theme.code === code)?.name ?? code

export function useTaste() {
  return {
    profile,
    preferences,
    forYou,
    setForYou,
    whenReady,
    savePreferences,
    clearPreferences,
    themes,
    nameOf,
  }
}
