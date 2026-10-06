// 主頁作品「風」。
//
// 做法是 p5 課的「流場」加「粒子」：畫面每個位置有一個風向（用 noise 算出來，相鄰的位置風向相近），
// 一千多個墨點順著所在位置的風向走，走過的地方留下墨痕，墨痕再慢慢退掉。
// 風吹到衣服的範圍裡會慢下來、改成往下垂，墨就積在那裡，所以衣服是「被風畫出來的」。
//
// 互動有兩層：
//   1. 滑鼠揮過去是一陣風，附近的墨點被帶著走。
//   2. 按住拖曳，從滑鼠放出朱色的線，讓風帶走；線吹進衣服裡會跟著垂下來。
// 點一件衣服會進到那個主題。
import p5 from 'p5'
import { INK, PAPER, VERMILION, layoutGarments, makePaperGrain, prefersReducedMotion } from './stage'

const DENSITY = 1 / 620 // 每多少平方像素放一個墨點
const FIELD_ZOOM = 0.0017 // 風向在空間上變化得多快；越小，風的紋路越大
const FIELD_DRIFT = 0.00009 // 風向隨時間變化得多快
const WIND_SPEED = 1.9 // 衣服外面，每一幀走幾個像素
const DRAPE_SPEED = 0.7 // 衣服裡面走得慢，墨才積得起來
const FADE = 0.055 // 每一幀墨痕退掉多少
const GUST_REACH = 120 // 滑鼠那陣風吹得到多遠
const THREAD_LIFE = 5200 // 朱線留多久（毫秒）
const PICK_DELAY = 320

const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

export function createWindSketch(container, { onHover = () => {}, onPick = () => {}, seed = 7 } = {}) {
  const reduced = prefersReducedMotion()
  let state = null

  const instance = new p5((p) => {
    let width = 0
    let height = 0
    let stage = null
    let grain = null
    let ink = null // 另一張透明的圖層，墨痕畫在這上面，才能單獨讓它退掉而不動到紙
    let motes = [] // 墨點：{ x, y, vx, vy, age, life }
    let threads = [] // 朱線的點：同樣的結構，多一個 born
    let clock = 0
    let hovered = -1
    let picked = -1
    let press = null
    let ready = false

    // 墨點出生在畫面上隨機的位置（均勻分布：風要吹滿整張紙），
    // 壽命用高斯分布：大部分差不多長，少數特別長或特別短，墨痕的長短才不會一個樣
    function spawn(mote = {}) {
      mote.x = p.random(width)
      mote.y = p.random(height)
      mote.vx = 0
      mote.vy = 0
      mote.age = 0
      mote.life = Math.max(40, p.randomGaussian(170, 60))
      return mote
    }

    function build() {
      if (!ready) return
      if (stage && width === container.clientWidth && height === container.clientHeight) return
      width = container.clientWidth
      height = container.clientHeight
      p.resizeCanvas(width, height)
      stage = layoutGarments(width, height)
      // createGraphics 做出來的圖層是另一張畫布，不用了要自己丟掉
      grain?.remove()
      ink?.remove()
      grain = makePaperGrain(p, width, height)
      ink = p.createGraphics(width, height)
      ink.pixelDensity(p.pixelDensity())
      motes = Array.from({ length: Math.round(width * height * DENSITY) }, () => spawn())
      threads = []
      // 減少動態時不跑動畫：先在背後算 260 步，直接給一張已經畫好的靜止畫面
      if (reduced) for (let n = 0; n < 260; n++) step(16.7)
      p.redraw()
    }

    p.setup = () => {
      p.createCanvas(container.clientWidth, container.clientHeight)
      p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2))
      // 固定亂數種子：同一個 seed 每次畫出來的風都一樣，才能比較不同 seed 的結果
      p.randomSeed(seed)
      p.noiseSeed(seed)
      ready = true
      build()
      if (reduced) p.noLoop()
    }

    function setHovered(index) {
      if (index === hovered) return
      hovered = index
      const garment = stage.garments[index]
      onHover(garment ? { theme: garment.theme, kind: garment.kind, x: garment.centerX, y: garment.top } : null)
    }

    p.mouseMoved = () => {
      setHovered(stage.indexAt(p.mouseX, p.mouseY))
      if (reduced) p.redraw()
    }

    p.mousePressed = () => {
      press = { x: p.mouseX, y: p.mouseY, dragged: false }
    }

    p.mouseDragged = () => {
      if (!press) return
      if (Math.hypot(p.mouseX - press.x, p.mouseY - press.y) > 6) press.dragged = true
      if (!press.dragged || reduced) return
      // 每次拖曳事件放出三個朱色的點，位置稍微散開，線才有粗細
      for (let n = 0; n < 3; n++) {
        threads.push({ x: p.mouseX + p.random(-3, 3), y: p.mouseY + p.random(-3, 3), vx: 0, vy: 0, born: clock })
      }
    }

    p.mouseReleased = () => {
      if (press && !press.dragged) {
        const index = stage.indexAt(p.mouseX, p.mouseY)
        if (index >= 0 && picked < 0) {
          picked = index
          p.redraw()
          setTimeout(() => onPick({ theme: stage.garments[index].theme }), PICK_DELAY)
        }
      }
      press = null
    }

    // 讓一個點走一步，回傳它現在在哪件衣服裡。墨點和朱線共用同一套走法。
    function advance(point, frames, gustX, gustY) {
      const inside = stage.indexAt(point.x, point.y)
      // noise 回傳 0 到 1，乘上兩圈，風向才不會永遠偏同一邊
      let angle = p.noise(point.x * FIELD_ZOOM, point.y * FIELD_ZOOM, clock * FIELD_DRIFT) * p.TWO_PI * 2
      let speed = WIND_SPEED
      if (inside >= 0) {
        // 在衣服裡：風向大部分改成往下（HALF_PI），只留一點原本的擺動
        angle = p.HALF_PI + Math.sin(angle) * 0.35
        speed = DRAPE_SPEED
      }
      // 速度不是直接跳到新的風向，而是每一幀靠近一點，轉彎才圓
      point.vx += (Math.cos(angle) * speed - point.vx) * 0.12
      point.vy += (Math.sin(angle) * speed - point.vy) * 0.12

      // 滑鼠那陣風：離得越近被帶得越多
      const distance = Math.hypot(point.x - p.mouseX, point.y - p.mouseY)
      if (distance < GUST_REACH) {
        const pull = (1 - distance / GUST_REACH) * 0.35
        point.vx += gustX * pull
        point.vy += gustY * pull
      }
      point.x += point.vx * frames
      point.y += point.vy * frames
      return inside
    }

    function step(dt) {
      clock += dt
      const frames = dt / 16.7
      const pen = ink.drawingContext

      // 讓舊的墨痕退掉一點：destination-out 是「把已經畫上去的東西擦淡」
      pen.globalCompositeOperation = 'destination-out'
      pen.fillStyle = `rgba(0,0,0,${1 - Math.pow(1 - FADE, frames)})`
      pen.fillRect(0, 0, width, height)
      pen.globalCompositeOperation = 'source-over'
      pen.lineCap = 'round'

      // 滑鼠這一幀移動了多少，就是那陣風的方向與力道（限制上限，甩太快也不會把墨點丟出畫面）
      const gustX = Math.max(-14, Math.min(14, p.mouseX - p.pmouseX))
      const gustY = Math.max(-14, Math.min(14, p.mouseY - p.pmouseY))

      // 墨點依所在的地方分成幾組，每一組的線段描進同一條路徑、只上墨一次
      const outside = new Path2D()
      const draped = stage.garments.map(() => new Path2D())
      for (const mote of motes) {
        const fromX = mote.x
        const fromY = mote.y
        const inside = advance(mote, frames, gustX, gustY)
        mote.age += frames
        const target = inside >= 0 ? draped[inside] : outside
        target.moveTo(fromX, fromY)
        target.lineTo(mote.x, mote.y)
        if (mote.age > mote.life || mote.x < -20 || mote.x > width + 20 || mote.y < -20 || mote.y > height + 20) spawn(mote)
      }
      pen.lineWidth = 0.9
      pen.strokeStyle = rgba(INK, 0.16)
      pen.stroke(outside)
      draped.forEach((path, g) => {
        // 指著某一件時，其他件的墨下得比較輕，退後一點
        const strength = hovered < 0 ? 0.5 : g === hovered ? 0.85 : 0.18
        pen.lineWidth = 1.1
        pen.strokeStyle = rgba(INK, strength)
        pen.stroke(path)
      })

      // 朱線
      threads = threads.filter((thread) => clock - thread.born < THREAD_LIFE)
      if (threads.length) {
        const red = new Path2D()
        for (const thread of threads) {
          const fromX = thread.x
          const fromY = thread.y
          advance(thread, frames, 0, 0)
          red.moveTo(fromX, fromY)
          red.lineTo(thread.x, thread.y)
        }
        pen.lineWidth = 1.6
        pen.strokeStyle = rgba(VERMILION, 0.9)
        pen.stroke(red)
      }
    }

    p.draw = () => {
      if (!reduced) step(Math.min(p.deltaTime || 16.7, 50))

      p.background(PAPER[0], PAPER[1], PAPER[2])
      p.image(grain, 0, 0, width, height)
      p.image(ink, 0, 0, width, height)

      // 款式圖的輪廓很淡，主要讓墨自己把形狀堆出來；指到或點到才畫清楚
      const pen = p.drawingContext
      stage.garments.forEach((garment, g) => {
        const justPicked = g === picked
        const strength = justPicked ? 1 : g === hovered ? 0.85 : hovered < 0 ? 0.3 : 0.12
        pen.strokeStyle = justPicked ? rgba(VERMILION, 1) : rgba(INK, strength)
        pen.lineWidth = justPicked ? 2.2 : 1.3
        pen.stroke(garment.outline)
        if (g === hovered || justPicked) {
          pen.lineWidth = 1
          garment.seams.forEach((seam) => pen.stroke(seam))
          pen.setLineDash([4, 4])
          garment.stitches.forEach((stitch) => pen.stroke(stitch))
          pen.setLineDash([])
        }
      })

      state = { threadPoints: threads.length, motes: motes.length, hovered, picked, clock }
    }

    p.rebuild = build
    p.freeLayers = () => {
      grain?.remove()
      ink?.remove()
    }
  }, container)

  const observer = new ResizeObserver(() => instance.rebuild?.())
  observer.observe(container)

  return {
    probe: () => state,
    dispose() {
      observer.disconnect()
      instance.freeLayers?.()
      instance.remove()
    },
  }
}
