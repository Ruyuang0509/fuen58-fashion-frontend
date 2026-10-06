// 會員、地址簿、訂單的假資料 API 層。
// 畫面只呼叫這裡匯出的函式；後端 API 好了以後，把每個函式內容換成 fetch 即可。
// 欄位與回傳形狀依照 docs/api-契約草案.md §6–8；首次使用時會把 mock/members.json 複製到 localStorage 的 account。
// 密碼只有假資料環境才存明碼；真正後端會依功能規劃 7 儲存密碼雜湊。
import seed from './mock/members.json'
import { FREE_SHIPPING_FROM, SHIPPING_FEE } from '@/products/labels'

const KEY = 'account'

// 模擬網路延遲，讓「載入中」的畫面在開發時看得到
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const copy = (value) => JSON.parse(JSON.stringify(value))

function fresh() {
  return {
    ...copy(seed),
    tokens: {},
  }
}

let memory = fresh()

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY))
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.members)) {
      memory = parsed
      return parsed
    }
    memory = fresh()
    return memory
  } catch {
    // 儲存空間不能用時，頁面存活期間仍共用記憶體裡的資料
    return memory
  }
}

function write(db) {
  memory = db
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    // 存不了就保留模組層的副本，重新整理後才會消失
  }
}

function nextNumericId(records) {
  return records.reduce((max, record) => Math.max(max, Number(record.id) || 0), 0) + 1
}

function newToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function publicUser(member) {
  const { password, ...user } = member
  return copy(user)
}

function publicAddress(address) {
  const { memberId, ...result } = address
  return copy(result)
}

function publicOrder(order) {
  const { memberId, ...result } = order
  return copy(result)
}

function memberFromToken(db, token) {
  const memberId = db.tokens?.[token]
  const member = db.members.find((item) => item.id === memberId)
  if (!member) throw new ApiError('UNAUTHORIZED', '請先登入')
  return member
}

function normalisePhone(value) {
  return String(value ?? '').replace(/[\s-]/g, '')
}

function trim(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function validatedAddress(data) {
  const recipient = trim(data?.recipient)
  const phone = normalisePhone(data?.phone)
  const postalCode = trim(data?.postalCode)
  const city = trim(data?.city)
  const district = trim(data?.district)
  const street = trim(data?.street)

  if (!recipient) throw new ApiError('VALIDATION', '請填收件人', 'recipient')
  if (!phone) throw new ApiError('VALIDATION', '請填手機號碼', 'phone')
  if (!/^09\d{8}$/.test(phone)) {
    throw new ApiError('VALIDATION', '手機號碼要是 09 開頭的 10 位數字', 'phone')
  }
  if (!/^\d{3}(\d{2,3})?$/.test(postalCode)) {
    throw new ApiError('VALIDATION', '郵遞區號是 3、5 或 6 位數字', 'postalCode')
  }
  if (!city) throw new ApiError('VALIDATION', '請填縣市', 'city')
  if (!district) throw new ApiError('VALIDATION', '請填鄉鎮市區', 'district')
  if (!street) throw new ApiError('VALIDATION', '請填街道地址', 'street')

  return {
    recipient,
    phone,
    postalCode,
    city,
    district,
    street,
    isDefault: !!data?.isDefault,
  }
}

function addressSnapshot(address) {
  return {
    recipient: address.recipient,
    phone: address.phone,
    postalCode: address.postalCode,
    city: address.city,
    district: address.district,
    street: address.street,
  }
}

function memberAddresses(db, memberId) {
  return db.addresses
    .filter((address) => address.memberId === memberId)
    .sort((a, b) => a.id - b.id)
}

function memberOrder(db, memberId, id) {
  return db.orders.find((order) => order.memberId === memberId && order.id === id)
}

const dateFormatter = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const taipeiDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function taipeiDay(date = new Date()) {
  const parts = taipeiDayFormatter.formatToParts(date)
  const valueOf = (type) => parts.find((part) => part.type === type)?.value ?? ''
  return `${valueOf('year')}-${valueOf('month')}-${valueOf('day')}`
}

function validBirthday(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const isRealDate = date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day

  return isRealDate && value <= taipeiDay()
}

function nextOrderId(db) {
  const day = taipeiDay().replace(/-/g, '')
  const prefix = `WD-${day}-`
  const largest = db.orders.reduce((max, order) => {
    if (!order.id.startsWith(prefix)) return max
    const sequence = Number(order.id.slice(prefix.length))
    return Number.isInteger(sequence) ? Math.max(max, sequence) : max
  }, 0)

  return `${prefix}${String(largest + 1).padStart(4, '0')}`
}

export class ApiError extends Error {
  constructor(code, message, field = null) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.field = field
  }
}

export const PASSWORD_RULE = '密碼至少 8 碼，要有英文與數字'

export const isStrongPassword = (password) => typeof password === 'string'
  && password.length >= 8
  && /[a-zA-Z]/.test(password)
  && /\d/.test(password)

export const isEmail = (value) => typeof value === 'string'
  && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

// 付款方式：代碼 → 畫面上的說法（結帳頁的選項、訂單頁的顯示共用）
export const PAYMENT_METHODS = {
  card: '信用卡（沙盒，尚未串接）',
  cod: '貨到付款',
  mock: '模擬付款成功（展示用）',
}

// 訂單畫面共用的日期格式（臺北時間）
export const formatDate = (iso) => dateFormatter.format(new Date(iso))
export const formatDateTime = (iso) => dateTimeFormatter.format(new Date(iso))

export async function register({ email, password, name }) {
  await wait(150)
  const db = read()
  const cleanName = trim(name)
  const cleanEmail = trim(email).toLowerCase()

  if (!cleanName) throw new ApiError('VALIDATION', '請填姓名', 'name')
  if (!isEmail(email)) throw new ApiError('VALIDATION', '電子郵件格式不對', 'email')
  if (db.members.some((member) => member.email.toLowerCase() === cleanEmail)) {
    throw new ApiError('EMAIL_TAKEN', '這個電子郵件已經註冊過了', 'email')
  }
  if (!isStrongPassword(password)) {
    throw new ApiError('VALIDATION', PASSWORD_RULE, 'password')
  }

  const member = {
    id: nextNumericId(db.members),
    email: cleanEmail,
    password,
    name: cleanName,
    phone: '',
    birthday: '',
    gender: 'unsaid',
    createdAt: new Date().toISOString(),
  }
  const token = newToken()

  db.members.push(member)
  db.tokens[token] = member.id
  write(db)

  return {
    token,
    user: publicUser(member),
  }
}

export async function login({ email, password }) {
  await wait(150)
  const db = read()
  const cleanEmail = trim(email).toLowerCase()
  const member = db.members.find((item) => item.email.toLowerCase() === cleanEmail)

  if (!member || member.password !== password) {
    throw new ApiError('INVALID_CREDENTIALS', '帳號或密碼不對')
  }

  const token = newToken()
  db.tokens[token] = member.id
  write(db)

  return {
    token,
    user: publicUser(member),
  }
}

export async function logout(token) {
  await wait(150)
  const db = read()

  if (db.tokens?.[token] !== undefined) {
    delete db.tokens[token]
    write(db)
  }

  return true
}

export async function getMe(token) {
  await wait(150)
  const db = read()
  const memberId = db.tokens?.[token]
  const member = db.members.find((item) => item.id === memberId)

  return member ? publicUser(member) : null
}

export async function updateProfile(token, { name, phone, birthday, gender }) {
  await wait(150)
  const db = read()
  const member = memberFromToken(db, token)
  const cleanName = trim(name)
  const cleanPhone = normalisePhone(phone)
  const cleanBirthday = trim(birthday)
  const genders = ['female', 'male', 'other', 'unsaid']

  if (!cleanName) throw new ApiError('VALIDATION', '請填姓名', 'name')
  if (cleanPhone && !/^09\d{8}$/.test(cleanPhone)) {
    throw new ApiError('VALIDATION', '手機號碼要是 09 開頭的 10 位數字', 'phone')
  }
  if (cleanBirthday && !validBirthday(cleanBirthday)) {
    throw new ApiError('VALIDATION', '生日的日期不對', 'birthday')
  }

  member.name = cleanName
  member.phone = cleanPhone
  member.birthday = cleanBirthday
  member.gender = genders.includes(gender) ? gender : 'unsaid'
  write(db)

  return publicUser(member)
}

export async function changePassword(token, { current, next }) {
  await wait(150)
  const db = read()
  const member = memberFromToken(db, token)

  if (current !== member.password) {
    throw new ApiError('INVALID_CREDENTIALS', '目前的密碼不對', 'current')
  }
  if (!isStrongPassword(next)) {
    throw new ApiError('VALIDATION', PASSWORD_RULE, 'next')
  }

  member.password = next
  write(db)
  return true
}

export async function listAddresses(token) {
  await wait(150)
  const db = read()
  const member = memberFromToken(db, token)

  return memberAddresses(db, member.id).map(publicAddress)
}

export async function addAddress(token, data) {
  await wait(150)
  const db = read()
  const member = memberFromToken(db, token)
  const clean = validatedAddress(data)
  const existing = memberAddresses(db, member.id)
  const isDefault = existing.length === 0 || clean.isDefault

  if (isDefault) {
    existing.forEach((address) => {
      address.isDefault = false
    })
  }

  const address = {
    id: nextNumericId(db.addresses),
    memberId: member.id,
    ...addressSnapshot(clean),
    isDefault,
  }

  db.addresses.push(address)
  write(db)
  return publicAddress(address)
}

export async function updateAddress(token, id, data) {
  await wait(150)
  const db = read()
  const member = memberFromToken(db, token)
  const address = db.addresses.find((item) => item.memberId === member.id && item.id === Number(id))

  if (!address) throw new ApiError('NOT_FOUND', '找不到這個地址')

  const clean = validatedAddress(data)
  const existing = memberAddresses(db, member.id)

  if (clean.isDefault) {
    existing.forEach((item) => {
      item.isDefault = item.id === address.id
    })
  }

  Object.assign(address, addressSnapshot(clean))
  if (!address.isDefault && !existing.some((item) => item.isDefault)) {
    address.isDefault = true
  }

  write(db)
  return publicAddress(address)
}

export async function removeAddress(token, id) {
  await wait(150)
  const db = read()
  const member = memberFromToken(db, token)
  const index = db.addresses.findIndex((item) => item.memberId === member.id && item.id === Number(id))

  if (index === -1) throw new ApiError('NOT_FOUND', '找不到這個地址')

  const [removed] = db.addresses.splice(index, 1)
  const remaining = memberAddresses(db, member.id)

  if (removed.isDefault && remaining.length) {
    remaining.forEach((address, addressIndex) => {
      address.isDefault = addressIndex === 0
    })
  }

  write(db)
  return remaining.map(publicAddress)
}

export async function setDefaultAddress(token, id) {
  await wait(150)
  const db = read()
  const member = memberFromToken(db, token)
  const address = db.addresses.find((item) => item.memberId === member.id && item.id === Number(id))

  if (!address) throw new ApiError('NOT_FOUND', '找不到這個地址')

  const addresses = memberAddresses(db, member.id)
  addresses.forEach((item) => {
    item.isDefault = item.id === address.id
  })

  write(db)
  return addresses.map(publicAddress)
}

export async function createOrder(token, { items, addressId, address, payment }) {
  await wait(150)
  const db = read()
  const member = memberFromToken(db, token)

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError('VALIDATION', '購物車是空的', 'items')
  }

  const storedItems = items.map((item) => ({
    productId: item.productId,
    name: item.name,
    brand: item.brand,
    colour: item.colour,
    colourName: item.colourName,
    size: item.size,
    qty: Number.isInteger(Number(item.qty)) && Number(item.qty) >= 1 ? Number(item.qty) : 1,
    price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
  }))

  let storedAddress
  if (addressId !== undefined && addressId !== null && addressId !== '') {
    const saved = db.addresses.find((item) => (
      item.memberId === member.id && item.id === Number(addressId)
    ))
    if (!saved) throw new ApiError('NOT_FOUND', '找不到這個地址')
    storedAddress = addressSnapshot(saved)
  } else if (address && typeof address === 'object') {
    storedAddress = addressSnapshot(validatedAddress(address))
  } else {
    throw new ApiError('VALIDATION', '請選收件地址', 'address')
  }

  if (!['card', 'cod', 'mock'].includes(payment?.method)) {
    throw new ApiError('VALIDATION', '請選付款方式', 'payment')
  }

  const subtotal = storedItems.reduce((sum, item) => sum + item.price * item.qty, 0)
  const shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE
  const createdAt = new Date().toISOString()

  // 真正後端會重新計價並扣庫存；假 API 信任購物車送來的快照價格
  const order = {
    id: nextOrderId(db),
    memberId: member.id,
    createdAt,
    status: '待付款',
    items: storedItems,
    address: storedAddress,
    subtotal,
    shipping,
    total: subtotal + shipping,
    payment: {
      method: payment.method,
      paidAt: null,
    },
    history: [
      {
        status: '待付款',
        at: createdAt,
      },
    ],
  }

  db.orders.push(order)
  write(db)
  return publicOrder(order)
}

export async function payOrder(token, id, { method }) {
  await wait(150)
  const db = read()
  const member = memberFromToken(db, token)
  const order = memberOrder(db, member.id, id)

  if (!order) throw new ApiError('NOT_FOUND', '找不到這張訂單')
  if (order.status !== '待付款') {
    throw new ApiError('NOT_PAYABLE', '只有待付款的訂單可以付款')
  }
  if (!['card', 'mock'].includes(method)) {
    throw new ApiError('VALIDATION', '請選付款方式', 'payment')
  }

  const now = new Date().toISOString()
  order.payment = {
    method,
    paidAt: now,
  }
  order.status = '已付款'
  order.history.push({
    status: '已付款',
    at: now,
  })

  write(db)
  return publicOrder(order)
}

export async function listOrders(token) {
  await wait(150)
  const db = read()
  const member = memberFromToken(db, token)

  return db.orders
    .filter((order) => order.memberId === member.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map(publicOrder)
}

export async function getOrder(token, id) {
  await wait(150)
  const db = read()
  const member = memberFromToken(db, token)
  const order = memberOrder(db, member.id, id)

  return order ? publicOrder(order) : null
}

export async function cancelOrder(token, id) {
  await wait(150)
  const db = read()
  const member = memberFromToken(db, token)
  const order = memberOrder(db, member.id, id)

  if (!order) throw new ApiError('NOT_FOUND', '找不到這張訂單')
  if (order.status !== '待付款') {
    throw new ApiError('NOT_CANCELLABLE', '只有待付款的訂單可以取消')
  }

  const now = new Date().toISOString()
  order.status = '已取消'
  order.history.push({
    status: '已取消',
    at: now,
  })

  write(db)
  return publicOrder(order)
}

export async function confirmReceipt(token, id) {
  await wait(150)
  const db = read()
  const member = memberFromToken(db, token)
  const order = memberOrder(db, member.id, id)

  if (!order) throw new ApiError('NOT_FOUND', '找不到這張訂單')
  if (order.status !== '已送達') {
    throw new ApiError('NOT_DELIVERED', '訂單送達後才能確認收貨')
  }

  const now = new Date().toISOString()
  order.status = '完成'
  order.history.push({
    status: '完成',
    at: now,
  })

  write(db)
  return publicOrder(order)
}

export async function resetDemoData() {
  await wait(150)
  const db = read()

  // 重設會清空所有權杖，因此每個已登入的分頁都會失效
  write(fresh())
  return true
}
