// 整個畫面的底：一片慢慢流動的漸層，顏色跟著被指到的單品換。
//
// 參考的是 Skylrk 首頁（2026-10-06 實際看過它的網頁與程式結構）：
// 一個顏色拆成四個深淺（上、下、點綴、暗），用雜訊把座標轉一轉、再用正弦波扭一下，
// 四色之間平滑混合；滑鼠所在的地方往最亮的那個顏色提亮；最後加一層細顆粒。
// 這裡是照這個想法自己寫的，數值不同。
//
// 沒有 WebGL 的時候退回 CSS 的放射漸層（顏色一樣會換，只是不會流動）。

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FRAG = `
precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec3 uTop;
uniform vec3 uBottom;
uniform vec3 uAccent;
uniform vec3 uDark;
uniform vec2 uFocus;
uniform float uFocusK;
varying vec2 vUv;

mat2 rot(float a) { float s = sin(a); float c = cos(a); return mat2(c, -s, s, c); }
vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(2127.1, 81.17)), dot(p, vec2(1269.5, 283.37)));
  return fract(sin(p) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return 0.5 + 0.5 * mix(
    mix(dot(-1.0 + 2.0 * hash(i), f), dot(-1.0 + 2.0 * hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(-1.0 + 2.0 * hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(-1.0 + 2.0 * hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y);
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vUv;
  vec2 p = uv - 0.5;
  float t = uTime * 0.4;

  // 整片慢慢轉，轉多少由雜訊決定
  float turn = noise(vec2(t * 0.06, p.x * p.y));
  p.y /= aspect;
  p *= rot((turn - 0.5) * 9.0);
  p.y *= aspect;

  // 正弦波扭一下，像熔岩燈
  p.x += sin(p.y * 4.0 + t * 1.6) / 26.0;
  p.y += sin(p.x * 6.0 + t * 1.6) / 13.0;

  vec3 left = mix(uAccent, uDark, smoothstep(-0.35, 0.25, (p * rot(-0.1)).x));
  vec3 right = mix(uBottom, uTop, smoothstep(-0.35, 0.25, (p * rot(-0.1)).x));
  vec3 col = mix(left, right, smoothstep(0.5, -0.35, p.y));

  // 滑鼠附近提亮
  vec2 d = (uv - uFocus) + (p - (uv - 0.5)) * 0.5;
  d.x *= aspect;
  float glow = smoothstep(0.65, 0.0, length(d)) * uFocusK;
  col = mix(col, mix(col, uTop, 0.5), glow);

  // 細顆粒
  col -= fract(sin(dot(uv * uRes, vec2(12.9898, 78.233)) + uTime) * 43758.5453) * 0.045;
  gl_FragColor = vec4(col, 1.0);
}`

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)

function rgbToHsl([r, g, b]) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, s, l]
}

function hslToRgb([h, s, l]) {
  if (s === 0) return [l, l, l]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t) => {
    t = (t + 1) % 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)]
}

/** 一個顏色 → 四個深淺。亮的往上、暗的往下，再給一個很暗的當陰影 */
export function paletteOf(hex) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex))
  return {
    top: hslToRgb([h, s * 0.85, Math.min(l + 0.24, 0.8)]),
    bottom: hslToRgb([h, s * 0.95, Math.max(l - 0.18, 0.2)]),
    accent: hslToRgb([h, s * 0.9, l]),
    dark: hslToRgb([h, s * 0.7, 0.19]),
  }
}

/** 這個顏色上面的字該用深色嗎（相對亮度 > 0.4） */
export function wantsDarkText([r, g, b]) {
  const f = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) > 0.4
}

const toCss = ([r, g, b]) => `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} options hex 起始顏色；reduced 減少動態；onTone(dark) 字該不該變深時通知
 */
export function createGradientField(canvas, { hex = '#7a86a8', reduced = false, onTone = () => {} } = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false })
  let current = paletteOf(hex)
  let from = current
  let target = current
  let blendStart = 0
  let blendMs = 0
  let focus = [0.5, 0.5]
  let focusK = 0
  let focusGoal = 0
  let raf = 0
  let start = performance.now()
  let disposed = false
  onTone(wantsDarkText(current.top))

  // 沒有 WebGL：用 CSS 漸層代替，顏色一樣會跟著換
  if (!gl) {
    const paint = () => {
      canvas.style.background = `radial-gradient(at 50% 30%, ${toCss(current.top)}, ${toCss(current.bottom)} 70%, ${toCss(current.dark)})`
      canvas.style.transition = 'background 0.8s ease'
    }
    paint()
    return {
      webgl: false,
      setColour(nextHex) {
        current = paletteOf(nextHex)
        onTone(wantsDarkText(current.top))
        paint()
      },
      setFocus() {},
      dispose() {},
    }
  }

  const compile = (type, source) => {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader))
    return shader
  }
  const program = gl.createProgram()
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT))
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(program)
  gl.useProgram(program)
  const quad = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(program, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
  const u = {}
  for (const name of ['uTime', 'uRes', 'uTop', 'uBottom', 'uAccent', 'uDark', 'uFocus', 'uFocusK']) u[name] = gl.getUniformLocation(program, name)

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const w = Math.round(canvas.clientWidth * dpr)
    const h = Math.round(canvas.clientHeight * dpr)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
      gl.viewport(0, 0, w, h)
    }
  }

  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

  function frame(now) {
    if (disposed) return
    size()
    // 顏色過渡
    if (blendMs > 0) {
      const t = Math.min(1, (now - blendStart) / blendMs)
      const e = easeInOut(t)
      current = {
        top: lerp3(from.top, target.top, e),
        bottom: lerp3(from.bottom, target.bottom, e),
        accent: lerp3(from.accent, target.accent, e),
        dark: lerp3(from.dark, target.dark, e),
      }
      if (t >= 1) blendMs = 0
    }
    focusK += (focusGoal - focusK) * 0.08
    gl.uniform1f(u.uTime, reduced ? 12 : (now - start) / 1000)
    gl.uniform2f(u.uRes, canvas.width, canvas.height)
    gl.uniform3fv(u.uTop, current.top)
    gl.uniform3fv(u.uBottom, current.bottom)
    gl.uniform3fv(u.uAccent, current.accent)
    gl.uniform3fv(u.uDark, current.dark)
    gl.uniform2f(u.uFocus, focus[0], focus[1])
    gl.uniform1f(u.uFocusK, focusK)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    // 減少動態：顏色換完、提亮到位就停
    if (!reduced || blendMs > 0 || Math.abs(focusGoal - focusK) > 0.01) raf = requestAnimationFrame(frame)
    else raf = 0
  }
  raf = requestAnimationFrame(frame)

  return {
    webgl: true,
    /** 換顏色，ms 是過渡時間 */
    setColour(nextHex, ms = 800) {
      from = current
      target = paletteOf(nextHex)
      blendStart = performance.now()
      blendMs = reduced ? 1 : ms
      onTone(wantsDarkText(target.top))
      if (!raf) raf = requestAnimationFrame(frame)
    },
    /** 滑鼠在哪裡（0 到 1，y 往上），null 表示離開 */
    setFocus(point) {
      if (point) {
        focus = point
        focusGoal = 1
      } else focusGoal = 0
      if (!raf) raf = requestAnimationFrame(frame)
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}
