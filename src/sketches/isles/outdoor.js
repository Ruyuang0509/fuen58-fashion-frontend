// 戶外：一座用等高線疊出來的山。山腳有帳篷和幾棵杉樹，山頂有雪和一面旗。
import { mat, mix, rgb } from './iso'

const TAU = Math.PI * 2
const STEP = 0.46 // 每一層等高線的高度

// 每一層的半徑與顏色：由下往上，越高越小、越亮，最上面是雪
const LEVELS = [
  { radius: 3.3, hex: '#2f5a45' },
  { radius: 2.2, hex: '#3d7a53' },
  { radius: 1.6, hex: '#57965f' },
  { radius: 1.1, hex: '#80b271' },
  { radius: 0.68, hex: '#b4d097' },
  { radius: 0.33, hex: '#f2f5ec' },
]

const pineMat = mat('#1f5a41')
const pineDeep = mat('#17473a')
const tent = mat('#ee6a3c')
const trunk = rgb('#3a2a1f')
const fire = [255, 208, 130]
const flag = rgb('#ee6a3c')
const cloud = rgb('#eef1ea')

// 可重現的亂數：同一個種子每次給出同一串數字
function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function inside(points, x, y) {
  let hit = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]
    const [xj, yj] = points[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

export const outdoor = {
  theme: 'outdoor',
  kind: 'vest',
  key: '#3d7a53',
  rise: 9,
  hang: [1.4, -0.2, 7.5],
  round: true, // 底座是圓的，影子也要畫圓的
  cloth: '#f4c644',
  ink: '#1c2a22',

  hill: null,

  /** 用一個種子把山的輪廓算出來。換種子，每一層的凹凸就不一樣。 */
  build(seed = 7) {
    const rand = seeded(seed)
    let cx = 0
    let cy = 0
    this.hill = LEVELS.map((level, i) => {
      // 第一層往左後方退得多，讓右前方留一塊平地放帳篷；之後每層只退一點
      if (i === 1) {
        cx -= 0.55
        cy -= 0.22
      } else if (i > 1) {
        cx -= 0.17
        cy -= 0.07
      }
      // 輪廓 = 圓 + 四個不同頻率的起伏。起伏的相位用亂數，幅度是定的：
      // 要的是「大致是圓、邊緣有點不規則」，所以相位均勻分布、幅度不隨機。
      const phases = [1, 2, 3, 5].map(() => rand() * TAU)
      const amps = [0.035, 0.03, 0.022, 0.015]
      const points = []
      for (let j = 0; j < 56; j++) {
        const angle = (j / 56) * TAU
        let wobble = 1
        phases.forEach((phase, n) => (wobble += amps[n] * Math.sin([1, 2, 3, 5][n] * angle + phase)))
        points.push([cx + level.radius * wobble * Math.cos(angle), cy + level.radius * wobble * Math.sin(angle)])
      }
      return { points, m: mat(level.hex), bottom: i === 0 ? -0.5 : (i - 1) * STEP, top: i * STEP, cx, cy }
    })
  },

  /** 地面在 (x, y) 這一點有多高 */
  heightAt(x, y) {
    for (let i = this.hill.length - 1; i >= 0; i--) if (inside(this.hill[i].points, x, y)) return this.hill[i].top
    return 0
  },

  draw(k, time, on) {
    if (!this.hill) this.build()

    // 一層一層往上疊。每一層先畫看得到的側面，再蓋上頂面
    this.hill.forEach((level) => {
      const { points, m, bottom, top } = level
      for (let j = 0; j < points.length; j++) {
        const [x1, y1] = points[j]
        const [x2, y2] = points[(j + 1) % points.length]
        // 這一小段邊朝外的方向
        const nx = y2 - y1
        const ny = x1 - x2
        if (nx + ny <= 0) continue // 朝後面的看不到
        const length = Math.hypot(nx, ny)
        // 朝左亮、朝右暗，中間平滑過渡
        const facing = Math.min(1, Math.max(0, (ny / length - nx / length + 1) / 2))
        k.poly([[x1, y1, top], [x2, y2, top], [x2, y2, bottom], [x1, y1, bottom]], k.tone(mix(m.dark, m.lit, facing)))
      }
      k.poly(points.map(([x, y]) => [x, y, top]), k.tone(m.top))
    })

    // 山上的東西，由後往前畫
    const things = [
      { x: 2.75, y: -0.75, pine: 0.7 },
      { x: -2.55, y: 0.9, pine: 0.95 },
      { x: 2.5, y: 0.45, pine: 1 },
      { x: -1.75, y: 2.05, pine: 1.1 },
      { x: 1.75, y: 1.65, tent: true },
      { x: -0.5, y: 2.75, pine: 0.8 },
    ].sort((a, b) => a.x + a.y - (b.x + b.y))

    things.forEach((thing) => {
      const ground = this.heightAt(thing.x, thing.y)
      if (thing.pine) {
        const s = thing.pine
        k.blob(thing.x + 0.12, thing.y + 0.12, ground, 0.42 * s, 0.25)
        k.line([[thing.x, thing.y, ground], [thing.x, thing.y, ground + 0.4 * s]], k.tone(trunk), 2.2)
        k.cone(thing.x, thing.y, ground + 0.28 * s, 0.5 * s, 0.85 * s, pineDeep)
        k.cone(thing.x, thing.y, ground + 0.72 * s, 0.4 * s, 0.75 * s, pineMat)
        k.cone(thing.x, thing.y, ground + 1.12 * s, 0.28 * s, 0.62 * s, pineMat)
      } else {
        // 帳篷：正面一個三角形，側面一片斜的布
        const x0 = thing.x - 0.5
        const x1 = thing.x + 0.5
        const y0 = thing.y - 0.45
        const y1 = thing.y + 0.45
        const peak = ground + 1.05
        k.blob(thing.x + 0.2, thing.y + 0.2, ground, 0.8, 0.22)
        k.poly([[x1, y0, ground], [x1, y1, ground], [thing.x, y1, peak], [thing.x, y0, peak]], k.tone(tent.dark))
        k.poly([[x0, y1, ground], [x1, y1, ground], [thing.x, y1, peak]], k.tone(tent.top))
        // 帳篷的門：被點亮時裡面有燈
        k.poly(
          [[thing.x - 0.2, y1, ground], [thing.x + 0.2, y1, ground], [thing.x, y1, ground + 0.72]],
          on > 0.02 ? k.light(fire, 0.35 + 0.65 * on) : k.tone(trunk),
        )
      }
    })

    // 山頂的旗：旗面跟著風擺
    const summit = this.hill[this.hill.length - 1]
    const flutter = Math.sin(time * 0.004) * 0.12 * (0.5 + on)
    k.line([[summit.cx, summit.cy, summit.top], [summit.cx, summit.cy, summit.top + 1.25]], k.tone(trunk), 1.6)
    k.poly(
      [
        [summit.cx, summit.cy, summit.top + 1.25],
        [summit.cx + 0.7, summit.cy - 0.1, summit.top + 1.05 + flutter],
        [summit.cx, summit.cy, summit.top + 0.82],
      ],
      k.tone(flag),
    )

    // 一朵雲，慢慢來回飄
    const { ctx } = k
    const [sx, sy] = k.at(-2.6 + Math.sin(time * 0.00017) * 0.7, 1.2, 4.9)
    ctx.fillStyle = k.tone(cloud, 0.86)
    ctx.beginPath()
    ctx.ellipse(sx, sy, k.u * 1.15, k.u * 0.3, 0, 0, TAU)
    ctx.ellipse(sx - k.u * 0.35, sy - k.u * 0.22, k.u * 0.5, k.u * 0.3, 0, 0, TAU)
    ctx.ellipse(sx + k.u * 0.3, sy - k.u * 0.3, k.u * 0.6, k.u * 0.38, 0, 0, TAU)
    ctx.fill()
  },
}
