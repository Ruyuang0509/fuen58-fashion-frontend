// GSAP 的註冊點：全站只在這裡 registerPlugin，別處從這裡 import。
// 分工（第十二輪定的規矩）：微互動（hover、焦點、按鈕的回饋）留給 CSS；
// 捲動的連動、換頁的連續、整句重排這些「編排」交給 GSAP。兩套不混用在同一個元素上。
// 系統設定減少動態時，用 GSAP 的地方都要先問 reducedMotion()。
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { isReduced } from '@/stores/motion'

gsap.registerPlugin(ScrollTrigger, Flip)
gsap.defaults({ ease: 'power3.out', duration: 0.6 })

// 第十八輪子輪 1：除了系統設定，頁尾的「畫面」選單（stores/motion.js）選了減少動態或一般模式也算
export const reducedMotion = () => isReduced()

export { gsap, ScrollTrigger, Flip }
