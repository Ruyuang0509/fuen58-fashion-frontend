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
const report = {}
for (const raw of urls) {
  const zoom = raw.endsWith('#zoom')
  const url = zoom ? raw.slice(0, -5) : raw
  await send('Page.navigate', { url })
  await sleep(2000)
  const name = url.replace(/^https?:\/\/[^/]+/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root'
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
