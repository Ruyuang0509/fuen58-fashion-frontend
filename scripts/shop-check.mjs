// Headless Chrome over raw CDP: walks the purchase path (product → cart → checkout, search) and records checks.
// usage: node shop.mjs <origin> <outDir> [width] [height]
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [origin, outDir, w = '1252', h = '699'] = process.argv.slice(2)
const W = +w
const H = +h
mkdirSync(outDir, { recursive: true })
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const port = 9333 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(join(tmpdir(), 'cdp-'))
const chrome = spawn(
  chromePath,
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
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type))
    problems.push(m.params.type + ' ' + m.params.args.map((a) => a.value ?? a.description).join(' '))
}
const send = (method, params = {}) =>
  new Promise((r) => {
    const n = ++id
    pending.set(n, r)
    ws.send(JSON.stringify({ id: n, method, params }))
  })
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
const go = async (path, wait = 1400) => {
  await send('Page.navigate', { url: origin + path })
  await sleep(wait)
}
const key = async (k, code) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: code === 'Escape' ? 27 : 0 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: code === 'Escape' ? 27 : 0 })
}
const results = []
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail })
const text = (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.textContent.trim().replace(/\\s+/g, ' ') ?? null`)
const count = (sel) => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`)
const click = (sel, nth = 0) => ev(`(() => { const el = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; if (!el) return 'missing'; el.click(); return 'clicked' })()`)
const overflow = () => ev('document.documentElement.scrollWidth - window.innerWidth')
const cartCount = () => ev('document.querySelector(".cart-link .count")?.firstChild?.textContent ?? "0"')

const phone = W < 600

// ── 1. 商品頁 101（落肩混紡大衣：兩色、三尺寸、燕麥 S 無庫存） ──
await go('/products/101', 2200)
await shot('product-101')
check('product: name', (await text('h1.name')) === '落肩混紡大衣', await text('h1.name'))
check('product: main image is a rendered PNG', (await ev('document.querySelector(".main img")?.src.startsWith("data:image/png")')) === true)
check('product: 2 colour thumbs', (await count('.thumbs button')) === 2, await count('.thumbs button'))
check('product: 3 sizes, 1 disabled (oat S)', (await count('.sizes input')) === 3 && (await count('.sizes input:disabled')) === 1, `${await count('.sizes input')} / ${await count('.sizes input:disabled')}`)
check('product: overflow 0', (await overflow()) <= 0, await overflow())
// 沒選尺寸就按：錯誤貼在欄位旁、焦點移到第一個可選尺寸
await click('.buy button[type=submit]')
await sleep(150)
check('product: size error shown', (await text('#size-error')) === '請先選尺寸。', await text('#size-error'))
check('product: focus moved to a size radio', (await ev('document.activeElement?.name')) === 'size', await ev('document.activeElement?.outerHTML.slice(0, 60)'))
check('product: cart count still 0', (await cartCount()) === '0', await cartCount())
// 選 M，加到 2 件
await click('.sizes label', 1)
await sleep(120)
check('product: M chosen', (await text('.sizes ~ legend, .field legend .chosen')) !== null && (await ev('document.querySelector(".size.on span")?.textContent')) === 'M', await ev('document.querySelector(".size.on span")?.textContent'))
check('product: error cleared', (await count('#size-error')) === 0)
await click('.stepper button[aria-label=加一件]')
await sleep(80)
check('product: qty 2', (await ev('document.querySelector("#qty").value')) === '2', await ev('document.querySelector("#qty").value'))
// 換色：網址帶 colour、圖換了、M 仍可選、L 變無庫存
const srcBefore = await ev('document.querySelector(".main img").src.length')
await click('.thumbs button', 1)
await sleep(400)
check('product: colour in url', (await ev('location.search')) === '?colour=charcoal', await ev('location.search'))
check('product: image changed with colour', (await ev('document.querySelector(".main img").src.length')) !== srcBefore)
check('product: caption shows 炭灰', (await text('.main figcaption')) === '炭灰', await text('.main figcaption'))
check('product: charcoal L disabled', (await ev('document.querySelectorAll(".sizes input")[2].disabled')) === true)
check('product: M still chosen', (await ev('document.querySelector(".size.on span")?.textContent')) === 'M')
await shot('product-101-charcoal')
// 加入購物車：回饋文字、頂欄件數、飛入的那張圖
const ghost = await ev('(() => { document.querySelector(".buy button[type=submit]").click(); return document.querySelectorAll("body > img[aria-hidden]").length })()')
await sleep(300)
check('product: fly ghost appeared', phone ? true : ghost === 1, ghost)
check('product: feedback text', (await text('.feedback')) === '已加入購物車：炭灰・M × 2', await text('.feedback'))
check('product: header count 2', (await cartCount()) === '2', await cartCount())
await shot('product-added')
// 放大
await click('.zoom-btn')
await sleep(500)
check('product: zoom dialog open', (await count('dialog[open]')) === 1)
await shot('product-zoom')
await key('Escape', 'Escape')
await sleep(200)
check('product: Esc closes zoom', (await count('dialog[open]')) === 0)
// 下面兩段
check('product: appears in ≥1 outfit', (await count('.looks .look')) >= 1, await count('.looks .look'))
check('product: related products present', (await count('.section .grid .card')) >= 1, await count('.section .grid .card'))
await ev('window.scrollTo(0, document.body.scrollHeight)')
await sleep(400)
await shot('product-bottom')
// 尺寸表
await ev('window.scrollTo(0, 0)')
await click('.measure summary')
await sleep(200)
check('product: measure table has 4 columns + size', (await count('.measure thead th')) === 5, await count('.measure thead th'))
check('product: chosen size row highlighted', (await text('.measure tr.on th')) === 'M', await text('.measure tr.on th'))

// ── 2. 商品頁 404（健行襪：沒有款式圖 → 布料近拍；單一尺寸） ──
await go('/products/404', 2000)
await shot('product-404')
check('socks: rendered flat (not the swatch fallback)', (await count('.main img:not(.swatch)')) === 1 && (await count('.main img.swatch')) === 0)
check('socks: single size text', (await text('.buy .single')) === '尺寸單一尺寸', await text('.buy .single'))
await click('.buy button[type=submit]')
await sleep(300)
check('socks: added, count 3', (await cartCount()) === '3', await cartCount())
// 找不到的商品
await go('/products/999', 1500)
check('missing product: state shown', (await text('.state h1')) === '找不到這件商品', await text('.state h1'))

// ── 3. 從穿搭卡整套加入（三件，尺寸未選） ──
await go('/outfits', 2200)
await click('.card .btn')
await sleep(400)
check('outfits: whole outfit added, count 6', (await cartCount()) === '6', await cartCount())

// ── 4. 購物車 ──
await go('/cart', 2200)
await shot('cart')
check('cart: 5 lines', (await count('.lines .line')) === 5, await count('.lines .line'))
check('cart: 3 lines missing size', (await count('.size-pick.missing')) === 3, await count('.size-pick.missing'))
check('cart: checkout disabled', (await ev('document.querySelector(".summary .primary").disabled')) === true)
check('cart: missing-size hint', (await text('.summary .hint:last-of-type')) === '還有 3 件沒選尺寸。', await text('.summary .hint:last-of-type'))
check('cart: hangers 6 in 5 groups', (await count('.rail .hanger')) === 6 && (await count('.rail .hanger-group')) === 5, `${await count('.rail .hanger')} / ${await count('.rail .hanger-group')}`)
check('cart: subtotal 12,980 free shipping', (await text('.summary dd:nth-of-type(1)')) === 'NT$ 12,980' && (await text('.summary dd:nth-of-type(2)')) === '免運', `${await text('.summary dd:nth-of-type(1)')} / ${await text('.summary dd:nth-of-type(2)')}`)
check('cart: overflow 0', (await overflow()) <= 0, await overflow())
// 補選尺寸：第 3 列（101 燕麥）選 M；其中 S 應該是無庫存
const missingSelects = '.size-pick.missing select'
check('cart: oat S disabled in select', (await ev(`document.querySelectorAll(${JSON.stringify(missingSelects)})[0].querySelector("option[value=S]").disabled`)) === true)
await ev(`(() => { const s = document.querySelectorAll(${JSON.stringify(missingSelects)})[0]; s.value = "M"; s.dispatchEvent(new Event("change", { bubbles: true })) })()`)
await sleep(150)
check('cart: still 5 lines (oat M ≠ charcoal M)', (await count('.lines .line')) === 5, await count('.lines .line'))
// 第 4 列（102 米白）選 M：庫存只有 2，加到 3 會停在 2
await ev(`(() => { const s = document.querySelectorAll(${JSON.stringify(missingSelects)})[0]; s.value = "M"; s.dispatchEvent(new Event("change", { bubbles: true })) })()`)
await sleep(150)
await click('.lines .line:nth-child(4) .stepper button[aria-label=加一件]')
await sleep(80)
await click('.lines .line:nth-child(4) .stepper button[aria-label=加一件]')
await sleep(80)
check('cart: qty capped at stock 2', (await ev('document.querySelector(".lines .line:nth-child(4) .stepper input").value')) === '2' && (await ev('document.querySelector(".lines .line:nth-child(4) .stepper button[aria-label=加一件]").disabled')) === true, await ev('document.querySelector(".lines .line:nth-child(4) .stepper input").value'))
// 第 5 列（103）選 L
await ev(`(() => { const s = document.querySelectorAll(${JSON.stringify(missingSelects)})[0]; s.value = "L"; s.dispatchEvent(new Event("change", { bubbles: true })) })()`)
await sleep(150)
check('cart: no line missing size', (await count('.size-pick.missing')) === 0)
check('cart: checkout enabled', (await ev('document.querySelector(".summary .primary").disabled')) === false)
// 數量輸入超過庫存：第 1 列炭灰 M 庫存 15
await ev('(() => { const i = document.querySelector(".lines .line:nth-child(1) .stepper input"); i.value = "99"; i.dispatchEvent(new Event("change", { bubbles: true })) })()')
await sleep(100)
check('cart: typed 99 clamps to 15', (await ev('document.querySelector(".lines .line:nth-child(1) .stepper input").value')) === '15', await ev('document.querySelector(".lines .line:nth-child(1) .stepper input").value'))
check('cart: header count updated', (await cartCount()) === String(15 + 1 + 1 + 2 + 1), await cartCount())
// 移除與復原
await click('.lines .line:nth-child(2) .remove')
await sleep(150)
check('cart: removed → 4 lines, undo offered', (await count('.lines .line')) === 4 && (await text('.undo'))?.startsWith('已移除「健行襪」'), await text('.undo'))
await click('.undo .link')
await sleep(150)
check('cart: undo → 5 lines, order kept', (await count('.lines .line')) === 5 && (await text('.lines .line:nth-child(2) .name')) === '健行襪', await text('.lines .line:nth-child(2) .name'))
await shot('cart-ready')
await click('.summary .primary')
await sleep(600)
check('cart: checkout navigates', (await ev('location.pathname')) === '/checkout', await ev('location.pathname'))

// ── 5. 搜尋 ──
await go('/search?q=' + encodeURIComponent('襯衫'), 1800)
await shot('search')
check('search: 6 shirts', (await count('.grid .card')) === 6, await count('.grid .card'))
check('search: header input shows keyword', (await ev('document.querySelector("#site-search").value')) === '襯衫')
await go('/search?q=' + encodeURIComponent('龐克'), 1500)
check('search: theme name matches 3', (await count('.grid .card')) === 3, await count('.grid .card'))
await go('/search?q=zzz', 1800)
await shot('search-empty')
check('search: empty state with suggestions', (await count('.empty .grid .card')) >= 1 && (await text('.empty > p'))?.includes('找不到'), await count('.empty .grid .card'))
check('search: overflow 0', (await overflow()) <= 0, await overflow())

const summary = { origin, size: `${W}x${H}`, passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok), problems }
console.log(JSON.stringify(summary, null, 1))
ws.close()
chrome.kill()
process.exit(0)
