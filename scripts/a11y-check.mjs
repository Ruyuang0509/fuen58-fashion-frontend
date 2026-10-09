// Headless Chrome over raw CDP (第十七輪子輪 2): (1) axe-core on every page (WCAG 2.0/2.1 A + AA rules), including a few opened
// states (clause picker, header peek, zoom dialog); (2) a keyboard-only walk of the purchase path — Tab / Space / Enter only, no .focus().
// usage: node scripts/a11y-check.mjs <origin> <outDir> [width] [height]
// exit 0 = no serious/critical violations and the keyboard walk arrived; 1 = something to fix; 2 = the instrument itself failed.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { inflateSync } from 'node:zlib'

const require = createRequire(import.meta.url)
const axe = require('axe-core')

const [origin, outDir, w = '1252', h = '699'] = process.argv.slice(2)
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
if (!target) {
  console.error('instrument: chrome did not expose a page target')
  process.exit(2)
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

const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) return 'EVAL-ERROR ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
  return r.result?.value
}
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(outDir, name + '.png'), Buffer.from(r.data, 'base64'))
}
const go = async (path, wait = 1500) => {
  await send('Page.navigate', { url: origin + path })
  await sleep(wait)
}
const count = (sel) => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`)
const click = (sel, nth = 0) => ev(`(() => { const el = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; if (!el) return 'missing'; el.click(); return 'clicked' })()`)
const type = (sel, value) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'missing'; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return 'typed' })()`)
const pathname = () => ev('location.pathname')

// ── 天空上的字：真的量像素 ──
// axe 看不到 WebGL 畫布（它把天空當成頁面底色，桌機判「無法判定」、手機判違規）。所以頂欄浮在天空上的字另外量：
// 把那個元素的文字藏起來（visibility: hidden，版面不動）、截那一塊的圖、算背景像素的平均亮度，再和文字顏色算 WCAG 對比度。
// 這是量「畫出來的結果」，比 axe 的推算更接近法條本身；量到的數字印出來，不合格一樣算失敗。
function decodePng(buf) {
  let pos = 8
  let width = 0
  let height = 0
  let colorType = 6
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      colorType = data[9]
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    pos += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1
  const stride = width * bpp
  const out = Buffer.alloc(height * stride)
  let prev = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const cur = Buffer.alloc(stride)
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      let v = line[i]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const pr = a + b - c
        const pa = Math.abs(pr - a)
        const pb = Math.abs(pr - b)
        const pc = Math.abs(pr - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      cur[i] = v & 255
    }
    cur.copy(out, y * stride)
    prev = cur
  }
  return { width, height, bpp, data: out }
}
const linear = (c) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4)
const luminance = ([r, g, b]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const meanColour = ({ width, height, bpp, data }) => {
  const sum = [0, 0, 0]
  const n = width * height
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) sum[k] += data[i * bpp + k]
  return sum.map((v) => v / n)
}
// 量一個元素：回 { ratio, text, bg, size, weight }；找不到元素回 null
const measureOnSky = async (selector) => {
  const box = await ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return { x: r.x, y: r.y, w: r.width, h: r.height, color: s.color, size: parseFloat(s.fontSize), weight: s.fontWeight } })()`)
  if (!box || !box.w || !box.h) return null
  await ev(`document.querySelector(${JSON.stringify(selector)}).style.visibility = 'hidden'`)
  await sleep(120)
  const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 1 } })
  await ev(`document.querySelector(${JSON.stringify(selector)}).style.visibility = ''`)
  const png = decodePng(Buffer.from(r.data, 'base64'))
  const bg = meanColour(png)
  // 文字顏色：Chrome 把 color-mix 的結果算成 color(srgb r g b)（0–1），其他是 rgb(r, g, b)（0–255）
  const nums = box.color.match(/\d+(\.\d+)?/g).map(Number)
  const text = box.color.startsWith('color(srgb') ? nums.slice(0, 3).map((v) => v * 255) : nums.slice(0, 3)
  return { ratio: contrast(text, bg), text, bg: bg.map(Math.round), size: box.size, weight: box.weight }
}
const sky = []
const skyCheck = async (page, selector, label) => {
  const m = await measureOnSky(selector)
  if (!m) { sky.push({ page, selector, label, ok: false, detail: 'element not found' }); console.log(`sky  FAIL ${page} ${label}: element not found`); return }
  // WCAG AA：一般文字 4.5，大字（≥ 24px，或 ≥ 18.66px 且粗體）3
  const large = m.size >= 24 || (m.size >= 18.66 && Number(m.weight) >= 700)
  const min = large ? 3 : 4.5
  const ok = m.ratio >= min
  sky.push({ page, selector, label, ok, ratio: +m.ratio.toFixed(2), min, text: m.text, bg: m.bg, size: m.size })
  console.log(`sky  ${ok ? 'ok  ' : 'FAIL'} ${page} ${label}: ${m.ratio.toFixed(2)} (min ${min}; text rgb(${m.text.join(',')}) on mean rgb(${m.bg.join(',')}), ${m.size}px)`)
}

// ── Part 1: axe-core ──
// 只跑 WCAG 2.0／2.1 的 A 與 AA 規則（best-practice 另外一回事，噪音多）。每頁注入一次 axe.source（1.4 MB）。
const RULE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
const runAxe = async (name) => {
  const injected = await ev('typeof axe === "object"')
  if (injected !== true) await send('Runtime.evaluate', { expression: axe.source })
  const ready = await ev('typeof axe === "object" && typeof axe.run === "function"')
  if (ready !== true) return { name, error: 'axe did not load' }
  const result = await ev(`axe.run(document, { runOnly: { type: 'tag', values: ${JSON.stringify(RULE_TAGS)} }, resultTypes: ['violations'] }).then((r) => JSON.stringify({ violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') ?? '', summary: v.nodes[0]?.failureSummary ?? '' })), passes: r.passes.length, incomplete: r.incomplete.length }))`)
  if (typeof result !== 'string') return { name, error: String(result) }
  return { name, ...JSON.parse(result) }
}

const pages = []
const audit = async (name, prep) => {
  if (prep) await prep()
  const r = await runAxe(name)
  // axe 對浮在天空上的頂欄字的對比度判定是推算的（它看不到畫布）；那幾個元素上面已經用像素量過，量過且合格的才從 axe 的清單移到 remeasured
  const headerMeasuredOk = sky.length > 0 && sky.every((s) => s.ok)
  r.remeasured = (r.violations ?? []).filter((v) => v.id === 'color-contrast' && /\.site-header|\.mark|\.nav-item/.test(v.sample) && headerMeasuredOk)
  r.violations = (r.violations ?? []).filter((v) => !r.remeasured.includes(v))
  pages.push(r)
  const serious = (r.violations ?? []).filter((v) => ['serious', 'critical'].includes(v.impact))
  console.log(`${name.padEnd(34)} ${r.error ? 'ERROR ' + r.error : `${(r.violations ?? []).length} violations (${serious.length} serious/critical), ${r.passes} passes, ${r.incomplete} incomplete${r.remeasured.length ? `, ${r.remeasured.length} re-measured on the sky` : ''}`}`)
  for (const v of r.violations ?? []) console.log(`    ${v.impact?.padEnd(8)} ${v.id} ×${v.nodes}  ${v.sample}`)
}

// 訪客能到的頁
// 四個時刻（開發版的 ?hour=）：清晨與傍晚天空是中間調，是最容易不合格的；桌機的頂欄浮在天空上、手機的頂欄在紙色上
for (const hour of [6, 12, 18, 22]) {
  await go(`/?hour=${hour}`, 2400)
  await skyCheck(`home ${String(hour).padStart(2, '0')}:00`, '.site-header .mark', 'brand mark')
  await skyCheck(`home ${String(hour).padStart(2, '0')}:00`, '.site-header .nav-item .label', 'first nav label')
  await skyCheck(`home ${String(hour).padStart(2, '0')}:00`, 'h1', 'hero h1')
}
await go('/', 2200)
await audit('home')
await audit('home: clause picker open', async () => { await click('.sentence .pick'); await sleep(400) })
await audit('home: cart peek open', async () => { await ev('document.querySelector(".cart-link")?.focus()'); await sleep(400) })
await audit('theme page', async () => { await go('/themes/minimal', 2000) })
await audit('all outfits', async () => { await go('/outfits', 2000) })
await audit('campaign page', async () => { await go('/campaigns/rain-week', 2000) })
await audit('outfit page', async () => { await go('/outfits/1', 2000) })
await audit('products list', async () => { await go('/products?q=大衣', 1800) })
await audit('product page', async () => { await go('/products/101', 1800) })
await audit('product page: zoom dialog open', async () => { await click('.zoom-btn'); await sleep(400) })
await audit('brand page', async () => { await go('/brands/wuan', 1800) })
await audit('fitting room', async () => { await go('/fitting?from=1', 2000) })
await audit('favorites (guest)', async () => { await go('/favorites', 1500) })
await audit('history (guest)', async () => { await go('/history', 1500) })
await audit('cart (with one line)', async () => { await go('/products/404', 1800); await click('.buy button[type=submit]'); await sleep(300); await go('/cart', 1800) })
await audit('login', async () => { await go('/login', 1400) })
await audit('register', async () => { await go('/register', 1400) })
await audit('not found', async () => { await go('/no-such-page', 1400) })
// 登入後的頁
await go('/login', 1400)
await type('#login-email', 'demo@example.com')
await type('#login-password', 'demo1234')
await click('form.login button[type=submit]')
await sleep(900)
const loggedIn = (await pathname()) === '/account'
if (!loggedIn) console.log('instrument: login did not land on /account:', await pathname())
await audit('account', async () => { await go('/account', 1500) })
await audit('addresses', async () => { await go('/account/addresses', 1500) })
await audit('orders', async () => { await go('/account/orders', 1500) })
await audit('order detail (pending)', async () => { await go('/account/orders/WD-20261003-0002', 1500) })
await audit('order detail: pay options open', async () => { await click('.pay-now'); await sleep(300) })
await audit('my style', async () => { await go('/account/style', 1500) })
await audit('body', async () => { await go('/account/body', 1500) })
await audit('onboarding style', async () => { await go('/onboarding/style', 1800) })
await audit('onboarding body', async () => { await go('/onboarding/body', 1500) })
await audit('checkout step 1', async () => { await go('/checkout', 1800) })
await audit('checkout step 2', async () => { await click('.checkout-step1 .address-option input', 0); await click('.checkout-step1 .next'); await sleep(500) })

// ── Part 2: keyboard-only purchase path ──
// 真的按鍵（Input.dispatchKeyEvent），不呼叫 .focus()。tabTo：一直按 Tab 直到焦點落在符合的元素上，超過上限就算卡住。
// 無頭 Chrome 的頁面預設沒有「焦點」，Tab 按了不會走：要先開 focus emulation（第一次跑就是這樣，18 項全紅、activeElement 一直是 body）。
// 沒有文字的鍵（Tab）用 rawKeyDown，有文字的（Enter、Space）用 keyDown——和 Puppeteer 一樣。
await send('Emulation.setFocusEmulationEnabled', { enabled: true })
await send('Page.bringToFront')
const key = async (keyName, code, vk, text) => {
  await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key: keyName, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(text ? { text } : {}) })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk })
}
const tab = () => key('Tab', 'Tab', 9)
// Shift+Tab：往回走（頂欄在 main 前面，從購買區塊往前 Tab 要繞過整個頁尾才回得來；真的鍵盤使用者也是往回走）
const shiftTab = async () => {
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, modifiers: 8 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, modifiers: 8 })
}
const enter = () => key('Enter', 'Enter', 13, '\r')
const space = () => key(' ', 'Space', 32, ' ')
const arrowDown = () => key('ArrowDown', 'ArrowDown', 40)
const active = () => ev('(() => { const a = document.activeElement; if (!a) return null; return { tag: a.tagName, id: a.id, cls: a.className, text: (a.textContent || "").trim().slice(0, 30), href: a.getAttribute("href") } })()')
const tabTo = async (selector, max = 60, backwards = false) => {
  for (let i = 1; i <= max; i++) {
    await (backwards ? shiftTab() : tab())
    const hit = await ev(`document.activeElement?.matches(${JSON.stringify(selector)}) === true`)
    if (hit === true) return i
  }
  return -1
}
const walk = []
const step = (name, ok, detail) => { walk.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail !== undefined ? ' — ' + detail : ''}`) }

// 空購物車、從單品列表開始（登入狀態還在）
await ev('localStorage.removeItem("cart")')
await go('/products', 1800)
let n = await tabTo('.skip')
step('products: first Tab lands on the skip link', n === 1, n)
await enter()
await sleep(200)
step('products: skip link moves focus to main', (await ev('document.activeElement?.id')) === 'main', JSON.stringify(await active()))
n = await tabTo('.grid a, .product-card a, a[href^="/products/"]')
step('products: Tab reaches a product link', n > 0, n)
await enter()
await sleep(1500)
step('products: Enter opens the product page', /^\/products\/\d+$/.test(await pathname()), await pathname())
// 換頁後焦點在 h1；商品還在載入時 h1 還沒畫出來，就落在 main（main.js 的退路）——兩種都算到了新頁面
step('product page: focus landed on the h1 (or main while loading) after the route change', ['H1', 'MAIN'].includes(await ev('document.activeElement?.tagName')), JSON.stringify(await active()))
n = await tabTo('.buy input[name=size]:not([disabled])')
step('product page: Tab reaches an in-stock size radio', n > 0, n)
await space()
step('product page: Space picks the size', (await ev('document.querySelector(".buy input[name=size]:checked") !== null')) === true)
n = await tabTo('.buy button[type=submit]', 40)
step('product page: Tab reaches 加入購物車', n > 0, n)
await enter()
await sleep(600)
step('product page: Enter adds one line', (await ev('document.querySelector(".cart-link .count")?.firstChild?.textContent')) === '1', await ev('document.querySelector(".cart-link .count")?.firstChild?.textContent'))
n = await tabTo('.cart-link', 40, true)
step('header: Shift+Tab back to the cart link', n > 0, n)
await enter()
await sleep(1600)
step('cart: Enter opens the cart', (await pathname()) === '/cart', await pathname())
n = await tabTo('.summary .primary', 60)
step('cart: Tab reaches 去結帳', n > 0, n)
await enter()
await sleep(1600)
step('checkout: Enter opens the checkout', (await pathname()) === '/checkout', await pathname())
n = await tabTo('.checkout-step1 .address-option input', 40)
step('checkout: Tab reaches an address option', n > 0, n)
await space()
n = await tabTo('.checkout-step1 .next', 40)
step('checkout: Tab reaches 下一步', n > 0, n)
await enter()
await sleep(500)
step('checkout: step 2 opened and the title got focus', (await count('.checkout-step2')) === 1 && (await ev('document.activeElement?.id')) === 'step2-title', JSON.stringify(await active()))
n = await tabTo('.checkout-step2 input[name=payment]', 40)
step('checkout: Tab enters the payment radio group', n > 0, n)
// 同一組 radio 用方向鍵換（Tab 只進到群組、方向鍵會移動並勾選）：按到「模擬付款成功」為止
for (let i = 0; i < 4; i++) {
  if ((await ev('document.activeElement?.value')) === 'mock') break
  await arrowDown()
}
if ((await ev('document.querySelector(".checkout-step2 input[name=payment]:checked")?.value')) !== 'mock') await space()
step('checkout: arrow keys reach and pick 模擬付款', (await ev('document.querySelector(".checkout-step2 input[name=payment]:checked")?.value')) === 'mock', await ev('document.querySelector(".checkout-step2 input[name=payment]:checked")?.value'))
n = await tabTo('.checkout-step2 .place-order', 40)
step('checkout: Tab reaches 送出訂單', n > 0, n)
await enter()
await sleep(1800)
step('done: Enter places the order', (await pathname()).startsWith('/checkout/done/WD-'), await pathname())
await shot('keyboard-done')

const seriousTotal = pages.reduce((sum, p) => sum + (p.violations ?? []).filter((v) => ['serious', 'critical'].includes(v.impact)).length, 0)
const allTotal = pages.reduce((sum, p) => sum + (p.violations ?? []).length, 0)
const errors = pages.filter((p) => p.error).length
const skyFailed = sky.filter((s) => !s.ok)
const summary = { origin, size: `${W}x${H}`, pages: pages.length, violations: allTotal, seriousOrCritical: seriousTotal, instrumentErrors: errors, sky, keyboard: { passed: walk.filter((s) => s.ok).length, failed: walk.filter((s) => !s.ok) }, problems }
writeFileSync(join(outDir, 'a11y.json'), JSON.stringify({ summary, pages, sky, walk }, null, 1))
console.log(JSON.stringify(summary, null, 1))
ws.close()
chrome.kill()
process.exit(errors ? 2 : seriousTotal || summary.keyboard.failed.length || skyFailed.length ? 1 : 0)
