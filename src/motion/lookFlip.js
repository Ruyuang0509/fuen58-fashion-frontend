// 衣服從卡片飛到穿搭頁。
// 點卡片的那一刻記下那套衣服在畫面上的位置與大小（Flip.getState）；換頁後穿搭頁掛好，
// 從記下的位置補到新位置（Flip.from）。兩邊是不同的元素，用同一個 data-flip-id（look-<穿搭 id>）對上。
// 順手把那套穿搭的資料一起帶過去，穿搭頁不用等 API 就能先把衣服掛出來。
import { Flip, gsap, reducedMotion } from './gsap'

let pending = null

/**
 * @param {object} outfit 點的那套穿搭（要有 id）
 * @param {Element|null} from 點的那個連結；裡面要有 .stack（OutfitLook 的人形）
 */
export function rememberLook(outfit, from) {
  const element = from?.querySelector?.('.stack') ?? null
  if (!outfit || !element || reducedMotion()) {
    pending = null
    return
  }
  pending = { id: outfit.id, outfit, state: Flip.getState(element) }
}

/** 穿搭頁拿走剛才記下的那套；id 對不上就當沒有 */
export function takeLook(id) {
  const hit = pending && pending.id === Number(id) ? pending : null
  pending = null
  return hit
}

/** 從記下的位置飛到 target（穿搭頁的 .stack）；飛完把 transform 交回 CSS（天空的風在用它） */
export function flyLookIn(target, state) {
  if (!target || !state) return null
  return Flip.from(state, {
    targets: target,
    duration: 0.8,
    ease: 'power3.inOut',
    scale: true,
    onComplete: () => gsap.set(target, { clearProps: 'transform,opacity' }),
  })
}
