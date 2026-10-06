import { reactive } from 'vue'

// 探索區的三頁（首頁、路線頁、全部穿搭）共用同一片天空——ExploreView 裡的那一個 SkyPage。
// 每一頁掛上時把自己要的天空寫進來：時刻、天氣（null＝今天）、染色、第一屏的高度。
// 以前三頁各自一個 SkyPage，換風格等於整頁重掛（畫布重建、頂欄重畫），看起來像網頁刷新；
// 現在只換天空裡的內容，太陽與雲是慢慢移過去的。
const DEFAULTS = { hour: null, weather: null, tint: null, height: '100svh', minHeight: '36rem' }
const sky = reactive({ ...DEFAULTS })

export function useExploreSky() {
  function setSky(next = {}) {
    Object.assign(sky, DEFAULTS, next)
  }
  return { sky, setSky }
}
