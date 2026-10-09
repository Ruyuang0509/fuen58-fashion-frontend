// 訂單狀態的共用規則（第十七輪子輪 1）：狀態機的順序、列表的篩選、小標的調子、時間線的組法。畫面只讀這裡，假 API 在 api/account.js。
// 狀態機（契約 §8、企劃前段 §7.2）：待付款 → 已付款 → 出貨中 → 已送達 → 完成；另有已取消。
// 貨到付款（這一輪的提案，10/12 確認）：待付款（不逾時）→ 出貨中 → 已送達（送達時付款）→ 完成，所以少「已付款」這一步。
export const ORDER_FLOW = ['待付款', '已付款', '出貨中', '已送達', '完成']

export const isCod = (order) => order?.payment?.method === 'cod'

export const flowFor = (order) => (isCod(order) ? ORDER_FLOW.filter((status) => status !== '已付款') : ORDER_FLOW)

// 小標的調子：wait 等人付款、go 在路上、done 完成、off 取消。文字永遠在，顏色只是輔助
const TONES = { 待付款: 'wait', 已付款: 'go', 出貨中: 'go', 已送達: 'go', 完成: 'done', 已取消: 'off' }
export const statusTone = (status) => TONES[status] ?? 'off'

export const cancelReasonText = (order) => (order?.cancelReason === 'timeout' ? '付款逾時，自動取消' : '自行取消')

// 訂單紀錄的篩選；code 寫在網址 ?status=，空的就是全部
export const STATUS_FILTERS = [
  { code: '', label: '全部', match: () => true },
  { code: 'unpaid', label: '待付款', match: (order) => order.status === '待付款' },
  { code: 'active', label: '進行中', match: (order) => ['已付款', '出貨中', '已送達'].includes(order.status) },
  { code: 'done', label: '完成', match: (order) => order.status === '完成' },
  { code: 'cancelled', label: '已取消', match: (order) => order.status === '已取消' },
]

/**
 * 時間線：狀態機的每一步配上 history 裡第一次走到的時間。
 * state：done 走過｜current 目前這一步｜todo 還沒到。
 * 已取消的訂單：走過的步照留，後面接一個 cancelled 節點（原因在 note），還沒到的步不畫。
 */
export function buildTimeline(order) {
  if (!order) return []
  const reached = new Map()
  for (const entry of order.history ?? []) {
    if (!reached.has(entry.status)) reached.set(entry.status, entry)
  }
  const cancelled = order.status === '已取消'
  const nodes = flowFor(order).map((status) => {
    const entry = reached.get(status)
    let state = 'todo'
    if (entry) state = status === order.status ? 'current' : 'done'
    return { status, at: entry?.at ?? null, note: entry?.note ?? null, state, cancelled: false }
  })
  if (!cancelled) return nodes

  const lastReached = nodes.reduce((last, node, index) => (node.state === 'todo' ? last : index), -1)
  const entry = reached.get('已取消')
  return [
    ...nodes.slice(0, lastReached + 1),
    { status: '已取消', at: entry?.at ?? null, note: entry?.note ?? cancelReasonText(order), state: 'current', cancelled: true },
  ]
}
