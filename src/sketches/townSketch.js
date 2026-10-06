// 主頁作品「商店街」。
//
// 一條手繪的日系商店街，每一間店是一個風格。畫法是插畫地圖那種斜投影，分三層做出 2.5D：
//   後景  遠處的屋頂和雲，沒有線稿、彩度低，移動得慢
//   中景  店本身
//   前景  馬路和路燈，移動得快
// 滑鼠左右移動時三層的錯位不同，拖曳或滾輪可以沿著街走。線稿會「沸騰」（每隔一小段時間換一組抖動）。
//
// 可以玩的：
//   1. 指著一間店，它上色、其他店退成鉛筆線稿；它的遮雨棚飄起來。
//   2. 掃過店門口吊著的衣服，它會晃。
//   3. 按住拖曳走在街上。
// 點一間店，鏡頭推進店門，進到那個風格。
import p5 from 'p5'
import { prefersReducedMotion } from './stage'
import { INK, PAPER, createInk, css, mix, rect, rgb } from './town/ink'
import { hangingGarment, tree } from './town/props'
import { SHOPS } from './town/shops'

const GAP = 150 // 店與店之間的空地（衣服招牌吊在這裡），店座標的單位
const MARGIN = 160 // 街的兩端留白
const GARMENT = 104 // 吊著的衣服的高度（像素）
const PUSH_MS = 650
const BOIL_MS = 140 // 線稿多久換一組抖動
const PENCIL = 0.15 // 沒被指著的店剩多少顏色

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export function createTownSketch(container, { onHover = () => {}, onPick = () => {}, onLeave = () => {}, onLayout = () => {} } = {}) {
  const reduced = prefersReducedMotion()
  let state = null
  let focusTheme = null

  const instance = new p5((p) => {
    let W = 0
    let H = 0
    let ground = 0 // 人行道前緣在畫面上的 y
    let shops = []
    let worldW = 0
    let scroll = 0
    let scrollGoal = 0
    let grain = null
    let ink = null
    let clock = 0
    let hovered = -1
    let picked = -1
    let pickedAt = 0
    let press = null
    let last = { x: 0, y: 0 }
    let speed = 0
    let ready = false
    let lastLayoutScroll = -1
    let S = 1 // 店座標的 1 等於畫面上幾個像素：螢幕越高店越大

    function place() {
      ground = Math.round(H * 0.74)
      S = clamp(H / 560, 0.8, 1.4)
      let x = MARGIN
      shops = SHOPS.map((def) => {
        const shop = { def, x, w: def.width * S, on: 0, colour: 0.92, sway: 0, swayV: 0, keyRgb: rgb(def.key), clothRgb: rgb(def.cloth) }
        x += shop.w + GAP * S
        return shop
      })
      worldW = x - GAP * S + MARGIN
      scroll = scrollGoal = clamp((worldW - W) / 2, 0, Math.max(0, worldW - W))
    }

    // 紙的顆粒：只做一次
    function paper() {
      const density = p.pixelDensity()
      grain = document.createElement('canvas')
      grain.width = Math.round(W * density)
      grain.height = Math.round(H * density)
      const g = grain.getContext('2d')
      const image = g.createImageData(grain.width, grain.height)
      const data = image.data
      for (let i = 0; i < data.length; i += 4) {
        // 均勻分布的細點：紙的纖維哪裡都一樣密
        const v = Math.random()
        data[i] = data[i + 1] = data[i + 2] = v < 0.5 ? 40 : 255
        data[i + 3] = v < 0.08 || v > 0.94 ? 22 : 0
      }
      g.putImageData(image, 0, 0)
    }

    function build() {
      if (!ready) return
      if (grain && W === container.clientWidth && H === container.clientHeight) return
      W = container.clientWidth
      H = container.clientHeight
      p.resizeCanvas(W, H)
      place()
      paper()
      lastLayoutScroll = -1
      p.redraw()
    }

    p.setup = () => {
      p.createCanvas(container.clientWidth, container.clientHeight)
      p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2))
      ink = createInk(p.drawingContext)
      ready = true
      build()
      if (reduced) p.noLoop()
    }

    // ── 位置換算 ──

    const toWorld = (sx) => sx + scroll
    const shopAt = (sx, sy) => {
      const wx = toWorld(sx)
      return shops.findIndex((shop) => wx >= shop.x - 70 * S && wx <= shop.x + shop.w + 20 && sy >= ground - (shop.def.height + 70) * S && sy <= ground + 26)
    }
    // 衣服在世界座標裡佔的矩形（給撥動用）
    function garmentBox(shop) {
      const [bx, bz] = shop.def.bracket
      const [ax, ay] = ink.at(bx, -30, bz)
      return { x: shop.x + ax * S, top: ground + (ay + 10) * S, halfWidth: GARMENT * 0.4 * S, height: GARMENT * 0.92 * S }
    }

    function setHovered(index) {
      if (index === hovered) return
      hovered = index
      container.style.cursor = index >= 0 ? 'pointer' : 'grab'
      onHover(index >= 0 ? { theme: shops[index].def.theme } : null)
    }

    p.mouseMoved = () => {
      if (picked >= 0) return
      setHovered(shopAt(p.mouseX, p.mouseY))
      if (reduced) p.redraw()
    }

    p.mousePressed = () => {
      press = { x: p.mouseX, y: p.mouseY, scroll, dragged: false }
    }

    p.mouseDragged = () => {
      if (!press || picked >= 0) return
      if (Math.abs(p.mouseX - press.x) > 6) press.dragged = true
      if (press.dragged) {
        container.style.cursor = 'grabbing'
        scrollGoal = clamp(press.scroll - (p.mouseX - press.x), 0, Math.max(0, worldW - W))
        if (reduced) scroll = scrollGoal
      }
      if (reduced) p.redraw()
    }

    p.mouseReleased = () => {
      if (press && !press.dragged && picked < 0) {
        const index = shopAt(p.mouseX, p.mouseY)
        if (index >= 0) {
          picked = index
          pickedAt = performance.now()
          onLeave()
          setTimeout(() => onPick({ theme: shops[index].def.theme }), reduced ? 0 : PUSH_MS)
          if (reduced) p.redraw()
        }
      }
      press = null
      container.style.cursor = hovered >= 0 ? 'pointer' : 'grab'
    }

    p.mouseWheel = (event) => {
      scrollGoal = clamp(scrollGoal + (event.deltaX || event.deltaY) * 0.9, 0, Math.max(0, worldW - W))
      if (reduced) {
        scroll = scrollGoal
        p.redraw()
      }
      return false
    }

    // ── 後景與前景 ──

    function drawBackdrop(shift) {
      const { drawingContext: ctx } = p
      ctx.save()
      ctx.translate(shift, 0)
      // 太陽
      ctx.fillStyle = 'rgba(248,214,160,0.75)'
      ctx.beginPath()
      ctx.arc(W * 0.78 + scroll * 0.25, H * 0.16, 34, 0, Math.PI * 2)
      ctx.fill()
      // 幾隻鳥
      for (const [bx, by, s] of [[0.36, 0.14, 1], [0.4, 0.17, 0.8], [0.44, 0.13, 0.9]]) {
        const X = bx * W + scroll * 0.2
        const Y = by * H
        ink.stroke([[X - 9 * s, Y], [X - 3 * s, Y - 5 * s], [X, Y - 2 * s], [X + 3 * s, Y - 5 * s], [X + 9 * s, Y]], { w: 1.1, alpha: 0.7, id: 7700 + Math.round(bx * 100) })
      }
      // 遠處的屋頂：一整排剪影，淡藍灰、沒有線稿（遠景不畫線）
      const roofs = rgb('#d3dbe2')
      ctx.fillStyle = css(roofs, 0.9)
      ctx.beginPath()
      const base = ground - 150
      ctx.moveTo(-200, ground)
      let x = -200
      let n = 0
      while (x < worldW + 400) {
        const w = 70 + ((n * 37) % 90)
        const h = 40 + ((n * 53) % 70)
        ctx.lineTo(x, base - h)
        if (n % 3 === 0) {
          ctx.lineTo(x + w / 2, base - h - 26)
        }
        ctx.lineTo(x + w, base - h)
        x += w
        n++
      }
      ctx.lineTo(x, ground)
      ctx.closePath()
      ctx.fill()
      // 更遠一排，更淡
      ctx.fillStyle = css(mix(roofs, rgb(PAPER), 0.5), 0.9)
      ctx.beginPath()
      ctx.moveTo(-300, ground)
      x = -300
      n = 0
      while (x < worldW + 500) {
        const w = 110 + ((n * 41) % 120)
        const h = 90 + ((n * 29) % 60)
        ctx.lineTo(x, base - h)
        ctx.lineTo(x + w, base - h)
        x += w
        n++
      }
      ctx.lineTo(x, ground)
      ctx.closePath()
      ctx.fill()
      // 雲：幾個疊起來的圓，沒有線
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      for (const [cx, cy, s] of [[0.2, 0.2, 1], [0.55, 0.12, 0.7], [1.1, 0.24, 0.9]]) {
        const X = cx * W + scroll * 0.15
        const Y = cy * H
        ctx.beginPath()
        ctx.ellipse(X, Y, 46 * s, 14 * s, 0, 0, Math.PI * 2)
        ctx.ellipse(X - 18 * s, Y - 8 * s, 22 * s, 14 * s, 0, 0, Math.PI * 2)
        ctx.ellipse(X + 14 * s, Y - 12 * s, 26 * s, 17 * s, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    function drawSidewalk() {
      const { drawingContext: ctx } = p
      // 人行道：一條淡灰帶，前緣一條手繪線
      ctx.fillStyle = '#ebe3d6'
      ctx.fillRect(-50, ground - 34, worldW + 100, 52)
      ink.stroke([[-50, ground + 18], [worldW + 50, ground + 18]], { w: 1.8, gaps: 6, id: 7001 })
      // 磚縫：短短的斜線，稀稀疏疏
      for (let x = -40; x < worldW + 40; x += 46) ink.stroke([[x, ground + 4], [x + 18, ground - 6]], { w: 0.8, alpha: 0.35, id: 7100 + x })
    }

    function drawRoad(shift) {
      const { drawingContext: ctx } = p
      ctx.save()
      ctx.translate(shift, 0)
      ctx.fillStyle = '#e2dbd0'
      ctx.fillRect(-400, ground + 18, worldW * 1.4 + 800, H)
      // 路中間的虛線
      for (let x = -400; x < worldW * 1.4 + 400; x += 70) ink.stroke([[x, ground + 70], [x + 34, ground + 70]], { w: 2.4, alpha: 0.5, colour: rgb('#ffffff'), id: 7200 + x })
      ctx.restore()
    }

    // 電線桿：桿、兩根橫擔、一盞路燈。translated 為 true 表示還沒換到它的位置
    function utilityPole(x, id, translated = false) {
      const { drawingContext: ctx } = p
      if (translated) {
        ctx.save()
        ctx.translate(x, ground)
        ctx.scale(S, S)
      }
      const [px, py] = ink.at(0, 30, 0)
      const wood = rgb('#8a7f74')
      ink.stroke([[px, py], [px, py - 300]], { w: 3, colour: wood, id: 7300 + id })
      ink.stroke([[px - 22, py - 262], [px + 22, py - 262]], { w: 2.2, colour: wood, id: 7320 + id })
      ink.stroke([[px - 16, py - 282], [px + 16, py - 282]], { w: 2, colour: wood, id: 7340 + id })
      ink.stroke([[px, py - 180], [px + 26, py - 190]], { w: 2, colour: wood, id: 7350 + id })
      ink.shape(rect(px + 20, py - 202, 14, 12), rgb('#f6e3a3'), { w: 1.3, id: 7355 + id })
      if (translated) ctx.restore()
    }

    // ── 每一幀 ──

    p.draw = () => {
      const dt = Math.min(p.deltaTime || 16.7, 50)
      if (!reduced) clock += dt
      const frames = dt / 16.7
      const ease = reduced ? 1 : 1 - Math.pow(0.86, frames)
      speed = (p.mouseX - last.x) / frames
      last = { x: p.mouseX, y: p.mouseY }
      scroll += (scrollGoal - scroll) * (reduced ? 1 : 1 - Math.pow(0.8, frames))

      const keyboard = focusTheme ? shops.findIndex((shop) => shop.def.theme === focusTheme) : -1
      const focus = picked >= 0 ? picked : hovered >= 0 ? hovered : keyboard

      shops.forEach((shop, g) => {
        const onGoal = g === focus ? 1 : 0
        shop.on += (onGoal - shop.on) * ease
        const colourGoal = focus < 0 ? 0.92 : g === focus ? 1 : PENCIL
        shop.colour += (colourGoal - shop.colour) * ease
        if (!reduced) {
          const seconds = dt / 1000
          const box = garmentBox(shop)
          const mx = toWorld(p.mouseX)
          const touching = picked < 0 && Math.abs(mx - box.x) <= box.halfWidth && p.mouseY >= box.top && p.mouseY <= box.top + box.height
          if (touching) shop.swayV -= clamp(speed, -60, 60) * 0.016 * frames
          const breeze = 0.2 * Math.sin(clock * 0.0011 + g * 1.7)
          shop.swayV += (-17.6 * shop.sway - 1.5 * shop.swayV + breeze) * seconds
          shop.swayV = clamp(shop.swayV, -3.2, 3.2)
          shop.sway += shop.swayV * seconds
        }
      })

      // 滑鼠位置決定三層的錯位（2.5D 的視差）
      const parX = (p.mouseX / W - 0.5) * 2 || 0
      const parY = (p.mouseY / H - 0.5) * 2 || 0
      const push = picked >= 0 && !reduced ? Math.min(1, (performance.now() - pickedAt) / PUSH_MS) : 0
      const eased = push * push * push

      const ctx = p.drawingContext
      ctx.fillStyle = PAPER
      ctx.fillRect(0, 0, W, H)
      ink.phase = reduced ? 0 : Math.floor(clock / BOIL_MS)

      ctx.save()
      if (picked >= 0) {
        const target = shops[picked]
        const cx = target.x + target.w * 0.55 - scroll
        const cy = ground - target.def.height * 0.3 * S
        ctx.translate(cx, cy)
        ctx.scale(1 + eased * 5, 1 + eased * 5)
        ctx.translate(-cx, -cy)
      }

      drawBackdrop(-scroll * 0.25 - parX * 10 - 0 * parY)

      ctx.save()
      ctx.translate(-scroll - parX * 4, parY * 3)
      ink.colour = 1
      ink.boil = 0.8
      drawSidewalk()
      // 店與店之間：輪流站一根電線桿（附路燈）或一棵樹，在人行道後排；電線桿之間拉電線
      const poles = []
      shops.forEach((shop, g) => {
        if (!g) return
        const before = shops[g - 1]
        const x = before.x + before.w + 18 * S
        ctx.save()
        ctx.translate(x, ground)
        ctx.scale(S, S)
        if (g % 2) {
          utilityPole(x, g)
          poles.push(x + 30 * 0.52 * S)
        } else tree(ink, 0, 30, { size: 1.15, id: 7600 + g })
        ctx.restore()
      })
      // 第一間店左邊也站一根，電線才有地方接
      utilityPole(shops[0].x - 60 * S, 99, true)
      poles.unshift(shops[0].x - 60 * S + 30 * 0.52 * S)
      for (let i = 1; i < poles.length; i++) {
        for (const [dz, sag] of [[262, 22], [282, 16]]) {
          const wire = []
          for (let k = 0; k <= 14; k++) {
            const t = k / 14
            wire.push([poles[i - 1] + (poles[i] - poles[i - 1]) * t, ground - dz * S - 30 * 0.3 * S + Math.sin(t * Math.PI) * sag])
          }
          ink.stroke(wire, { w: 1, alpha: 0.6, taper: false, id: 7360 + i * 2 + (sag === 22 ? 0 : 1) })
        }
      }
      shops.forEach((shop, g) => {
        const { def } = shop
        ctx.save()
        ctx.translate(shop.x, ground - shop.on * 3)
        ctx.scale(S, S)
        // 被指著的店微微放大，從地面中央長出去
        const pop = 1 + 0.025 * shop.on
        ctx.translate(def.width / 2, 0)
        ctx.scale(pop, pop)
        ctx.translate(-def.width / 2, 0)
        ink.colour = shop.colour
        ink.boil = 0.8 + 0.9 * shop.on
        // 店的影子：地上一片淡灰
        ctx.fillStyle = `rgba(80,70,60,${0.12 * ink.colour})`
        ctx.beginPath()
        ctx.ellipse(def.width / 2 + 20, 6, def.width * 0.62, 10, 0, 0, Math.PI * 2)
        ctx.fill()
        def.draw(ink, clock, shop.on)

        // 掛衣服的支架：從牆伸出來，前端垂一小段鍊子，衣服吊在下面
        const [bx, bz] = def.bracket
        const [ax, ay] = ink.at(bx, -30, bz)
        ink.stroke([[bx, -bz], [ax, ay]], { w: 2.2, id: 9000 + g })
        ink.stroke([[bx, -bz + 14], [ax - 6, ay + 1]], { w: 1.4, id: 9010 + g })
        ink.stroke([[ax, ay], [ax, ay + 10]], { w: 1.2, id: 9020 + g })
        hangingGarment(ink, def.kind, [ax, ay + 10], GARMENT, shop.sway, shop.clothRgb, def.line, 9100 + g * 100)
        ctx.restore()
      })
      ctx.restore()

      ink.colour = 1
      ink.boil = 0.8
      drawRoad(-scroll * 1.25 + parX * 16 + 0 * parY)
      ctx.restore()

      // 紙的顆粒
      ctx.drawImage(grain, 0, 0, W, H)

      // 推進店門的最後：整張紙染成那間店的顏色
      if (picked >= 0 && !reduced) {
        ctx.fillStyle = css(shops[picked].keyRgb, eased * 0.96)
        ctx.fillRect(0, 0, W, H)
      }

      // 店名的位置給外面（文字是 DOM）
      if (Math.abs(scroll - lastLayoutScroll) > 0.4) {
        lastLayoutScroll = scroll
        onLayout(shops.map((shop) => ({ theme: shop.def.theme, x: shop.x + shop.w / 2 - scroll, y: ground + 30 })))
      }

      state = {
        hovered,
        picked,
        push,
        clock,
        scroll: Math.round(scroll),
        worldW,
        on: shops.map((shop) => +shop.on.toFixed(3)),
        colour: shops.map((shop) => +shop.colour.toFixed(3)),
        sway: shops.map((shop) => +shop.sway.toFixed(4)),
        boxes: shops.map((shop) => {
          const box = garmentBox(shop)
          return { ...box, x: box.x - scroll }
        }),
        centres: shops.map((shop) => ({ theme: shop.def.theme, x: shop.x + shop.w / 2 - scroll, y: ground - (shop.def.height / 2) * S })),
      }
    }

    p.rebuild = build
    p.wake = () => reduced && p.redraw()
  }, container)

  const observer = new ResizeObserver(() => instance.rebuild?.())
  observer.observe(container)

  return {
    probe: () => state,
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

export { INK }
