// 把款式圖畫成「像商品圖」的樣子：有布的厚度、有皺褶的陰影、有布料的紋理，沒有線稿。
//
// 正式上線時這裡會換成真正的商品去背照片；現在沒有照片，先用程式把款式圖「打光」。
// 做法是一層一層疊上去（都裁在衣服的輪廓裡）：
//   1. 底色
//   2. 整體的光：左上亮、右下暗
//   3. 輪廓內側一圈暗，布才有厚度
//   4. 沿著車縫線的皺褶：一邊暗、一邊亮
//   5. 布料紋理：棉的細顆粒、丹寧的斜紋、皮的亮面、尼龍的光澤
//   6. 車縫線與鈕扣
// 回傳的是 PNG 的 data URL，可以直接給 <img>。同一組參數只畫一次。
import { FLAT_BOX, FLATS } from './flats'

const cache = new Map()

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

// 細顆粒的雜訊圖，只做一次，之後當成貼圖重複貼
let grainTile = null
function grain() {
  if (grainTile) return grainTile
  grainTile = document.createElement('canvas')
  grainTile.width = grainTile.height = 128
  const g = grainTile.getContext('2d')
  const image = g.createImageData(128, 128)
  for (let i = 0; i < image.data.length; i += 4) {
    // 均勻分布：布的織紋到處一樣密
    const v = 110 + Math.random() * 90
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v
    image.data[i + 3] = 255
  }
  g.putImageData(image, 0, 0)
  return grainTile
}

/**
 * @param {string} kind    款式：coat | top | trousers | skirt | vest | dress | blouse | jacket
 * @param {object} options colour 布色（#rrggbb）；fabric 布料：cotton | denim | leather | nylon | wool | satin；px 畫出來的高度（像素）
 */
export function renderGarment(kind, { colour = '#cccccc', fabric = 'cotton', px = 640 } = {}) {
  const key = `${kind}|${colour}|${fabric}|${px}`
  if (cache.has(key)) return cache.get(key)

  const flat = FLATS[kind]
  const k = px / FLAT_BOX.height
  const pad = 12 // 四周留白給柔邊
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(FLAT_BOX.width * k + pad * 2)
  canvas.height = Math.round(px + pad * 2)
  const ctx = canvas.getContext('2d')
  ctx.translate(pad, pad)
  ctx.scale(k, k)
  const body = new Path2D(flat.body)
  const seams = flat.seams.map((d) => new Path2D(d))
  const base = hexToRgb(colour)
  const light = base.map((v) => Math.min(255, v * 0.35 + 255 * 0.65))
  const shade = base.map((v) => v * 0.45)
  const bright = Math.max(...base) > 200 // 淺色布：陰影要更輕，不然會髒

  // 1. 底色
  ctx.fillStyle = colour
  ctx.fill(body)

  ctx.save()
  ctx.clip(body)

  // 2. 整體的光：左上到右下
  const sun = ctx.createLinearGradient(10, 0, 110, 160)
  sun.addColorStop(0, rgba(light, 0.35))
  sun.addColorStop(0.45, rgba(light, 0))
  sun.addColorStop(0.7, rgba(shade, 0))
  sun.addColorStop(1, rgba(shade, bright ? 0.22 : 0.38))
  ctx.fillStyle = sun
  ctx.fillRect(-10, -10, 140, 180)

  // 兩側往裡暗一點，身體才是圓的
  const sides = ctx.createLinearGradient(0, 0, 120, 0)
  sides.addColorStop(0, rgba(shade, bright ? 0.18 : 0.3))
  sides.addColorStop(0.25, rgba(shade, 0))
  sides.addColorStop(0.75, rgba(shade, 0))
  sides.addColorStop(1, rgba(shade, bright ? 0.22 : 0.36))
  ctx.fillStyle = sides
  ctx.fillRect(-10, -10, 140, 180)

  // 3. 輪廓內側一圈暗：線畫在輪廓上，裁掉外面那一半就是內陰影
  ctx.filter = 'blur(1.6px)' // 模糊的單位跟著目前的縮放，所以這裡的 px 是款式圖格子的單位
  ctx.lineWidth = 5
  ctx.strokeStyle = rgba(shade, bright ? 0.35 : 0.5)
  ctx.stroke(body)
  ctx.filter = 'none'

  // 4. 皺褶：沿著車縫線，右下暗、左上亮
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.filter = 'blur(1px)'
  seams.forEach((seam) => {
    ctx.save()
    ctx.translate(1.2, 1.2)
    ctx.lineWidth = 2.6
    ctx.strokeStyle = rgba(shade, bright ? 0.28 : 0.42)
    ctx.stroke(seam)
    ctx.restore()
    ctx.save()
    ctx.translate(-0.9, -0.9)
    ctx.lineWidth = 1.4
    ctx.strokeStyle = rgba(light, 0.35)
    ctx.stroke(seam)
    ctx.restore()
  })
  ctx.filter = 'none'

  // 5. 布料紋理
  if (fabric === 'denim') {
    ctx.strokeStyle = rgba(light, 0.13)
    ctx.lineWidth = 0.4
    ctx.beginPath()
    for (let s = -160; s < 160; s += 1.6) {
      ctx.moveTo(s, 0)
      ctx.lineTo(s + 160, 160)
    }
    ctx.stroke()
  } else if (fabric === 'leather') {
    // 皮：大片柔和的高光
    ctx.filter = 'blur(3px)'
    ctx.strokeStyle = 'rgba(255,255,255,0.13)'
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.moveTo(44, 20)
    ctx.quadraticCurveTo(36, 60, 40, 100)
    ctx.moveTo(78, 20)
    ctx.quadraticCurveTo(84, 50, 82, 80)
    ctx.stroke()
    ctx.filter = 'none'
  } else if (fabric === 'nylon') {
    // 尼龍：每一格鼓起來，格子上緣亮、下緣暗
    ctx.filter = 'blur(1.4px)'
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 3
    seams.forEach((seam) => {
      ctx.save()
      ctx.translate(0, -5)
      ctx.stroke(seam)
      ctx.restore()
    })
    ctx.filter = 'none'
  } else if (fabric === 'satin') {
    // 緞：直向的亮帶
    ctx.filter = 'blur(2px)'
    ctx.fillStyle = 'rgba(255,255,255,0.09)'
    for (const x of [30, 58, 86]) ctx.fillRect(x, 20, 7, 140)
    ctx.filter = 'none'
  }
  // 所有布都有一點細顆粒；羊毛的粗一點
  ctx.save()
  ctx.globalAlpha = fabric === 'wool' ? 0.35 : 0.22
  ctx.globalCompositeOperation = 'overlay'
  const tile = grain()
  const scaleTile = fabric === 'wool' ? 0.55 : 0.3
  ctx.scale(scaleTile, scaleTile)
  for (let y = 0; y < 160 / scaleTile; y += 128) for (let x = 0; x < 120 / scaleTile; x += 128) ctx.drawImage(tile, x, y)
  ctx.restore()

  // 6. 車縫線：一明一暗兩條很細的虛線；鈕扣
  ctx.setLineDash([2.2, 1.6])
  ctx.lineWidth = 0.45
  flat.stitches.forEach((d) => {
    const path = new Path2D(d)
    ctx.strokeStyle = rgba(shade, 0.55)
    ctx.stroke(path)
    ctx.save()
    ctx.translate(0, -0.6)
    ctx.strokeStyle = rgba(light, 0.5)
    ctx.stroke(path)
    ctx.restore()
  })
  ctx.setLineDash([])
  ctx.restore()

  flat.dots.forEach(([x, y]) => {
    const button = ctx.createRadialGradient(x - 0.6, y - 0.6, 0.2, x, y, 2.2)
    button.addColorStop(0, rgba(light, 0.95))
    button.addColorStop(1, rgba(shade, 0.9))
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath()
    ctx.arc(x + 0.5, y + 0.7, 2.1, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = button
    ctx.beginPath()
    ctx.arc(x, y, 2, 0, Math.PI * 2)
    ctx.fill()
  })

  const url = canvas.toDataURL('image/png')
  cache.set(key, url)
  return url
}

/**
 * 沒有款式圖的商品（襪子、皮帶這類配件）用「布料的近拍」代替：一塊圓角的布，
 * 同樣的打光與紋理。正式版換成商品照片。
 * @param {object} options colour 布色；fabric 布料；px 邊長（像素）
 */
export function renderSwatch({ colour = '#cccccc', fabric = 'cotton', px = 480 } = {}) {
  const key = `swatch|${colour}|${fabric}|${px}`
  if (cache.has(key)) return cache.get(key)

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = px
  const ctx = canvas.getContext('2d')
  const k = px / 120
  ctx.scale(k, k)
  const base = hexToRgb(colour)
  const light = base.map((v) => Math.min(255, v * 0.35 + 255 * 0.65))
  const shade = base.map((v) => v * 0.45)
  const bright = Math.max(...base) > 200

  // 布塊的形狀：圓角方形，右下角微微翹起來的感覺用一條亮邊表示
  const body = new Path2D('M14 10Q10 10 10 14V106Q10 110 14 110H106Q110 110 110 106V14Q110 10 106 10Z')
  ctx.fillStyle = colour
  ctx.fill(body)
  ctx.save()
  ctx.clip(body)

  const sun = ctx.createLinearGradient(10, 10, 110, 110)
  sun.addColorStop(0, rgba(light, 0.32))
  sun.addColorStop(0.5, rgba(light, 0))
  sun.addColorStop(1, rgba(shade, bright ? 0.2 : 0.34))
  ctx.fillStyle = sun
  ctx.fillRect(0, 0, 120, 120)

  ctx.filter = 'blur(1.6px)'
  ctx.lineWidth = 5
  ctx.strokeStyle = rgba(shade, bright ? 0.3 : 0.45)
  ctx.stroke(body)
  ctx.filter = 'none'

  // 布面的起伏：三道柔和的斜向皺褶
  ctx.filter = 'blur(1.4px)'
  ctx.lineCap = 'round'
  for (const [x, y] of [[30, 20], [60, 40], [40, 80]]) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + 30, y + 10, x + 60, y + 36)
    ctx.lineWidth = 3
    ctx.strokeStyle = rgba(shade, bright ? 0.2 : 0.3)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x - 1.5, y - 2)
    ctx.quadraticCurveTo(x + 28, y + 8, x + 58, y + 34)
    ctx.lineWidth = 1.6
    ctx.strokeStyle = rgba(light, 0.35)
    ctx.stroke()
  }
  ctx.filter = 'none'

  if (fabric === 'denim') {
    ctx.strokeStyle = rgba(light, 0.13)
    ctx.lineWidth = 0.4
    ctx.beginPath()
    for (let s = -120; s < 120; s += 1.6) {
      ctx.moveTo(s, 0)
      ctx.lineTo(s + 120, 120)
    }
    ctx.stroke()
  } else if (fabric === 'leather') {
    ctx.filter = 'blur(3px)'
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'
    ctx.lineWidth = 9
    ctx.beginPath()
    ctx.moveTo(24, 30)
    ctx.quadraticCurveTo(60, 20, 96, 44)
    ctx.stroke()
    ctx.filter = 'none'
  } else if (fabric === 'satin') {
    ctx.filter = 'blur(2px)'
    ctx.fillStyle = 'rgba(255,255,255,0.09)'
    for (const x of [26, 54, 82]) ctx.fillRect(x, 10, 7, 110)
    ctx.filter = 'none'
  }
  ctx.save()
  ctx.globalAlpha = fabric === 'wool' ? 0.38 : 0.22
  ctx.globalCompositeOperation = 'overlay'
  const tile = grain()
  const scaleTile = fabric === 'wool' ? 0.55 : 0.3
  ctx.scale(scaleTile, scaleTile)
  for (let y = 0; y < 120 / scaleTile; y += 128) for (let x = 0; x < 120 / scaleTile; x += 128) ctx.drawImage(tile, x, y)
  ctx.restore()
  ctx.restore()

  const url = canvas.toDataURL('image/png')
  cache.set(key, url)
  return url
}
