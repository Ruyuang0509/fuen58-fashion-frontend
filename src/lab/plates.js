// 試做：穿搭卡牆（HTML-in-Canvas × WebGPU）。
// 真實的 Vue 元件（OutfitCard）放在 <canvas layoutsubtree content="drawable"> 裡當「貼圖來源」：
// 瀏覽器把每張卡的快照交給 WebGPU（queue.drawElementImageToTexture），GPU 把它畫成帶透視的板子；
// 每幀再把同一個矩陣寫回 el.style.transform 並呼叫 canvas.updateElementGeometry(el)，
// 所以板子上的連結、按鈕、Tab 焦點都還是真的 DOM。抓圖只跟著 canvas 的 paint 事件 changedElements 走，每卡有頻率上限。
// 只有 Chromium 155 以上、開了 chrome://flags/#canvas-draw-element（或站台有 origin trial）才跑得起來；
// 不支援時 PlatesLabView 會退回普通的卡片格。

export function platesSupport() {
  if (!('gpu' in navigator)) return '這個瀏覽器沒有 WebGPU'
  const q = globalThis.GPUQueue
  if (!q || typeof q.prototype.drawElementImageToTexture !== 'function') return '沒有 HTML-in-Canvas（GPUQueue.drawElementImageToTexture）'
  if (typeof HTMLCanvasElement.prototype.updateElementGeometry !== 'function') return '沒有 canvas.updateElementGeometry'
  return null
}

const WGSL = /* wgsl */ `
struct Frame { res: vec2f, time: f32, dpr: f32, bg: vec4f, tint: vec4f };
struct Card { m: mat4x4f, size: vec4f, fx: vec4f };
@group(0) @binding(0) var<uniform> F: Frame;
@group(0) @binding(1) var samp: sampler;
@group(1) @binding(0) var<uniform> C: Card;
@group(1) @binding(1) var tex: texture_2d<f32>;

struct VO { @builtin(position) p: vec4f, @location(0) uv: vec2f };
fn hash21(p: vec2f) -> f32 { var q = fract(p * vec2f(123.34, 456.21)); q += dot(q, q + 45.32); return fract(q.x * q.y); }

@vertex fn bgVs(@builtin(vertex_index) i: u32) -> VO {
  var q = array(vec2f(-1., -3.), vec2f(-1., 1.), vec2f(3., 1.));
  var o: VO; o.p = vec4f(q[i], 0., 1.); o.uv = vec2f(q[i].x * .5 + .5, .5 - q[i].y * .5); return o;
}
// 底：頁面底色、從上往下一點點暗、中央一團主題色的光、細微的紙紋
@fragment fn bgFs(in: VO) -> @location(0) vec4f {
  let uv = in.uv;
  var col = F.bg.rgb * (1. - uv.y * .035);
  let asp = F.res.x / F.res.y;
  let c = vec2f(.5 + .03 * sin(F.time * .11), .55);
  let d = length((uv - c) * vec2f(asp, 1.));
  col = mix(col, F.tint.rgb, smoothstep(.75, .0, d) * F.tint.a);
  col += (hash21(in.p.xy) - .5) * .012;
  return vec4f(col, 1.);
}

@vertex fn cardVs(@builtin(vertex_index) i: u32) -> VO {
  var q = array(vec2f(0., 0.), vec2f(1., 0.), vec2f(0., 1.), vec2f(1., 1.));
  let lp = q[i] * C.size.xy;
  var o: VO; o.p = C.m * vec4f(lp, 0., 1.); o.uv = q[i]; return o;
}
// 卡：快照本身；fx.x 是整體透明度（進場用），fx.y 是滑過時提亮
@fragment fn cardFs(in: VO) -> @location(0) vec4f {
  let t = textureSample(tex, samp, in.uv);
  let a = t.a * C.fx.x;
  let rgb = mix(t.rgb, vec3f(1.), C.fx.y * .06);
  return vec4f(rgb * a, a);
}
// 影子：板子下方一層柔邊的暗色，沿著板子的形狀，稍微往下偏
@fragment fn shadowFs(in: VO) -> @location(0) vec4f {
  let e = min(min(in.uv.x, 1. - in.uv.x) * C.size.x, min(in.uv.y, 1. - in.uv.y) * C.size.y);
  let soft = smoothstep(0., 28., e);
  let a = soft * .16 * C.fx.x * (.6 + .4 * C.fx.y);
  return vec4f(vec3f(.12, .11, .1) * a, a);
}
`

const PERSPECTIVE = 1500

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function cssMatrix(card, pose, W, H) {
  const persp = new DOMMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1 / PERSPECTIVE, 0, 0, 0, 1])
  const model = new DOMMatrix()
    .translate(pose.x, pose.y, pose.z)
    .rotate(pose.rx, pose.ry, pose.rz)
    .scale(pose.s, pose.s, 1)
    .translate(-card.w / 2, -card.h / 2, 0)
  return new DOMMatrix().translate(W / 2, H / 2).multiply(persp).translate(-W / 2, -H / 2).multiply(model)
}
function clipFromCss(css, W, H) {
  return new DOMMatrix([2 / W, 0, 0, 0, 0, -2 / H, 0, 0, 0, 0, 0, 0, -1, 1, 0.5, 1]).multiply(css)
}
const lerp = (a, b, t) => a + (b - a) * t
const easeOut = (t) => 1 - Math.pow(1 - t, 3)

export async function createPlates(canvas, { reduced = false, maxHz = 20, bg = '#faf8f4', tint = '#3f4a54', onStats } = {}) {
  const why = platesSupport()
  if (why) throw new Error(why)
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
  if (!adapter) throw new Error('拿不到 WebGPU adapter')
  const device = await adapter.requestDevice()
  const errors = []
  device.addEventListener('uncapturederror', (e) => errors.push(String(e.error?.message || e.error)))
  const ctx = canvas.getContext('webgpu')
  const format = navigator.gpu.getPreferredCanvasFormat()
  ctx.configure({ device, format, alphaMode: 'opaque' })

  const sh = device.createShaderModule({ code: WGSL })
  sh.getCompilationInfo().then((info) => {
    for (const m of info.messages) if (m.type === 'error') console.error('plates WGSL', m.lineNum, m.message)
  })
  const frameBuf = device.createBuffer({ size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
  const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear' })
  const bgl0 = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
    ],
  })
  const bgl1 = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
    ],
  })
  const bg0 = device.createBindGroup({ layout: bgl0, entries: [{ binding: 0, resource: { buffer: frameBuf } }, { binding: 1, resource: sampler }] })
  const blend = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } }
  const pipe = (vs, fs, topology) =>
    device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: vs === 'bgVs' ? [bgl0] : [bgl0, bgl1] }),
      vertex: { module: sh, entryPoint: vs },
      fragment: { module: sh, entryPoint: fs, targets: [{ format, blend }] },
      primitive: { topology },
    })
  const bgPipe = pipe('bgVs', 'bgFs', 'triangle-list')
  const cardPipe = pipe('cardVs', 'cardFs', 'triangle-strip')
  const shadowPipe = pipe('cardVs', 'shadowFs', 'triangle-strip')
  const dummyTex = device.createTexture({ size: [1, 1], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST })

  const cards = new Map()
  const stats = { paints: 0, captures: 0, p: 0, c: 0, f: 0, paintsSec: 0, capsSec: 0, fps: 0, lastTick: performance.now(), changed: -1 }
  let dpr = 1, cssW = 1, cssH = 1, raf = 0, disposed = false
  const bgRgb = hexToRgb(bg), tintRgb = hexToRgb(tint)

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1)
    const r = canvas.getBoundingClientRect()
    cssW = Math.max(1, r.width); cssH = Math.max(1, r.height)
    const w = Math.max(1, Math.round(cssW * dpr)), h = Math.max(1, Math.round(cssH * dpr))
    if (w === canvas.width && h === canvas.height) return
    canvas.width = w; canvas.height = h
    for (const c of cards.values()) { c.tex?.destroy(); c.tex = null; c.bg1 = null; c.captured = false; c.dirty = true }
    canvas.requestPaint?.()
  }

  // ── 抓圖：paint 事件說誰變了就抓誰；每卡每秒最多 maxHz 次；看不見（透明度 < .02）的不抓 ──
  function onPaint(e) {
    stats.paints++; stats.p++
    const changed = e.changedElements ? new Set(e.changedElements) : null
    stats.changed = changed ? changed.size : -1
    const now = performance.now()
    let deferred = false
    for (const c of cards.values()) {
      const wants = !c.captured || !changed || changed.has(c.el) || c.dirty
      if (!wants) continue
      if (c.pose.o < 0.02) { c.dirty = true; continue }
      if (c.captured && now - c.lastCap < 1000 / maxHz) { c.dirty = true; deferred = true; continue }
      capture(c)
    }
    if (deferred) canvas.requestPaint?.()
  }
  function capture(c) {
    const tw = Math.max(1, Math.round(c.w * dpr)), th = Math.max(1, Math.round(c.h * dpr))
    if (!c.tex || c.tex.width !== tw || c.tex.height !== th) {
      c.tex?.destroy()
      c.tex = device.createTexture({ size: [tw, th], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT })
      c.bg1 = device.createBindGroup({ layout: bgl1, entries: [{ binding: 0, resource: { buffer: c.ubuf } }, { binding: 1, resource: c.tex.createView() }] })
    }
    const enc = device.createCommandEncoder()
    enc.beginRenderPass({ colorAttachments: [{ view: c.tex.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }] }).end()
    device.queue.submit([enc.finish()])
    try {
      device.queue.drawElementImageToTexture({ source: c.el }, { texture: c.tex })
      c.captured = true; c.dirty = false; c.lastCap = performance.now(); c.capN++
      stats.captures++; stats.c++
    } catch (err) {
      // visibility:hidden 的元素沒有快照（InvalidStateError）：留著 dirty，下次再抓
      if (!(err instanceof DOMException && err.name === 'InvalidStateError')) console.warn('plates capture', c.id, err)
      c.dirty = true
    }
  }

  // ── 幾何回寫：只在角點移動超過 0.05 px 時才改 DOM 的 transform（每次改都會讓那張卡進 changedElements） ──
  function corners(m, c) {
    return [[0, 0], [c.w, 0], [0, c.h], [c.w, c.h]].map(([x, y]) => { const p = m.transformPoint(new DOMPoint(x, y, 0, 1)); return [p.x / p.w, p.y / p.w] })
  }
  function moved(a, b) {
    if (!a) return true
    for (let i = 0; i < 4; i++) if (Math.abs(a[i][0] - b[i][0]) > 0.05 || Math.abs(a[i][1] - b[i][1]) > 0.05) return true
    return false
  }

  function frame(t) {
    if (disposed) return
    raf = requestAnimationFrame(frame)
    stats.f++
    const now = performance.now()
    device.queue.writeBuffer(frameBuf, 0, new Float32Array([canvas.width, canvas.height, t / 1000, dpr, ...bgRgb, 1, ...tintRgb, 0.16]))
    const draws = []
    for (const c of cards.values()) {
      // 補間：pose 往 target 走（滑過、進場）；減少動態時直接到位
      const k = reduced ? 1 : Math.min(1, (now - c.last) / 1000 * 8)
      c.last = now
      for (const key of ['x', 'y', 'z', 'rx', 'ry', 'rz', 's', 'o']) c.pose[key] = lerp(c.pose[key], c.target[key], k)
      c.hover = lerp(c.hover, c.hovered ? 1 : 0, reduced ? 1 : Math.min(1, k))
      const css = cssMatrix(c, c.pose, cssW, cssH)
      const cs = corners(css, c)
      if (moved(c.lastCorners, cs)) {
        c.el.style.transform = css.toString()
        c.lastCorners = cs
        try { canvas.updateElementGeometry(c.el) } catch { /* 155 之前的版本沒有：那就只有畫面，沒有點擊對位 */ }
      }
      const hidden = c.pose.o < 0.02
      if (hidden !== (c.el.dataset.hid === '1')) { if (hidden) c.el.dataset.hid = '1'; else delete c.el.dataset.hid }
      if (!c.captured || !c.tex || hidden) continue
      const clip = clipFromCss(css, cssW, cssH)
      const u = new Float32Array(24)
      u.set(clip.toFloat32Array(), 0); u.set([c.w, c.h, 0, 0], 16); u.set([c.pose.o, c.hover, 0, 0], 20)
      device.queue.writeBuffer(c.ubuf, 0, u)
      draws.push(c)
    }
    draws.sort((a, b) => a.pose.z - b.pose.z)
    const enc = device.createCommandEncoder()
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: [...bgRgb, 1] }] })
    pass.setPipeline(bgPipe); pass.setBindGroup(0, bg0); pass.draw(3)
    pass.setPipeline(shadowPipe); pass.setBindGroup(0, bg0)
    for (const c of draws) { pass.setBindGroup(1, c.bg1); pass.draw(4) }
    pass.setPipeline(cardPipe); pass.setBindGroup(0, bg0)
    for (const c of draws) { pass.setBindGroup(1, c.bg1); pass.draw(4) }
    pass.end()
    device.queue.submit([enc.finish()])
    if (t - stats.lastTick >= 1000) {
      stats.paintsSec = stats.p; stats.capsSec = stats.c; stats.fps = stats.f; stats.p = stats.c = stats.f = 0; stats.lastTick = t
      onStats?.({ fps: stats.fps, paintsSec: stats.paintsSec, capsSec: stats.capsSec, paints: stats.paints, captures: stats.captures, changed: stats.changed, cards: cards.size, errors: errors.length, adapter: adapter.info ? `${adapter.info.vendor} ${adapter.info.architecture}`.trim() : '' })
    }
  }

  canvas.addEventListener('paint', onPaint)
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()
  // 字型載進來以後，已抓的快照是舊字型：全部重抓一次
  document.fonts?.ready.then(() => { for (const c of cards.values()) c.dirty = true; canvas.requestPaint?.() })
  raf = requestAnimationFrame(frame)

  return {
    /** 登記一張卡：el 是 canvas 裡的那個 div；pose 是目標；from 是進場起點（沒給就直接在目標） */
    addCard(id, el, w, h, pose, from) {
      const ubuf = device.createBuffer({ size: 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
      el.style.width = `${w}px`; el.style.height = `${h}px`; el.style.transformOrigin = '0 0'
      const target = { rx: 0, ry: 0, rz: 0, s: 1, o: 1, ...pose }
      const start = from && !reduced ? { ...target, ...from } : { ...target }
      const card = { id, el, w, h, ubuf, tex: null, bg1: null, captured: false, dirty: true, lastCap: -1e9, capN: 0, pose: start, target, hovered: false, hover: 0, last: performance.now(), lastCorners: null }
      cards.set(id, card)
      el.addEventListener('pointerenter', () => { card.hovered = true })
      el.addEventListener('pointerleave', () => { card.hovered = false })
      el.addEventListener('focusin', () => { card.hovered = true })
      el.addEventListener('focusout', () => { card.hovered = false })
      canvas.requestPaint?.()
      return card
    },
    setTarget(id, patch) { const c = cards.get(id); if (c) Object.assign(c.target, patch) },
    get(id) { return cards.get(id) },
    stats,
    device,
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('paint', onPaint)
      for (const c of cards.values()) { c.tex?.destroy(); c.ubuf.destroy() }
      cards.clear()
      dummyTex.destroy(); frameBuf.destroy()
      try { ctx.unconfigure() } catch { /* 舊版沒有 */ }
      device.destroy()
    },
  }
}
