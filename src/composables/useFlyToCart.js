// 「飛過去」的回饋。加入購物車時商品圖縮小、畫一道弧飛向頂欄的「購物車」（功能規劃 4「購買流程的樂趣」：商品圖飛入購物車）；
// 第十五輪子輪 2 多了收藏：一顆小愛心沿同一條弧飛向頂欄的「收藏」。
// 只是回饋，不擋操作：動畫是另外複製的一份，原來的不動；系統設定減少動態時不做。
// 頂欄在窄螢幕是靜態的、可能已經捲出畫面，那時就不飛，直接送到站事件。
// 2026-10-06 使用者：原本 0.62 秒、縮到 6% 太快太小，不注意看不到——改成 1.05 秒、弧線先往上、最後留到 20% 才消失，
// 到站那一刻才讓頂欄的提袋跳一下（cart:arrive 事件；件數本身在按下的瞬間就更新了，不等動畫）。
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const arrive = (eventName) => window.dispatchEvent(new CustomEvent(eventName))

/**
 * 把 source 的複製品沿弧線飛到 target。
 * @param {Element|null} source 要飛的元素（圖或圖示）
 * @param {{ target: string, event: string, duration?: number, endScale?: number, colour?: string }} options
 *   target 頂欄上目的地的選擇器；event 到站時送的事件名；endScale 最後縮到幾成；colour 給 SVG 用的顏色
 */
function flyTo(source, { target, event, duration = 1050, endScale = 0.2, colour } = {}) {
  const destination = document.querySelector(target)
  if (!source || !destination || reduced() || !('animate' in source)) {
    arrive(event)
    return
  }
  const from = source.getBoundingClientRect()
  const to = destination.getBoundingClientRect()
  if (to.bottom < 0 || to.top > window.innerHeight || !from.width) {
    arrive(event)
    return
  }

  const ghost = source.cloneNode(true)
  ghost.setAttribute('aria-hidden', 'true')
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    margin: 0,
    pointerEvents: 'none',
    zIndex: 50,
    filter: 'drop-shadow(0 18px 24px rgba(20, 24, 40, 0.28))',
    transformOrigin: '50% 50%',
  })
  if (colour) ghost.style.color = colour
  document.body.append(ghost)
  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  // 弧線：先往上抬一點再落向目的地；大小慢慢縮，到最後才消失
  const lift = Math.min(160, Math.max(70, from.height * 0.3))
  const mid = endScale + (1 - endScale) * 0.65
  const late = endScale + (1 - endScale) * 0.18
  const animation = ghost.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
      { transform: `translate(${dx * 0.35}px, ${dy * 0.3 - lift}px) scale(${mid})`, opacity: 1, offset: 0.38 },
      { transform: `translate(${dx * 0.85}px, ${dy * 0.86 - lift * 0.25}px) scale(${late})`, opacity: 0.95, offset: 0.82 },
      { transform: `translate(${dx}px, ${dy}px) scale(${endScale})`, opacity: 0, offset: 1 },
    ],
    { duration, easing: 'cubic-bezier(0.3, 0.1, 0.25, 1)' },
  )
  animation.onfinish = () => {
    ghost.remove()
    arrive(event)
  }
}

export function useFlyToCart() {
  /** 商品圖飛向購物車 */
  function fly(image) {
    flyTo(image, { target: '.cart-link', event: 'cart:arrive' })
  }

  /** 小愛心飛向頂欄的收藏（0.8 秒；愛心本來就小，最後留到六成） */
  function flyHeart(icon) {
    const svg = icon?.cloneNode ? icon : null
    if (svg) {
      // 飛的是一顆填滿的心，顏色用目前的強調色
      const filled = svg.cloneNode(true)
      filled.querySelectorAll('path').forEach((path) => path.setAttribute('fill', 'currentColor'))
      // cloneNode 已經是複製品，flyTo 會再複製一次；先把填滿的版本放回原位量尺寸
      filled.style.position = 'fixed'
      const box = svg.getBoundingClientRect()
      Object.assign(filled.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, pointerEvents: 'none' })
      document.body.append(filled)
      flyTo(filled, { target: '.fav-link', event: 'fav:arrive', duration: 800, endScale: 0.6, colour: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || undefined })
      filled.remove()
      return
    }
    arrive('fav:arrive')
  }

  return { fly, flyHeart, flyTo }
}
