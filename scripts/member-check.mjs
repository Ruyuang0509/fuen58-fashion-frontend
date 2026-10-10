// Headless Chrome over raw CDP: walks login → member centre → checkout → register and records checks.
// Written BEFORE the member pages were built (acceptance criteria for round 10); the DOM hooks it uses are the contract.
// usage: node scripts/member-check.mjs <origin> <outDir> [width] [height]
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
const results = []
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail })
const text = (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.textContent.trim().replace(/\\s+/g, ' ') ?? null`)
const count = (sel) => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`)
const click = (sel, nth = 0) => ev(`(() => { const el = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; if (!el) return 'missing'; el.click(); return 'clicked' })()`)
// 像使用者打字：設值後送 input 與 change 事件（Vue 的 v-model 聽 input）
const type = (sel, value) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'missing'; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return 'typed' })()`)
const pathname = () => ev('location.pathname')
// 和 clientWidth 比，不是 innerWidth：手機模擬下版面視口會跟著溢出的內容長大，scrollWidth − innerWidth 永遠是 0（第十五輪實測）
const overflow = () => ev('document.documentElement.scrollWidth - document.documentElement.clientWidth')
const cartCount = () => ev('document.querySelector(".cart-link .count")?.firstChild?.textContent ?? "0"')

// ── 1. 守門：沒登入進會員頁 → 登入頁，帶著原本的網址 ──
await go('/account', 1800)
check('guard: /account redirects to login with redirect', (await pathname()) === '/login' && (await ev('location.search')) === '?redirect=/account', `${await pathname()}${await ev('location.search')}`)
await shot('login')
check('login: form fields present', (await count('form.login #login-email')) === 1 && (await count('form.login #login-password')) === 1)
check('login: overflow 0', (await overflow()) <= 0, await overflow())
// 密碼錯：錯誤貼在表單裡，不跳視窗；還在登入頁
await type('#login-email', 'demo@example.com')
await type('#login-password', 'wrong-password')
await click('form.login button[type=submit]')
await sleep(700)
check('login: wrong password shows inline error', ((await text('form.login .form-error')) ?? '').includes('帳號或密碼'), await text('form.login .form-error'))
check('login: still on login page', (await pathname()) === '/login')
// 正確：回到原本要去的 /account
await type('#login-password', 'demo1234')
await click('form.login button[type=submit]')
await sleep(900)
check('login: success returns to /account', (await pathname()) === '/account', await pathname())

// ── 2. 個人資料 ──
await shot('account')
// 第十五輪子輪 2：分頁列多了收藏、看過的
// 第十五輪子輪 4 加了「我的偏好」、第十六輪子輪 2 加了「身形」：五個變七個
check('account: nav has 7 links', (await count('.account-nav a')) === 7, await count('.account-nav a'))
check('account: name prefilled', (await ev('document.querySelector("#profile-name")?.value')) === '林示範', await ev('document.querySelector("#profile-name")?.value'))
await type('#profile-name', '林示範二')
await click('form.profile button[type=submit]')
await sleep(600)
check('profile: saved status', ((await text('form.profile [role=status]')) ?? '').includes('已儲存'), await text('form.profile [role=status]'))
await go('/account', 1500)
check('profile: change persists after reload', (await ev('document.querySelector("#profile-name")?.value')) === '林示範二', await ev('document.querySelector("#profile-name")?.value'))
// 改密碼：舊密碼錯 → 欄位旁錯誤
await type('#password-current', 'nope')
await type('#password-next', 'newpass123')
await type('#password-confirm', 'newpass123')
await click('form.password button[type=submit]')
await sleep(600)
check('password: wrong current shows inline error', (await count('form.password .field-error')) >= 1, await count('form.password .field-error'))

// ── 3. 地址簿 ──
await go('/account/addresses', 1600)
await shot('addresses')
check('addresses: 1 seeded address, default', (await count('.address')) === 1 && (await count('.address.default')) === 1, await count('.address'))
await click('.add-address')
await sleep(300)
check('addresses: form opens', (await count('form.address')) === 1)
await type('form.address #address-recipient', '林示範二')
await type('form.address #address-phone', '0987654321')
await type('form.address #address-postal', '220')
await type('form.address #address-city', '新北市')
await type('form.address #address-district', '板橋區')
await type('form.address #address-street', '文化路一段 1 號')
await click('form.address button[type=submit]')
await sleep(600)
check('addresses: 2 after adding', (await count('.address')) === 2, await count('.address'))
await click('.address:nth-of-type(2) .set-default')
await sleep(400)
check('addresses: second becomes default', (await ev('document.querySelectorAll(".address")[1]?.classList.contains("default")')) === true)

// ── 4. 訂單：付款期限、在訂單頁付款、示範物流走完、確認收貨、完成後的連結（第十七輪子輪 1）──
await go('/account/orders', 1600)
await shot('orders')
check('orders: 2 seeded orders', (await count('.order')) === 2, await count('.order'))
check('orders: status filter, 全部 pressed with count 2', ((await text('.status-filter button[aria-pressed=true]')) ?? '').replace(/\s/g, '').startsWith('全部2'), await text('.status-filter button[aria-pressed=true]'))
check('orders: the pending seeded order shows a payment deadline', (await count('.order .deadline')) === 1, await count('.order .deadline'))
await go('/account/orders/WD-20261003-0002', 1600)
await shot('order-pending')
check('order: 待付款 with deadline and 去付款', (await text('.order-status')) === '待付款' && (await count('.deadline')) === 1 && (await count('.pay-now')) === 1, `${await text('.order-status')} / ${await count('.deadline')} / ${await count('.pay-now')}`)
check('order: timeline has 5 steps, 待付款 current, none done', (await count('.timeline li')) === 5 && (await text('.timeline li.current .step-status')) === '待付款' && (await count('.timeline li.done')) === 0, `${await count('.timeline li')} / ${await text('.timeline li.current .step-status')}`)
check('order: the demo-logistics note is on the page', ((await text('.demo-note')) ?? '').includes('示範'), await text('.demo-note'))
await click('.pay-now')
await sleep(300)
check('order: 去付款 opens two methods, no 貨到付款', (await count('.pay-options input')) === 2 && (await count('.pay-options input[value=cod]')) === 0, await count('.pay-options input'))
await click('.pay-submit')
await sleep(400)
check('order: paying without a method shows an inline error', ((await text('.form-error')) ?? '').includes('付款方式'), await text('.form-error'))
await click('.pay-options input[value=mock]')
await click('.pay-submit')
await sleep(800)
check('order: paid → 已付款, one step done, 已付款 current', (await text('.order-status')) === '已付款' && (await count('.timeline li.done')) === 1 && (await text('.timeline li.current .step-status')) === '已付款', `${await text('.order-status')} / ${await count('.timeline li.done')}`)
check('order: no deadline or 去付款 once paid', (await count('.deadline')) === 0 && (await count('.pay-now')) === 0)
// 時間快轉：把付款時間改成 6 分鐘前（直接改 localStorage 的 account），重新整理 → 假 API 結算成已送達（示範物流：2 分鐘出貨、5 分鐘送達）
await ev(`(() => { const db = JSON.parse(localStorage.getItem('account')); const o = db.orders.find((x) => x.id === 'WD-20261003-0002'); const t = new Date(Date.now() - 6 * 60000).toISOString(); o.payment.paidAt = t; o.history.find((h) => h.status === '已付款').at = t; localStorage.setItem('account', JSON.stringify(db)); return 'ok' })()`)
await go('/account/orders/WD-20261003-0002', 1600)
await ev('(() => { document.querySelector("#history-title")?.scrollIntoView(); window.scrollBy(0, -90); return 1 })()')
await shot('order-delivered')
check('order: 6 minutes after paying → 已送達, three steps done', (await text('.order-status')) === '已送達' && (await count('.timeline li.done')) === 3 && (await text('.timeline li.current .step-status')) === '已送達', `${await text('.order-status')} / ${await count('.timeline li.done')}`)
check('order: settled times are the scheduled moments (出貨 = 付款 + 2 分, 送達 = + 5 分)', (await ev(`(() => { const db = JSON.parse(localStorage.getItem('account')); const o = db.orders.find((x) => x.id === 'WD-20261003-0002'); const at = (s) => Date.parse(o.history.find((h) => h.status === s).at); return at('出貨中') - at('已付款') === 120000 && at('已送達') - at('已付款') === 300000 })()`)) === true)
await click('.confirm-receipt')
await sleep(300)
check('order: 確認收貨 asks first', (await count('.confirm-receipt-yes')) === 1 && (await text('.order-status')) === '已送達')
await click('.confirm-receipt-yes')
await sleep(700)
check('order: completed after confirming receipt, four steps done', (await text('.order-status')) === '完成' && (await count('.timeline li.done')) === 4 && (await text('.timeline li.current .step-status')) === '完成', await text('.order-status'))
check('order: a completed order offers 更新身形 and the fitting room with its outer', (await count('.aftercare .body-link')) === 1 && ((await ev('document.querySelector(".aftercare .fitting-link")?.getAttribute("href")')) ?? '').includes('/fitting?outer=509'), await ev('document.querySelector(".aftercare .fitting-link")?.getAttribute("href")'))
await ev('(() => { document.querySelector("#history-title")?.scrollIntoView(); window.scrollBy(0, -90); return 1 })()')
await shot('order-done')
// 種子的已送達訂單：確認收貨（第十輪的檢查）
await go('/account/orders/WD-20260928-0001', 1600)
check('order: delivered seeded one has 確認收貨', (await text('.order-status')) === '已送達' && (await count('.confirm-receipt')) === 1, await text('.order-status'))
await click('.confirm-receipt')
await sleep(300)
await click('.confirm-receipt-yes')
await sleep(600)
check('order: seeded delivered order completes too', (await text('.order-status')) === '完成', await text('.order-status'))

// ── 5. 結帳：加一件 → 購物車 → 收件 → 付款 → 完成 ──
await go('/products/404', 2000)
await click('.buy button[type=submit]')
await sleep(400)
check('checkout: item added', (await cartCount()) === '1', await cartCount())
await go('/cart', 2000)
await click('.summary .primary')
await sleep(900)
check('checkout: cart → /checkout', (await pathname()) === '/checkout', await pathname())
await shot('checkout-1')
check('checkout: step 1 shows address options', (await count('.checkout-step1 .address-option')) >= 1, await count('.checkout-step1 .address-option'))
check('checkout: overflow 0', (await overflow()) <= 0, await overflow())
await click('.checkout-step1 .address-option input', 0)
await click('.checkout-step1 .next')
await sleep(500)
check('checkout: step 2 shows payment options', (await count('.checkout-step2 input[name=payment]')) >= 2, await count('.checkout-step2 input[name=payment]'))
// 第十七輪子輪 3：第二步滑進來之後要停在原位（行內 transform 與 opacity 都清掉）
check('checkout: step 2 slid in and settled', (await ev('getComputedStyle(document.querySelector(".checkout-step2")).transform')) === 'none' && (await ev('getComputedStyle(document.querySelector(".checkout-step2")).opacity')) === '1', `${await ev('getComputedStyle(document.querySelector(".checkout-step2")).transform')} / ${await ev('getComputedStyle(document.querySelector(".checkout-step2")).opacity')}`)
check('checkout: step 2 shows total 280 + 80 shipping', ((await text('.checkout-step2 .total')) ?? '').includes('360'), await text('.checkout-step2 .total'))
await click('.checkout-step2 input[name=payment][value=mock]')
await shot('checkout-2')
await click('.checkout-step2 .place-order')
await sleep(1200)
check('checkout: lands on done page', (await pathname()).startsWith('/checkout/done/WD-'), await pathname())
await shot('checkout-done')
check('done: shows order id and items', ((await text('.order-id')) ?? '').startsWith('WD-') && (await count('.done-items li')) === 1, await text('.order-id'))
check('done: cart emptied', (await cartCount()) === '0', await cartCount())
// 第十七輪子輪 3：下單完成的短動畫——剛從結帳來才播；播完的畫面和跳過的一樣；重新整理不再播
check('done: the celebration is playing on arrival, with a skip button', (await ev('document.querySelector(".celebrate")?.dataset.state')) === 'playing' && (await count('.skip-anim')) === 1, await ev('document.querySelector(".celebrate")?.dataset.state'))
const restState = () => ev('(() => { const g = [...document.querySelectorAll(".celebrate .drop")]; return JSON.stringify({ state: document.querySelector(".celebrate")?.dataset.state, n: g.length, styles: g.map((el) => el.getAttribute("style") || ""), opacity: g.map((el) => getComputedStyle(el).opacity), skip: document.querySelectorAll(".skip-anim").length, note: getComputedStyle(document.querySelector(".celebrate-note")).opacity, front: document.querySelector(".bag-front")?.getAttribute("style") || "" }) })()')
await sleep(2400)
const finished = JSON.parse(await restState())
check('done: it finishes by itself — garments at rest, note visible, skip gone', finished.state === 'done' && finished.n >= 1 && finished.styles.every((s) => s === '') && finished.opacity.every((o) => o === '1') && finished.skip === 0 && finished.note === '1' && finished.front === '', JSON.stringify(finished))
const donePath = await pathname()
await ev(`sessionStorage.setItem('celebrate:' + ${JSON.stringify(donePath.split('/').pop())}, '1'); 1`)
await go(donePath, 1100)
check('done: replaying (flag set again) is in progress at 1.1 s', (await ev('document.querySelector(".celebrate")?.dataset.state')) === 'playing', await ev('document.querySelector(".celebrate")?.dataset.state'))
await click('.skip-anim')
await sleep(150)
const skipped = JSON.parse(await restState())
check('done: 跳過 lands on exactly the resting state', JSON.stringify(skipped) === JSON.stringify(finished), JSON.stringify(skipped))
await shot('done-resting')
await go(donePath, 1100)
check('done: a plain reload does not replay (static, no skip button)', (await ev('document.querySelector(".celebrate")?.dataset.state')) === 'done' && (await count('.skip-anim')) === 0, await ev('document.querySelector(".celebrate")?.dataset.state'))
await go('/account/orders', 1600)
check('orders: 3 after checkout', (await count('.order')) === 3, await count('.order'))

// ── 5b. 貨到付款的訂單、自行取消、付款逾時、列表篩選（第十七輪子輪 1）──
await go('/products/404', 2000)
await click('.buy button[type=submit]')
await sleep(400)
await go('/cart', 2000)
await click('.summary .primary')
await sleep(900)
await click('.checkout-step1 .address-option input', 0)
await click('.checkout-step1 .next')
await sleep(500)
await click('.checkout-step2 input[name=payment][value=cod]')
// 減少動態：完成頁不播動畫，直接是靜止的畫面
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
await click('.checkout-step2 .place-order')
await sleep(1200)
check('reduced motion: the done page is static at once, no skip button', (await ev('document.querySelector(".celebrate")?.dataset.state')) === 'done' && (await count('.skip-anim')) === 0 && (await count('.celebrate .drop')) >= 1, `${await ev('document.querySelector(".celebrate")?.dataset.state')} / ${await count('.celebrate .drop')}`)
await send('Emulation.setEmulatedMedia', { features: [] })
check('cod: done page says 貨到付款 and has no 去付款', ((await text('.lead')) ?? '').includes('貨到付款') && (await count('.pay-link')) === 0, await text('.lead'))
const codId = (await pathname()).split('/').pop()
await go(`/account/orders/${codId}`, 1600)
check('cod: 待付款 without deadline or 去付款, four-step timeline', (await text('.order-status')) === '待付款' && (await count('.deadline')) === 0 && (await count('.pay-now')) === 0 && (await count('.timeline li')) === 4, `${await text('.order-status')} / ${await count('.timeline li')}`)
await click('.cancel-order')
await sleep(300)
check('cod: cancel asks for confirmation first', (await count('.confirm-cancel')) === 1 && (await text('.order-status')) === '待付款')
await click('.confirm-cancel')
await sleep(700)
check('cod: cancelled by the member → timeline ends with 已取消（自行取消）', (await text('.order-status')) === '已取消' && ((await text('.timeline li.cancelled')) ?? '').includes('自行取消') && (await count('.timeline li.todo')) === 0, await text('.timeline li.cancelled'))
await ev('(() => { document.querySelector("#history-title")?.scrollIntoView(); window.scrollBy(0, -90); return 1 })()')
await shot('order-cancelled')
// 逾時：塞一張 16 分鐘前下單、還沒付款的信用卡訂單；列表讀到就該是已取消（假 API 的結算＝正式版的後端排程）
await ev(`(() => { const db = JSON.parse(localStorage.getItem('account')); const src = db.orders.find((x) => x.id === ${JSON.stringify(codId)}); const t = new Date(Date.now() - 16 * 60000).toISOString(); const o = JSON.parse(JSON.stringify(src)); o.id = 'WD-TEST-TIMEOUT'; o.status = '待付款'; o.createdAt = t; o.payment = { method: 'card', paidAt: null }; o.history = [{ status: '待付款', at: t }]; delete o.cancelReason; db.orders.push(o); localStorage.setItem('account', JSON.stringify(db)); return 'ok' })()`)
await go('/account/orders', 1600)
check('timeout: an unpaid card order older than 15 minutes is listed as 已取消', (await ev('[...document.querySelectorAll(".order")].find((li) => li.textContent.includes("WD-TEST-TIMEOUT"))?.querySelector(".order-status")?.textContent.trim()')) === '已取消', await ev('[...document.querySelectorAll(".order")].find((li) => li.textContent.includes("WD-TEST-TIMEOUT"))?.querySelector(".order-status")?.textContent.trim()'))
await go('/account/orders/WD-TEST-TIMEOUT', 1600)
check('timeout: detail says 付款逾時 with a time', ((await text('.timeline li.cancelled')) ?? '').includes('付款逾時') && (await count('.timeline li.cancelled time')) === 1, await text('.timeline li.cancelled'))
check('timeout: cancelled at = created + 15 minutes, no 去付款', (await ev(`(() => { const db = JSON.parse(localStorage.getItem('account')); const o = db.orders.find((x) => x.id === 'WD-TEST-TIMEOUT'); const last = o.history[o.history.length - 1]; return last.status === '已取消' && Date.parse(last.at) - Date.parse(o.createdAt) === 900000 })()`)) === true && (await count('.pay-now')) === 0)
await go('/account/orders?status=cancelled', 1600)
check('orders: ?status=cancelled lists only the two cancelled orders', (await count('.order')) === 2 && (await ev('[...document.querySelectorAll(".order .order-status")].every((s) => s.textContent.trim() === "已取消")')) === true, await count('.order'))
await click('.status-filter button', 0)
await sleep(400)
check('orders: 全部 shows all 5 and clears the query', (await count('.order')) === 5 && (await ev('location.search')) === '', `${await count('.order')} ${await ev('location.search')}`)

// ── 6. 登出、註冊 ──
await go('/account', 1500)
await click('.logout')
await sleep(800)
check('logout: lands on home', (await pathname()) === '/', await pathname())
await go('/account', 1500)
check('logout: /account guarded again', (await pathname()) === '/login')
await go('/register', 1500)
await shot('register')
await type('#register-name', '新會員')
await type('#register-email', 'demo@example.com')
await type('#register-password', 'abcd1234')
await type('#register-confirm', 'abcd1234')
await click('form.register button[type=submit]')
await sleep(700)
check('register: duplicate email error inline', ((await text('form.register .field-error, form.register .form-error')) ?? '').includes('已經'), await text('form.register .field-error, form.register .form-error'))
await type('#register-email', 'new@example.com')
await type('#register-password', '1234')
await type('#register-confirm', '1234')
await click('form.register button[type=submit]')
await sleep(500)
check('register: weak password error mentions 8', ((await ev('[...document.querySelectorAll("form.register .field-error, form.register .form-error")].map(e => e.textContent).join(" ")')) ?? '').includes('8'), await ev('[...document.querySelectorAll("form.register .field-error, form.register .form-error")].map(e => e.textContent).join(" | ")'))
check('register: still on register page', (await pathname()) === '/register')
await type('#register-password', 'abcd1234')
await type('#register-confirm', 'abcd1234')
await click('form.register button[type=submit]')
await sleep(1400)
// 子輪 4：註冊成功先到偏好調查（三步都能略過）；這裡走略過的路，確認略過後才是會員中心
check('register: success logs in and lands on /onboarding/style', (await pathname()) === '/onboarding/style', await pathname())
await click('.quiz .link') // 先不選
await sleep(900)
check('register: quiz step 2 shows 8 looks', (await count('.pick-tile')) === 8, await count('.pick-tile'))
await click('.quiz .foot .link') // 先不挑，直接開始逛
await sleep(1200)
check('register: skipping the quiz lands on the home page', (await pathname()) === '/', await pathname())
await go('/account', 1500)
check('register: new member name prefilled', (await ev('document.querySelector("#profile-name")?.value')) === '新會員', await ev('document.querySelector("#profile-name")?.value'))
await go('/account/orders', 1500)
check('register: new member has no orders (empty state)', (await count('.order')) === 0 && (await count('.empty')) === 1, `${await count('.order')} / ${await count('.empty')}`)

const summary = { origin, size: `${W}x${H}`, passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok), problems }
console.log(JSON.stringify(summary, null, 1))
ws.close()
chrome.kill()
process.exit(0)
