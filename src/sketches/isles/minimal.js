// 簡約：一面牆、一道縫、三階不通往任何地方的樓梯、一顆球。其餘留白。
import { mat, rgb } from './iso'

const stone = mat('#e6e0d3')
const wall = mat('#f3eee4')
const ink = rgb('#24221e')
const sun = [255, 250, 236]

export const minimal = {
  theme: 'minimal',
  kind: 'top',
  key: '#e9e4d8', // 點進去時畫面染成的顏色
  rise: 9, // 這座島從地面往上佔多高（算滑鼠範圍用）
  hang: [0.5, 0.9, 7.0], // 衣服掛點的立體座標
  cloth: '#fbf8f1', // 衣服的布色
  ink: '#24221e', // 衣服的線色

  draw(k, time, on) {
    k.box(-3, -3, -0.5, 6, 6, 0.5, stone)

    // 地上用細線框出一塊方形，衣服就吊在它的正上方；被點亮時框裡微微發亮
    k.plane('z', 0, (c) => {
      c.fillStyle = k.light(sun, 0.5 * on)
      c.fillRect(-0.75, -0.35, 2.5, 2.5)
      c.strokeStyle = k.tone(ink, 0.55)
      c.lineWidth = 0.035
      c.strokeRect(-0.75, -0.35, 2.5, 2.5)
    })

    // 牆，和牆上的一道細縫
    k.box(-2.5, -2.6, 0, 3.6, 0.26, 4.9, wall)
    k.plane('y', -2.34, (c) => {
      c.fillStyle = k.tone(ink, 0.82)
      c.fillRect(0.2, 1.0, 0.15, 3.1)
    })

    // 三階樓梯，沿著牆往右上
    k.box(1.1, -2.6, 0, 0.62, 1.0, 0.34, wall)
    k.box(1.72, -2.6, 0, 0.62, 1.0, 0.68, wall)
    k.box(2.34, -2.6, 0, 0.62, 1.0, 1.02, wall)

    // 衣服的影子
    k.blob(0.5, 0.9, 0, 0.85, 0.1)

    // 一顆球
    k.blob(-1.75, 1.95, 0, 0.62, 0.2)
    k.ball(-1.9, 1.8, 0.56, 0.56, stone)
  },
}
