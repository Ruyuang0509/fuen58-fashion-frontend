// 商店街共用的零件：門、窗、遮雨棚、招牌、花盆、路燈、樹、吊著的衣服。
// 每個零件都畫在「這間店自己的座標」裡：x 往右、depth 往裡（右上）、z 往上，原點是店的左前方地角。
import { FLATS } from '@/garments/flats'
import { INK, circle, pathPoints, rect, rgb } from './ink'

const WHITE = rgb('#fffaf4')

/** 門：可以是方的或拱形的 */
export function door(ink, x, w, h, colour, { arch = false, id = 0, knob = true } = {}) {
  const pts = arch ? archPoints(x, 0, w, h) : rect(x, -h, w, h)
  ink.shape(pts, colour, { w: 1.6, id })
  // 門框裡再一圈細線
  ink.stroke(arch ? archPoints(x + 4, 0, w - 8, h - 4) : rect(x + 4, -h + 4, w - 8, h - 4), { w: 0.9, closed: true, id: id + 1 })
  if (knob) ink.stroke(circle(x + w - 9, -h * 0.45, 2, 10), { w: 1.3, closed: true, id: id + 2 })
}

/** 拱形的頂點：底邊在 z 高度 bottom，寬 w、總高 h */
export function archPoints(x, bottom, w, h) {
  const r = w / 2
  const pts = [[x, -bottom], [x, -bottom - (h - r)]]
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (i / 12) * Math.PI
    pts.push([x + r + r * Math.cos(a), -bottom - (h - r) + r * Math.sin(a)])
  }
  pts.push([x + w, -bottom])
  return pts
}

/** 窗：方窗、拱窗或圓窗；panes 畫十字窗格 */
export function shopWindow(ink, x, z, w, h, { arch = false, round = false, panes = true, glass = rgb('#dfe9ee'), frame = WHITE, id = 0 } = {}) {
  const pts = round ? circle(x + w / 2, -z - w / 2, w / 2) : arch ? archPoints(x, z, w, h) : rect(x, -z - h, w, h)
  // 窗框：比窗大一圈
  const framePts = round ? circle(x + w / 2, -z - w / 2, w / 2 + 3) : arch ? archPoints(x - 3, z - 3, w + 6, h + 6) : rect(x - 3, -z - h - 3, w + 6, h + 6)
  ink.fill(framePts, frame, { id: id + 9 })
  ink.shape(pts, glass, { w: 1.4, id })
  if (panes) {
    const cx = x + w / 2
    const top = round ? -z - w : -z - h
    ink.stroke([[cx, -z], [cx, top]], { w: 0.9, id: id + 1 })
    const mid = round ? -z - w / 2 : -z - h / 2
    ink.stroke([[x, mid], [x + w, mid]], { w: 0.9, id: id + 2 })
  }
}

/**
 * 遮雨棚：掛在牆上 z 高度、從 x 到 x+w，往觀眾方向伸出 reach，前緣垂一排半圓。
 * flutter 是風吹的幅度（0 到 1）。
 */
export function awning(ink, x, z, w, { reach = 22, drop = 9, colour, stripe, scallop = 10, flutter = 0, time = 0, id = 0 } = {}) {
  const wave = Math.sin(time * 0.006) * 3 * flutter
  const wallL = [x, -z]
  const wallR = [x + w, -z]
  const outL = [x - reach * 0.52 + 0, -z + drop + wave - reach * -0.3]
  const outR = [x + w - reach * 0.52, -z + drop + wave - reach * -0.3]
  // 往觀眾方向 = 深度為負：at(x, -reach, z - drop)
  const [oxl, oyl] = ink.at(x, -reach, z - drop - wave)
  const [oxr, oyr] = ink.at(x + w, -reach, z - drop - wave)
  const canopy = [wallL, wallR, [oxr, oyr], [oxl, oyl]]
  ink.fill(canopy, colour, { id })
  if (stripe) {
    // 直條紋：每隔一條塗另一個顏色
    const n = Math.round(w / 16)
    for (let i = 0; i < n; i += 2) {
      const a = i / n
      const b = Math.min(1, (i + 1) / n)
      ink.fill(
        [
          [x + w * a, -z],
          [x + w * b, -z],
          [oxl + (oxr - oxl) * b, oyl],
          [oxl + (oxr - oxl) * a, oyl],
        ],
        stripe,
        { id: id + 20 + i, offset: [0, 0] },
      )
    }
  }
  ink.stroke(canopy, { w: 1.6, closed: true, id: id + 1 })
  // 前緣的一排半圓
  const count = Math.max(2, Math.round((oxr - oxl) / scallop))
  const edge = []
  for (let i = 0; i < count; i++) {
    const x0 = oxl + ((oxr - oxl) * i) / count
    const x1 = oxl + ((oxr - oxl) * (i + 1)) / count
    for (let k = 0; k <= 6; k++) {
      const a = Math.PI + (k / 6) * Math.PI
      edge.push([(x0 + x1) / 2 + ((x1 - x0) / 2) * Math.cos(a), oyl - ((x1 - x0) / 2) * Math.sin(a)])
    }
  }
  ink.fill([[oxl, oyl], ...edge, [oxr, oyl]], stripe || colour, { id: id + 2, offset: [0, 0] })
  ink.stroke(edge, { w: 1.3, id: id + 3 })
  void outL
  void outR
}

/** 招牌：掛在牆上的一塊板子 */
export function signboard(ink, x, z, w, h, colour, { id = 0, round = false } = {}) {
  const pts = round ? circle(x + w / 2, -z - h / 2, w / 2) : rect(x, -z - h, w, h)
  ink.shape(pts, colour, { w: 1.8, id })
  return pts
}

/** 花盆：一個小梯形盆，上面幾叢葉子和幾點花 */
export function planter(ink, x, depth, { w = 26, leaf = rgb('#7fae7a'), flower = rgb('#e9829a'), pot = rgb('#c99a6a'), id = 0 } = {}) {
  const [ax, ay] = ink.at(x, depth, 0)
  const pts = [[ax, ay], [ax + w, ay], [ax + w - 3, ay - 14], [ax + 3, ay - 14]]
  ink.shape(pts, pot, { w: 1.5, id })
  for (let i = 0; i < 3; i++) {
    const cx = ax + 5 + (w - 10) * (i / 2)
    ink.shape(circle(cx, ay - 20 - (i % 2) * 4, 7, 10), leaf, { w: 1.1, id: id + 1 + i })
  }
  for (let i = 0; i < 4; i++) ink.shape(circle(ax + 4 + (w - 8) * (i / 3), ay - 24 - (i % 2) * 5, 2.6, 8), flower, { w: 0.9, id: id + 5 + i })
}

/** 路燈 */
export function lamp(ink, x, depth, { h = 120, id = 0 } = {}) {
  const [bx, by] = ink.at(x, depth, 0)
  ink.shape(rect(bx - 6, by - 6, 12, 6), rgb('#6a6560'), { w: 1.4, id })
  ink.stroke([[bx, by - 6], [bx, by - h]], { w: 2.6, id: id + 1 })
  ink.stroke([[bx, by - h], [bx + 16, by - h - 8]], { w: 2, id: id + 2 })
  ink.shape(rect(bx + 10, by - h - 22, 14, 14), rgb('#f6e3a3'), { w: 1.5, id: id + 3 })
}

/** 一棵圓圓的樹 */
export function tree(ink, x, depth, { size = 1, leaf = rgb('#8dbb82'), id = 0 } = {}) {
  const [bx, by] = ink.at(x, depth, 0)
  ink.stroke([[bx, by], [bx, by - 26 * size]], { w: 2.6, id })
  ink.shape(circle(bx, by - 40 * size, 20 * size, 16), leaf, { w: 1.6, gaps: 1, id: id + 1 })
  ink.shape(circle(bx - 12 * size, by - 30 * size, 12 * size, 12), leaf, { w: 1.2, id: id + 2 })
  ink.shape(circle(bx + 13 * size, by - 32 * size, 13 * size, 12), leaf, { w: 1.2, id: id + 3 })
}

// ── 吊著的衣服 ──

const DASH_ON = 3
const DASH_OFF = 2

/**
 * 掛在支架上的衣服：pivot 是衣架掛點在店座標裡的畫面位置，size 是衣服高度（像素），
 * angle 是晃到幾度；cloth 布色、line 線色。
 */
export function hangingGarment(ink, kind, pivot, size, angle, cloth, line = INK, id = 100) {
  const flat = FLATS[kind]
  const k = size / 160
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  // 衣服格子裡的點 → 畫面：以掛點 (60, hang) 為軸旋轉再放大
  const place = ([x, y]) => {
    const dx = (x - 60) * k
    const dy = (y - flat.hang) * k
    return [pivot[0] + dx * cos - dy * sin, pivot[1] + dx * sin + dy * cos]
  }
  // 衣架
  const hanger = flat.bar
    ? [[[60, flat.hang - 8], [60, flat.hang - 1]], [[34, flat.hang - 1], [86, flat.hang - 1]]]
    : [[[60, flat.hang - 8], [60, flat.hang - 3]], [[38, flat.hang + 7], [60, flat.hang - 3], [82, flat.hang + 7]]]
  hanger.forEach((seg, i) => ink.stroke(seg.map(place), { w: 1.3, colour: line, id: id + 50 + i }))

  pathPoints(flat.body, 3).forEach((piece, i) => ink.shape(piece.pts.map(place), cloth, { w: 2, gaps: 2, id: id + i, line }))
  flat.seams.forEach((d, s) => pathPoints(d, 3).forEach((piece, i) => ink.stroke(piece.pts.map(place), { w: 1, closed: piece.closed, colour: line, id: id + 10 + s * 3 + i })))
  // 車縫線：每隔幾個點斷一下，變成虛線
  flat.stitches.forEach((d, s) =>
    pathPoints(d, 3).forEach((piece) => {
      const pts = piece.pts.map(place)
      for (let i = 0; i + DASH_ON < pts.length; i += DASH_ON + DASH_OFF) ink.stroke(pts.slice(i, i + DASH_ON + 1), { w: 0.9, colour: line, taper: false, id: id + 30 + s + i })
    }),
  )
  flat.dots.forEach(([x, y], i) => {
    const [px, py] = place([x, y])
    ink.shape(circle(px, py, 1.8 * k * 1.1 + 0.8, 8), line, { w: 0.8, id: id + 40 + i, line })
  })
}
