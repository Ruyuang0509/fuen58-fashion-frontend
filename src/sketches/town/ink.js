// 手繪風的畫筆。
//
// 這支筆把「電腦畫的線」變成「手畫的線」，用的是使用者在日系插畫課裡學到的四件事：
//   線條中斷   長的外輪廓偶爾斷一小段，腦子會自己把它接起來，畫面比較不累
//   外粗內細   外輪廓粗、裡面的細節線細
//   線有粗細   一筆的頭尾細、中段粗，而且粗細一路微微變化
//   顏色出界   填色和線稿故意錯開一點點，像用色鉛筆沒塗準
// 另外線條會「沸騰」：每隔一小段時間換一組抖動，線稿看起來像一格一格手畫的動畫。
//
// 立體用的是斜投影（商店街地圖那種畫法）：正面是原樣的平面，深度往右上方縮一半。

export const PAPER = '#f7f2e8'
export const INK = [58, 50, 46] // 線的顏色：帶一點棕的深灰，不用純黑

const DEPTH_X = 0.52 // 深度每 1 像素在畫面上往右幾像素
const DEPTH_Y = 0.3 // 往上幾像素

export const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`
export const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

// 可重現的雜訊：同樣的輸入永遠給同樣的輸出，線條才不會每一幀都亂跳
function hash(a, b, c) {
  let h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453
  return h - Math.floor(h) // 0 到 1
}

/** 把一組頂點之間每段切成不超過 step 像素的小段，線才有地方抖 */
export function densify(points, step = 6, closed = false) {
  const out = []
  const n = closed ? points.length : points.length - 1
  for (let i = 0; i < n; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[(i + 1) % points.length]
    const parts = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step))
    for (let s = 0; s < parts; s++) out.push([x0 + ((x1 - x0) * s) / parts, y0 + ((y1 - y0) * s) / parts])
  }
  if (!closed) out.push(points[points.length - 1])
  return out
}

export const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]

export function circle(cx, cy, r, n = 28) {
  const pts = []
  for (let i = 0; i < n; i++) pts.push([cx + r * Math.cos((i / n) * Math.PI * 2), cy + r * Math.sin((i / n) * Math.PI * 2)])
  return pts
}

/** SVG 路徑字串 → 頂點。用瀏覽器自己的 getPointAtLength 取樣，取過一次就記起來 */
const pathCache = new Map()
export function pathPoints(d, step = 4) {
  const key = d + '|' + step
  if (!pathCache.has(key)) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    el.setAttribute('d', d)
    svg.appendChild(el)
    // 一個 d 裡可能有好幾段（M 開頭），分開取，每段一條線
    const pieces = d.match(/M[^M]+/g) || [d]
    const lines = pieces.map((piece) => {
      el.setAttribute('d', piece)
      const length = el.getTotalLength()
      const n = Math.max(2, Math.ceil(length / step))
      const pts = []
      for (let i = 0; i <= n; i++) {
        const p = el.getPointAtLength((length * i) / n)
        pts.push([p.x, p.y])
      }
      return { pts, closed: /z\s*$/i.test(piece) }
    })
    pathCache.set(key, lines)
  }
  return pathCache.get(key)
}

export function createInk(ctx) {
  const ink = {
    ctx,
    phase: 0, // 沸騰：換一個數字，所有線的抖動就換一組
    boil: 1, // 抖動的幅度（像素）
    colour: 1, // 0 = 只剩鉛筆線稿；1 = 全上色
    // 斜投影的原點：地面上 (x, depth) 與高度 z → 畫面
    at(x, depth, z = 0) {
      return [x + depth * DEPTH_X, -depth * DEPTH_Y - z]
    },

    /**
     * 畫一條手繪線。pts 是畫面座標的頂點。
     *   w       最粗的地方幾像素
     *   taper   頭尾收細
     *   gaps    讓線在幾個地方斷掉（只給長的外輪廓用）
     *   id      同一條線要有固定的抖法，給它一個不變的編號
     */
    stroke(pts, { w = 1.6, colour = INK, alpha = 1, taper = true, gaps = 0, closed = false, id = 0, amp = ink.boil } = {}) {
      const dense = densify(pts, 5, closed)
      const total = dense.length
      if (total < 2) return
      const k1 = 0.9 + hash(id, 1, 0) * 0.6
      const k2 = 2.3 + hash(id, 2, 0) * 1.2
      const p1 = hash(id, 3, ink.phase) * 6.28
      const p2 = hash(id, 4, ink.phase) * 6.28
      // 斷線的位置：沿著線的比例
      const cuts = []
      for (let g = 0; g < gaps; g++) cuts.push([hash(id, 10 + g, 0) * 0.8 + 0.1, 0.03 + hash(id, 20 + g, 0) * 0.03])

      ctx.strokeStyle = css(colour, alpha)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      let moved = false
      for (let i = 0; i < total; i++) {
        const t = i / (total - 1)
        const [x, y] = dense[i]
        // 往線的垂直方向抖；抖的量是兩個不同頻率的波疊起來，慢慢變、不會毛
        const [nx, ny] = dense[Math.min(i + 1, total - 1)]
        const [px, py] = dense[Math.max(i - 1, 0)]
        const dx = nx - px
        const dy = ny - py
        const len = Math.hypot(dx, dy) || 1
        const wob = amp * (Math.sin(t * Math.PI * 2 * k1 + p1) + 0.5 * Math.sin(t * Math.PI * 2 * k2 + p2))
        const wx = x - (dy / len) * wob
        const wy = y + (dx / len) * wob
        const inGap = cuts.some(([at, size]) => t > at && t < at + size)
        if (inGap || !moved) {
          if (!inGap) {
            ctx.beginPath()
            ctx.moveTo(wx, wy)
            moved = true
          } else if (moved) {
            ctx.stroke()
            moved = false
          }
          continue
        }
        // 粗細：頭尾細、中間粗，再加一點點隨機
        const thick = (taper ? 0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, Math.max(0, t))) : 1) * (0.85 + 0.3 * hash(id, i, 7))
        ctx.lineWidth = w * thick
        ctx.lineTo(wx, wy)
        // 每一小段自己 stroke，粗細才會變；round cap 把接縫蓋掉
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(wx, wy)
      }
      if (closed && moved) {
        const [x0, y0] = dense[0]
        ctx.lineTo(x0, y0)
        ctx.stroke()
      }
    },

    /** 填色：故意往右下錯開一點，顏色會稍微出界；ink.colour 低的時候整片淡掉變成線稿 */
    fill(pts, colour, { alpha = 1, offset = [1.3, 1.1], id = 0 } = {}) {
      const dense = densify(pts, 8, true)
      ctx.beginPath()
      dense.forEach(([x, y], i) => {
        const wob = ink.boil * 0.6 * Math.sin(i * 0.7 + hash(id, 5, ink.phase) * 6.28)
        if (i) ctx.lineTo(x + offset[0] + wob, y + offset[1])
        else ctx.moveTo(x + offset[0], y + offset[1])
      })
      ctx.closePath()
      ctx.fillStyle = css(colour, alpha * ink.colour)
      ctx.fill()
    },

    /** 排線：在一個形狀裡畫一排斜線，當陰影用 */
    hatch(pts, { angle = -0.9, gap = 5, colour = INK, alpha = 0.35, w = 0.9, id = 0 } = {}) {
      ctx.save()
      ctx.beginPath()
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.closePath()
      ctx.clip()
      const xs = pts.map((p) => p[0])
      const ys = pts.map((p) => p[1])
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2
      const reach = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + gap
      const ux = Math.cos(angle)
      const uy = Math.sin(angle)
      let n = 0
      for (let s = -reach; s <= reach; s += gap, n++) {
        // 每一條排線的起點終點都稍微不齊，才像手畫的
        const jitter = (hash(id, n, 1) - 0.5) * gap * 0.8
        const ox = cx - uy * s + ux * jitter
        const oy = cy + ux * s + uy * jitter
        ink.stroke([[ox - ux * reach, oy - uy * reach], [ox + ux * reach, oy + uy * reach]], { w, colour, alpha: alpha * ink.colour, taper: true, id: id * 31 + n, amp: ink.boil * 0.5 })
      }
      ctx.restore()
    },

    /** 一個形狀：先填色、再描外輪廓 */
    shape(pts, colour, { w = 1.8, gaps = 0, id = 0, alpha = 1, line = INK, lineAlpha = 1 } = {}) {
      if (colour) ink.fill(pts, colour, { id, alpha })
      ink.stroke(pts, { w, gaps, closed: true, id, colour: line, alpha: lineAlpha })
    },

    /**
     * 斜投影的方塊：地面左前角 (x, depth)，寬 w、深 d、高 h。
     * 正面原樣、右側面往右上縮，頂面是平行四邊形。右側面用排線當陰影。
     */
    box(x, depth, w, d, h, { front, side, top, id = 0, w1 = 2, w2 = 1.1, roofless = false }) {
      const A = ink.at(x, depth, 0)
      const B = ink.at(x + w, depth, 0)
      const C = ink.at(x + w, depth, h)
      const D = ink.at(x, depth, h)
      const Bb = ink.at(x + w, depth + d, 0)
      const Cb = ink.at(x + w, depth + d, h)
      const Db = ink.at(x, depth + d, h)
      // 側面
      ink.fill([B, Bb, Cb, C], side || front, { id: id + 1 })
      ink.hatch([B, Bb, Cb, C], { id: id + 1, gap: 5.5, alpha: 0.28 })
      // 頂面
      if (!roofless) ink.fill([D, C, Cb, Db], top || front, { id: id + 2 })
      // 正面
      ink.fill([A, B, C, D], front, { id })
      // 線：外輪廓粗，中間共用的邊細
      ink.stroke([A, B, Bb, Cb, Db, D], { w: w1, closed: true, gaps: 1, id })
      ink.stroke([B, C], { w: w2, id: id + 3 })
      ink.stroke([C, D], { w: w2, id: id + 4 })
      ink.stroke([C, Cb], { w: w2, id: id + 5 })
      return { A, B, C, D, Bb, Cb, Db }
    },
  }
  return ink
}
