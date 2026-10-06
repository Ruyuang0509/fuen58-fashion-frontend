// 試做：一片布（three.js）。
// 一件衣服不再是貼在 DOM 上的一張圖，而是天空下的一片布：一個分很多格的平面，用現在的款式圖當貼圖（透明底），
// 每一幀把頂點往前後推出風的起伏（上緣掛著不動、愈往下擺得愈大），整片再繞著掛點微微擺；
// 光是一盞平行光，方向跟著天空的太陽（sky.js 的 sunNow），所以傍晚的衣服會偏暖。
// 這只是試做：停損條件寫在 vault 筆記第 13 節——手機 FPS 低於 30、或看起來沒有比 2D 更真，就不投入。
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  WebGLRenderer,
} from 'three'
import { sunNow } from '@/sky/sky'

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} options
 *   textureUrl  款式圖（PNG data URL，透明底）
 *   aspect      圖的寬高比（寬／高）
 *   reduced     減少動態：布不動
 *   onFps       每秒回報一次 FPS
 */
export function createCloth(canvas, { textureUrl, aspect = 0.75, reduced = false, onFps = null } = {}) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' })
  renderer.setClearColor(0x000000, 0)
  // 手機的像素密度常是 3，全開會很吃力；1.5 已經看不出鋸齒
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))

  const scene = new Scene()
  const camera = new PerspectiveCamera(28, 1, 0.1, 50)
  camera.position.set(0.35, 0.1, 6.2)
  camera.lookAt(0, 0, 0)

  // 布：高 3 個單位，寬照圖的比例；格子愈多起伏愈順，每幀要算的頂點也愈多（32×40 ≈ 1300 個，手機還行）
  const height = 3
  const width = height * aspect
  const cols = 32
  const rows = 40
  const geometry = new PlaneGeometry(width, height, cols, rows)
  const base = Float32Array.from(geometry.attributes.position.array) // 沒有風的原位

  const texture = new TextureLoader().load(textureUrl)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
  const material = new MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.08, // 透明底的部分不畫，也不留下半透明的毛邊
    roughness: 0.92,
    metalness: 0,
    side: 2, // DoubleSide：擺到側面時看得到背面
  })
  const cloth = new Mesh(geometry, material)
  scene.add(cloth)

  // 光：太陽方向的平行光 + 環境光；顏色隨太陽高度從暖到白
  const sunLight = new DirectionalLight(0xffffff, 2.2)
  const ambient = new AmbientLight(0xffffff, 0.9)
  scene.add(sunLight, ambient)
  const warm = new Color('#ffd2a0')
  const white = new Color('#ffffff')
  const night = new Color('#8a93b8')

  function lightFromSky(date = new Date()) {
    const sun = sunNow(date)
    // 太陽在畫面左右的位置 → 光從那一側來；高度 → 光的仰角
    const x = (sun.x - 0.5) * 6
    const y = 1.5 + Math.max(0, sun.elevation) * 6
    sunLight.position.set(x, y, 4)
    const day = Math.max(0, Math.min(1, (sun.elevation + 0.1) / 0.5))
    const lowSun = Math.max(0, Math.min(1, 1 - sun.elevation / 0.35))
    sunLight.color.copy(white).lerp(warm, lowSun * day).lerp(night, 1 - day)
    sunLight.intensity = 0.6 + 1.8 * day
    ambient.intensity = 0.35 + 0.6 * day
  }

  // 時間自己算（three 的 Clock 已標記棄用）；暫停時扣掉停住的那段
  let started = performance.now()
  let pausedAt = 0
  const elapsed = () => (performance.now() - started) / 1000
  let wind = 0 // 使用者推出來的風（-1～1），會自己衰減
  let gust = 0.5 // 風的強度（滑桿）
  let frames = 0
  let fpsAt = performance.now()
  let raf = 0
  let running = true

  function resize() {
    const { clientWidth, clientHeight } = canvas
    if (!clientWidth || !clientHeight) return
    renderer.setSize(clientWidth, clientHeight, false)
    camera.aspect = clientWidth / clientHeight
    camera.updateProjectionMatrix()
  }

  function ripple(t) {
    const position = geometry.attributes.position
    const array = position.array
    for (let i = 0; i < array.length; i += 3) {
      const x = base[i]
      const y = base[i + 1]
      // v：0 在上緣（掛著），1 在下襬
      const v = (height / 2 - y) / height
      const sway = v * v
      // 兩個不同頻率的波疊起來，像布被風掠過；下襬擺得最多
      const z = gust * sway * (0.22 * Math.sin(x * 1.6 + t * 1.9 + y * 0.8) + 0.12 * Math.sin(y * 2.3 - t * 1.3) + 0.3 * wind * Math.sin(y * 1.1 + t * 2.6))
      array[i] = x + wind * sway * 0.35
      array[i + 1] = y
      array[i + 2] = z
    }
    position.needsUpdate = true
    geometry.computeVertexNormals()
    // 整片繞著掛點微微擺
    cloth.rotation.z = -wind * 0.09 + Math.sin(t * 0.7) * 0.012 * gust
  }

  function frame() {
    if (!running) return
    raf = requestAnimationFrame(frame)
    const t = elapsed()
    if (!reduced) ripple(t)
    wind *= 0.965
    renderer.render(scene, camera)
    frames += 1
    const now = performance.now()
    if (now - fpsAt >= 1000) {
      onFps?.(Math.round((frames * 1000) / (now - fpsAt)))
      frames = 0
      fpsAt = now
    }
  }

  resize()
  lightFromSky()
  if (reduced) ripple(0)
  frame()
  window.addEventListener('resize', resize, { passive: true })

  return {
    /** 使用者推一下（滑鼠或手指的水平速度） */
    stir(vx) {
      wind = Math.max(-1, Math.min(1, wind + vx * 2.5))
    },
    /** 風的強度 0～1 */
    setGust(value) {
      gust = Math.max(0, Math.min(1, value))
    },
    /** 換時刻（開發時的 ?hour= 也走這裡） */
    setTime(date) {
      lightFromSky(date)
    },
    pause() {
      running = false
      pausedAt = performance.now()
      cancelAnimationFrame(raf)
    },
    resume() {
      if (running) return
      running = true
      started += performance.now() - pausedAt
      frame()
    },
    dispose() {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      geometry.dispose()
      material.dispose()
      texture.dispose()
      renderer.dispose()
    },
  }
}
