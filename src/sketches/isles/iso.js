// 等角投影的畫筆。
//
// 每座小島都是用「立體座標」想的：x 往右下、y 往左下、z 往上。
// 這支畫筆負責把立體座標換成畫面上的點，並提供幾種現成的形體（方塊、圓柱、圓錐、球）。
// 光固定從左上方來：頂面最亮、朝左的面次之、朝右的面最暗，所以每個材質有三個深淺。
import { FLATS } from '@/garments/flats'

const COS = Math.cos(Math.PI / 6)
const SIN = 0.5
const ROOT2 = Math.SQRT2

export const NIGHT = [11, 13, 23] // 底色：夜裡的深藍黑
const SHADOW_TINT = [22, 26, 56] // 暗面往這個偏藍的深色靠，暗面才不會髒

export const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
export const css = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`

/** 材質：給一個顏色，算出頂面、亮面、暗面三個深淺。 */
export function mat(hex, lit = 0.8, dark = 0.58) {
  const top = rgb(hex)
  return {
    top,
    lit: mix(top.map((v) => v * lit), SHADOW_TINT, 0.08),
    dark: mix(top.map((v) => v * dark), SHADOW_TINT, 0.2),
  }
}

export function createPen(ctx) {
  const pen = {
    ctx,
    ox: 0, // 這座島的原點在畫面上的位置
    oy: 0,
    u: 20, // 立體座標的 1 等於畫面上幾個像素
    shade: 0, // 0 = 全亮；越接近 1 越沉進夜色裡

    /** 立體座標 → 畫面座標 */
    at(x, y, z = 0) {
      return [pen.ox + (x - y) * COS * pen.u, pen.oy + (x + y) * SIN * pen.u - z * pen.u]
    },

    /** 物體的顏色：會跟著這座島的明暗一起沉下去 */
    tone(c, a = 1) {
      return css(mix(c, NIGHT, pen.shade), a)
    },

    /** 光的顏色：燈、窗、火，不受明暗影響 */
    light(c, a = 1) {
      return css(c, a)
    },

    /** 填一個多邊形；seal 會用同色描一圈細邊，把相鄰兩面之間的縫蓋掉 */
    poly(points, color, seal = true) {
      ctx.beginPath()
      points.forEach((q, i) => {
        const [sx, sy] = pen.at(q[0], q[1], q[2])
        if (i) ctx.lineTo(sx, sy)
        else ctx.moveTo(sx, sy)
      })
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
      if (seal) {
        ctx.strokeStyle = color
        ctx.lineWidth = 0.7
        ctx.stroke()
      }
    },

    /** 立體折線 */
    line(points, color, width = 1) {
      ctx.beginPath()
      points.forEach((q, i) => {
        const [sx, sy] = pen.at(q[0], q[1], q[2])
        if (i) ctx.lineTo(sx, sy)
        else ctx.moveTo(sx, sy)
      })
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()
    },

    /** 方塊：從 (x, y, z) 這個角開始，寬 w、深 d、高 h */
    box(x, y, z, w, d, h, m) {
      pen.poly([[x, y + d, z + h], [x + w, y + d, z + h], [x + w, y + d, z], [x, y + d, z]], pen.tone(m.lit))
      pen.poly([[x + w, y, z + h], [x + w, y + d, z + h], [x + w, y + d, z], [x + w, y, z]], pen.tone(m.dark))
      pen.poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], pen.tone(m.top))
    },

    /** 圓柱：底面圓心 (cx, cy, z)、半徑 r、高 h。側面用左亮右暗的漸層 */
    cyl(cx, cy, z, r, h, m) {
      const [sx, sy] = pen.at(cx, cy, z)
      const rx = r * pen.u * COS * ROOT2
      const ry = r * pen.u * SIN * ROOT2
      const rise = h * pen.u
      const side = ctx.createLinearGradient(sx - rx, 0, sx + rx, 0)
      side.addColorStop(0, pen.tone(m.lit))
      side.addColorStop(0.45, pen.tone(m.lit))
      side.addColorStop(1, pen.tone(m.dark))
      ctx.beginPath()
      ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI)
      ctx.lineTo(sx - rx, sy - rise)
      ctx.ellipse(sx, sy - rise, rx, ry, 0, Math.PI, 0, true)
      ctx.closePath()
      ctx.fillStyle = side
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(sx, sy - rise, rx, ry, 0, 0, Math.PI * 2)
      ctx.fillStyle = pen.tone(m.top)
      ctx.fill()
    },

    /** 圓錐：底面圓心 (cx, cy, z)、半徑 r、高 h */
    cone(cx, cy, z, r, h, m) {
      const [sx, sy] = pen.at(cx, cy, z)
      const rx = r * pen.u * COS * ROOT2
      const ry = r * pen.u * SIN * ROOT2
      const side = ctx.createLinearGradient(sx - rx, 0, sx + rx, 0)
      side.addColorStop(0, pen.tone(m.top))
      side.addColorStop(0.5, pen.tone(m.lit))
      side.addColorStop(1, pen.tone(m.dark))
      ctx.beginPath()
      ctx.moveTo(sx, sy - h * pen.u)
      ctx.lineTo(sx + rx, sy)
      ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI)
      ctx.closePath()
      ctx.fillStyle = side
      ctx.fill()
    },

    /** 球：球心 (x, y, z)、半徑 r */
    ball(x, y, z, r, m) {
      const [sx, sy] = pen.at(x, y, z)
      const R = r * pen.u
      const glow = ctx.createRadialGradient(sx - R * 0.35, sy - R * 0.45, R * 0.05, sx, sy, R)
      glow.addColorStop(0, pen.tone(m.top))
      glow.addColorStop(0.55, pen.tone(m.lit))
      glow.addColorStop(1, pen.tone(m.dark))
      ctx.beginPath()
      ctx.arc(sx, sy, R, 0, Math.PI * 2)
      ctx.fillStyle = glow
      ctx.fill()
    },

    /** 落在地上的影子：一個壓扁的深色圓 */
    blob(x, y, z, r, alpha = 0.3) {
      const [sx, sy] = pen.at(x, y, z)
      ctx.beginPath()
      ctx.ellipse(sx, sy, r * pen.u * COS * ROOT2, r * pen.u * SIN * ROOT2, 0, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(8,9,18,${alpha})`
      ctx.fill()
    },

    /**
     * 在一個平面上畫圖。進到 draw 裡面之後，就當成一般的平面畫布來畫，單位是立體座標的 1。
     *   plane('z', 高度)  地板或桌面，座標是 (x, y)
     *   plane('x', 位置)  朝右的牆面，座標是 (y, z)，z 往上
     *   plane('y', 位置)  朝左的牆面，座標是 (x, z)，z 往上
     * 做法是把畫布的座標軸換成那個平面的兩個方向，所以畫圓會自動變成等角的橢圓。
     */
    plane(axis, value, draw) {
      const origin = axis === 'z' ? pen.at(0, 0, value) : axis === 'x' ? pen.at(value, 0, 0) : pen.at(0, value, 0)
      const first = axis === 'z' ? pen.at(1, 0, value) : axis === 'x' ? pen.at(value, 1, 0) : pen.at(1, value, 0)
      const second = axis === 'z' ? pen.at(0, 1, value) : axis === 'x' ? pen.at(value, 0, 1) : pen.at(0, value, 1)
      ctx.save()
      ctx.transform(first[0] - origin[0], first[1] - origin[1], second[0] - origin[0], second[1] - origin[1], origin[0], origin[1])
      draw(ctx)
      ctx.restore()
    },
  }
  return pen
}

// ── 掛著的衣服 ──────────────────────────────────────────────────────────

const flatCache = {}
function flatPaths(kind) {
  if (!flatCache[kind]) {
    const flat = FLATS[kind]
    flatCache[kind] = {
      body: new Path2D(flat.body),
      seams: flat.seams.map((d) => new Path2D(d)),
      stitches: flat.stitches.map((d) => new Path2D(d)),
      dots: flat.dots,
      hang: flat.hang,
      bar: flat.bar,
    }
  }
  return flatCache[kind]
}

/**
 * 畫一件掛著的款式圖。(sx, sy) 是衣架掛點在畫面上的位置，衣服以這一點為軸左右晃。
 *   size   衣服那個 160 高的格子要畫成幾個像素高
 *   angle  目前晃到幾度（弧度）
 *   fill   布的顏色；ink 線的顏色
 */
export function drawHanging(ctx, kind, sx, sy, size, angle, fill, ink) {
  const flat = flatPaths(kind)
  const k = size / 160
  ctx.save()
  ctx.translate(sx, sy)
  ctx.rotate(angle)
  ctx.scale(k, k)
  ctx.translate(-60, -flat.hang)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // 衣架：上衣用三角衣架，褲和裙用橫桿
  ctx.strokeStyle = ink
  ctx.lineWidth = 1.1 / k
  ctx.beginPath()
  if (flat.bar) {
    ctx.moveTo(60, flat.hang - 7)
    ctx.lineTo(60, flat.hang - 1)
    ctx.moveTo(34, flat.hang - 1)
    ctx.lineTo(86, flat.hang - 1)
  } else {
    ctx.moveTo(60, flat.hang - 7)
    ctx.lineTo(60, flat.hang - 3)
    ctx.moveTo(38, flat.hang + 7)
    ctx.lineTo(60, flat.hang - 3)
    ctx.lineTo(82, flat.hang + 7)
  }
  ctx.stroke()

  ctx.fillStyle = fill
  ctx.fill(flat.body)
  ctx.lineWidth = 1.5 / k
  ctx.stroke(flat.body)
  ctx.lineWidth = 0.9 / k
  flat.seams.forEach((seam) => ctx.stroke(seam))
  ctx.setLineDash([3, 2.6])
  flat.stitches.forEach((stitch) => ctx.stroke(stitch))
  ctx.setLineDash([])
  ctx.fillStyle = ink
  flat.dots.forEach(([x, y]) => {
    ctx.beginPath()
    ctx.arc(x, y, 1.7, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.restore()
}
