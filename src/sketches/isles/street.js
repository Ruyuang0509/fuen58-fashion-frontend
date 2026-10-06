// 街頭：一個街角。水泥牆上貼著網點海報、鐵絲網、路燈、滑板、三角錐。
import { mat, rgb } from './iso'

const asphalt = mat('#474b57')
const kerb = mat('#a3a6ae')
const concrete = mat('#8d9099')
const steel = rgb('#c9ccd4')
const dark = rgb('#16171d')
const paper = rgb('#f1e9d6')
const hot = rgb('#ff5a36')
const yellow = rgb('#f3c637')
const lamp = [255, 214, 140]
const board = mat('#ff5a36')
const coneMat = mat('#ff7a3d')

export const street = {
  theme: 'street',
  kind: 'trousers',
  key: '#ff5a36',
  rise: 9,
  hang: [0.3, 0.5, 7.0],
  cloth: '#ff5a36',
  ink: '#16171d',

  draw(k, time, on) {
    k.box(-3, -3, -0.5, 6, 6, 0.5, asphalt)

    // 路面的黃色分隔線
    k.plane('z', 0, (c) => {
      c.fillStyle = k.tone(yellow, 0.9)
      for (let i = 0; i < 4; i++) c.fillRect(-2.5 + i * 1.45, 2.05, 0.85, 0.15)
    })

    // 人行道
    k.box(-2.55, -3, 0, 5.55, 1.15, 0.16, kerb)

    // 水泥牆
    k.box(-3, -3, 0, 0.45, 4.6, 4.0, concrete)
    k.plane('x', -2.55, (c) => {
      // 模板的接縫
      c.strokeStyle = k.tone(dark, 0.22)
      c.lineWidth = 0.03
      c.beginPath()
      for (let z = 1.33; z < 4; z += 1.33) {
        c.moveTo(-3, z)
        c.lineTo(1.6, z)
      }
      c.moveTo(-0.7, 0)
      c.lineTo(-0.7, 4)
      c.stroke()

      // 海報：米色的紙，上面是一波一波變大變小的網點
      c.fillStyle = k.tone(paper)
      c.fillRect(-0.1, 0.95, 1.5, 2.3)
      c.save()
      c.beginPath()
      c.rect(-0.1, 0.95, 1.5, 2.3)
      c.clip()
      c.fillStyle = k.tone(hot)
      c.beginPath()
      for (let row = 0; row < 15; row++) {
        for (let col = 0; col < 11; col++) {
          const y = -0.1 + col * 0.16 + (row % 2) * 0.08
          const z = 0.95 + row * 0.16
          const wave = 0.5 + 0.5 * Math.sin(row * 0.55 - time * 0.0016 + col * 0.3)
          const radius = 0.012 + wave * (0.05 + 0.03 * on)
          c.moveTo(y + radius, z)
          c.arc(y, z, radius, 0, Math.PI * 2)
        }
      }
      c.fill()
      c.restore()

      // 第二張小的，有一半會被吊著的褲子擋住
      c.fillStyle = k.tone(hot)
      c.fillRect(-1.5, 1.7, 1.05, 1.4)
      c.fillStyle = k.tone(dark)
      c.fillRect(-1.35, 2.55, 0.75, 0.12)
      c.fillRect(-1.35, 2.3, 0.5, 0.12)
      c.fillRect(-1.35, 1.9, 0.75, 0.22)
    })

    // 鐵絲網
    k.plane('y', -2.9, (c) => {
      c.save()
      c.beginPath()
      c.rect(-2.5, 0.16, 5.4, 3.1)
      c.clip()
      c.strokeStyle = k.tone(steel, 0.42)
      c.lineWidth = 0.022
      c.beginPath()
      for (let s = -6; s < 9; s += 0.3) {
        c.moveTo(s, 0)
        c.lineTo(s + 3.4, 3.4)
        c.moveTo(s, 0)
        c.lineTo(s - 3.4, 3.4)
      }
      c.stroke()
      c.restore()
      c.strokeStyle = k.tone(steel, 0.9)
      c.lineWidth = 0.06
      c.beginPath()
      c.moveTo(-2.5, 3.26)
      c.lineTo(2.9, 3.26)
      for (const x of [-0.7, 1.1, 2.9]) {
        c.moveTo(x, 0.16)
        c.lineTo(x, 3.26)
      }
      c.stroke()
    })

    // 路燈照在地上的光：只有這座島被點亮時才開
    if (on > 0.02) {
      const { ctx } = k
      const [hx, hy] = k.at(1.9, -1.2, 5.3)
      const [gx, gy] = k.at(1.9, -1.2, 0)
      const rx = 1.7 * k.u * 1.2247
      const ry = 1.7 * k.u * 0.7071
      const beam = ctx.createLinearGradient(0, hy, 0, gy + ry)
      beam.addColorStop(0, k.light(lamp, 0.4 * on))
      beam.addColorStop(1, k.light(lamp, 0.03 * on))
      ctx.beginPath()
      ctx.moveTo(hx, hy)
      ctx.lineTo(gx + rx, gy)
      ctx.ellipse(gx, gy, rx, ry, 0, 0, Math.PI)
      ctx.closePath()
      ctx.fillStyle = beam
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(gx, gy, rx, ry, 0, 0, Math.PI * 2)
      ctx.fillStyle = k.light(lamp, 0.2 * on)
      ctx.fill()
    }

    // 路燈
    k.line(
      [
        [2.55, -1.85, 0.16],
        [2.55, -1.85, 5.2],
        [2.3, -1.6, 5.55],
        [1.75, -1.05, 5.55],
      ],
      k.tone(dark),
      2.4,
    )
    k.box(1.6, -1.5, 5.3, 0.6, 0.6, 0.16, mat('#2a2c35'))
    k.poly(
      [
        [1.6, -0.9, 5.3],
        [2.2, -0.9, 5.3],
        [2.2, -1.5, 5.3],
      ],
      k.light(lamp, 0.25 + 0.75 * on),
      false,
    )

    // 衣服的影子
    k.blob(0.3, 0.5, 0, 0.95, 0.3)

    // 滑板
    k.blob(-1.05, 1.3, 0, 0.75, 0.28)
    k.box(-1.9, 1.05, 0.15, 1.7, 0.46, 0.07, board)
    k.line([[-1.6, 1.52, 0.08], [-1.58, 1.52, 0.08]], k.tone(dark), 4)
    k.line([[-0.5, 1.52, 0.08], [-0.48, 1.52, 0.08]], k.tone(dark), 4)

    // 三角錐
    k.box(1.55, 1.25, 0, 0.8, 0.8, 0.07, coneMat)
    k.cone(1.95, 1.65, 0.07, 0.3, 1.0, coneMat)
    k.line([[1.8, 1.82, 0.5], [2.1, 1.82, 0.5]], k.tone(paper), 2.2)
  },
}
