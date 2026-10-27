// 試做頁 /lab/plates 的驗收：用帶 HTML-in-Canvas 旗標的 headless Chrome 155（真 GPU）走 CDP。
// 檢查：API 有、卡片抓到圖、滑過會抬起（transform 變）、點「整套加入購物車」有回饋、點標題連到 /outfits/:id、Tab 走得進卡片、閒置零重抓。
// usage: node scripts/plates-check.mjs [baseUrl] [outDir]   退出碼 0 過 / 1 產品失敗 / 2 沒評估到
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const base = process.argv[2] || 'http://localhost:5183'
const outDir = process.argv[3] || 'docs/r19-shots/plates'
mkdirSync(outDir, { recursive: true })
const lines = []
const log = (s) => { lines.push(s); process.stdout.write(s + '\n') }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const port = 9400 + Math.floor(Math.random() * 400)
const profile = mkdtempSync(join(tmpdir(), 'hic-'))
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--enable-unsafe-webgpu', '--enable-blink-features=CanvasDrawElement', '--enable-features=CanvasDrawElement',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--force-device-scale-factor=1',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' })
let code = 2
async function finish(c) {
  code = c
  writeFileSync(join(outDir, 'out.txt'), lines.join('\n') + '\n' + 'DOES NOT PROVE: CDP 合成事件不是真人指標；一台桌機、一個視窗；讀屏沒測；旗標開在獨立的 headless 設定檔，不是使用者平常的 Chrome。\n', 'utf8')
  try { chrome.kill() } catch {}
  process.exitCode = c
}
try {
  let page
  for (let i = 0; i < 60 && !page; i++) { try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page') } catch { await sleep(200) } }
  if (!page) throw new Error('chrome 的除錯埠沒開')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let id = 0; const pending = new Map(); const problems = []
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
    if (m.method === 'Runtime.exceptionThrown') problems.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text))
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') problems.push('ERR ' + m.params.args.map((a) => a.value ?? a.description).join(' '))
  }
  const send = (method, params = {}) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, (m) => (m.error ? rej(new Error(method + ' ' + JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: mid, method, params })) })
  const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value }
  const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(outDir, name), Buffer.from(r.data, 'base64')); log('截圖 ' + name) }
  const click = async (x, y) => { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }) }
  const centre = (sel) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } })()`)
  await send('Runtime.enable'); await send('Page.enable')
  // headless 的 --window-size 含工具列，視口只剩 743 高：牆的下緣會在摺線外，elementFromPoint 對摺線外一律回 null（第一次跑就被這個騙了）。固定視口
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${base}/lab/plates?r=${Date.now()}` })
  await sleep(4500)
  const env = await ev(`({ brands: navigator.userAgentData?.brands?.map(b => b.brand + '/' + b.version), draw: !!(globalThis.GPUQueue && 'drawElementImageToTexture' in GPUQueue.prototype), geom: 'updateElementGeometry' in HTMLCanvasElement.prototype, mode: document.querySelector('.wall') ? 'plates' : document.querySelector('.grid') ? 'grid' : 'none', plates: !!window.__plates, stats: document.querySelector('.stats')?.textContent?.trim() })`)
  log('env ' + JSON.stringify(env))
  if (!env.draw || !env.geom) { log('NOT EVALUATED: 這個 Chrome 沒有 HTML-in-Canvas'); await shot('00-unsupported.png'); await finish(2); process.exit() }
  if (env.mode !== 'plates' || !env.plates) { log('FAIL: 頁面沒進 plates 模式（mode=' + env.mode + '）'); await shot('00-mode.png'); await finish(1); process.exit() }
  const fails = []
  const caps = () => ev(`(() => { const p = window.__plates; const out = {}; for (const [k, c] of p.get ? [] : []) {} return { captures: p.stats.captures, paints: p.stats.paints, capsSec: p.stats.capsSec, fps: p.stats.fps, perCard: [...document.querySelectorAll('.plate')].map(el => { const c = p.get(Number(el.dataset.plate)); return c ? c.capN : -1 }) } })()`)
  const c0 = await caps()
  log('載入後 ' + JSON.stringify(c0))
  if (c0.perCard.some((n) => n < 1)) fails.push('有卡片沒抓到圖：' + c0.perCard.join(','))
  await shot('01-wall.png')

  // 滑過第三張卡：transform 要變（抬起來），之後再離開
  const plate3 = '.plate:nth-of-type(3)'
  const before = await ev(`document.querySelector(${JSON.stringify(plate3)}).style.transform`)
  const p3 = await centre(plate3)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p3.x, y: p3.y })
  await sleep(700)
  const after = await ev(`document.querySelector(${JSON.stringify(plate3)}).style.transform`)
  const hovered = await ev(`document.querySelector(${JSON.stringify(plate3)}).matches(':hover')`)
  log(`滑過第三張：:hover=${hovered} transform 變了=${before !== after}`)
  if (!hovered) fails.push('滑過傾斜的卡片，DOM 沒有 :hover（幾何回寫沒對上）')
  if (before === after) fails.push('滑過沒有抬起來（transform 沒變）')
  await shot('02-hover.png')

  // 點第三張卡的「整套加入購物車」：回饋文字要出現
  const btn = await centre(`${plate3} .btn`)
  log('按鈕中心 ' + JSON.stringify(btn) + ' elementFromPoint=' + (await ev(`document.elementFromPoint(${btn.x}, ${btn.y})?.className`)))
  await click(btn.x, btn.y)
  await sleep(500)
  const feedback = await ev(`document.querySelector(${JSON.stringify(plate3 + ' .feedback')}).textContent`)
  const cartCount = await ev(`(() => { try { return JSON.parse(localStorage.getItem('cart') || '[]').length } catch { return -1 } })()`)
  log(`點整套加入購物車：feedback="${feedback}" cart 筆數=${cartCount}`)
  if (!/已加入/.test(feedback)) fails.push('點傾斜卡片上的按鈕沒有回饋')
  await shot('03-added.png')
  await sleep(1600)

  // Tab：從第一張卡前面開始，Tab 要走進卡片裡的連結
  await ev(`(document.activeElement?.blur(), document.body.focus(), true)`)
  const order = []
  for (let i = 0; i < 3; i++) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await sleep(80)
    order.push(await ev(`(() => { const a = document.activeElement; return (a?.closest('.plate') ? 'plate' + a.closest('.plate').dataset.plate + ':' : '') + (a?.className || a?.tagName) })()`))
  }
  log('Tab 順序 ' + JSON.stringify(order))
  if (!order.some((s) => s.startsWith('plate'))) fails.push('Tab 沒走進任何一張卡')
  await shot('04-tab.png')

  // 閒置 2 秒：零重抓
  await ev(`(document.activeElement?.blur(), true)`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 })
  await sleep(1500)
  const i0 = await caps(); await sleep(2000); const i1 = await caps()
  log(`閒置 2 秒：抓圖 ${i0.captures} → ${i1.captures}，fps ${i1.fps}`)
  if (i1.captures - i0.captures > 2) fails.push(`閒置時還在重抓：${i1.captures - i0.captures} 次`)

  // 點標題：要走到 /outfits/:id
  const title = await centre(`${plate3} .title`)
  await click(title.x, title.y)
  await sleep(900)
  const path = await ev('location.pathname')
  log('點標題後 pathname=' + path)
  if (!/\/outfits\/\d+$/.test(path)) fails.push('點傾斜卡片的標題沒有連到穿搭頁：' + path)
  await shot('05-outfit-page.png')
  // 回來：plates 要重新建（dispose 後再 create）
  await send('Page.navigate', { url: `${base}/lab/plates?r=${Date.now()}` })
  await sleep(3500)
  const again = await ev(`({ plates: !!window.__plates, captures: window.__plates?.stats.captures })`)
  log('回到牆 ' + JSON.stringify(again))
  if (!again.plates) fails.push('離開再回來，牆沒有重建')

  const errs = problems.filter((p) => !/favicon/.test(p))
  log(`console 錯誤 ${errs.length}` + (errs.length ? '\n  ' + errs.join('\n  ') : ''))
  if (errs.length) fails.push('有 console 錯誤')
  if (fails.length) { log('FAIL:\n  ' + fails.join('\n  ')); await finish(1) } else { log('PASS'); await finish(0) }
} catch (e) {
  log('NOT EVALUATED: ' + (e?.stack || e)); await finish(2)
}
process.exit()
