// 主頁作品共用的東西：墨與紙的顏色、衣服擺在哪裡、滑鼠指到哪一件。
import { FLAT_BOX, FLATS } from '@/garments/flats'

// 顏色只有三個：紙、墨、朱。朱色只留給「你做了什麼」（畫線、點選），平常畫面上沒有它。
export const PAPER = [242, 237, 227]
export const INK = [29, 27, 24]
export const VERMILION = [200, 55, 29]

// 每個主題先用一件衣服代表。位置與大小是畫面寬高的比例，故意不對齊成一排。
// 主題和衣服的對應是暫定的。
const PLACEMENT = [
  { theme: 'formal', kind: 'coat', cx: 0.22, cy: 0.52, size: 0.6 },
  { theme: 'minimal', kind: 'top', cx: 0.46, cy: 0.33, size: 0.34 },
  { theme: 'street', kind: 'trousers', cx: 0.61, cy: 0.67, size: 0.44 },
  { theme: 'vintage', kind: 'skirt', cx: 0.8, cy: 0.38, size: 0.38 },
  { theme: 'outdoor', kind: 'beanie', cx: 0.41, cy: 0.8, size: 0.3 },
]

/**
 * 依畫面大小算出每件衣服的實際位置，並準備好兩樣東西：
 *   outline  可以直接畫在畫布上的輪廓路徑（Path2D）
 *   indexAt  問「畫面上這一點在哪一件衣服裡」的函式，回傳第幾件，不在任何一件裡回傳 -1
 */
export function layoutGarments(width, height) {
  // 另外開一張看不見的小畫布專門用來問「點在不在路徑裡」，不會被主畫布的縮放影響
  const probe = document.createElement('canvas').getContext('2d')

  const garments = PLACEMENT.map((spot) => {
    const flat = FLATS[spot.kind]
    const scale = (height * spot.size) / FLAT_BOX.height
    const x = width * spot.cx - (FLAT_BOX.width * scale) / 2
    const y = height * spot.cy - (FLAT_BOX.height * scale) / 2
    const place = new DOMMatrix([scale, 0, 0, scale, x, y])
    const moved = (d) => {
      const path = new Path2D()
      path.addPath(new Path2D(d), place)
      return path
    }
    return {
      theme: spot.theme,
      kind: spot.kind,
      centerX: width * spot.cx,
      centerY: height * spot.cy,
      top: y,
      // 外框：這件衣服佔的矩形範圍
      box: { left: x, top: y, width: FLAT_BOX.width * scale, height: FLAT_BOX.height * scale },
      outline: moved(flat.body),
      seams: flat.seams.map(moved),
      stitches: flat.stitches.map(moved),
    }
  })

  // 把畫面切成 6 像素的小格，先算好每一格屬於哪件衣服。
  // 之後每一幀要問幾千次「這一點在哪件衣服裡」，查表比每次重算路徑快得多。
  const CELL = 6
  const cols = Math.ceil(width / CELL)
  const rows = Math.ceil(height / CELL)
  const table = new Int8Array(cols * rows).fill(-1)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px = col * CELL + CELL / 2
      const py = row * CELL + CELL / 2
      for (let g = 0; g < garments.length; g++) {
        if (probe.isPointInPath(garments[g].outline, px, py)) {
          table[row * cols + col] = g
          break
        }
      }
    }
  }

  function indexAt(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return -1
    return table[Math.floor(y / CELL) * cols + Math.floor(x / CELL)]
  }

  return { garments, indexAt }
}

/** 紙紋：一張只畫一次的雜點圖，之後每一幀直接貼上去。 */
export function makePaperGrain(p, width, height) {
  const layer = p.createGraphics(width, height)
  layer.pixelDensity(1)
  layer.noStroke()
  // 雜點的位置用均勻分布：紙的纖維沒有哪裡特別密
  for (let i = 0; i < (width * height) / 90; i++) {
    layer.fill(INK[0], INK[1], INK[2], p.random(4, 16))
    layer.circle(p.random(width), p.random(height), p.random(0.6, 1.8))
  }
  return layer
}

/** 使用者的系統有沒有設定「減少動態」。 */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
