// 首頁的天空。
//
// 整個首頁的底不是顏色，是「現在的天空」：用片段著色器算出來的天空——
// 太陽的高度由現在的時間決定（白天藍、傍晚暖、晚上深），雲量、雨、霧由今天的天氣決定。
// 所以同一個首頁，早上開和晚上開不一樣，晴天開和雨天開不一樣。這就是「今天穿什麼」的「今天」。
//
// 滑鼠移動會讓雲跟著被推一下（風），很輕。
// 沒有 WebGL 的瀏覽器退回 CSS 漸層（顏色一樣跟著時間與天氣走，只是沒有雲在動）。

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uSun;    // 太陽高度：-1 到 1（0 是地平線）
uniform float uSunX;   // 太陽在畫面上的左右位置：0 到 1
uniform float uCloud;  // 雲量 0 到 1
uniform float uRain;   // 雨 0 到 1
uniform float uHaze;   // 霧（濕度）0 到 1
uniform vec3 uTint;    // 風格的顏色，淡淡地染進天空
uniform float uTintK;
uniform vec2 uWind;    // 滑鼠推出來的風，累積的位移

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;

  // 白天的程度，以及地平線附近的暖色帶（日出日落）
  float day = smoothstep(-0.12, 0.28, uSun);
  float dusk = exp(-pow((uSun - 0.03) / 0.14, 2.0));

  vec3 zenith = mix(vec3(0.05, 0.07, 0.14), vec3(0.36, 0.55, 0.80), day);
  vec3 horizon = mix(vec3(0.16, 0.19, 0.30), vec3(0.82, 0.89, 0.95), day);
  horizon = mix(horizon, vec3(0.96, 0.74, 0.52), dusk * 0.85);
  zenith = mix(zenith, vec3(0.45, 0.42, 0.62), dusk * 0.4);
  vec3 sky = mix(horizon, zenith, pow(uv.y, 0.62));

  // 太陽：一團柔光，雲多的時候被遮掉大半
  vec2 sunPos = vec2(uSunX, 0.12 + 0.72 * clamp(uSun, 0.0, 1.0));
  vec2 d = uv - sunPos;
  d.x *= aspect;
  float dist = length(d);
  float open = 1.0 - uCloud * 0.75;
  sky += vec3(1.0, 0.92, 0.78) * exp(-dist * dist * 22.0) * (0.25 + 0.55 * day) * open;
  sky += vec3(1.0, 0.95, 0.86) * exp(-dist * 2.4) * 0.14 * day * open;

  // 雲：兩層不同大小的雲，慢慢往右飄，再加上滑鼠推的風
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 drift = vec2(uTime * 0.010, uTime * 0.0012) + uWind;
  float big = fbm(p * 2.1 + drift);
  float small = fbm(p * 4.6 - drift * 1.7 + 7.3);
  float shape = big * 0.68 + small * 0.32;
  float edge0 = 0.62 - uCloud * 0.46;
  float cloud = smoothstep(edge0, edge0 + 0.26, shape);
  // 雲的明暗：往上一點取樣，比較密的地方是雲的底部，比較暗
  float above = fbm(p * 2.1 + drift + vec2(0.0, 0.09));
  float litness = smoothstep(0.25, 0.95, above);
  vec3 cloudDay = mix(vec3(0.58, 0.62, 0.70), vec3(1.0, 1.0, 1.0), litness);
  vec3 cloudNight = mix(vec3(0.08, 0.09, 0.14), vec3(0.22, 0.24, 0.32), litness);
  vec3 cloudCol = mix(cloudNight, cloudDay, day);
  cloudCol = mix(cloudCol, cloudCol * vec3(1.05, 0.9, 0.78), dusk * 0.6);
  sky = mix(sky, cloudCol, cloud * 0.92);

  // 陰天整體灰一點、平一點
  float grey = dot(sky, vec3(0.3, 0.59, 0.11));
  sky = mix(sky, vec3(grey), uCloud * 0.22);

  // 濕度：地平線附近起霧
  vec3 hazeCol = mix(vec3(0.17, 0.19, 0.25), vec3(0.85, 0.87, 0.89), day);
  sky = mix(sky, hazeCol, uHaze * (1.0 - uv.y) * 0.55);

  // 雨：很細的斜線往下落。每一欄有自己的相位、長短與速度，才不會排成格子
  if (uRain > 0.0) {
    float col = floor(uv.x * aspect * 220.0 + uv.y * 30.0);
    float phase = hash(vec2(col, 1.7));
    float speed = 2.2 + hash(vec2(col, 3.1)) * 1.6;
    float y = uv.y * (7.0 + phase * 6.0) + uTime * speed + phase * 10.0;
    float r = hash(vec2(col, floor(y)));
    float along = fract(y);
    float streak = step(1.0 - uRain * 0.16, r) * smoothstep(0.0, 0.35, along) * smoothstep(0.75, 0.45, along);
    // 靠近地平線的雨被霧吃掉
    sky += streak * 0.055 * mix(0.6, 1.0, day) * smoothstep(0.0, 0.35, uv.y);
  }

  // 風格的顏色，淡淡的
  sky = mix(sky, sky * 0.5 + uTint * 0.6, uTintK * 0.42);

  // 顆粒
  sky += (hash(uv * uRes + fract(uTime)) - 0.5) * 0.018;
  gl_FragColor = vec4(sky, 1.0);
}`

/** 現在幾點 → 太陽高度（-1 到 1）與左右位置（0 到 1）。粗略的：6 點出、18 點落，台灣的緯度不另算 */
export function sunNow(date = new Date()) {
  const hour = date.getHours() + date.getMinutes() / 60
  const t = (hour - 6) / 12 // 0 日出、1 日落
  const elevation = Math.sin(t * Math.PI) * (t >= 0 && t <= 1 ? 1 : 1) // 夜裡自然是負的
  return { elevation: Math.max(-1, Math.min(1, elevation)), x: Math.max(0.08, Math.min(0.92, t)) }
}

/** 天氣 → 雲量、雨、霧 */
export function weatherLook(weather) {
  if (!weather) return { cloud: 0.5, rain: 0, haze: 0.3 }
  const condition = weather.condition ?? ''
  const cloud = condition === 'rain' ? 0.92 : condition === 'cloudy' ? 0.68 : condition === 'clear' ? 0.14 : 0.5
  const rain = condition === 'rain' ? 0.65 : 0
  const haze = Math.max(0, Math.min(1, ((weather.humidity ?? 60) - 50) / 45))
  return { cloud, rain, haze }
}

/** 這片天空上面的字要不要用深色 */
export function skyWantsDarkText({ elevation }, { cloud }) {
  // 白天用深字；傍晚與夜裡用淺字。陰天的白天仍是亮的
  return elevation > 0.08 || (elevation > -0.02 && cloud > 0.6)
}

export function createSky(canvas, { reduced = false } = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false })
  const state = { sun: 0.5, sunX: 0.5, cloud: 0.5, rain: 0, haze: 0.3, tint: [0.5, 0.5, 0.5], tintK: 0 }
  const goal = { ...state, tint: [...state.tint] }
  let wind = [0, 0]
  let gust = [0, 0]
  let raf = 0
  let disposed = false
  let paused = false
  const start = performance.now()

  if (!gl) {
    const paint = () => {
      const day = Math.max(0, Math.min(1, (goal.sun + 0.12) / 0.4))
      const overcast = goal.cloud > 0.6
      const top = day > 0.5 ? (overcast ? '#8d9aab' : '#5b85c2') : '#0f1424'
      const bottom = day > 0.5 ? (overcast ? '#c9d0d8' : '#d5e4f1') : '#2a3049'
      canvas.style.background = `linear-gradient(${top}, ${bottom})`
      canvas.style.transition = 'background 1s ease'
    }
    paint()
    return {
      webgl: false,
      set(next) {
        Object.assign(goal, next)
        paint()
      },
      stir() {},
      pause() {},
      resume() {},
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
  for (const name of ['uRes', 'uTime', 'uSun', 'uSunX', 'uCloud', 'uRain', 'uHaze', 'uTint', 'uTintK', 'uWind']) u[name] = gl.getUniformLocation(program, name)

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

  const ease = (a, b, k) => a + (b - a) * k

  function frame(now) {
    if (disposed || paused) {
      raf = 0
      return
    }
    size()
    // 每個參數都慢慢靠近目標，天氣與風格換的時候才不會跳
    const k = reduced ? 1 : 0.035
    for (const key of ['sun', 'sunX', 'cloud', 'rain', 'haze', 'tintK']) state[key] = ease(state[key], goal[key], k)
    state.tint = state.tint.map((v, i) => ease(v, goal.tint[i], k))
    // 風：陣風慢慢衰減，位移累積
    gust = gust.map((v) => v * 0.9)
    wind = [wind[0] + gust[0], wind[1] + gust[1]]

    gl.uniform2f(u.uRes, canvas.width, canvas.height)
    gl.uniform1f(u.uTime, reduced ? 40 : (now - start) / 1000)
    gl.uniform1f(u.uSun, state.sun)
    gl.uniform1f(u.uSunX, state.sunX)
    gl.uniform1f(u.uCloud, state.cloud)
    gl.uniform1f(u.uRain, reduced ? 0 : state.rain)
    gl.uniform1f(u.uHaze, state.haze)
    gl.uniform3fv(u.uTint, state.tint)
    gl.uniform1f(u.uTintK, state.tintK)
    gl.uniform2f(u.uWind, wind[0], wind[1])
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    const settled = reduced && Math.abs(state.tintK - goal.tintK) < 0.01 && Math.abs(state.cloud - goal.cloud) < 0.01
    raf = settled ? 0 : requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return {
    webgl: true,
    /** 設定目標：sun、sunX、cloud、rain、haze、tint（0 到 1 的 rgb）、tintK */
    set(next) {
      Object.assign(goal, next)
      if (next.tint) goal.tint = [...next.tint]
      if (!raf) raf = requestAnimationFrame(frame)
    },
    /** 滑鼠推一下風：vx、vy 是這一幀移動的比例 */
    stir(vx, vy) {
      gust = [gust[0] + vx * 0.0025, gust[1] - vy * 0.0012]
    },
    /** 天空捲出畫面時停下來，省電；捲回來再動 */
    pause() {
      paused = true
    },
    resume() {
      paused = false
      if (!raf) raf = requestAnimationFrame(frame)
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}
