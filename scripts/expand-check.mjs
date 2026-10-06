// Headless Chrome over raw CDP: acceptance checks for the expansion rounds (docs/09). Sections: sub-round 1
// (footer, home shelves, campaigns, six more outfits), 2 (favourites, history), 3 (multi-select, /products), header peeks,
// 4 (style quiz, taste profile, for-you ordering). usage: node scripts/expand-check.mjs <origin> <outDir> [width] [height]
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { familyOf } from '../src/products/colourFamily.js'

// 子輪 3 的色系檢查要對著資料算期望值（用同一個 familyOf：量的是「篩選有沒有接上」，分類對不對另外用眼睛看 docs/12 的對照表）
const PRODUCTS = JSON.parse(readFileSync(new URL('../src/api/mock/products.json', import.meta.url), 'utf8'))

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
check('home: shelf 看全部 links to /products?sort=new', (await ev('document.querySelector(".shelves .shelf-head a")?.getAttribute("href")')) === '/products?sort=new', await ev('document.querySelector(".shelves .shelf-head a")?.getAttribute("href")'))
await bottom()
await shot('home-bottom')
check('footer: ≥ 5 column titles', (await count('.site-footer .col h2')) >= 5, await count('.site-footer .col h2'))
check('footer: 8 theme links', (await count('.site-footer .col:nth-of-type(1) a')) === 8, await count('.site-footer .col:nth-of-type(1) a'))
check('footer: 6 brand links', (await count('.site-footer .col:nth-of-type(2) a')) === 6, await count('.site-footer .col:nth-of-type(2) a'))
check('footer: 3 active campaigns listed (expired one hidden)', (await count('.site-footer a[href^="/campaigns/"]')) === 3, await count('.site-footer a[href^="/campaigns/"]'))
check('footer: GitHub link is external and opens a new tab', (await ev('[...document.querySelectorAll(".site-footer a.ext")].some((a) => a.href.startsWith("https://github.com/") && a.target === "_blank" && a.rel.includes("noopener"))')) === true)
check('footer: no fake social links', (await ev('[...document.querySelectorAll(".site-footer a")].some((a) => /instagram|facebook|twitter|x\\.com|threads/i.test(a.href))')) === false)
check('footer: statements kept', (await ev('document.querySelector(".site-footer .notes")?.textContent.includes("品牌皆為虛構")')) === true)
// 2026-10-06 使用者：「沒人會在 footer 放這個」——登入／註冊不在頁尾
check('footer: no 會員 column, no 登入／註冊 links', (await ev('[...document.querySelectorAll(".site-footer .col h2")].every((h) => h.textContent.trim() !== "會員") && ![...document.querySelectorAll(".site-footer a")].some((a) => ["登入", "註冊"].includes(a.textContent.trim()))')) === true)
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
check('product: same-brand row ≤ 4 and excludes itself', (await ev('(() => { const cards = [...document.querySelectorAll(".same-brand .card")]; return cards.length > 0 && cards.length <= 4 && cards.every((card) => !card.querySelector("a").getAttribute("href").endsWith("/products/401")) })()')) === true, await count('.same-brand .card'))

// ── 5. 搜尋頁沒有關鍵字、穿搭數 ──
await go('/search?sort=popular', 2200)
check('search: no keyword lists all 35', (await count('.grid .card')) === 35, await count('.grid .card'))
check('search: heading 單品', (await text('.head h1')) === '單品', await text('.head h1'))
check('search: lead ends with 共 35 件', ((await text('.lead')) ?? '').includes('共 35 件'), await text('.lead'))
check('search: old /search url redirected to /products', (await ev('location.pathname')) === '/products', await ev('location.pathname + location.search'))
await go('/search?q=' + encodeURIComponent('襯衫'), 2000)
check('search: keyword still works (6 shirts)', (await count('.grid .card')) === 6, await count('.grid .card'))
await go('/outfits', 2600)
check('outfits: 18 cards', (await count('.grid .card')) === 18, await count('.grid .card'))
await go('/outfits?for=women', 2600)
check('outfits: ?for=women → 14', (await count('.grid .card')) === 14, await count('.grid .card'))
await go('/outfits?for=men', 2600)
check('outfits: ?for=men → 9', (await count('.grid .card')) === 9, await count('.grid .card'))
check('outfits: overflow 0', (await overflow()) <= 0, await overflow())

// ── 子輪 2：收藏、瀏覽紀錄 ──
const click = (sel, nth = 0) => ev(`(() => { const el = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; if (!el) return 'missing'; el.click(); return 'clicked' })()`)
const setValue = (sel, value) =>
  ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'missing'; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return 'set' })()`)
const favCount = () => ev('document.querySelector(".fav-link .count")?.firstChild?.textContent ?? "0"')
const cartCount = () => ev('document.querySelector(".cart-link .count")?.firstChild?.textContent ?? "0"')
const pressed = (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.getAttribute("aria-pressed")`)

await go('/products/101', 2400)
check('fav: header has a heart link and no count yet', (await count('.fav-link')) === 1 && (await favCount()) === '0', await favCount())
check('fav: product page heart starts off', (await pressed('.buy .fav')) === 'false', await pressed('.buy .fav'))
await click('.buy .fav')
await sleep(500)
check('fav: heart turns on', (await pressed('.buy .fav')) === 'true', await pressed('.buy .fav'))
check('fav: header count 1', (await favCount()) === '1', await favCount())
check('fav: guest favourite stored locally with the colour', (await ev('(() => { const f = JSON.parse(localStorage.getItem("favorites") || "{}"); return f.products?.length === 1 && f.products[0].productId === 101 && f.products[0].colour === "oat" })()')) === true, await ev('localStorage.getItem("favorites")'))
await go('/outfits', 2600)
check('fav: outfit cards offer 收藏這套', (await text('.grid .card .fav .fav-text')) === '收藏這套', await text('.grid .card .fav .fav-text'))
await click('.grid .card .fav')
await sleep(500)
check('fav: outfit heart turns on → header count 2', (await favCount()) === '2' && (await text('.grid .card .fav .fav-text')) === '已收藏', `${await favCount()} / ${await text('.grid .card .fav .fav-text')}`)
await go('/favorites', 2400)
await shot('favorites-guest')
check('fav page: 1 product row + 1 outfit card', (await count('.fav-list li')) === 1 && (await count('.fav-outfits .card')) === 1, `${await count('.fav-list li')} / ${await count('.fav-outfits .card')}`)
check('fav page: product name and colour', (await text('.fav-list .name')) === '落肩混紡大衣' && ((await text('.fav-list .sub')) ?? '').includes('燕麥'), `${await text('.fav-list .name')} / ${await text('.fav-list .sub')}`)
check('fav page: guest note mentions the browser', ((await text('.lead')) ?? '').includes('瀏覽器'), await text('.lead'))
await click('.fav-list .btn')
await sleep(200)
check('fav page: adding without a size shows the inline error', (await text('.fav-list .error')) === '請先選尺寸。', await text('.fav-list .error'))
await setValue('.fav-list select', 'M')
await click('.fav-list .btn')
await sleep(400)
check('fav page: add to cart → cart count 1', (await cartCount()) === '1', await cartCount())
check('fav page: overflow 0', (await overflow()) <= 0, await overflow())
// 登入後併入帳號
await go('/login', 2000)
await setValue('#login-email', 'demo@example.com')
await setValue('#login-password', 'demo1234')
await click('form.login button[type=submit]')
await sleep(1800)
check('fav merge: logged in and landed on /account', (await ev('location.pathname')) === '/account', await ev('location.pathname'))
check('fav merge: header count still 2', (await favCount()) === '2', await favCount())
check('fav merge: local copy cleared', (await ev('localStorage.getItem("favorites")')) === null, await ev('localStorage.getItem("favorites")'))
check('fav merge: the account now holds 1 product + 1 outfit', (await ev('(() => { const db = JSON.parse(localStorage.getItem("account")); const m = db.members.find((x) => x.email === "demo@example.com"); return m.favorites?.products?.length === 1 && m.favorites?.outfits?.length === 1 })()')) === true)
// 子輪 4 加了「我的偏好」：五個分頁變六個
check('account nav: 6 tabs incl. 我的偏好, 收藏 and 看過的', JSON.stringify(await ev('[...document.querySelectorAll(".account-nav a")].map((a) => a.textContent.trim())')) === JSON.stringify(['個人資料', '地址簿', '訂單紀錄', '我的偏好', '收藏', '看過的']), await ev('[...document.querySelectorAll(".account-nav a")].map((a) => a.textContent.trim()).join("|")'))
await go('/products/101', 2400)
check('fav merge: product heart on after login', (await pressed('.buy .fav')) === 'true', await pressed('.buy .fav'))
await click('.buy .fav')
await sleep(500)
check('fav: toggling off → header count 1', (await favCount()) === '1', await favCount())
// 瀏覽紀錄
await go('/products/201', 2400)
await go('/products/101', 2400)
check('history: 最近看過 on the product page shows 201, not 101', (await ev('(() => { const links = [...document.querySelectorAll(".recent .card a")].map((a) => a.getAttribute("href")); return links.length > 0 && links.some((h) => h.includes("/products/201")) && !links.some((h) => h.includes("/products/101")) })()')) === true, await ev('[...document.querySelectorAll(".recent .card a")].map((a) => a.getAttribute("href")).join(",")'))
await go('/outfits/3', 2600)
await go('/history', 2400)
await shot('history')
// 這一輪跑下來看過的單品：401（第一段的同品牌檢查）、101、201、101 → 三件不重複；穿搭只進過 3 號
check('history page: 3 products (401, 101, 201 deduped), 1 outfit', (await count('.history-products .card')) === 3 && (await count('.history-outfits .card')) === 1, `${await count('.history-products .card')} / ${await count('.history-outfits .card')}`)
check('history page: newest first (101 before 201)', (await ev('document.querySelector(".history-products .card a")?.getAttribute("href")')) === '/products/101', await ev('document.querySelector(".history-products .card a")?.getAttribute("href")'))
check('history page: overflow 0', (await overflow()) <= 0, await overflow())
await click('.clear')
await sleep(300)
check('history page: cleared → empty state', ((await text('.state')) ?? '').includes('還沒有紀錄'), await text('.state'))
check('header: the five items fit in the viewport', (await ev('(() => { const n = document.querySelector(".site-header .links").getBoundingClientRect(); return n.right <= document.documentElement.clientWidth + 1 })()')) === true)

// ── 子輪 3：多選篩選、單品列表 ──
const VK = { Enter: 13, Escape: 27, ' ': 32, ArrowDown: 40, ArrowUp: 38, Tab: 9 }
const key = async (k, code) => {
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: VK[k] ?? 0 })
}
const pickText = (slot) => text(`[data-flip-id=clause-${slot}] .pick`)
const expanded = (slot) => ev(`document.querySelector("[data-flip-id=clause-${slot}] .pick")?.getAttribute("aria-expanded")`)

await go('/outfits?occasion=work,date', 2600)
check('multi: ?occasion=work,date → 12 outfits', (await count('.grid .card')) === 12, await count('.grid .card'))
check('multi: phrase reads 上班或約會', ((await pickText('occasion')) ?? '').includes('上班或約會'), await pickText('occasion'))
await go('/outfits?size=S,M&category=outer', 2600)
check('multi: ?size=S,M&category=outer → 15 outfits', (await count('.grid .card')) === 15, await count('.grid .card'))
check('multi: phrase reads S 或 M', ((await pickText('size')) ?? '').includes('S 或 M'), await pickText('size'))
await go('/outfits?occasion=foo,work&size=M,M', 2600)
// pickText 連讀屏用的「尺寸：」也一起讀出來，所以比對冒號後面那段
check('multi: unknown and duplicate values dropped → 2 outfits, phrase 去上班／M', (await count('.grid .card')) === 2 && (await pickText('occasion'))?.includes('去上班') && (await pickText('size'))?.replace(/^.*：/, '').trim() === 'M', `${await count('.grid .card')} / ${await pickText('occasion')} / ${await pickText('size')}`)
// 鍵盤：方向鍵開、方向鍵移、空白鍵勾、Esc 關、焦點回按鈕
await go('/outfits', 2600)
await ev('document.querySelector("[data-flip-id=clause-occasion] .pick").focus()')
await key('ArrowDown', 'ArrowDown')
await sleep(250)
check('picker: ArrowDown on the button opens the listbox', (await count('[role=listbox]')) === 1 && (await expanded('occasion')) === 'true', `${await count('[role=listbox]')} / ${await expanded('occasion')}`)
check('picker: listbox is focused and multiselectable', (await ev('document.activeElement?.getAttribute("role")')) === 'listbox' && (await ev('document.activeElement?.getAttribute("aria-multiselectable")')) === 'true')
await key('ArrowDown', 'ArrowDown')
await key(' ', 'Space')
await sleep(600)
check('picker: ArrowDown + Space ticks 去上班 → ?occasion=work, stays open', (await ev('location.search')) === '?occasion=work' && (await count('[role=listbox]')) === 1, `${await ev('location.search')} / ${await count('[role=listbox]')}`)
await key('ArrowDown', 'ArrowDown')
await key(' ', 'Space')
await sleep(600)
check('picker: second tick → ?occasion=work,date and phrase 上班或約會', (await ev('location.search')) === '?occasion=work,date' && ((await pickText('occasion')) ?? '').includes('上班或約會'), `${await ev('location.search')} / ${await pickText('occasion')}`)
check('picker: option 去上班 is aria-selected', (await ev('[...document.querySelectorAll("[role=option]")].filter((o) => o.getAttribute("aria-selected") === "true").map((o) => o.textContent.trim()).join("|")')) === '去上班|去約會', await ev('[...document.querySelectorAll("[role=option]")].filter((o) => o.getAttribute("aria-selected") === "true").map((o) => o.textContent.trim()).join("|")'))
await key('Escape', 'Escape')
await sleep(250)
check('picker: Esc closes and returns focus to the button', (await count('[role=listbox]')) === 0 && (await ev('document.activeElement?.classList.contains("pick")')) === true, await ev('document.activeElement?.outerHTML.slice(0, 60)'))
check('picker: 12 outfits listed after the keyboard round', (await count('.grid .card')) === 12, await count('.grid .card'))
await shot('sentence-multi')
// 單品列表
await go('/products?brand=wuan,banri', 2400)
check('products: ?brand=wuan,banri → 13', (await count('.grid .card')) === 13, await count('.grid .card'))
check('products: brand phrase 霧岸或半日的', ((await text('[data-slot=brand]')) ?? '').includes('霧岸或半日的'), await text('[data-slot=brand]'))
await go('/products?colour=pink', 2400)
check('products: ?colour=pink → 2 (櫻粉、淺粉)', (await count('.grid .card')) === 2, await count('.grid .card'))
const blackExpected = PRODUCTS.filter((p) => p.colours.some((c) => familyOf(c.hex) === 'black')).length
await go('/products?colour=black,grey', 2400)
const greyBlackExpected = PRODUCTS.filter((p) => p.colours.some((c) => ['black', 'grey'].includes(familyOf(c.hex)))).length
check(`products: ?colour=black,grey → ${greyBlackExpected} (from data), phrase 黑或灰色`, (await count('.grid .card')) === greyBlackExpected && ((await text('[data-slot=colour]')) ?? '').includes('黑或灰色'), `${await count('.grid .card')} / ${await text('[data-slot=colour]')}`)
check('instrument: black alone is a strict subset of black+grey', blackExpected > 0 && blackExpected < greyBlackExpected, `${blackExpected} / ${greyBlackExpected}`)
await go('/products?price=lt2000', 2400)
check('products: ?price=lt2000 → 26, every price below 2,000', (await count('.grid .card')) === 26 && (await ev('[...document.querySelectorAll(".grid .card .num")].every((n) => Number(n.textContent.replace(/[^\\d]/g, "")) < 2000)')) === true, await count('.grid .card'))
await go('/products?size=110', 2400)
check('products: ?size=110 → 3 kids items', (await count('.grid .card')) === 3, await count('.grid .card'))
await go('/products?q=' + encodeURIComponent('襯衫') + '&sort=price-desc&stock=1', 2400)
check('products: keyword + sort + stock → 2,480 first, 6 shirts', (await text('.grid .card .num')) === 'NT$ 2,480' && (await count('.grid .card')) === 6, `${await text('.grid .card .num')} / ${await count('.grid .card')}`)
check('products: header search input shows the keyword', (await ev('document.querySelector("#site-search").value')) === '襯衫')
await go('/products?brand=nope', 2400)
check('products: zero results → 清除條件 + suggestions', ((await text('.empty > p')) ?? '').includes('沒有符合') && (await ev('[...document.querySelectorAll(".empty .btn")].some((a) => a.textContent.trim() === "清除條件")')) === true && (await count('.empty .grid .card')) >= 1, await text('.empty > p'))
await go('/products?colour=beige&category=outer', 2400)
await shot('products-filtered')
check('products: overflow 0', (await overflow()) <= 0, await overflow())
// 打開一格：桌機是浮在下面的清單，手機是底部面板
await ev('document.querySelector("[data-slot=colour] .pick").click()')
await sleep(300)
check(`products: colour list opens with swatches (${W < 600 ? 'bottom sheet' : 'popover'})`, (await count('[role=listbox] .swatch')) === 11 && (await ev('getComputedStyle(document.querySelector(".pop")).position')) === (W < 600 ? 'fixed' : 'absolute'), await ev('getComputedStyle(document.querySelector(".pop")).position'))
await shot('products-picker-open')
check('products: nothing spills with the list open', JSON.stringify(await spill()) === '[]', JSON.stringify(await spill()))

// ── 頂欄圖示的預覽（使用者 2026-10-06 中途提出：icon 不只是連結）──
// 到這裡的狀態：已登入 demo、購物車裡一件 M 的大衣、收藏 0 件單品 1 套穿搭
const hover = async (sel) => {
  const centre = await ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } })()`)
  if (centre) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: centre.x, y: centre.y })
  await sleep(450)
}
const panelText = async () => (await text('.peek-panel')) ?? ''
await go('/outfits', 2600)
if (W >= 768) {
  await hover('.cart-link')
  check('peek: hovering the cart shows the mini cart with the coat and a subtotal', (await count('.peek-panel')) === 1 && (await panelText()).includes('落肩混紡大衣') && (await panelText()).includes('小計'), (await panelText()).slice(0, 90))
  check('peek: mini cart offers 看購物車 and 去結帳', (await ev('[...document.querySelectorAll(".peek-panel a")].map((a) => a.textContent.trim()).join("|")')).includes('看購物車|去結帳'))
  await shot('peek-cart')
  await hover('.fav-link')
  check('peek: hovering 收藏 says 0 件單品、1 套穿搭', (await panelText()).includes('0 件單品、1 套穿搭'), (await panelText()).slice(0, 90))
  await hover('.links a[href="/outfits"]')
  check('peek: hovering 全部穿搭 lists the 8 routes', (await count('.peek-panel a[href^="/themes/"]')) === 8, await count('.peek-panel a[href^="/themes/"]'))
  await shot('peek-routes')
  await hover('.links .member')
  check('peek: member menu names the member and has 登出', (await panelText()).includes('林示範') && (await panelText()).includes('登出'), (await panelText()).slice(0, 90))
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 30, y: 420 })
  await sleep(450)
  check('peek: moving the mouse away closes the panel', (await count('.peek-panel')) === 0, await count('.peek-panel'))
  await ev('document.querySelector(".cart-link").focus()')
  await sleep(300)
  check('peek: keyboard focus on the cart link opens it', (await count('.peek-panel')) === 1, await count('.peek-panel'))
  await key('Escape', 'Escape')
  await sleep(300)
  check('peek: Esc closes it and focus stays on the link', (await count('.peek-panel')) === 0 && (await ev('document.activeElement?.classList.contains("cart-link")')) === true)
  check('peek: nothing spills while a panel is open', JSON.stringify(await (async () => { await hover('.cart-link'); return spill() })()) === '[]')
} else {
  await ev('document.querySelector(".cart-link").focus()')
  await sleep(300)
  check('peek: no popover on the phone (tap goes straight to the page)', (await count('.peek-panel')) === 0, await count('.peek-panel'))
}

// ── 子輪 4：偏好調查、推測、為你排 ──
// 到這裡：登入的是 demo（收藏 1 套、看過 101）。先登出，註冊一個新帳號走一遍調查
const firstTheme = () => ev('document.querySelector(".grid .card")?.dataset.theme')
const firstHref = () => ev('document.querySelector(".grid .card a")?.getAttribute("href")')
const tileThemes = () => ev('[...document.querySelectorAll(".pick-tile")].map((t) => t.dataset.theme).join(",")')
await go('/account', 2200)
await click('.account-nav .logout')
await sleep(800)
check('quiz: logged out from the account page', (await ev('location.pathname')) === '/', await ev('location.pathname'))
const quizEmail = `quiz-${Date.now()}@example.com`
await go('/register?redirect=' + encodeURIComponent('/outfits'), 2000)
await setValue('#register-name', '偏好測試')
await setValue('#register-email', quizEmail)
await setValue('#register-password', 'Quiz1234')
await setValue('#register-confirm', 'Quiz1234')
await click('form.register button[type=submit]')
await sleep(2400)
// vue-router 寫網址時斜線不轉義（redirect=/outfits），所以解碼後比
check('quiz: registering lands on /onboarding/style and keeps the redirect', (await ev('location.pathname')) === '/onboarding/style' && (await ev('new URLSearchParams(location.search).get("redirect")')) === '/outfits', await ev('location.pathname + location.search'))
check('quiz: step 1 offers 4 audiences and 先不選', (await count('.audiences .big')) === 4 && (await ev('[...document.querySelectorAll(".quiz .link")].some((b) => b.textContent.trim() === "先不選")')) === true, await count('.audiences .big'))
await click('.audiences .big', 0) // 女生
await sleep(1000)
check('quiz: step 2 starts with 8 looks, one per route', (await count('.pick-tile')) === 8 && (await ev('new Set([...document.querySelectorAll(".pick-tile")].map((t) => t.dataset.theme)).size')) === 8, await tileThemes())
check('quiz: 看我的比例 is disabled before 3 picks', (await ev('document.querySelector(".quiz .primary")?.disabled')) === true)
check('quiz: overflow 0 with the grid open', (await overflow()) <= 0 && JSON.stringify(await spill()) === '[]', `${await overflow()} / ${JSON.stringify(await spill())}`)
await click('.pick-tile[data-theme=street]')
await sleep(1000)
// 街頭的相鄰是龐克、戶外：各補一套還沒出現的，插在街頭那一套後面
check('quiz: picking 街頭 adds a 龐克 and a 戶外 look right after it (8 → 10)', (await count('.pick-tile')) === 10 && (await ev('[...document.querySelectorAll(".pick-tile")].slice(1, 4).map((t) => t.dataset.theme).join(",")')) === 'street,punk,outdoor' && (await ev('document.querySelector(".pick-tile[data-theme=street]").getAttribute("aria-pressed")')) === 'true', await tileThemes())
await click('.pick-tile[data-theme=punk]') // 剛補進來的那一套
await sleep(1000)
await click('.pick-tile[data-theme=outdoor]') // 剛補進來的那一套
await sleep(1000)
const pickedThemes = await ev('[...document.querySelectorAll(".pick-tile[aria-pressed=true]")].map((t) => t.dataset.theme)')
check('quiz: 3 picked (街頭、龐克、戶外) → 已挑 3 套, button enabled', JSON.stringify(pickedThemes) === JSON.stringify(['street', 'punk', 'outdoor']) && ((await text('.quiz .status')) ?? '').includes('已挑 3 套') && (await ev('document.querySelector(".quiz .primary")?.disabled')) === false, `${JSON.stringify(pickedThemes)} / ${await text('.quiz .status')}`)
await shot('quiz-picks')
await click('.quiz .primary')
await sleep(1400)
// 三套三條路線各 1/3：34／33／33，多出來的 1% 給路線順序在前的（街頭），所以街頭是首選
check('quiz: result bar has 3 segments, 街頭 first with 34%', (await count('.taste .seg')) === 3 && (await ev('document.querySelector(".taste .seg")?.dataset.code')) === 'street' && ((await text('.taste .text')) ?? '').startsWith('34% 街頭') && ((await text('.taste .text')) ?? '').includes('%'), await text('.taste .text'))
check('quiz: preferences saved on the new member (women, 3 picks, weights sum 1)', (await ev(`(() => { const db = JSON.parse(localStorage.getItem("account")); const p = db.members.find((x) => x.email === ${JSON.stringify(quizEmail)})?.preferences; if (!p) return "none"; const sum = Object.values(p.themes).reduce((a, b) => a + b, 0); return p.pickedOutfitIds.length === 3 && p.audience === "women" && Math.round(sum * 100) === 100 && p.themes.street === 0.34 })()`)) === true, await ev(`JSON.stringify(JSON.parse(localStorage.getItem("account")).members.find((x) => x.email === ${JSON.stringify(quizEmail)})?.preferences)`))
check('quiz: 開始逛 goes back to the redirect with ?for=women', (await ev('document.querySelector(".result .btn")?.getAttribute("href")')) === '/outfits?for=women', await ev('document.querySelector(".result .btn")?.getAttribute("href")'))
await shot('quiz-result')
// 會員中心：同一條橫條、理由、六個分頁
await go('/account/style', 2600)
await shot('account-style')
check('account style: 你挑的 bar has the same 3 segments, 街頭 first', (await count('.picked-panel .taste .seg')) === 3 && (await ev('document.querySelector(".picked-panel .taste .seg")?.dataset.code')) === 'street', await text('.picked-panel .taste .text'))
check('account style: the guess panel lists 你挑了 1 套街頭', ((await text('.guess-panel .reasons')) ?? '').includes('你挑了 1 套街頭'), await text('.guess-panel .reasons'))
check('account style: nav has 6 tabs with 我的偏好 current', (await count('.account-nav a')) === 6 && (await ev('document.querySelector(".account-nav a.current")?.textContent.trim()')) === '我的偏好', await ev('document.querySelector(".account-nav a.current")?.textContent.trim()'))
// 六個分頁：桌機兩列都看得到；手機一列橫向捲，目前的那個要捲到看得見（第一版在 390 寬被切在右邊）
check('account style: the current tab is fully visible inside the nav', (await ev('(() => { const a = document.querySelector(".account-nav a.current"); const u = a.closest("ul").getBoundingClientRect(); const r = a.getBoundingClientRect(); return r.left >= u.left - 1 && r.right <= u.right + 1 })()')) === true, await ev('(() => { const a = document.querySelector(".account-nav a.current"); return Math.round(a.getBoundingClientRect().right - a.closest("ul").getBoundingClientRect().right) })()'))
if (W >= 768) check('account style: on the desktop every tab is inside the column', (await ev('[...document.querySelectorAll(".account-nav a")].every((a) => a.getBoundingClientRect().right <= a.closest("ul").getBoundingClientRect().right + 1)')) === true)
check('account style: overflow 0', (await overflow()) <= 0, await overflow())
// 全部穿搭：照喜好排、可以關
await go('/outfits', 2800)
check('for-you: first card is 街頭 and the title says 照你的喜好排', (await firstTheme()) === 'street' && ((await text('.shop-title')) ?? '').includes('照你的喜好排'), `${await firstTheme()} / ${await text('.shop-title')}`)
check('for-you: reason line under the title', ((await text('.taste-line')) ?? '').includes('你挑了 1 套街頭') && ((await text('.taste-line')) ?? '').includes('街頭的排前面'), await text('.taste-line'))
// 權重一樣的三條照路線順序排在一起（街頭、戶外、龐克），不交錯；之後才是其他路線照 id
check('for-you: picked routes grouped first (3 街頭, 3 戶外, 2 龐克), then id order', (await ev('[...document.querySelectorAll(".grid .card")].slice(0, 9).map((c) => c.dataset.theme).join(",")')) === 'street,street,street,outdoor,outdoor,outdoor,punk,punk,minimal', await ev('[...document.querySelectorAll(".grid .card")].slice(0, 9).map((c) => c.dataset.theme).join(",")'))
await ev('document.querySelector(".shop-head")?.scrollIntoView()')
await sleep(500)
await shot('outfits-for-you')
await click('.taste-toggle')
await sleep(1000)
check('for-you: turning it off → id order, no clause in the title, forYou=0 stored', (await firstHref()) === '/outfits/1' && !((await text('.shop-title')) ?? '').includes('照你的喜好排') && (await ev('localStorage.getItem("forYou")')) === '0', `${await firstHref()} / ${await text('.shop-title')}`)
check('for-you: the line now says 照原本的順序 and offers 照我的喜好排', ((await text('.taste-line')) ?? '').includes('照原本的順序') && (await text('.taste-toggle')) === '照我的喜好排', await text('.taste-line'))
await click('.taste-toggle')
await sleep(1000)
check('for-you: back on → clause returns, forYou key removed', ((await text('.shop-title')) ?? '').includes('照你的喜好排') && (await firstTheme()) === 'street' && (await ev('localStorage.getItem("forYou")')) === null, await text('.shop-title'))
await go('/themes/street', 2600)
check('for-you: a route page is not re-sorted and has no line', !((await text('.shop-title')) ?? '').includes('照你的喜好排') && (await count('.taste-line')) === 0, await text('.shop-title'))
// 首頁第一個詞
await go('/', 2800)
check('for-you: home first word is 街頭 (profile.top), not the default 簡約', (await text('.home-hero .word')) === '街頭', await text('.home-hero .word'))
// 商品頁：你可能也想看
await go('/products/101', 2800)
check('also-like: 你可能也想看 with a reason and 1–6 cards', (await ev('[...document.querySelectorAll(".section-title")].some((h) => h.textContent.trim() === "你可能也想看")')) === true && ((await text('.also .why')) ?? '').includes('因為你挑了') && (await count('.also .card')) >= 1 && (await count('.also .card')) <= 6, `${await text('.also .why')} / ${await count('.also .card')}`)
check('also-like: none of the cards is the product itself', (await ev('[...document.querySelectorAll(".also .card a")].every((a) => !a.getAttribute("href").endsWith("/products/101"))')) === true)
await ev('document.querySelector(".also")?.scrollIntoView()')
await sleep(500)
await shot('product-also-like')
// 清掉偏好、清掉看過的 → 全部消失
await go('/account/style', 2600)
await click('.picked-panel .link') // 清掉偏好
await sleep(900)
check('clear: preferences gone → 去挑三套 shows, member record null', (await ev('[...document.querySelectorAll(".picked-panel a")].some((a) => a.textContent.trim() === "去挑三套")')) === true && (await ev(`JSON.parse(localStorage.getItem("account")).members.find((x) => x.email === ${JSON.stringify(quizEmail)})?.preferences`)) === null)
await go('/history', 2400)
await click('.clear')
await sleep(500)
await go('/outfits', 2800)
check('clear: no signals left → no clause, no line, id order', !((await text('.shop-title')) ?? '').includes('照你的喜好排') && (await count('.taste-line')) === 0 && (await firstHref()) === '/outfits/1', await text('.shop-title'))
await go('/products/101', 2600)
check('clear: 你可能也想看 gone too', (await count('.also')) === 0, await count('.also'))

const summary = { origin, size: `${W}x${H}`, passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok), problems }
console.log(JSON.stringify(summary, null, 1))
ws.close()
chrome.kill()
process.exit(0)
