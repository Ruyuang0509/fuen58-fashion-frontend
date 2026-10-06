import { computed, reactive } from 'vue'

// 購物車。lines 宣告在模組最外層，所以整個網站共用同一份；哪個元件呼叫 useCart() 拿到的都是它。
// 一列（line）是「同一件商品、同一個顏色、同一個尺寸」；數量在 qty。
// 列裡只存身分（productId、colour、size）與一份名稱價格的快照；庫存、顏色名、尺寸表這些
// 都由購物車頁向 API 重新要（商品下架、改價、庫存變動都要以當下為準）。
// 內容存在 localStorage，重新整理後還在；訪客也能用，登入後併入會員購物車是後端的事。
const KEY = 'cart'

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY)) ?? []
    // 舊版本的列沒有 colour 欄位，補成 null（代表預設顏色）
    return parsed.map((line) => ({ colour: null, ...line }))
  } catch {
    // 儲存空間不能用或內容壞掉時，從空的購物車開始
    return []
  }
}

const lines = reactive(load())

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines))
  } catch {
    // 存不了就只留在記憶體，重新整理後會消失
  }
}

const sameLine = (line, productId, colour, size) => line.productId === productId && line.colour === colour && line.size === size

export function useCart() {
  const count = computed(() => lines.reduce((sum, line) => sum + line.qty, 0))
  const subtotal = computed(() => lines.reduce((sum, line) => sum + line.price * line.qty, 0))

  /**
   * 加入購物車。
   * @param item   商品（要有 productId、name、brand、price）
   * @param size   尺寸；null 代表還沒選，要在購物車裡補選
   * @param colour 顏色代碼；null 代表預設顏色
   * @param qty    件數
   */
  function add(item, size = null, colour = null, qty = 1) {
    const same = lines.find((line) => sameLine(line, item.productId, colour, size))
    if (same) same.qty += qty
    else lines.push({ productId: item.productId, name: item.name, brand: item.brand, price: item.price, colour, size, qty })
    save()
  }

  function setQty(line, qty) {
    const next = Math.max(1, Math.floor(qty) || 1)
    line.qty = next
    save()
  }

  // 補選或改尺寸：改完如果和另一列變成同一件同色同尺寸，就併成一列
  function setSize(line, size) {
    const twin = lines.find((other) => other !== line && sameLine(other, line.productId, line.colour, size))
    if (twin) {
      twin.qty += line.qty
      lines.splice(lines.indexOf(line), 1)
    } else {
      line.size = size
    }
    save()
  }

  function remove(line) {
    const index = lines.indexOf(line)
    if (index >= 0) lines.splice(index, 1)
    save()
    return index
  }

  // 「復原」用：把剛刪掉的那一列放回原位
  function restore(line, index) {
    lines.splice(Math.min(index, lines.length), 0, line)
    save()
  }

  return { lines, count, subtotal, add, setQty, setSize, remove, restore }
}
