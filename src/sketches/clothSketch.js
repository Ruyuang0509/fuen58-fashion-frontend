// 主頁作品「布」。
//
// 做法是 p5 課的「波紋格子」：畫面上排滿結點，每個結點繞著自己的小圓轉，
// 相鄰結點的起始角度錯開一點，整片連起來就像一塊在動的布。
// 橫向把結點連成線是緯線；衣服的範圍裡再加上直向的經線，所以衣服是「織得比較密的地方」。
//
// 互動有兩層：
//   1. 滑鼠經過，附近的布被撥動（結點的圓變大），放開後自己平復。
//   2. 按住拖曳，畫出一條朱色的粉線；粉線經過的地方布被縫住（結點的圓縮小），幾秒後線退掉。
// 點一件衣服會進到那個主題。
import p5 from 'p5'
import { INK, PAPER, VERMILION, layoutGarments, makePaperGrain, prefersReducedMotion } from './stage'

const GAP = 14 // 線與線的距離（像素）
const ORBIT = 4.5 // 靜止時每個結點繞的圓半徑
const TURN = 0.0011 // 每毫秒轉多少弧度
const PHASE_X = 0.38 // 往右一格，起始角度差多少
const PHASE_Y = 0.24 // 往下一格，起始角度差多少
const REACH = 80 // 滑鼠能撥動多遠的布
const CHALK_LIFE = 7000 // 粉線留多久（毫秒）
const PICK_DELAY = 320 // 點選後停多久才換頁，讓朱色的輪廓來得及被看到

const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

export function createClothSketch(container, { onHover = () => {}, onPick = () => {} } = {}) {
  const reduced = prefersReducedMotion()
  let state = null // 給外面檢查用，見最下面的 probe

  const instance = new p5((p) => {
    let width = 0
    let height = 0
    let cols = 0
    let rows = 0
    let stage = null
    let grain = null
    let owner = null // 每個結點在哪件衣服裡（-1 代表不在）
    let span = [] // 每件衣服涵蓋的結點範圍
    let swell = null // 每個結點被撥動的程度，0 到 1
    let pinch = null // 每個結點被粉線縫住的程度，0 到 1
    let nodeX = null
    let nodeY = null
    let clock = 0
    let hovered = -1
    let picked = -1
    let pickedAt = 0
    let chalk = [] // 粉線上的點：{ x, y, born }
    let press = null // 按下去的位置；用來分辨「點一下」和「拖曳」
    let ready = false // 畫布建好了沒

    function build() {
      if (!ready) return
      // 大小沒變就不用重排（ResizeObserver 剛掛上去時會先叫一次）
      if (stage && width === container.clientWidth && height === container.clientHeight) return
      width = container.clientWidth
      height = container.clientHeight
      p.resizeCanvas(width, height)
      stage = layoutGarments(width, height)
      // createGraphics 做出來的圖層是另一張畫布，不用了要自己丟掉，否則每次重排就多留一張
      grain?.remove()
      grain = makePaperGrain(p, width, height)
      // 左右上下各多一圈結點，布的邊緣才不會露出畫面
      cols = Math.floor(width / GAP) + 3
      rows = Math.floor(height / GAP) + 3
      owner = new Int8Array(cols * rows)
      swell = new Float32Array(cols * rows)
      pinch = new Float32Array(cols * rows)
      nodeX = new Float32Array(cols * rows)
      nodeY = new Float32Array(cols * rows)
      // span：每件衣服涵蓋第幾欄到第幾欄、第幾列到第幾列的結點，畫的時候只跑這個範圍
      span = stage.garments.map(() => ({ i0: cols, i1: 0, j0: rows, j1: 0 }))
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const g = stage.indexAt((i - 1) * GAP, (j - 1) * GAP)
          owner[j * cols + i] = g
          if (g < 0) continue
          span[g].i0 = Math.min(span[g].i0, i)
          span[g].i1 = Math.max(span[g].i1, i)
          span[g].j0 = Math.min(span[g].j0, j)
          span[g].j1 = Math.max(span[g].j1, j)
        }
      }
      // 往外多留兩格，裁切之後布料才會一路織到輪廓邊
      for (const range of span) {
        range.i0 = Math.max(0, range.i0 - 2)
        range.i1 = Math.min(cols - 1, range.i1 + 2)
        range.j0 = Math.max(0, range.j0 - 2)
        range.j1 = Math.min(rows - 1, range.j1 + 2)
      }
      chalk = []
      p.redraw()
    }

    p.setup = () => {
      p.createCanvas(container.clientWidth, container.clientHeight)
      // 高解析螢幕最多畫到兩倍，再高看不出差別，只會變慢
      p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2))
      ready = true
      build()
      // 系統設定減少動態時不跑動畫迴圈，只在有操作時重畫一次
      if (reduced) p.noLoop()
    }

    // 以 (x, y) 為中心、radius 為半徑，把 field 裡附近的結點往上推到 amount，越遠推得越少
    function splat(field, x, y, radius, amount) {
      const i0 = Math.max(0, Math.floor((x - radius) / GAP) + 1)
      const i1 = Math.min(cols - 1, Math.ceil((x + radius) / GAP) + 1)
      const j0 = Math.max(0, Math.floor((y - radius) / GAP) + 1)
      const j1 = Math.min(rows - 1, Math.ceil((y + radius) / GAP) + 1)
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const distance = Math.hypot((i - 1) * GAP - x, (j - 1) * GAP - y)
          if (distance > radius) continue
          const k = j * cols + i
          const falloff = 1 - distance / radius
          field[k] = Math.max(field[k], amount * falloff * falloff)
        }
      }
    }

    function setHovered(index) {
      if (index === hovered) return
      hovered = index
      const garment = stage.garments[index]
      onHover(garment ? { theme: garment.theme, kind: garment.kind, x: garment.centerX, y: garment.top } : null)
    }

    p.mouseMoved = () => {
      const travelled = Math.hypot(p.mouseX - p.pmouseX, p.mouseY - p.pmouseY)
      // 動得越快撥得越用力；慢慢移過去只會輕輕動一下
      splat(swell, p.mouseX, p.mouseY, REACH, Math.min(1, travelled / 24))
      setHovered(stage.indexAt(p.mouseX, p.mouseY))
      if (reduced) p.redraw()
    }

    p.mousePressed = () => {
      press = { x: p.mouseX, y: p.mouseY, dragged: false, newStroke: true }
    }

    p.mouseDragged = () => {
      if (!press) return
      if (Math.hypot(p.mouseX - press.x, p.mouseY - press.y) > 6) press.dragged = true
      if (!press.dragged) return
      const last = chalk[chalk.length - 1]
      if (press.newStroke || !last || Math.hypot(p.mouseX - last.x, p.mouseY - last.y) > 8) {
        chalk.push({ x: p.mouseX, y: p.mouseY, born: clock, fresh: press.newStroke })
        press.newStroke = false
        splat(pinch, p.mouseX, p.mouseY, 34, 1)
      }
      if (reduced) p.redraw()
    }

    p.mouseReleased = () => {
      if (press && !press.dragged) {
        const index = stage.indexAt(p.mouseX, p.mouseY)
        if (index >= 0 && picked < 0) {
          picked = index
          pickedAt = clock
          if (reduced) p.redraw()
          setTimeout(() => onPick({ theme: stage.garments[index].theme }), PICK_DELAY)
        }
      }
      press = null
    }

    p.draw = () => {
      // deltaTime 是距離上一幀的毫秒數。切到別的分頁再回來時它會很大，限制在 50 以內，布才不會跳一下
      const dt = Math.min(p.deltaTime || 16.7, 50)
      if (!reduced) clock += dt
      const frames = dt / 16.7

      // 撥動很快退掉，縫住的退得慢
      const swellKeep = Math.pow(0.93, frames)
      const pinchKeep = Math.pow(0.991, frames)
      let liveliest = 0
      for (let k = 0; k < swell.length; k++) {
        swell[k] *= swellKeep
        pinch[k] *= pinchKeep
        if (swell[k] > liveliest) liveliest = swell[k]
        if (pinch[k] > liveliest) liveliest = pinch[k]
      }
      chalk = chalk.filter((point) => clock - point.born < CHALK_LIFE)

      // 算出這一幀每個結點在哪裡
      const turn = clock * TURN
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const k = j * cols + i
          // 滑鼠指著的那件衣服會靜下來，讓它從一片晃動裡被看見
          const calm = hovered >= 0 && owner[k] === hovered ? 0.2 : 1
          const radius = ORBIT * calm * (1 + 2.4 * swell[k]) * (1 - 0.92 * pinch[k])
          const angle = turn + i * PHASE_X + j * PHASE_Y
          nodeX[k] = (i - 1) * GAP + radius * Math.cos(angle)
          nodeY[k] = (j - 1) * GAP + radius * Math.sin(angle)
        }
      }

      p.background(PAPER[0], PAPER[1], PAPER[2])
      p.image(grain, 0, 0, width, height)

      // 下面直接用瀏覽器畫布的原生畫筆（drawingContext）：幾千條線段先全部描進同一條路徑，
      // 最後只上墨一次。一段一段各自上墨會慢很多。
      const pen = p.drawingContext
      pen.lineCap = 'round'
      pen.lineJoin = 'round'

      // 整塊布的緯線：很淡
      pen.beginPath()
      for (let j = 0; j < rows; j++) {
        pen.moveTo(nodeX[j * cols], nodeY[j * cols])
        for (let i = 1; i < cols; i++) pen.lineTo(nodeX[j * cols + i], nodeY[j * cols + i])
      }
      pen.lineWidth = 0.8
      pen.strokeStyle = rgba(INK, 0.17)
      pen.stroke()

      // 每件衣服：輪廓裡面的緯線加深，再加上直向的經線，所以衣服是布上織得比較密的地方
      stage.garments.forEach((garment, g) => {
        // 指著某一件時，其他件退後
        const strength = hovered < 0 ? 0.62 : g === hovered ? 0.92 : 0.26
        // 款式圖跟著衣服中心那個結點一起晃
        const angle = turn + (garment.centerX / GAP) * PHASE_X + (garment.centerY / GAP) * PHASE_Y
        const sway = g === hovered ? ORBIT * 0.2 : ORBIT
        const swayX = sway * Math.cos(angle)
        const swayY = sway * Math.sin(angle)
        const { i0, i1, j0, j1 } = span[g]

        pen.save()
        pen.translate(swayX, swayY)

        // clip：接下來畫的東西只有落在輪廓裡面的部分會留下來
        pen.save()
        pen.clip(garment.outline)
        pen.translate(-swayX, -swayY)
        pen.beginPath()
        for (let j = j0; j <= j1; j++) {
          pen.moveTo(nodeX[j * cols + i0], nodeY[j * cols + i0])
          for (let i = i0 + 1; i <= i1; i++) pen.lineTo(nodeX[j * cols + i], nodeY[j * cols + i])
        }
        for (let i = i0; i <= i1; i++) {
          pen.moveTo(nodeX[j0 * cols + i], nodeY[j0 * cols + i])
          for (let j = j0 + 1; j <= j1; j++) pen.lineTo(nodeX[j * cols + i], nodeY[j * cols + i])
        }
        pen.lineWidth = 1
        pen.strokeStyle = rgba(INK, strength)
        pen.stroke()
        pen.restore()

        const justPicked = g === picked
        pen.strokeStyle = justPicked ? rgba(VERMILION, 1) : rgba(INK, Math.min(1, strength + 0.25))
        pen.lineWidth = justPicked ? 2.2 : 1.5
        pen.stroke(garment.outline)
        pen.lineWidth = 1
        garment.seams.forEach((seam) => pen.stroke(seam))
        pen.setLineDash([4, 4])
        garment.stitches.forEach((stitch) => pen.stroke(stitch))
        pen.setLineDash([])
        pen.restore()
      })

      // 粉線：朱色虛線，越舊越淡
      if (chalk.length > 1) {
        pen.lineWidth = 2
        pen.setLineDash([7, 6])
        for (let n = 1; n < chalk.length; n++) {
          if (chalk[n].fresh) continue // 這一點是新的一筆的起點，不和上一筆相連
          const age = (clock - chalk[n].born) / CHALK_LIFE
          pen.beginPath()
          pen.moveTo(chalk[n - 1].x, chalk[n - 1].y)
          pen.lineTo(chalk[n].x, chalk[n].y)
          pen.strokeStyle = rgba(VERMILION, 1 - age * age)
          pen.stroke()
        }
        pen.setLineDash([])
      }

      state = { liveliest, chalkPoints: chalk.length, hovered, picked, clock, nodes: cols * rows }
    }

    // 外面在畫面大小改變時呼叫
    p.rebuild = build
    p.freeLayers = () => grain?.remove()
  }, container)

  // 容器大小變了就整個重排一次
  const observer = new ResizeObserver(() => instance.rebuild?.())
  observer.observe(container)

  return {
    // 目前的狀態，用來量「放開後有沒有回到靜止」
    probe: () => state,
    dispose() {
      observer.disconnect()
      instance.freeLayers?.()
      instance.remove()
    },
  }
}
