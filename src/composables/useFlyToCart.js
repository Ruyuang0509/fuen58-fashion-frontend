// 加入購物車的回饋：商品圖縮小、畫一道弧飛向頂欄的「購物車」（功能規劃 4「購買流程的樂趣」：商品圖飛入購物車）。
// 只是回饋，不擋操作：動畫是另外複製的一張圖，原來的圖不動；系統設定減少動態時不做。
// 頂欄在窄螢幕是靜態的、可能已經捲出畫面，那時就不飛。
// 2026-10-06 使用者：原本 0.62 秒、縮到 6% 太快太小，不注意看不到——改成 1.05 秒、弧線先往上、最後留到 20% 才消失，
// 到站那一刻才讓頂欄的提袋跳一下（cart:arrive 事件；件數本身在按下的瞬間就更新了，不等動畫）。
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const arrive = () => window.dispatchEvent(new CustomEvent('cart:arrive'))

export function useFlyToCart() {
  /**
   * @param {HTMLImageElement|null} image 要飛的那張圖
   */
  function fly(image) {
    const target = document.querySelector('.cart-link')
    if (!image || !target || reduced() || !('animate' in image)) {
      arrive()
      return
    }
    const from = image.getBoundingClientRect()
    const to = target.getBoundingClientRect()
    if (to.bottom < 0 || to.top > window.innerHeight || !from.width) {
      arrive()
      return
    }

    const ghost = image.cloneNode()
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
    document.body.append(ghost)
    const dx = to.left + to.width / 2 - (from.left + from.width / 2)
    const dy = to.top + to.height / 2 - (from.top + from.height / 2)
    // 弧線：先往上抬一點再落向提袋；大小慢慢縮，到最後才消失
    const lift = Math.min(160, Math.max(70, from.height * 0.3))
    const animation = ghost.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
        { transform: `translate(${dx * 0.35}px, ${dy * 0.3 - lift}px) scale(0.72)`, opacity: 1, offset: 0.38 },
        { transform: `translate(${dx * 0.85}px, ${dy * 0.86 - lift * 0.25}px) scale(0.34)`, opacity: 0.95, offset: 0.82 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0, offset: 1 },
      ],
      { duration: 1050, easing: 'cubic-bezier(0.3, 0.1, 0.25, 1)' },
    )
    animation.onfinish = () => {
      ghost.remove()
      arrive()
    }
  }

  return { fly }
}
