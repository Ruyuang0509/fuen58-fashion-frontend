// Headless Chrome over raw CDP: screenshots a list of pages. usage: node shots.mjs <outDir> <width> <height> <url> [url...]
// A url ending in "#zoom" also clicks .zoom-btn and reports the zoomed image box.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [outDir, w, h, ...urls] = process.argv.slice(2)
const W = +w
const H = +h
mkdirSync(outDir, { recursive: true })
const port = 9333 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(join(tmpdir(), 'cdp-'))
const chrome = spawn(
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`, '--hide-scrollbars', '--no-first-run', 'about:blank'],
  { stdio: 'ignore' },
)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let target
for (let i = 0; i < 50; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
    target = list.find((t) => t.type === 'page')
    if (target) break
  } catch {}
  await sleep(200)
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
const problems = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result ?? m.error)
    pending.delete(m.id)
  }
  if (m.method === 'Runtime.exceptionThrown') problems.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text))
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) problems.push(m.params.type + ' ' + m.params.args.map((a) => a.value ?? a.description).join(' '))
}
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
await send('Runtime.enable')
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 600 })
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
// SHOT_WAIT：每頁等幾毫秒再拍（字型多的頁面要久一點）。
// url 結尾 "#hover=<選擇器>" 會先把滑鼠移到那個元素上再拍；"#click=<選擇器>" 會點那個元素，等 SHOT_AFTER 毫秒再拍（抓換頁動畫的中間一格）；
// "#scroll=<像素>" 會先捲到那個位置再拍。
const WAIT = +(process.env.SHOT_WAIT ?? 2000)
const AFTER = +(process.env.SHOT_AFTER ?? 350)
const report = {}
for (const raw of urls) {
  // 指令寫在 # 後面，用 ; 串接可以疊加：例如 "#scroll=520;hover=.card li"（先捲再滑）
  const zoom = raw.endsWith('#zoom')
  const hashAt = raw.indexOf('#')
  const directives = !zoom && hashAt >= 0 ? raw.slice(hashAt + 1).split(';') : []
  const pick = (key) => directives.find((d) => d.startsWith(key + '='))?.slice(key.length + 1) ?? null
  const hoverMatch = pick('hover') ? [null, pick('hover')] : null
  const clickMatch = pick('click') ? [null, pick('click')] : null
  const scrollMatch = pick('scroll') ? [null, pick('scroll')] : null
  const url = zoom ? raw.slice(0, -5) : directives.length ? raw.slice(0, hashAt) : raw
  await send('Page.navigate', { url })
  await sleep(WAIT)
  let name = url.replace(/^https?:\/\/[^/]+/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root'
  if (scrollMatch) {
    await ev(`window.scrollTo({ top: ${+scrollMatch[1]}, behavior: 'instant' })`)
    await sleep(700)
    name += `-scroll${scrollMatch[1]}`
  }
  if (clickMatch) {
    const clicked = await ev(`(() => { const el = document.querySelector(${JSON.stringify(clickMatch[1])}); if (!el) return false; el.click(); return true })()`)
    await sleep(AFTER)
    if (clicked) name += `-click${AFTER}`
  }
  if (hoverMatch) {
    const centre = await ev(`(() => { const el = document.querySelector(${JSON.stringify(hoverMatch[1])}); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } })()`)
    if (centre) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: centre.x, y: centre.y })
      await sleep(600)
      name += '-hover'
    }
  }
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(outDir, name + '.png'), Buffer.from(r.data, 'base64'))
  if (zoom) {
    await ev('document.querySelector(".zoom-btn")?.click()')
    await sleep(600)
    report[name + '#zoom'] = await ev('(() => { const img = document.querySelector("dialog[open] img"); if (!img) return null; const b = img.getBoundingClientRect(); return { h: Math.round(b.height), w: Math.round(b.width), top: Math.round(b.top), innerH: innerHeight } })()')
    const z = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(outDir, name + '-zoom.png'), Buffer.from(z.data, 'base64'))
  }
}
report.problems = problems
console.log(JSON.stringify(report))
ws.close()
chrome.kill()
process.exit(0)
