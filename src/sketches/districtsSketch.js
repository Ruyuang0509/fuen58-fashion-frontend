// 主頁作品「分區」。
//
// 模式學十殿之世：深色的底，每個主題是一座各自獨立的區，有自己的顏色和自己的圖樣；
// 指到哪一區，那一區變亮、其他壓暗；點下去鏡頭推近，進到那個主題。
// 這裡每一區是一件服飾款式圖，輪廓裡面填的是那個風格自己的圖樣，五區五種畫法：
//   簡約  等距的細橫線，平常微微起伏，指到時拉成筆直
//   街頭  斜排的網點，大小一波一波地變
//   復古  兩組同心圓互相錯開，疊出水波紋
//   戶外  一層一層的山稜線，用 noise 算高度
//   正式  人字紋，一道光斜斜掃過
//
// 互動有兩層：
//   1. 滑鼠靠近某一區，那一區的圖樣就動得比較大；指到它，它變亮、其他退後。
//   2. 按住拖曳，拉出一條發亮的線，顏色是起點那一區的顏色，幾秒後退掉。
import p5 from 'p5'
import { layoutGarments, prefersReducedMotion } from './stage'

const NIGHT = [7, 8, 12]
const DIM = 0.42 // 沒被指到的區壓到多暗（十殿之世用的值）
const NEAR = 280 // 滑鼠離一區的中心多近，那一區開始有反應
const THREAD_LIFE = 5000
const PUSH_MS = 560 // 點選後鏡頭推近的時間

// 每個主題的顏色。這五個顏色是為深色底挑的暫定值。
const HUES = {
  minimal: [232, 230, 223],
  street: [255, 90, 54],
  vintage: [224, 166, 63],
  outdoor: [88, 195, 154],
  formal: [134, 166, 232],
}

const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

export function createDistrictsSketch(container, { onHover = () => {}, onPick = () => {}, onLeave = () => {} } = {}) {
  const reduced = prefersReducedMotion()
  let state = null

  const instance = new p5((p) => {
    let width = 0
    let height = 0
    let stage = null
    let stars = null
    let heat = [] // 每一區目前有多「熱」，0 到 1；滑鼠靠近就升高，離開慢慢降回去
    let clock = 0
    let hovered = -1
    let picked = -1
    let pickedAt = 0
    let threads = [] // 拖曳拉出來的線：{ x, y, born, hue, fresh }
    let press = null
    let ready = false

    // ── 五種圖樣。每一個都只管「在 box 這個矩形裡畫滿」，外面會先用衣服的輪廓把它裁掉 ──

    // 簡約：warm 越高線越直
    function drawMinimal(pen, box, warm) {
      pen.beginPath()
      for (let y = box.top; y < box.top + box.height; y += 9) {
        for (let x = box.left - 10; x <= box.left + box.width + 10; x += 12) {
          const bend = Math.sin(x * 0.021 + clock * 0.0012 + y * 0.05) * 5 * (1 - warm)
          if (x < box.left) pen.moveTo(x, y + bend)
          else pen.lineTo(x, y + bend)
        }
      }
      pen.lineWidth = 1
      pen.stroke()
    }

    // 街頭：整片網點轉 20 度；warm 越高點越大
    function drawStreet(pen, box, warm) {
      const cx = box.left + box.width / 2
      const cy = box.top + box.height / 2
      const reach = Math.hypot(box.width, box.height) / 2
      pen.save()
      pen.translate(cx, cy)
      pen.rotate(0.35)
      pen.beginPath()
      for (let v = -reach; v <= reach; v += 13) {
        for (let u = -reach; u <= reach; u += 13) {
          const wave = 0.5 + 0.5 * Math.sin(u * 0.045 + clock * 0.002) * Math.cos(v * 0.05 - clock * 0.0015)
          const radius = 0.8 + wave * 4.6 * (0.55 + 0.45 * warm)
          pen.moveTo(u + radius, v)
          pen.arc(u, v, radius, 0, Math.PI * 2)
        }
      }
      pen.fill()
      pen.restore()
    }

    // 復古：兩組同心圓，圓心各自繞著中心慢慢轉；warm 越高錯得越開，水波紋越粗
    function drawVintage(pen, box, warm) {
      const cx = box.left + box.width / 2
      const cy = box.top + box.height * 0.45
      const reach = Math.hypot(box.width, box.height)
      const apart = 7 + 16 * warm
      pen.beginPath()
      for (const side of [-1, 1]) {
        const ox = cx + Math.cos(clock * 0.0004) * apart * side
        const oy = cy + Math.sin(clock * 0.0005) * apart * side
        for (let radius = 6; radius < reach; radius += 8) {
          pen.moveTo(ox + radius, oy)
          pen.arc(ox, oy, radius, 0, Math.PI * 2)
        }
      }
      pen.lineWidth = 1.1
      pen.stroke()
    }

    // 戶外：每一條橫線被 noise 往上頂，連起來像一層一層的山；warm 越高山越高
    function drawOutdoor(pen, box, warm) {
      pen.beginPath()
      for (let y = box.top + 8; y < box.top + box.height + 40; y += 10) {
        for (let x = box.left - 8; x <= box.left + box.width + 8; x += 7) {
          const lift = p.noise(x * 0.013, y * 0.021, clock * 0.00018)
          const yy = y - lift * lift * 52 * (0.55 + 0.75 * warm)
          if (x < box.left) pen.moveTo(x, yy)
          else pen.lineTo(x, yy)
        }
      }
      pen.lineWidth = 1
      pen.stroke()
    }

    // 正式：人字紋。先整片畫淡的，再只在一條斜的光帶裡畫一次亮的；warm 越高光帶掃得越快
    function drawFormal(pen, box, warm, hue, alpha) {
      const herringbone = new Path2D()
      let column = 0
      for (let x = box.left - 14; x < box.left + box.width + 14; x += 12, column++) {
        const rise = column % 2 ? -7 : 7
        for (let y = box.top - 10; y < box.top + box.height + 10; y += 7) {
          herringbone.moveTo(x, y)
          herringbone.lineTo(x + 12, y + rise)
        }
      }
      pen.lineWidth = 1
      pen.strokeStyle = rgba(hue, alpha * 0.5)
      pen.stroke(herringbone)

      const span = box.width + box.height
      const sweep = ((clock * (0.05 + 0.1 * warm)) % (span + 160)) - 80
      pen.save()
      pen.beginPath()
      pen.moveTo(box.left + sweep, box.top - 10)
      pen.lineTo(box.left + sweep + 70, box.top - 10)
      pen.lineTo(box.left + sweep + 70 - box.height, box.top + box.height + 10)
      pen.lineTo(box.left + sweep - box.height, box.top + box.height + 10)
      pen.clip()
      pen.strokeStyle = rgba(hue, alpha)
      pen.stroke(herringbone)
      pen.restore()
    }

    function build() {
      if (!ready) return
      if (stage && width === container.clientWidth && height === container.clientHeight) return
      width = container.clientWidth
      height = container.clientHeight
      p.resizeCanvas(width, height)
      stage = layoutGarments(width, height)
      heat = stage.garments.map(() => 0)
      // 星點只畫一次，存成一張圖
      stars?.remove()
      stars = p.createGraphics(width, height)
      stars.pixelDensity(1)
      stars.noStroke()
      // 位置均勻分布（夜空沒有哪裡特別密），亮度大部分很暗、少數較亮
      for (let i = 0; i < (width * height) / 5200; i++) {
        stars.fill(214, 218, 226, 20 + 110 * Math.pow(p.random(), 3))
        stars.circle(p.random(width), p.random(height), p.random(0.7, 1.7))
      }
      threads = []
      p.redraw()
    }

    p.setup = () => {
      p.createCanvas(container.clientWidth, container.clientHeight)
      p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2))
      // 固定種子：每次開，星點和山的形狀都一樣
      p.randomSeed(11)
      p.noiseSeed(11)
      ready = true
      build()
      if (reduced) p.noLoop()
    }

    function setHovered(index) {
      if (index === hovered) return
      hovered = index
      const garment = stage.garments[index]
      onHover(garment ? { theme: garment.theme, x: garment.centerX, y: garment.top } : null)
    }

    p.mouseMoved = () => {
      if (picked >= 0) return
      setHovered(stage.indexAt(p.mouseX, p.mouseY))
      if (reduced) p.redraw()
    }

    p.mousePressed = () => {
      const start = stage.indexAt(p.mouseX, p.mouseY)
      press = { x: p.mouseX, y: p.mouseY, dragged: false, newStroke: true, hue: start >= 0 ? HUES[stage.garments[start].theme] : HUES.minimal }
    }

    p.mouseDragged = () => {
      if (!press || picked >= 0) return
      if (Math.hypot(p.mouseX - press.x, p.mouseY - press.y) > 6) press.dragged = true
      if (!press.dragged) return
      const last = threads[threads.length - 1]
      if (press.newStroke || !last || Math.hypot(p.mouseX - last.x, p.mouseY - last.y) > 6) {
        threads.push({ x: p.mouseX, y: p.mouseY, born: clock, hue: press.hue, fresh: press.newStroke })
        press.newStroke = false
      }
      setHovered(stage.indexAt(p.mouseX, p.mouseY))
      if (reduced) p.redraw()
    }

    p.mouseReleased = () => {
      if (press && !press.dragged && picked < 0) {
        const index = stage.indexAt(p.mouseX, p.mouseY)
        if (index >= 0) {
          picked = index
          pickedAt = performance.now()
          onLeave()
          // 減少動態時不做推近，直接換頁
          setTimeout(() => onPick({ theme: stage.garments[index].theme }), reduced ? 0 : PUSH_MS)
          if (reduced) p.redraw()
        }
      }
      press = null
    }

    p.draw = () => {
      const dt = Math.min(p.deltaTime || 16.7, 50)
      if (!reduced) clock += dt
      const frames = dt / 16.7
      threads = threads.filter((point) => clock - point.born < THREAD_LIFE)

      // 鏡頭推近：0 到 1，越後面越快
      const push = picked >= 0 && !reduced ? Math.min(1, (performance.now() - pickedAt) / PUSH_MS) : 0
      const eased = push * push * push

      const pen = p.drawingContext
      p.background(NIGHT[0], NIGHT[1], NIGHT[2])
      p.image(stars, 0, 0, width, height)

      pen.save()
      if (picked >= 0) {
        // 以被點到的那一區為中心放大整個畫面
        const target = stage.garments[picked]
        pen.translate(target.centerX, target.centerY)
        pen.scale(1 + eased * 7, 1 + eased * 7)
        pen.translate(-target.centerX, -target.centerY)
      }
      pen.lineCap = 'round'
      pen.lineJoin = 'round'

      // 各區之間很淡的連線
      pen.beginPath()
      stage.garments.forEach((garment, g) => {
        const next = stage.garments[(g + 1) % stage.garments.length]
        pen.moveTo(garment.centerX, garment.centerY)
        pen.lineTo(next.centerX, next.centerY)
      })
      pen.lineWidth = 0.7
      pen.strokeStyle = 'rgba(214,218,226,0.07)'
      pen.stroke()

      let liveliest = 0
      stage.garments.forEach((garment, g) => {
        const hue = HUES[garment.theme]
        // 這一區該多熱：被指到是 1；沒被指到但滑鼠在附近，依距離給一部分
        const distance = Math.hypot(p.mouseX - garment.centerX, p.mouseY - garment.centerY)
        const goal = g === hovered || g === picked ? 1 : Math.max(0, 1 - distance / NEAR) * 0.6
        // 每一幀往目標靠近一點，升溫降溫才不會跳
        heat[g] += (goal - heat[g]) * (1 - Math.pow(0.88, frames))
        if (reduced) heat[g] = goal
        const warm = heat[g]
        if (g !== hovered && warm > liveliest) liveliest = warm

        // 亮度：有一區被指到時，其他區壓暗
        const focus = picked >= 0 ? picked : hovered
        const alpha = focus < 0 ? 0.62 + 0.3 * warm : g === focus ? 1 : DIM * 0.62

        pen.save()
        pen.clip(garment.outline)
        pen.strokeStyle = rgba(hue, alpha * 0.9)
        pen.fillStyle = rgba(hue, alpha * 0.9)
        if (garment.theme === 'minimal') drawMinimal(pen, garment.box, warm)
        else if (garment.theme === 'street') drawStreet(pen, garment.box, warm)
        else if (garment.theme === 'vintage') drawVintage(pen, garment.box, warm)
        else if (garment.theme === 'outdoor') drawOutdoor(pen, garment.box, warm)
        else drawFormal(pen, garment.box, warm, hue, alpha)
        pen.restore()

        // 款式圖的輪廓與細節；被指到的那一區加一圈光暈
        pen.save()
        if (g === focus) {
          pen.shadowColor = rgba(hue, 0.9)
          pen.shadowBlur = 14
        }
        pen.strokeStyle = rgba(hue, Math.min(1, alpha + 0.25))
        pen.lineWidth = 1.5
        pen.stroke(garment.outline)
        pen.restore()
        pen.strokeStyle = rgba(hue, alpha * 0.8)
        pen.lineWidth = 1
        garment.seams.forEach((seam) => pen.stroke(seam))
        pen.setLineDash([4, 4])
        garment.stitches.forEach((stitch) => pen.stroke(stitch))
        pen.setLineDash([])
      })

      // 拖曳拉出來的線：越舊越淡
      for (let n = 1; n < threads.length; n++) {
        if (threads[n].fresh) continue
        const age = (clock - threads[n].born) / THREAD_LIFE
        pen.beginPath()
        pen.moveTo(threads[n - 1].x, threads[n - 1].y)
        pen.lineTo(threads[n].x, threads[n].y)
        pen.lineWidth = 1.8
        pen.strokeStyle = rgba(threads[n].hue, 1 - age * age)
        pen.stroke()
      }
      pen.restore()

      // 推近的最後，整個畫面染成那一區的顏色，接到主題頁
      if (picked >= 0 && !reduced) {
        pen.fillStyle = rgba(HUES[stage.garments[picked].theme], eased * 0.92)
        pen.fillRect(0, 0, width, height)
      }

      state = { liveliest, threadPoints: threads.length, hovered, picked, push, clock }
    }

    p.rebuild = build
    p.freeLayers = () => stars?.remove()
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
