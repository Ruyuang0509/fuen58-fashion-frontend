// 正式：一間訂製店的角落。深藍的牆、兩扇拱窗、人字拼木地板、一面立鏡、一塊圓地毯。
import { mat, rgb } from './iso'

const plinth = mat('#252f5c')
const floor = mat('#8f6a45')
const floorLine = rgb('#5b3f27')
const navy = mat('#33437c')
const brass = rgb('#d9b45f')
const brassMat = mat('#d9b45f')
const dusk = rgb('#56669a') // 沒開燈時窗戶的顏色
const glow = [248, 230, 176] // 開燈後窗戶的顏色
const rug = rgb('#7c2b35')
const mirror = rgb('#9fb0cf')
const ivory = rgb('#ece5d6')

// 拱窗：下面是長方形，上面是半圓。座標在牆面上，(沿牆的位置, 高度)
function archWindow(c, left, width, sill, spring) {
  const radius = width / 2
  c.beginPath()
  c.moveTo(left, sill)
  c.lineTo(left, spring)
  c.arc(left + radius, spring, radius, Math.PI, 0, true)
  c.lineTo(left + width, sill)
  c.closePath()
}

export const formal = {
  theme: 'formal',
  kind: 'coat',
  key: '#33437c',
  rise: 9,
  hang: [0.4, 0.6, 7.1],
  cloth: '#cba468',
  ink: '#1b1a24',

  draw(k, time, on) {
    k.box(-3.3, -3.3, -0.6, 6.6, 6.6, 0.3, plinth)
    k.box(-3, -3, -0.3, 6, 6, 0.3, floor)

    // 人字拼地板
    k.plane('z', 0, (c) => {
      c.save()
      c.beginPath()
      c.rect(-3, -3, 6, 6)
      c.clip()
      c.strokeStyle = k.tone(floorLine, 0.55)
      c.lineWidth = 0.03
      c.beginPath()
      let column = 0
      for (let x = -3; x < 3; x += 0.5, column++) {
        const rise = column % 2 ? -0.5 : 0.5
        for (let y = -3.5; y < 3.5; y += 0.25) {
          c.moveTo(x, y)
          c.lineTo(x + 0.5, y + rise)
        }
      }
      c.stroke()
      c.restore()
    })

    // 圓地毯
    k.plane('z', 0, (c) => {
      c.beginPath()
      c.arc(0.4, 0.6, 1.55, 0, Math.PI * 2)
      c.fillStyle = k.tone(rug)
      c.fill()
      c.beginPath()
      c.arc(0.4, 0.6, 1.3, 0, Math.PI * 2)
      c.strokeStyle = k.tone(brass, 0.7)
      c.lineWidth = 0.05
      c.stroke()
    })

    // 窗戶照進來的兩塊光，慢慢移動
    const slide = Math.sin(time * 0.0002) * 0.25
    for (const from of [-2.0, 0.5]) {
      k.poly(
        [
          [-2.6, from, 0],
          [-2.6, from + 1.3, 0],
          [0.9 + slide, from + 2.3, 0],
          [0.9 + slide, from + 1.0, 0],
        ],
        k.light(glow, 0.05 + 0.24 * on),
        false,
      )
    }

    // 左後方的牆和兩扇拱窗
    k.box(-3, -3, 0, 0.4, 6, 4.7, navy)
    k.plane('x', -2.6, (c) => {
      for (const left of [-2.0, 0.5]) {
        archWindow(c, left, 1.3, 1.0, 2.9)
        // 沒被點亮是暮色，點亮後是屋裡的暖光
        c.fillStyle = on > 0.02 ? k.light(glow, 0.3 + 0.7 * on) : k.tone(dusk)
        c.fill()
        c.strokeStyle = k.tone(navy.dark)
        c.lineWidth = 0.06
        c.beginPath()
        c.moveTo(left + 0.65, 1.0)
        c.lineTo(left + 0.65, 3.55)
        c.moveTo(left, 2.0)
        c.lineTo(left + 1.3, 2.0)
        c.moveTo(left, 2.9)
        c.lineTo(left + 1.3, 2.9)
        c.stroke()
      }
      // 腰線
      c.strokeStyle = k.tone(brass, 0.55)
      c.lineWidth = 0.04
      c.beginPath()
      c.moveTo(-3, 0.62)
      c.lineTo(3, 0.62)
      c.stroke()
    })

    // 右後方的牆、腰線、立鏡
    k.box(-2.6, -3, 0, 5.6, 0.4, 4.7, navy)
    k.plane('y', -2.6, (c) => {
      c.strokeStyle = k.tone(brass, 0.55)
      c.lineWidth = 0.04
      c.beginPath()
      c.moveTo(-2.6, 0.62)
      c.lineTo(3, 0.62)
      c.stroke()

      archWindow(c, 1.15, 1.2, 0.5, 3.0)
      c.fillStyle = k.tone(brass)
      c.fill()
      archWindow(c, 1.27, 0.96, 0.62, 3.0)
      c.fillStyle = k.tone(mirror)
      c.fill()
      // 鏡面上的一道反光
      c.strokeStyle = k.light([255, 255, 255], 0.18 + 0.4 * on)
      c.lineWidth = 0.09
      c.beginPath()
      c.moveTo(1.5, 1.0)
      c.lineTo(1.95, 2.6)
      c.stroke()
    })

    // 衣服的影子（落在地毯上）
    k.blob(0.4, 0.6, 0, 1.0, 0.3)

    // 人台：三腳座、立桿、上身
    k.cyl(-1.9, 2.0, 0, 0.36, 0.08, brassMat)
    k.line([[-1.9, 2.0, 0.08], [-1.9, 2.0, 1.25]], k.tone(brass), 2)
    const { ctx } = k
    const [sx, sy] = k.at(-1.9, 2.0, 1.25)
    const u = k.u
    ctx.beginPath()
    ctx.moveTo(sx - 0.34 * u, sy)
    ctx.bezierCurveTo(sx - 0.5 * u, sy - 0.5 * u, sx - 0.3 * u, sy - 0.8 * u, sx - 0.52 * u, sy - 1.35 * u)
    ctx.quadraticCurveTo(sx - 0.2 * u, sy - 1.5 * u, sx - 0.13 * u, sy - 1.72 * u)
    ctx.lineTo(sx + 0.13 * u, sy - 1.72 * u)
    ctx.quadraticCurveTo(sx + 0.2 * u, sy - 1.5 * u, sx + 0.52 * u, sy - 1.35 * u)
    ctx.bezierCurveTo(sx + 0.3 * u, sy - 0.8 * u, sx + 0.5 * u, sy - 0.5 * u, sx + 0.34 * u, sy)
    ctx.closePath()
    const body = ctx.createLinearGradient(sx - 0.5 * u, 0, sx + 0.5 * u, 0)
    body.addColorStop(0, k.tone(ivory))
    body.addColorStop(1, k.tone(ivory.map((v) => v * 0.68)))
    ctx.fillStyle = body
    ctx.fill()
    k.line([[-1.9, 2.0, 2.97], [-1.9, 2.0, 3.12]], k.tone(brass), 3)
  },
}
