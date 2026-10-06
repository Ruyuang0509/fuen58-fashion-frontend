// 商店街上的店。每一間是一個風格，有自己的建築、顏色、門口的東西和一件吊著的衣服。
// 座標：x 往右、depth 往裡（畫面上是右上）、z 往上；原點在店的左前方地角。
// draw(ink, time, on) 裡 on 是 0 到 1：這間店被指著的程度。
import { INK, circle, rect, rgb } from './ink'
import { archPoints, awning, door, planter, shopWindow, signboard } from './props'

const WHITE = rgb('#fffaf4')
const CREAM = rgb('#f6ecd9')

// ── 量產型：粉紅色的小店，白色條紋遮雨棚、圓窗、到處是蝴蝶結 ──
export const ryousan = {
  theme: 'ryousan',
  kind: 'blouse',
  width: 230, // 建築正面的寬
  height: 150,
  key: '#f3b9c9', // 進店時畫面染成的顏色
  cloth: '#fffaf7',
  line: INK,
  bracket: [-12, 126], // 掛衣服的支架：在牆上的 x 與高度（負的 x = 店的左邊，衣服吊在店與店之間的空地）
  front: rgb('#f8d1db'),
  draw(ink, time, on) {
    const wall = rgb('#f8d1db')
    const pink = rgb('#e8799b')
    const mint = rgb('#bfe3d6')
    // 建築
    ink.box(0, 0, 230, 70, 150, { front: wall, side: rgb('#efb9c8'), top: rgb('#fbe3ea'), id: 1 })
    // 女兒牆上一排小圓球
    for (let i = 0; i < 8; i++) {
      const [bx, by] = ink.at(14 + i * 29, 0, 150)
      ink.shape(circle(bx, by - 5, 5, 10), WHITE, { w: 1.1, id: 10 + i })
    }
    // 門（右邊）與門上的心形小窗
    door(ink, 150, 50, 84, WHITE, { arch: true, id: 30 })
    heart(ink, 175, 60, 7, pink, 36)
    // 圓窗（左邊）
    shopWindow(ink, 38, 70, 56, 56, { round: true, id: 40 })
    // 遮雨棚：白底粉條紋，被指著時會飄
    awning(ink, 8, 108, 214, { colour: WHITE, stripe: rgb('#f4a9bf'), reach: 24, drop: 8, flutter: 0.3 + on, time, id: 60 })
    // 遮雨棚中間一個蝴蝶結
    bow(ink, 115, 118, 11, pink, 70)
    // 招牌：圓的，上面一顆心
    signboard(ink, 85, 122, 60, 20, mint, { id: 80 })
    heart(ink, 115, 132, 6, pink, 86)
    // 門口：兩盆花、一張小圓桌
    planter(ink, 20, -16, { flower: pink, id: 90 })
    planter(ink, 108, -18, { flower: rgb('#f3c0cf'), id: 100 })
    const [tx, ty] = ink.at(84, -30, 0)
    ink.stroke([[tx, ty], [tx, ty - 22]], { w: 1.8, id: 110 })
    ink.shape(circle(tx, ty - 24, 15, 14).map(([x, y]) => [x, ty - 24 + (y - (ty - 24)) * 0.45]), WHITE, { w: 1.4, id: 111 })
  },
}

// ── 龐克：深灰的 live house，紅門、海報、塗鴉、屋頂一排尖刺 ──
export const punk = {
  theme: 'punk',
  kind: 'jacket',
  width: 240,
  height: 160,
  key: '#3b3744',
  cloth: '#2c2830',
  line: rgb('#e6dcd6'),
  bracket: [-12, 134],
  front: rgb('#4a4552'),
  draw(ink, time, on) {
    const wall = rgb('#4a4552')
    const red = rgb('#cf3a35')
    const paper = rgb('#efe6d2')
    const yellow = rgb('#f2cd4a')
    ink.box(0, 0, 240, 70, 160, { front: wall, side: rgb('#3a3640'), top: rgb('#5a5563'), id: 1 })
    // 磚縫：只畫幾段，不畫滿
    for (let r = 0; r < 9; r++) {
      const z = 18 + r * 16
      const x0 = (r % 2) * 14 + 10
      for (let c = 0; c < 3; c++) {
        const x = x0 + c * 78 + (r * 7) % 20
        ink.stroke([[x, -z], [x + 22, -z]], { w: 0.9, colour: rgb('#2a2730'), alpha: 0.7, id: 10 + r * 3 + c })
      }
    }
    // 屋頂一排尖刺
    for (let i = 0; i < 10; i++) {
      const x = 10 + i * 24
      const [ax, ay] = ink.at(x, 0, 160)
      ink.shape([[ax, ay], [ax + 10, ay - 16], [ax + 20, ay]], rgb('#9b96a3'), { w: 1.3, id: 40 + i })
    }
    // 門：紅色、打了個大叉
    door(ink, 24, 52, 90, red, { id: 60, knob: false })
    ink.stroke([[30, -84], [70, -10]], { w: 2.4, colour: rgb('#f1e3dd'), id: 66 })
    ink.stroke([[70, -84], [30, -10]], { w: 2.4, colour: rgb('#f1e3dd'), id: 67 })
    // 釘死的窗：幾塊木板
    shopWindow(ink, 150, 70, 62, 48, { panes: false, glass: rgb('#2a2730'), frame: rgb('#6a6572'), id: 70 })
    for (let i = 0; i < 3; i++) ink.shape([[146 + i * 6, -76 - i * 14], [218 - i * 3, -84 - i * 14], [219 - i * 3, -92 - i * 14], [147 + i * 6, -84 - i * 14]], rgb('#9b7a55'), { w: 1.2, id: 74 + i })
    // 海報：撕過的紙，疊兩張
    ink.shape([[96, -128], [136, -126], [134, -70], [98, -74]], paper, { w: 1.2, id: 80 })
    ink.shape([[104, -116], [128, -116], [128, -104], [104, -104]], red, { w: 0.9, id: 81 })
    ink.stroke([[104, -96], [128, -96]], { w: 2.2, id: 82 })
    ink.stroke([[104, -90], [122, -90]], { w: 2.2, id: 83 })
    ink.shape([[200, -150], [232, -146], [230, -118], [202, -120]], yellow, { w: 1.2, id: 84 })
    ink.stroke([[206, -138], [226, -124]], { w: 2, id: 85 })
    // 塗鴉：一道螢光粉的草寫
    ink.stroke(
      [[20, -140], [34, -150], [48, -136], [62, -152], [78, -134], [92, -148]],
      { w: 3.2, colour: rgb('#ff6fae'), alpha: 0.9, taper: true, id: 90 },
    )
    // 門上方的招牌：黑底黃字條
    signboard(ink, 14, 100, 74, 22, rgb('#1f1c24'), { id: 95 })
    ink.stroke([[22, -112], [34, -112]], { w: 3, colour: yellow, id: 96 })
    ink.stroke([[40, -112], [78, -112]], { w: 3, colour: yellow, id: 97 })
    // 門口：兩個音箱疊著、一個垃圾桶
    const [sx, sy] = ink.at(176, -22, 0)
    ink.shape(rect(sx, sy - 34, 44, 34), rgb('#2a2730'), { w: 1.6, id: 100 })
    ink.shape(circle(sx + 22, sy - 17, 10, 12), rgb('#5a5563'), { w: 1.2, id: 101 })
    ink.shape(rect(sx + 4, sy - 62, 36, 28), rgb('#2a2730'), { w: 1.6, id: 102 })
    ink.shape(circle(sx + 22, sy - 48, 8, 12), rgb('#5a5563'), { w: 1.2, id: 103 })
    const [bx, by] = ink.at(-6, -14, 0)
    ink.shape([[bx, by], [bx + 24, by], [bx + 22, by - 30], [bx + 2, by - 30]], rgb('#6a6572'), { w: 1.5, id: 110 })
    ink.stroke([[bx - 2, by - 30], [bx + 26, by - 30]], { w: 2, id: 111 })
    // 被指著時：門縫透出紅光
    if (on > 0.02) {
      ink.ctx.fillStyle = `rgba(255,120,110,${0.35 * on})`
      ink.ctx.fillRect(24, -90, 52, 90)
    }
  },
}

// ── 蘿莉塔：薰衣草色的茶館，深紫的斜屋頂、蕾絲窗簾、鐵欄杆和玫瑰 ──
export const lolita = {
  theme: 'lolita',
  kind: 'dress',
  width: 230,
  height: 140,
  key: '#d9c7e6',
  cloth: '#8a3b52',
  line: rgb('#fbf3ea'),
  bracket: [-12, 118],
  front: rgb('#e9dcf0'),
  draw(ink, time, on) {
    const wall = rgb('#e9dcf0')
    const plum = rgb('#5e3f70')
    const wine = rgb('#8a3b52')
    const rose = rgb('#e78aa3')
    const leaf = rgb('#6f9a6c')
    ink.box(0, 0, 230, 70, 140, { front: wall, side: rgb('#d7c5e3'), top: plum, id: 1, roofless: true })
    // 斜屋頂：正面一片梯形，深紫，下緣一排小扇貝
    const roof = [[-8, -140], [238, -140], [222, -176], [8, -176]]
    ink.shape(roof, plum, { w: 2, gaps: 1, id: 10 })
    // 屋頂的側面：從正面右上角退到後面
    ink.shape([[238, -140], [222, -176], ink.at(222, 70, 176), ink.at(238, 70, 140)], rgb('#4a3059'), { w: 1.4, id: 11 })
    for (let i = 0; i < 12; i++) {
      const x = 2 + i * 20
      const pts = []
      for (let k = 0; k <= 6; k++) pts.push([x + 10 - 10 * Math.cos((k / 6) * Math.PI), -140 + 8 * Math.sin((k / 6) * Math.PI)])
      ink.shape(pts, plum, { w: 1.1, id: 20 + i })
    }
    // 老虎窗
    const [dx, dy] = ink.at(100, 24, 176)
    ink.shape([[dx, dy], [dx + 30, dy], [dx + 30, dy - 18], [dx + 15, dy - 30], [dx, dy - 18]], wall, { w: 1.4, id: 34 })
    ink.shape(circle(dx + 15, dy - 14, 6, 10), rgb('#dfe9ee'), { w: 1, id: 35 })
    // 拱門（中間）與兩扇拱窗，窗簾是蕾絲
    door(ink, 90, 50, 92, wine, { arch: true, id: 40 })
    shopWindow(ink, 22, 46, 44, 66, { arch: true, id: 50 })
    shopWindow(ink, 164, 46, 44, 66, { arch: true, id: 56 })
    // 窗簾：窗子下半掛一條蕾絲，邊是一排小半圓
    for (const x of [22, 164]) {
      ink.fill(rect(x, -80, 44, 34), WHITE, { id: 62 + x, alpha: 0.85 })
      const pts = []
      for (let i = 0; i < 5; i++) for (let k = 0; k <= 5; k++) pts.push([x + i * 8.8 + 4.4 - 4.4 * Math.cos((k / 5) * Math.PI), -80 + 4 * Math.sin((k / 5) * Math.PI)])
      ink.stroke(pts, { w: 0.9, id: 64 + x })
    }
    // 招牌：橢圓，上面一個茶壺
    const sign = signboard(ink, 80, 112, 70, 22, CREAM, { id: 70 })
    void sign
    teapot(ink, 115, 123, wine, 72)
    // 鐵欄杆：矮矮的，每根頂上一個小圈
    const [fx, fy] = ink.at(-10, -30, 0)
    ink.stroke([[fx, fy - 22], [fx + 250, fy - 22]], { w: 2, id: 80 })
    ink.stroke([[fx, fy - 6], [fx + 250, fy - 6]], { w: 1.6, id: 81 })
    for (let i = 0; i <= 10; i++) {
      const x = fx + i * 25
      ink.stroke([[x, fy], [x, fy - 30]], { w: 1.4, id: 82 + i })
      ink.stroke(circle(x, fy - 33, 3, 8), { w: 1, closed: true, id: 94 + i })
    }
    // 玫瑰叢
    for (const [x, depthAt] of [[20, -20], [200, -20]]) {
      const [bx, by] = ink.at(x, depthAt, 0)
      ink.shape(circle(bx, by - 14, 16, 12), leaf, { w: 1.4, id: 110 + x })
      for (let i = 0; i < 4; i++) ink.shape(circle(bx - 10 + i * 7, by - 18 - (i % 2) * 8, 3.4, 8), rose, { w: 0.9, id: 120 + x + i })
    }
    // 門口的蕾絲陽傘（收起來立著）
    const [px, py] = ink.at(150, -26, 0)
    ink.stroke([[px, py], [px + 4, py - 60]], { w: 1.8, id: 140 })
    ink.shape([[px - 4, py - 20], [px + 12, py - 20], [px + 5, py - 62]], WHITE, { w: 1.4, id: 141 })
    void on
  },
}

// ── 小圖案 ──

function heart(ink, cx, z, s, colour, id) {
  const pts = []
  for (let i = 0; i < 20; i++) {
    const t = (i / 20) * Math.PI * 2
    const x = 16 * Math.pow(Math.sin(t), 3)
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    pts.push([cx + (x * s) / 16, -z - (y * s) / 16])
  }
  ink.shape(pts, colour, { w: 1, id })
}

function bow(ink, cx, z, s, colour, id) {
  ink.shape([[cx, -z], [cx - s * 1.4, -z - s * 0.8], [cx - s * 1.3, -z + s * 0.7]], colour, { w: 1.1, id })
  ink.shape([[cx, -z], [cx + s * 1.4, -z - s * 0.8], [cx + s * 1.3, -z + s * 0.7]], colour, { w: 1.1, id: id + 1 })
  ink.shape(circle(cx, -z, s * 0.35, 8), colour, { w: 1, id: id + 2 })
  ink.stroke([[cx - s * 0.3, -z + s * 0.3], [cx - s * 0.7, -z + s * 1.5]], { w: 1.3, colour, id: id + 3 })
  ink.stroke([[cx + s * 0.3, -z + s * 0.3], [cx + s * 0.7, -z + s * 1.5]], { w: 1.3, colour, id: id + 4 })
}

function teapot(ink, cx, z, colour, id) {
  ink.shape(circle(cx, -z, 7, 12).map(([x, y]) => [x, -z + (y + z) * 0.8]), colour, { w: 1, id })
  ink.stroke([[cx + 6, -z - 2], [cx + 12, -z - 7], [cx + 11, -z - 1]], { w: 1.1, colour, id: id + 1 })
  ink.stroke([[cx - 7, -z - 1], [cx - 11, -z - 4], [cx - 8, -z + 2]], { w: 1.1, colour, id: id + 2 })
  ink.stroke([[cx - 3, -z - 6], [cx + 3, -z - 6]], { w: 1.2, colour, id: id + 3 })
}

export const SHOPS = [punk, ryousan, lolita]
export { archPoints }
