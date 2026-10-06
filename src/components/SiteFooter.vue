<script setup>
// 頁尾（第十五輪）：從兩行聲明變成整站的地圖。欄位是我們自己的內容——路線、品牌、找單品、會員、現在的活動、關於；
// 不放假的社群圖示：品牌全虛構、專題沒有真的社群帳號，唯一真的外連是 GitHub 專案。站內連結全走 RouterLink（Pages 的子路徑才對）。
// 底色跟著目前的路線色微染（6%），每一頁的頁尾顏色都不太一樣，但都淡到不搶。
import '@fontsource/noto-serif-tc/600.css'
import { computed, onMounted, ref } from 'vue'
import { getBrands, getCampaigns, getThemes } from '@/api'
import Icon from '@/components/Icon.vue'
import { REPO_URL, SITE_NAME } from '@/config'
import { useSession } from '@/stores/session'

const themes = ref([])
const brands = ref([])
const campaigns = ref([])
const { loggedIn } = useSession()

onMounted(async () => {
  // 三份資料各自獨立：哪一份拿不到，那一欄就空著（活動欄沒有內容時整欄不顯示）
  const [themeResult, brandResult, campaignResult] = await Promise.allSettled([getThemes(), getBrands(), getCampaigns({ active: true, placement: 'footer' })])
  if (themeResult.status === 'fulfilled') themes.value = themeResult.value
  if (brandResult.status === 'fulfilled') brands.value = brandResult.value
  if (campaignResult.status === 'fulfilled') campaigns.value = campaignResult.value
})

const findLinks = [
  { to: { name: 'search', query: { sort: 'new' } }, label: '新上架' },
  { to: { name: 'search', query: { sort: 'popular' } }, label: '熱銷' },
  { to: { name: 'search', query: { stock: '1' } }, label: '只看有貨' },
  { to: { name: 'outfits' }, label: '全部穿搭' },
  { to: { name: 'outfits', query: { for: 'kids' } }, label: '給小孩的穿搭' },
]

const memberLinks = computed(() => (loggedIn.value
  ? [
      { to: { name: 'account' }, label: '會員中心' },
      { to: { name: 'account-orders' }, label: '訂單紀錄' },
    ]
  : [
      { to: { name: 'login' }, label: '登入' },
      { to: { name: 'register' }, label: '註冊' },
    ]))

const CONTRACT_URL = `${REPO_URL}/blob/main/docs/api-契約草案.md`

const until = (iso) => {
  const [, month, day] = iso.split('-')
  return `${+month}/${+day}`
}

function toTop() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
}
</script>

<template>
  <footer class="site-footer">
    <div class="inner">
      <nav class="cols" aria-label="網站地圖">
        <section class="col">
          <h2>路線</h2>
          <ul>
            <li v-for="theme in themes" :key="theme.code">
              <RouterLink :to="{ name: 'theme', params: { code: theme.code } }">{{ theme.name }}</RouterLink>
            </li>
          </ul>
        </section>

        <section class="col">
          <h2>品牌</h2>
          <ul>
            <li v-for="brand in brands" :key="brand.code">
              <RouterLink :to="{ name: 'brand', params: { id: brand.code } }">{{ brand.name }}</RouterLink>
            </li>
          </ul>
        </section>

        <section class="col">
          <h2>找單品</h2>
          <ul>
            <li v-for="link in findLinks" :key="link.label">
              <RouterLink :to="link.to">{{ link.label }}</RouterLink>
            </li>
          </ul>
        </section>

        <section class="col">
          <h2>會員</h2>
          <ul>
            <li v-for="link in memberLinks" :key="link.label">
              <RouterLink :to="link.to">{{ link.label }}</RouterLink>
            </li>
          </ul>
        </section>

        <section v-if="campaigns.length" class="col">
          <h2>現在的活動</h2>
          <ul>
            <li v-for="campaign in campaigns" :key="campaign.code">
              <RouterLink :to="{ name: 'campaign', params: { code: campaign.code } }">{{ campaign.title }}</RouterLink>
              <small>到 {{ until(campaign.endsAt) }}</small>
            </li>
          </ul>
        </section>

        <section class="col">
          <h2>關於</h2>
          <ul>
            <li><a href="#about">關於本專題</a></li>
            <li><a :href="REPO_URL" class="ext" target="_blank" rel="noopener noreferrer">GitHub 專案<Icon name="arrow" /></a></li>
            <li><a :href="CONTRACT_URL" class="ext" target="_blank" rel="noopener noreferrer">給後端的契約<Icon name="arrow" /></a></li>
            <li><span class="soon">穿搭牆<small>籌備中</small></span></li>
          </ul>
        </section>
      </nav>

      <div id="about" class="foot">
        <p class="mark">{{ SITE_NAME }}</p>
        <div class="notes">
          <p>這是課程專題作品，不是營業中的商店，無法實際購買。</p>
          <p>站上的品牌皆為虛構。圖片為 AI 生成或採用允許非商業使用的素材，不作商業用途。</p>
        </div>
        <button type="button" class="top" @click="toTop">回到最上面<Icon name="up" /></button>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  margin-top: var(--s5);
  padding: var(--s5) var(--s3) var(--s4);
  border-top: 1px solid var(--line);
  background: color-mix(in srgb, var(--accent) 6%, var(--bg));
  color: var(--ink-soft);
  font-size: var(--fs-0);
}

.inner {
  max-width: var(--stage-max);
  margin-inline: auto;
}

.cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
  gap: var(--s4) var(--s3);
}

.col h2 {
  margin: 0 0 var(--s2);
  font-family: 'Noto Serif TC', serif;
  font-size: var(--fs-1);
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--ink);
}

.col ul {
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* 連結滑過：顏色變深、底線從左畫出來（和頂欄、穿搭卡同一套） */
.col a {
  color: inherit;
  text-decoration: none;
  background-image: linear-gradient(currentColor, currentColor);
  background-repeat: no-repeat;
  background-size: 0 1px;
  background-position: 0 100%;
  transition: color var(--ease), background-size 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.col a:hover,
.col a:focus-visible {
  color: var(--ink);
  background-size: 100% 1px;
}

.ext .icon {
  margin-left: 0.3em;
  transform: rotate(-45deg);
}

.col small {
  display: block;
  font-size: 0.75rem;
}

.foot {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: end;
  gap: var(--s3);
  margin-top: var(--s5);
  padding-top: var(--s3);
  border-top: 1px solid var(--line);
}

.mark {
  margin: 0;
  font-family: 'Noto Serif TC', serif;
  font-size: var(--fs-2);
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--ink);
}

.notes p {
  margin: 0;
  line-height: 1.7;
}

.top {
  all: unset;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--ink-soft);
  letter-spacing: 0.1em;
  white-space: nowrap;
}

.top:hover,
.top:focus-visible {
  color: var(--ink);
}

.top:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}

.top .icon {
  transition: transform 0.3s ease;
}

.top:hover .icon,
.top:focus-visible .icon {
  transform: translateY(-3px);
}

@media (prefers-reduced-motion: reduce) {
  .col a,
  .top .icon {
    transition: none;
  }
}

@media (max-width: 36rem) {
  .cols {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .foot {
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
}
</style>
