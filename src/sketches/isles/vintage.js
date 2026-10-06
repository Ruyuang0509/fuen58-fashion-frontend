// 復古：一台唱盤。黑膠在轉，後面立著一道七〇年代的彩虹拱門。
import { mat, rgb } from './iso'

const wood = mat('#96623b')
const platter = mat('#dccba6')
const vinyl = rgb('#17130f')
const groove = rgb('#6b5a48')
const mustard = rgb('#e3a93f')
const cream = rgb('#f3e5c4')
const teal = rgb('#2f958a')
const burgundy = rgb('#8a2f33')
const brass = mat('#d7b061')
// 拱門的四道色帶：[外半徑, 顏色]，每一道寬 0.48
const ARCH = [
  [2.5, burgundy],
  [2.02, mustard],
  [1.54, cream],
  [1.06, teal],
]
const BAND = 0.48

export const vintage = {
  theme: 'vintage',
  kind: 'skirt',
  key: '#e3a93f',
  rise: 9,
  hang: [0.2, 0.4, 7.0],
  cloth: '#2f958a',
  ink: '#17130f',

  // 這座島自己的狀態：唱片轉到幾度
  spin: 0,

  draw(k, time, on, dt) {
    // 平常慢慢轉，被點亮時接近 33 轉（每秒約 3.5 弧度）
    this.spin += (0.45 + 3 * on) * (dt / 1000)

    k.box(-3, -3, -0.9, 6, 6, 0.9, wood)

    // 木紋
    k.plane('z', 0, (c) => {
      c.strokeStyle = k.tone(wood.dark, 0.35)
      c.lineWidth = 0.025
      c.beginPath()
      for (let y = -2.7; y < 3; y += 0.42) {
        c.moveTo(-3, y)
        c.bezierCurveTo(-1, y + 0.12, 1, y - 0.1, 3, y + 0.05)
      }
      c.stroke()
    })

    // 彩虹拱門：先畫後面那一片（深一點）當厚度，再畫正面
    for (const [depth, darken] of [[-2.95, 0.6], [-2.7, 1]]) {
      k.plane('y', depth, (c) => {
        ARCH.forEach(([radius, colour]) => {
          // 一道色帶 = 外圈的半圓接內圈的半圓；最裡面是空的，看得到後面
          c.beginPath()
          c.arc(0.1, 0, radius, 0, Math.PI)
          c.arc(0.1, 0, radius - BAND, Math.PI, 0, true)
          c.closePath()
          c.fillStyle = k.tone(colour.map((v) => v * darken))
          c.fill()
        })
      })
    }

    // 轉盤與唱片
    k.cyl(0.2, 0.4, 0, 2.5, 0.2, platter)
    k.plane('z', 0.2, (c) => {
      c.translate(0.2, 0.4)
      c.beginPath()
      c.arc(0, 0, 2.32, 0, Math.PI * 2)
      c.fillStyle = k.tone(vinyl)
      c.fill()

      // 溝紋
      c.strokeStyle = k.tone(groove, 0.5)
      c.lineWidth = 0.018
      c.beginPath()
      for (let radius = 1.02; radius < 2.25; radius += 0.11) {
        c.moveTo(radius, 0)
        c.arc(0, 0, radius, 0, Math.PI * 2)
      }
      c.stroke()

      // 反光：兩道對角的亮扇形，位置不跟著唱片轉（光源沒有動）
      c.fillStyle = k.light(cream, 0.07 + 0.09 * on)
      for (const start of [-2.2, 0.94]) {
        c.beginPath()
        c.moveTo(0, 0)
        c.arc(0, 0, 2.32, start, start + 0.42)
        c.closePath()
        c.fill()
      }

      // 中間的標籤跟著轉；上面的字線只畫一邊，才看得出它在轉
      c.rotate(this.spin)
      c.beginPath()
      c.arc(0, 0, 0.86, 0, Math.PI * 2)
      c.fillStyle = k.tone(mustard)
      c.fill()
      c.strokeStyle = k.tone(vinyl, 0.8)
      c.lineWidth = 0.05
      c.beginPath()
      c.arc(0, 0, 0.62, -0.9, 0.9)
      c.moveTo(-0.5, -0.12)
      c.lineTo(-0.2, -0.12)
      c.moveTo(-0.5, 0.08)
      c.lineTo(-0.3, 0.08)
      c.stroke()
      c.beginPath()
      c.arc(0, 0, 0.09, 0, Math.PI * 2)
      c.fillStyle = k.tone(vinyl)
      c.fill()
    })

    // 衣服的影子（落在唱片上）
    k.blob(0.2, 0.4, 0.2, 0.9, 0.3)

    // 唱臂
    k.cyl(2.45, -1.85, 0, 0.3, 0.5, brass)
    k.line([[2.45, -1.85, 0.62], [1.55, -0.55, 0.42]], k.tone(cream), 2.2)
    k.box(1.3, -0.6, 0.3, 0.34, 0.24, 0.14, brass)

    // 兩顆旋鈕
    k.cyl(-2.5, 2.45, 0, 0.24, 0.16, brass)
    k.cyl(-1.75, 2.45, 0, 0.24, 0.16, brass)
  },
}
