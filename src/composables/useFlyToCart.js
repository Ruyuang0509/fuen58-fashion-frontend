// 加入購物車的回饋：商品圖縮小飛向頂欄的「購物車」（功能規劃 4「購買流程的樂趣」：商品圖飛入購物車）。
// 只是回饋，不擋操作：動畫是另外複製的一張圖，原來的圖不動；系統設定減少動態時不做。
// 頂欄在窄螢幕是靜態的、可能已經捲出畫面，那時就不飛。
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function useFlyToCart() {
  /**
   * @param {HTMLImageElement|null} image 要飛的那張圖
   */
  function fly(image) {
    const target = document.querySelector('.cart-link')
    if (!image || !target || reduced() || !('animate' in image)) return
    const from = image.getBoundingClientRect()
    const to = target.getBoundingClientRect()
    if (to.bottom < 0 || to.top > window.innerHeight) return

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
      filter: 'none',
    })
    document.body.append(ghost)
    const dx = to.left + to.width / 2 - (from.left + from.width / 2)
    const dy = to.top + to.height / 2 - (from.top + from.height / 2)
    const animation = ghost.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(0.4)`, opacity: 0.9, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.06)`, opacity: 0.2 },
      ],
      { duration: 620, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)' },
    )
    animation.onfinish = () => ghost.remove()
  }

  return { fly }
}
