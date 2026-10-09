import { computed, toValue } from 'vue'
import { adviseSize } from '@/products/sizeAdvice'
import { useBody } from '@/stores/body'

// 尺寸建議（第十六輪子輪 2）：商品頁的建議那一行、尺寸選項上的「建議」小標、收藏頁的尺寸下拉都從這裡拿。
// product 可以是 ref、getter 或物件（toValue 三種都認；第一版用 unref，傳 getter 進來時建議永遠是 null）；沒有身形或這件不適合建議（單一尺寸、童裝）就是 null
export function useSizeAdvice(product) {
  const { body, source } = useBody()
  const advice = computed(() => adviseSize(toValue(product), body.value))
  return { body, source, advice }
}
