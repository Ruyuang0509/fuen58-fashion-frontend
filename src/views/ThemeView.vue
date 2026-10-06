<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getThemes } from '@/api'
import OutfitStage from '@/components/OutfitStage.vue'

const route = useRoute()
const themes = ref([])
const loaded = ref(false)

// 用 computed 而不是在 onMounted 裡找一次：從一個主題換到另一個主題時，
// Vue Router 會沿用同一個元件、只換網址參數，onMounted 不會再跑。
const theme = computed(() => themes.value.find((item) => item.code === route.params.code))

onMounted(async () => {
  try {
    themes.value = await getThemes()
  } catch {
    themes.value = []
  }
  loaded.value = true
})
</script>

<template>
  <header v-if="theme" class="head">
    <h1>{{ theme.name }}</h1>
    <p>{{ theme.tagline }}</p>
  </header>

  <header v-else-if="loaded" class="head">
    <h1>找不到這個主題</h1>
    <p><RouterLink :to="{ name: 'outfits' }">看全部穿搭</RouterLink></p>
  </header>

  <OutfitStage v-if="theme" />
</template>

<style scoped>
.head {
  margin-block: var(--s3) var(--s4);
  padding-left: var(--s2);
  border-left: 4px solid var(--accent);
}

.head p {
  color: var(--ink-soft);
  font-size: var(--fs-2);
}
</style>
