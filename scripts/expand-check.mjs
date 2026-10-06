// Headless Chrome over raw CDP: acceptance checks for the expansion rounds (docs/09). Section 1 = sub-round 1
// (footer, home shelves, campaigns, six more outfits). usage: node scripts/expand-check.mjs <origin> <outDir> [width] [height]
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
const results = []
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail })
const text = (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.textContent.trim().replace(/\\s+/g, ' ') ?? null`)
const count = (sel) => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`)
// 溢出要和 clientWidth 比，不能和 innerWidth 比：手機模擬（mobile: true）下版面視口會跟著溢出的內容長大，
// scrollWidth 與 innerWidth 一起變成 589，相減永遠是 0（實測，第十五輪抓到）。clientWidth 才是 390
const overflow = () => ev('document.documentElement.scrollWidth - document.documentElement.clientWidth')
// 另外數「右緣超出視窗的可見元素」：跳過鍵盤用的跳轉連結（故意藏在上面）、飛行中的殘影，
// 以及橫向可捲容器（兩排單品）裡的東西——它們超出視窗是設計，不是溢出
const spill = () =>
  ev(`[...document.querySelectorAll("body *")].filter((el) => {
    if (el.matches(".skip, body > img[aria-hidden]")) return false
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll") return false }
    const r = el.getBoundingClientRect()
    return r.width > 1 && r.height > 1 && r.right > document.documentElement.clientWidth + 1 && getComputedStyle(el).visibility !== "hidden"
  }).map((el) => el.tagName + "." + String(el.className).split(" ")[0]).slice(0, 5)`)
const bottom = async () => {
  await ev('window.scrollTo(0, document.documentElement.scrollHeight)')
  await sleep(700)
}

// ── 1. 首頁：頁尾、舞台插卡、兩排單品 ──
await go('/', 2800)
check('home: 2 campaign tiles in the stage', (await count('.grid .campaign-tile')) === 2, await count('.grid .campaign-tile'))
check('home: 18 outfit cards', (await count('.grid .card')) === 18, await count('.grid .card'))
check('home: grid cells = 18 + 2', (await count('.grid > *')) === 20, await count('.grid > *'))
check('home: title says 18 套', ((await text('.shop-title .count')) ?? '').includes('18'), await text('.shop-title .count'))
check('home: tile links to a campaign page', (await ev('document.querySelector(".grid .campaign-tile")?.getAttribute("href")'))?.startsWith('/campaigns/'), await ev('document.querySelector(".grid .campaign-tile")?.getAttribute("href")'))
check('home: tile has title and period', (await ev('(() => { const t = document.querySelector(".grid .campaign-tile"); return !!t && t.querySelector(".title").textContent.length > 0 && /\\d+\\/\\d+–\\d+\\/\\d+/.test(t.querySelector(".period").textContent) })()')) === true)
// 插卡的字要留在插卡裡：量每一張插卡文字區塊裡「每一個元素」的右緣（第一版只量外框，標題自己跑出去卻是綠的），
// 也量插卡本身的右緣不超過視窗
check('home: tile text stays inside the tile', (await ev('[...document.querySelectorAll(".grid .campaign-tile")].every((t) => { const a = t.getBoundingClientRect(); return a.right <= document.documentElement.clientWidth + 1 && [...t.querySelectorAll(".text, .text *")].every((el) => el.getBoundingClientRect().right <= a.right + 1) })')) === true, await ev('[...document.querySelectorAll(".grid .campaign-tile")].map((t) => { const a = t.getBoundingClientRect(); return Math.round(Math.max(...[...t.querySelectorAll(".text, .text *")].map((el) => el.getBoundingClientRect().right)) - a.right) + "/" + Math.round(a.right - document.documentElement.clientWidth) }).join(",")'))
// 正控：溢出偵測本身要抓得到東西——塞一個 3000px 寬的元素進去，它一定要出現在清單裡，量完拿掉
check('instrument: spill detector catches an injected 3000px element', JSON.stringify(await ev('(() => { const d = document.createElement("div"); d.className = "control-spill"; d.style.cssText = "position:absolute;top:0;left:0;width:3000px;height:10px"; document.body.appendChild(d); const hit = [...document.querySelectorAll("body *")].filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1).some((el) => el.className === "control-spill"); d.remove(); return hit })()')) === 'true')
check('instrument: viewport is really ' + W + ' wide', (await ev('document.documentElement.clientWidth')) === W, await ev('document.documentElement.clientWidth'))
await ev('document.querySelector(".grid .campaign-tile")?.scrollIntoView()')
await sleep(300)
check('home: nothing spills past the viewport at the tile', JSON.stringify(await spill()) === '[]', JSON.stringify(await spill()))
check('home: shelves 8 new + 8 popular', (await count('.shelves .shelf:nth-of-type(1) .card')) === 8 && (await count('.shelves .ranked .card')) === 8, `${await count('.shelves .shelf:nth-of-type(1) .card')} / ${await count('.shelves .ranked .card')}`)
check('home: first rank number is 1', (await text('.shelves .ranked .rank')) === '1', await text('.shelves .ranked .rank'))
check('home: shelf 看全部 links to /search?sort=new', (await ev('document.querySelector(".shelves .shelf-head a")?.getAttribute("href")')) === '/search?sort=new', await ev('document.querySelector(".shelves .shelf-head a")?.getAttribute("href")'))
await bottom()
await shot('home-bottom')
check('footer: ≥ 5 column titles', (await count('.site-footer .col h2')) >= 5, await count('.site-footer .col h2'))
check('footer: 8 theme links', (await count('.site-footer .col:nth-of-type(1) a')) === 8, await count('.site-footer .col:nth-of-type(1) a'))
check('footer: 6 brand links', (await count('.site-footer .col:nth-of-type(2) a')) === 6, await count('.site-footer .col:nth-of-type(2) a'))
check('footer: 3 active campaigns listed (expired one hidden)', (await count('.site-footer a[href^="/campaigns/"]')) === 3, await count('.site-footer a[href^="/campaigns/"]'))
check('footer: GitHub link is external and opens a new tab', (await ev('[...document.querySelectorAll(".site-footer a.ext")].some((a) => a.href.startsWith("https://github.com/") && a.target === "_blank" && a.rel.includes("noopener"))')) === true)
check('footer: no fake social links', (await ev('[...document.querySelectorAll(".site-footer a")].some((a) => /instagram|facebook|twitter|x\\.com|threads/i.test(a.href))')) === false)
check('footer: statements kept', (await ev('document.querySelector(".site-footer .notes")?.textContent.includes("品牌皆為虛構")')) === true)
check('footer: guest sees 登入／註冊', (await ev('[...document.querySelectorAll(".site-footer .col a")].map((a) => a.textContent.trim()).filter((t) => t === "登入" || t === "註冊").length')) === 2)
// 平滑捲動從頁尾回頂端要一點時間（無頭 Chrome 裡比 1 秒長）：最多等 3 秒，到頂就算
check('footer: 回到最上面 works', (await ev('(async () => { document.querySelector(".site-footer .top").click(); for (let i = 0; i < 30; i++) { await new Promise((r) => setTimeout(r, 100)); if (window.scrollY < 40) return window.scrollY } return window.scrollY })()')) < 40, await ev('window.scrollY'))
check('home: overflow 0', (await overflow()) <= 0, await overflow())

// ── 2. 活動頁 ──
await go('/campaigns/rain-week', 2800)
await shot('campaign-rain-week')
check('campaign: title', (await text('.campaign-hero h1')) === '下雨也照常出門', await text('.campaign-hero h1'))
check('campaign: 3 looks in the hero', (await count('.campaign-hero .look-link')) === 3, await count('.campaign-hero .look-link'))
check('campaign: others nav lists the 2 other active ones', (await count('.campaign-hero .others a')) === 2, await count('.campaign-hero .others a'))
check('campaign: store title names the campaign', ((await text('.shop-title')) ?? '').includes('下雨也照常出門的穿搭'), await text('.shop-title'))
check('campaign: store lists its 3 outfits', (await count('.grid .card')) === 3, await count('.grid .card'))
check('campaign: no tiles inside a campaign', (await count('.grid .campaign-tile')) === 0, await count('.grid .campaign-tile'))
check('campaign: 6 products row', (await count('.campaign-items .card')) === 6, await count('.campaign-items .card'))
check('campaign: no 已經結束 note while active', (await count('.campaign-hero .ended')) === 0)
check('campaign: overflow 0', (await overflow()) <= 0, await overflow())
await go('/campaigns/summer-linen', 2400)
check('campaign expired: 已經結束 note', (await ev('document.querySelector(".campaign-hero .ended")?.textContent.includes("已經結束")')) === true, await text('.campaign-hero .ended'))
check('campaign expired: still lists its outfit', (await count('.grid .card')) === 1, await count('.grid .card'))
await go('/campaigns/nope', 2000)
check('campaign missing: not-found state', (await text('.campaign-hero h1')) === '找不到這檔活動', await text('.campaign-hero h1'))

// ── 3. 路線頁只插同路線的活動 ──
await go('/themes/street', 2600)
check('theme street: 3 outfits, 0 tiles', (await count('.grid .card')) === 3 && (await count('.grid .campaign-tile')) === 0, `${await count('.grid .card')} / ${await count('.grid .campaign-tile')}`)
await go('/themes/outdoor', 2600)
check('theme outdoor: 3 outfits, 1 tile', (await count('.grid .card')) === 3 && (await count('.grid .campaign-tile')) === 1, `${await count('.grid .card')} / ${await count('.grid .campaign-tile')}`)
await shot('theme-outdoor')

// ── 4. 商品頁：同品牌的新品 ──
await go('/products/401', 2600)
check('product: 同品牌的新品 row present', (await ev('[...document.querySelectorAll(".section-title")].some((h) => h.textContent.includes("的新品"))')) === true)
check('product: same-brand row ≤ 4 and excludes itself', (await ev('(() => { const cards = [...document.querySelectorAll(".same-brand .card")]; return cards.length > 0 && cards.length <= 4 && cards.every((a) => !a.href.endsWith("/products/401")) })()')) === true, await count('.same-brand .card'))

// ── 5. 搜尋頁沒有關鍵字、穿搭數 ──
await go('/search?sort=popular', 2200)
check('search: no keyword lists all 35', (await count('.grid .card')) === 35, await count('.grid .card'))
check('search: heading 單品', (await text('.head h1')) === '單品', await text('.head h1'))
check('search: lead says 35 件全部單品', ((await text('.lead')) ?? '').includes('35 件全部單品'), await text('.lead'))
await go('/search?q=' + encodeURIComponent('襯衫'), 2000)
check('search: keyword still works (6 shirts)', (await count('.grid .card')) === 6, await count('.grid .card'))
await go('/outfits', 2600)
check('outfits: 18 cards', (await count('.grid .card')) === 18, await count('.grid .card'))
await go('/outfits?for=women', 2600)
check('outfits: ?for=women → 14', (await count('.grid .card')) === 14, await count('.grid .card'))
await go('/outfits?for=men', 2600)
check('outfits: ?for=men → 9', (await count('.grid .card')) === 9, await count('.grid .card'))
check('outfits: overflow 0', (await overflow()) <= 0, await overflow())

const summary = { origin, size: `${W}x${H}`, passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok), problems }
console.log(JSON.stringify(summary, null, 1))
ws.close()
chrome.kill()
process.exit(0)
