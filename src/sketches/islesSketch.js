// 主頁作品「群島」。
//
// 一塊深色的布上有五座小島，每一座是一個風格自己的小世界，用同一種等角畫法、同一個方向的光：
//   街頭  街角：水泥牆、網點海報、鐵絲網、路燈、滑板
//   簡約  一面牆、一道縫、三階樓梯、一顆球
//   復古  一台唱盤，後面立著彩虹拱門
//   戶外  等高線疊出來的山，帳篷、杉樹、雪和旗
//   正式  訂製店的角落：拱窗、人字拼地板、立鏡、人台
// 每座島上方用一條線吊著一件那個風格的款式圖。
//
// 可以玩的有三層：
//   1. 滑鼠掃過吊著的衣服，它會被撥得晃起來，慢慢停下。
//   2. 指著一座島，它亮起來（燈開、窗亮、唱片轉快），其他島沉進夜色。
//   3. 按住拖曳，在布上縫出一道線；線經過的島會跟著亮，線退掉後再暗回去。
// 點一座島，鏡頭推近，進到那個風格。
import p5 from 'p5'
import { prefersReducedMotion } from './stage'
import { createPen, css, drawHanging, NIGHT, rgb } from './isles/iso'
import { formal } from './isles/formal'
import { minimal } from './isles/minimal'
import { outdoor } from './isles/outdoor'
import { street } from './isles/street'
import { vintage } from './isles/vintage'

// 由左到右的順序。兩端放最暗的兩座，最亮的簡約靠中間
const ORDER = [street, minimal, vintage, outdoor, formal]

const COS = Math.cos(Math.PI / 6)
const HALF = 3 // 島的底座是 6×6，從中心到邊是 3
const REST = 0.2 // 平常每座島沉在夜色裡的程度
const DIM = 0.62 // 有一座島被指著時，其他島沉到多深
const GARMENT = 5 // 吊著的衣服有多高（立體座標的單位）
const STITCH_LIFE = 6000 // 縫線留多久（毫秒）
const PUSH_MS = 620 // 點選後鏡頭推近的時間
const CREAM = [243, 234, 212]

const clamp = (value, low, high) => Math.min(high, Math.max(low, value))

export function createIslesSketch(container, { onHover = () => {}, onPick = () => {}, onLeave = () => {}, onLayout = () => {} } = {}) {
  const reduced = prefersReducedMotion()
  let state = null
  let focusTheme = null // 用鍵盤或文字連結指到的主題

  const instance = new p5((p) => {
    let W = 0
    let H = 0
    let u = 20
    let isles = []
    let cloth = null // 底布：只畫一次的圖
    let pen = null
    let clock = 0
    let hovered = -1
    let picked = -1
    let pickedAt = 0
    let stitches = [] // 縫線的點：{ x, y, born, fresh, run }
    let press = null
    let last = { x: 0, y: 0 }
    let speed = 0 // 滑鼠水平移動的速度（每幀幾個像素）
    let ready = false

    // ── 版面 ──────────────────────────────────────────────

    function place() {
      const wide = W >= H * 0.95
      // 寬螢幕排成 W 字形；直式螢幕排成左右交錯的一串
      const spots = wide
        ? [[0.16, 0.695], [0.33, 0.455], [0.5, 0.695], [0.67, 0.455], [0.84, 0.695]]
        : [[0.3, 0.25], [0.7, 0.385], [0.3, 0.52], [0.7, 0.655], [0.3, 0.79]]
      u = wide ? Math.max(9, Math.min(W / 1252, H / 699) * 24) : Math.max(8, Math.min(W / 24, H / 52))
      isles = ORDER.map((def, i) => ({
        def,
        x: W * spots[i][0],
        y: H * spots[i][1],
        key: rgb(def.key),
        clothColour: rgb(def.cloth),
        inkColour: rgb(def.ink),
        heat: 0, // 0 到 1：這座島現在多「醒」
        shade: REST,
        lift: 0,
        lit: 0, // 被縫線經過而亮的程度
        sway: 0, // 衣服晃到幾度（弧度）
        swayV: 0, // 衣服晃的速度
      }))
      onLayout(
        isles.map((isle) => ({
          theme: isle.def.theme,
          x: isle.x,
          y: isle.y + HALF * u + 1.3 * u, // 島的前緣下面一點：放名稱
        })),
      )
    }

    // 底布：夜色、很淡的等角格線、把五座島串起來的一道車縫線、細顆粒
    function weave() {
      const density = p.pixelDensity()
      cloth = document.createElement('canvas')
      cloth.width = Math.round(W * density)
      cloth.height = Math.round(H * density)
      const g = cloth.getContext('2d')
      g.scale(density, density)

      const pool = g.createRadialGradient(W / 2, H * 0.56, 0, W / 2, H * 0.56, Math.hypot(W, H) * 0.62)
      pool.addColorStop(0, 'rgb(24,28,48)')
      pool.addColorStop(1, css(NIGHT))
      g.fillStyle = pool
      g.fillRect(0, 0, W, H)

      // 等角格線：和島的邊同一個方向，讓五座島看起來站在同一個平面上
      g.strokeStyle = 'rgba(176,190,232,0.05)'
      g.lineWidth = 1
      g.beginPath()
      const slope = 0.5 / COS
      for (let b = -W; b < H + W; b += 2 * u) {
        g.moveTo(0, b)
        g.lineTo(W, b + W * slope)
        g.moveTo(0, b)
        g.lineTo(W, b - W * slope)
      }
      g.stroke()

      // 串起五座島的車縫線
      g.strokeStyle = css(CREAM, 0.3)
      g.lineWidth = 1.4
      g.lineCap = 'round'
      g.setLineDash([9, 8])
      g.beginPath()
      isles.forEach((isle, i) => {
        if (!i) return g.moveTo(isle.x, isle.y)
        const before = isles[i - 1]
        const bend = (i % 2 ? -1 : 1) * 0.9 * u
        g.quadraticCurveTo((before.x + isle.x) / 2, (before.y + isle.y) / 2 + bend, isle.x, isle.y)
      })
      g.stroke()
      g.setLineDash([])

      // 顆粒：每個像素加一點點亮暗。用均勻分布——顆粒本來就該到處一樣密；
      // 它同時讓大片的漸層不會出現一階一階的色帶。
      const image = g.getImageData(0, 0, cloth.width, cloth.height)
      const data = image.data
      for (let i = 0; i < data.length; i += 4) {
        const grain = (Math.random() - 0.5) * 7
        data[i] += grain
        data[i + 1] += grain
        data[i + 2] += grain
      }
      g.putImageData(image, 0, 0)
    }

    function build() {
      if (!ready) return
      if (cloth && W === container.clientWidth && H === container.clientHeight) return
      W = container.clientWidth
      H = container.clientHeight
      p.resizeCanvas(W, H)
      place()
      weave()
      stitches = []
      p.redraw()
    }

    p.setup = () => {
      p.createCanvas(container.clientWidth, container.clientHeight)
      p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2))
      pen = createPen(p.drawingContext)
      ready = true
      build()
      if (reduced) p.noLoop()
    }

    // ── 滑鼠指到哪一座島 ──────────────────────────────────

    // 衣服在畫面上佔的矩形
    function garmentBox(isle) {
      pen.ox = isle.x
      pen.oy = isle.y
      pen.u = u
      const [hx, hy] = pen.at(...isle.def.hang)
      return { x: hx, top: hy, halfWidth: GARMENT * u * 0.4, height: GARMENT * u * 0.92 }
    }

    function inIsle(isle, x, y) {
      // 島本身：底座的菱形，加上往上 5 個單位的建築
      const dx = Math.abs(x - isle.x)
      const dy = y - isle.y
      const a = 2 * HALF * COS * u
      const b = HALF * u
      if (dx <= a) {
        const edge = b * (1 - dx / a)
        if (dy <= edge + 0.7 * u && dy >= -edge - 5 * u) return true
      }
      // 或是吊在上面的衣服
      const box = garmentBox(isle)
      return Math.abs(x - box.x) <= box.halfWidth && y >= box.top - 0.4 * u && y <= box.top + box.height
    }

    function isleAt(x, y) {
      // 前面的島優先
      let found = -1
      isles.forEach((isle, i) => {
        if (inIsle(isle, x, y) && (found < 0 || isle.y > isles[found].y)) found = i
      })
      return found
    }

    function setHovered(index) {
      if (index === hovered) return
      hovered = index
      container.style.cursor = index >= 0 ? 'pointer' : ''
      onHover(index >= 0 ? { theme: isles[index].def.theme } : null)
    }

    p.mouseMoved = () => {
      if (picked >= 0) return
      setHovered(isleAt(p.mouseX, p.mouseY))
      if (reduced) p.redraw()
    }

    p.mousePressed = () => {
      press = { x: p.mouseX, y: p.mouseY, dragged: false, fresh: true, run: 0 }
    }

    p.mouseDragged = () => {
      if (!press || picked >= 0) return
      if (Math.hypot(p.mouseX - press.x, p.mouseY - press.y) > 6) press.dragged = true
      if (!press.dragged) return
      const tail = stitches[stitches.length - 1]
      const gap = tail && !press.fresh ? Math.hypot(p.mouseX - tail.x, p.mouseY - tail.y) : 0
      if (press.fresh || gap > 5) {
        press.run += gap
        stitches.push({ x: p.mouseX, y: p.mouseY, born: clock, fresh: press.fresh, run: press.run })
        press.fresh = false
      }
      setHovered(isleAt(p.mouseX, p.mouseY))
      if (reduced) p.redraw()
    }

    p.mouseReleased = () => {
      if (press && !press.dragged && picked < 0) {
        const index = isleAt(p.mouseX, p.mouseY)
        if (index >= 0) {
          picked = index
          pickedAt = performance.now()
          onLeave()
          // 減少動態時不做推近，直接換頁
          setTimeout(() => onPick({ theme: isles[index].def.theme }), reduced ? 0 : PUSH_MS)
          if (reduced) p.redraw()
        }
      }
      press = null
    }

    // ── 每一幀 ────────────────────────────────────────────

    p.draw = () => {
      const dt = Math.min(p.deltaTime || 16.7, 50)
      if (!reduced) clock += dt
      const frames = dt / 16.7
      const ease = reduced ? 1 : 1 - Math.pow(0.86, frames)
      stitches = stitches.filter((point) => clock - point.born < STITCH_LIFE)

      // 滑鼠的水平速度，換算成「每 1/60 秒移動幾個像素」
      speed = (p.mouseX - last.x) / frames
      last = { x: p.mouseX, y: p.mouseY }

      const keyboard = focusTheme ? isles.findIndex((isle) => isle.def.theme === focusTheme) : -1
      const focus = picked >= 0 ? picked : hovered >= 0 ? hovered : keyboard

      // 更新每座島的狀態
      isles.forEach((isle, g) => {
        // 縫線有沒有經過這座島；線越新，亮得越多
        let lit = 0
        for (const point of stitches) {
          if (inIsle(isle, point.x, point.y)) lit = Math.max(lit, 1 - (clock - point.born) / STITCH_LIFE)
        }
        isle.lit = lit

        const goal = g === focus ? 1 : lit * 0.9
        isle.heat += (goal - isle.heat) * ease
        const shadeGoal = focus >= 0 && g !== focus ? DIM * (1 - lit * 0.8) : REST * (1 - isle.heat)
        isle.shade += (shadeGoal - isle.shade) * ease
        isle.lift += ((g === focus ? 1 : 0) - isle.lift) * ease

        // 衣服是一個單擺：被推一下就晃，自己慢慢停
        if (!reduced) {
          const seconds = dt / 1000
          const box = garmentBox(isle)
          const touching = picked < 0 && Math.abs(p.mouseX - box.x) <= box.halfWidth && p.mouseY >= box.top && p.mouseY <= box.top + box.height
          if (touching) isle.swayV -= clamp(speed, -60, 60) * 0.016 * frames
          // 很輕的風：幅度遠小於用手撥的
          const breeze = 0.2 * Math.sin(clock * 0.0011 + g * 1.7)
          isle.swayV += (-17.6 * isle.sway - 1.5 * isle.swayV + breeze) * seconds
          isle.swayV = clamp(isle.swayV, -3.2, 3.2)
          isle.sway += isle.swayV * seconds
        }
      })

      // 鏡頭推近：0 到 1，越後面越快
      const push = picked >= 0 && !reduced ? Math.min(1, (performance.now() - pickedAt) / PUSH_MS) : 0
      const eased = push * push * push

      const ctx = p.drawingContext
      ctx.drawImage(cloth, 0, 0, W, H)

      ctx.save()
      if (picked >= 0) {
        const target = isles[picked]
        const cy = target.y - 2 * u
        ctx.translate(target.x, cy)
        ctx.scale(1 + eased * 6, 1 + eased * 6)
        ctx.translate(-target.x, -cy)
      }

      // 由後往前畫，前面的島會蓋住後面的
      const order = isles.map((_, i) => i).sort((a, b) => isles[a].y - isles[b].y)
      order.forEach((g) => {
        const isle = isles[g]
        const { def } = isle

        // 島底下的一圈光，顏色是這座島的顏色
        ctx.save()
        ctx.translate(isle.x, isle.y + 0.6 * u)
        ctx.scale(1, 0.58)
        const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 9.5 * u)
        halo.addColorStop(0, css(isle.key, 0.07 + 0.2 * isle.heat))
        halo.addColorStop(1, css(isle.key, 0))
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(0, 0, 9.5 * u, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()

        // 島落在布上的影子
        const a = 2 * HALF * COS * u
        const b = HALF * u
        ctx.beginPath()
        if (def.round) {
          ctx.ellipse(isle.x, isle.y + 0.55 * u, a * 0.82, b * 0.84, 0, 0, Math.PI * 2)
        } else {
          ctx.moveTo(isle.x - a - 4, isle.y + 0.5 * u)
          ctx.lineTo(isle.x, isle.y + b + 0.5 * u + 5)
          ctx.lineTo(isle.x + a + 4, isle.y + 0.5 * u)
          ctx.lineTo(isle.x, isle.y - b)
          ctx.closePath()
        }
        ctx.fillStyle = 'rgba(5,6,12,0.5)'
        ctx.fill()

        // 被指著的島浮起來一點
        pen.ox = isle.x
        pen.oy = isle.y - isle.lift * 0.32 * u
        pen.u = u
        pen.shade = isle.shade
        def.draw(pen, clock, isle.heat, reduced ? 0 : dt)

        // 吊衣服的線：往上淡出
        const [hx, hy] = pen.at(...def.hang)
        const thread = ctx.createLinearGradient(0, hy, 0, hy - 3 * u)
        thread.addColorStop(0, pen.tone(CREAM, 0.75))
        thread.addColorStop(1, pen.tone(CREAM, 0))
        ctx.strokeStyle = thread
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(hx, hy)
        ctx.lineTo(hx, hy - 3 * u)
        ctx.stroke()

        drawHanging(ctx, def.kind, hx, hy, GARMENT * u, isle.sway, pen.tone(isle.clothColour), pen.tone(isle.inkColour))
      })

      // 縫線：一段實、一段空，像真的平針縫。越舊越淡
      ctx.lineCap = 'round'
      ctx.lineWidth = 2
      ctx.setLineDash([10, 8])
      for (let n = 1; n < stitches.length; n++) {
        const point = stitches[n]
        if (point.fresh) continue
        const age = (clock - point.born) / STITCH_LIFE
        const before = stitches[n - 1]
        ctx.lineDashOffset = before.run
        ctx.strokeStyle = css(CREAM, 1 - age * age)
        ctx.beginPath()
        ctx.moveTo(before.x, before.y)
        ctx.lineTo(point.x, point.y)
        ctx.stroke()
      }
      ctx.setLineDash([])
      ctx.lineDashOffset = 0
      ctx.restore()

      // 推近的最後，整個畫面染成那座島的顏色，接到主題頁
      if (picked >= 0 && !reduced) {
        ctx.fillStyle = css(isles[picked].key, eased * 0.94)
        ctx.fillRect(0, 0, W, H)
      }

      state = {
        hovered,
        picked,
        push,
        clock,
        stitchPoints: stitches.length,
        heat: isles.map((isle) => +isle.heat.toFixed(3)),
        shade: isles.map((isle) => +isle.shade.toFixed(3)),
        sway: isles.map((isle) => +isle.sway.toFixed(4)),
        boxes: isles.map((isle) => garmentBox(isle)),
        centres: isles.map((isle) => ({ theme: isle.def.theme, x: isle.x, y: isle.y })),
      }
    }

    p.rebuild = build
    p.wake = () => reduced && p.redraw()
  }, container)

  const observer = new ResizeObserver(() => instance.rebuild?.())
  observer.observe(container)

  return {
    probe: () => state,
    /** 從畫布外面指定要亮哪一座島（鍵盤焦點或文字連結），傳 null 取消 */
    focus(theme) {
      focusTheme = theme
      instance.wake?.()
    },
    dispose() {
      observer.disconnect()
      instance.remove()
    },
  }
}
