<script setup>
// 設計方向樣張：同一份內容（一句話列＋一套穿搭）用三種視覺語言各畫一次，給使用者挑方向用。
// 這一頁不是產品頁，只在開發時看；方向定案後會刪掉，選中的那一套變成全站的設計變數。
import '@fontsource/noto-serif-tc/300.css'
import '@fontsource/noto-serif-tc/400.css'
import '@fontsource/noto-serif-tc/900.css'
import '@fontsource/noto-sans-tc/400.css'
import '@fontsource/noto-sans-tc/700.css'
import '@fontsource/huninn/400.css'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/fraunces/400.css'
import '@fontsource/fraunces/700.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import GarmentFlat from '@/components/design/GarmentFlat.vue'

const outfit = {
  title: '通勤的灰階',
  theme: '簡約',
  items: [
    { kind: 'coat', name: '落肩混紡大衣', brand: '霧岸', price: '3,280' },
    { kind: 'top', name: '圓領細針織上衣', brand: '半日', price: '1,180' },
    { kind: 'trousers', name: '直筒西裝褲', brand: '霧岸', price: '1,680' },
  ],
  total: '6,140',
}
</script>

<template>
  <div class="study">
    <header class="intro">
      <h1>設計方向樣張</h1>
      <p>同一份內容畫三次。服飾圖全部是程式畫的平面款式圖，沒有用圖片檔。顏色還沒有跑對比度檢查，選定方向後才跑。</p>
    </header>

    <!-- ───────── A 夜線 ───────── -->
    <section class="direction">
      <h2>A　夜線</h2>
      <p class="why">延續十殿之世的線稿世界：深色底、發亮的細線、一件主體配大片空場。顏色只留給事件（加入購物車），不拿來分類。</p>

      <div class="tile a">
        <div class="a-top">
          <span class="a-mark">今天穿什麼</span>
          <span class="a-nav">穿搭牆　天氣穿搭　購物車 <b class="a-signal">3</b>　會員</span>
        </div>

        <p class="a-sentence">今天 18°C，<u>去上班</u>，想穿<u>簡約</u>，找<u>整套穿搭</u>，尺寸 <u>M</u></p>

        <div class="a-stage">
          <figure v-for="(item, i) in outfit.items" :key="item.kind" class="a-piece" :class="`a-piece-${i}`">
            <GarmentFlat :kind="item.kind" />
            <figcaption>
              <span>{{ item.name }}</span>
              <small>{{ item.brand }}　NT$ {{ item.price }}</small>
            </figcaption>
          </figure>

          <!-- 旁邊另一套：沒有被選到的時候壓暗 -->
          <div class="a-other" aria-hidden="true">
            <GarmentFlat kind="top" />
            <GarmentFlat kind="skirt" />
          </div>
        </div>

        <div class="a-foot">
          <div>
            <h3>{{ outfit.title }}</h3>
            <p>{{ outfit.theme }}　三件　NT$ {{ outfit.total }}</p>
          </div>
          <div class="a-actions">
            <span class="a-added"><i></i>已加入 3 件</span>
            <button type="button">整套加入購物車</button>
          </div>
        </div>
      </div>
    </section>

    <!-- ───────── B 紙本型錄 ───────── -->
    <section class="direction">
      <h2>B　紙本型錄</h2>
      <p class="why">印刷品的語言：紙色底、粗明體大標、細線不用卡片框。款式圖帶尺寸標註，直接回應「買得合身」。主題色是印在圖版後面的一塊色。</p>

      <div class="tile b">
        <div class="b-mast">
          <span class="b-mark">今天穿什麼</span>
          <span class="b-nav">穿搭牆　天氣穿搭　購物車（3）　會員</span>
        </div>

        <p class="b-sentence">
          <span>今天 18°C，</span><span><b>去上班</b>，</span><span>想穿<b>簡約</b>，</span><span>找<b>整套穿搭</b>，</span><span>尺寸 <b>M</b>。</span>
        </p>

        <div class="b-spread">
          <div class="b-plate">
            <div class="b-flats">
              <figure v-for="item in outfit.items" :key="item.kind">
                <GarmentFlat :kind="item.kind" />
                <span class="b-dim">{{ item.kind === 'coat' ? '衣長 108' : item.kind === 'top' ? '胸寬 52' : '褲長 98' }}</span>
              </figure>
            </div>
            <p class="b-caption">圖版 01　尺寸為示意，單位公分</p>
          </div>

          <div class="b-text">
            <h3>{{ outfit.title }}</h3>
            <p class="b-meta">{{ outfit.theme }}　三件</p>
            <ul>
              <li v-for="item in outfit.items" :key="item.kind">
                <span class="b-name">{{ item.name }}<small>{{ item.brand }}</small></span>
                <span class="b-price">{{ item.price }}</span>
              </li>
              <li class="b-total">
                <span class="b-name">合計　NT$</span>
                <span class="b-price">{{ outfit.total }}</span>
              </li>
            </ul>
            <div class="b-actions">
              <button type="button">整套加入購物車</button>
              <a href="#" @click.prevent>逐件看</a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ───────── C 色塊小世界 ───────── -->
    <section class="direction">
      <h2>C　色塊小世界</h2>
      <p class="why">每個主題是一個房間，用平塗色塊和亮度分場；衣服是剪紙般的色塊，站在階梯上。字用圓體，整體比較像玩具或繪本。</p>

      <div class="tile c">
        <div class="c-top">
          <span class="c-mark">今天穿什麼</span>
          <p class="c-sentence">
            <span>18°C</span><span class="on">去上班</span><span class="on">簡約</span><span>整套穿搭</span><span class="on">M</span>
          </p>
          <span class="c-cart">購物車 3</span>
        </div>

        <div class="c-room">
          <div class="c-card">
            <small>第一室</small>
            <h3>{{ outfit.theme }}</h3>
            <p>少一點，剛剛好。</p>
          </div>

          <div class="c-steps">
            <figure v-for="(item, i) in outfit.items" :key="item.kind" :class="`c-step-${i}`">
              <GarmentFlat :kind="item.kind" :seams="false" />
              <figcaption>{{ item.name }}<b>{{ item.price }}</b></figcaption>
            </figure>
          </div>
        </div>

        <div class="c-foot">
          <span>{{ outfit.title }}　三件　NT$ {{ outfit.total }}</span>
          <button type="button">整套加入購物車</button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 樣張頁自己的外框：中性灰，不屬於任何一個方向 */
.study {
  --frame: #dcdcdc;
  --frame-ink: #222222;
  --frame-soft: #555555;
  min-height: 100vh;
  padding: 2rem;
  background: var(--frame);
  color: var(--frame-ink);
  font-family: 'Noto Sans TC', sans-serif;
}

.intro,
.direction {
  max-width: 76rem;
  margin: 0 auto 3rem;
}

.intro h1 {
  font-size: 1.75rem;
}

.intro p,
.why {
  max-width: 44em;
  color: var(--frame-soft);
}

.direction h2 {
  font-size: 1.25rem;
}

.why {
  margin: 0.25rem 0 1rem;
  font-size: 0.875rem;
}

.tile {
  overflow: hidden;
  min-height: 40rem;
}

.tile button {
  cursor: pointer;
}

/* ══════════ A 夜線 ══════════ */
.a {
  --paper: #06070b;
  --ink: #d5d9e0;
  --ink-2: #808896;
  --rule: rgba(213, 217, 224, 0.18);
  --signal: #ff5a3c;
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  padding: 1.75rem 2.5rem 2rem;
  background: radial-gradient(120% 90% at 30% 40%, #0d1018 0%, var(--paper) 70%);
  color: var(--ink);
  font-family: 'Cormorant Garamond', 'Noto Serif TC', serif;
  /* 這套字的數字預設是高低不齊的舊體數字，價格要用等高的 */
  font-variant-numeric: lining-nums;
}

.a-top {
  display: flex;
  justify-content: space-between;
  color: var(--ink-2);
  font-size: 0.875rem;
  letter-spacing: 0.24em;
}

.a-mark {
  color: var(--ink);
}

.a-signal {
  color: var(--signal);
  font-weight: 400;
}

.a-sentence {
  margin-top: 2.25rem;
  font-size: 1.3rem;
  font-weight: 300;
  letter-spacing: 0.14em;
  text-align: center;
}

.a-sentence u {
  text-decoration: none;
  padding-bottom: 0.15em;
  border-bottom: 1px solid var(--ink-2);
}

.a-stage {
  position: relative;
  min-height: 24rem;
}

.a-piece {
  position: absolute;
  margin: 0;
  filter: drop-shadow(0 0 7px rgba(213, 217, 224, 0.32));
}

.a-piece-0 {
  left: 22%;
  top: 6%;
  width: 14.5rem;
}

.a-piece-1 {
  left: 49%;
  top: 2%;
  width: 8.5rem;
}

.a-piece-2 {
  left: 53%;
  top: 44%;
  width: 7.5rem;
}

/* 說明文字用一條細線接到衣服 */
.a-piece figcaption {
  position: absolute;
  left: calc(100% + 3.5rem);
  top: 38%;
  white-space: nowrap;
  font-size: 0.95rem;
  letter-spacing: 0.1em;
}

.a-piece figcaption::before {
  content: '';
  position: absolute;
  right: calc(100% + 0.6rem);
  top: 0.7em;
  width: 2.6rem;
  border-top: 1px solid var(--rule);
}

.a-piece-0 figcaption {
  left: auto;
  right: calc(100% + 3.5rem);
  text-align: right;
}

.a-piece-0 figcaption::before {
  right: auto;
  left: calc(100% + 0.6rem);
}

.a-piece small {
  display: block;
  color: var(--ink-2);
  font-size: 0.8rem;
}

.a-other {
  position: absolute;
  right: 0;
  top: 14%;
  display: grid;
  gap: 1rem;
  width: 5.5rem;
  opacity: 0.42;
}

.a-foot {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding-top: 1.25rem;
  border-top: 1px solid var(--rule);
}

.a-foot h3 {
  font-size: 2.4rem;
  font-weight: 300;
  letter-spacing: 0.3em;
}

.a-foot p {
  margin-top: 0.4rem;
  color: var(--ink-2);
  letter-spacing: 0.18em;
}

.a-actions {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.a-added {
  color: var(--signal);
  font-size: 0.9rem;
  letter-spacing: 0.14em;
}

.a-added i {
  display: inline-block;
  width: 0.45rem;
  height: 0.45rem;
  margin-right: 0.6rem;
  border-radius: 50%;
  background: var(--signal);
}

.a button {
  padding: 0.7rem 1.6rem;
  border: 1px solid var(--ink);
  background: transparent;
  color: var(--ink);
  font: inherit;
  letter-spacing: 0.2em;
}

/* ══════════ B 紙本型錄 ══════════ */
.b {
  --paper: #f1ece2;
  --ink: #1c1a17;
  --ink-2: #645e54;
  --stamp: #b9c2c4;
  --grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .11 0 0 0 0 .1 0 0 0 0 .09 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
  padding: 1.5rem 2.5rem 2.25rem;
  background: var(--grain), var(--paper);
  color: var(--ink);
  font-family: 'Noto Serif TC', serif;
}

.b-mast {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 0.7rem;
  /* 報頭下面的雙線 */
  border-bottom: 3px double var(--ink);
}

.b-mark {
  font-size: 1.6rem;
  font-weight: 900;
}

.b-nav {
  font-size: 0.9rem;
}

.b-sentence {
  max-width: 22em;
  margin: 2rem 0 2.25rem;
  font-size: 1.9rem;
  line-height: 1.55;
}

/* 每一小段連同後面的標點不拆開，換行只會發生在段與段之間 */
.b-sentence span {
  display: inline-block;
  white-space: nowrap;
}

.b-sentence b {
  font-weight: 900;
  border-bottom: 2px solid var(--ink);
}

.b-spread {
  display: grid;
  grid-template-columns: 7fr 5fr;
  gap: 2.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--ink);
}

.b-flats {
  position: relative;
  display: grid;
  grid-template-columns: 1.35fr 1fr 0.95fr;
  align-items: end;
  gap: 1.75rem;
  padding: 1.5rem 1.5rem 0.5rem;
  --flat-fill: var(--paper);
}

/* 印在圖版後面、故意套不準的一塊色 */
.b-flats::before {
  content: '';
  position: absolute;
  inset: 14% 22% 18% 4%;
  background: var(--stamp);
  mix-blend-mode: multiply;
}

.b-flats figure {
  position: relative;
  margin: 0;
}

/* 尺寸標註：一條兩端有短豎線的橫線，數字壓在線中間 */
.b-dim {
  display: block;
  margin-top: 0.6rem;
  padding: 0 0.4rem;
  border-inline: 1px solid var(--ink);
  font-family: 'Fraunces', 'Noto Serif TC', serif;
  font-size: 0.78rem;
  line-height: 1;
  text-align: center;
  background: linear-gradient(var(--ink), var(--ink)) center / 100% 1px no-repeat;
}

.b-dim::first-line {
  background: var(--paper);
}

.b-caption {
  margin-top: 1rem;
  color: var(--ink-2);
  font-size: 0.78rem;
}

.b-text h3 {
  font-size: 2.7rem;
  font-weight: 900;
  line-height: 1.2;
}

.b-meta {
  margin: 0.4rem 0 1.25rem;
  color: var(--ink-2);
}

.b-text ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.b-text li {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  padding: 0.55rem 0;
  border-bottom: 1px dotted var(--ink-2);
}

.b-name small {
  display: block;
  color: var(--ink-2);
  font-size: 0.8rem;
}

.b-price {
  font-family: 'Fraunces', serif;
  font-size: 1.15rem;
  font-variant-numeric: tabular-nums;
}

.b-total {
  border-bottom: 3px double var(--ink) !important;
  font-weight: 900;
}

.b-total .b-price {
  font-weight: 700;
  font-size: 1.5rem;
}

.b-actions {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.b button {
  padding: 0.75rem 1.4rem;
  border: 0;
  border-radius: 0;
  background: var(--ink);
  color: var(--paper);
  font: inherit;
  font-weight: 900;
}

.b-actions a {
  color: var(--ink);
  text-underline-offset: 0.3em;
}

/* ══════════ C 色塊小世界 ══════════ */
.c {
  --paper: #f5eee0;
  --ink: #1e1b2e;
  --wall: #2a3a5e;
  --floor: #e8b54a;
  --step: #d96a4a;
  --cloth-0: #f5eee0;
  --cloth-1: #2a3a5e;
  --cloth-2: #1e1b2e;
  display: grid;
  grid-template-rows: auto 1fr auto;
  background: var(--paper);
  color: var(--ink);
  font-family: 'Huninn', 'Noto Sans TC', sans-serif;
}

.c-top {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.1rem 2rem;
}

.c-mark {
  font-size: 1.3rem;
}

.c-sentence {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0 auto;
}

.c-sentence span {
  padding: 0.35rem 0.9rem;
  border: 2px solid var(--ink);
  border-radius: 0.6rem;
}

.c-sentence .on {
  background: var(--ink);
  color: var(--paper);
}

.c-room {
  display: grid;
  grid-template-columns: 5fr 7fr;
  min-height: 27rem;
}

.c-card {
  display: grid;
  align-content: end;
  padding: 2.25rem;
  background: var(--wall);
  color: var(--paper);
}

.c-card h3 {
  font-size: 6rem;
  line-height: 1.05;
  font-weight: 400;
}

.c-card p {
  margin-top: 0.5rem;
  font-size: 1.15rem;
}

.c-steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  align-items: end;
  background: var(--floor);
  --flat-stroke: 0;
}

.c-steps figure {
  display: grid;
  justify-items: center;
  margin: 0;
  padding: 1.25rem 1.25rem 0;
}

.c-steps figure :deep(.flat) {
  width: 62%;
}

/* 三級階梯：每一級是一塊越來越高的色塊，衣服站在上面 */
.c-steps figcaption {
  display: grid;
  align-content: start;
  gap: 0.2rem;
  width: calc(100% + 2.5rem);
  margin-top: 0.75rem;
  padding: 0.8rem 1rem;
  background: var(--step);
  color: var(--ink);
  font-size: 0.95rem;
}

.c-steps b {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.3rem;
}

.c-step-0 {
  --flat-fill: var(--cloth-0);
}

.c-step-0 figcaption {
  min-height: 9.5rem;
}

.c-step-1 {
  --flat-fill: var(--cloth-1);
}

.c-step-1 figcaption {
  min-height: 6.5rem;
  filter: brightness(1.12);
}

.c-step-2 {
  --flat-fill: var(--cloth-2);
}

.c-step-2 figcaption {
  min-height: 3.5rem;
  filter: brightness(1.24);
}

.c-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 2rem;
  font-size: 1.15rem;
}

.c button {
  padding: 0.8rem 1.5rem;
  border: 2px solid var(--ink);
  border-radius: 0.8rem;
  background: var(--step);
  color: var(--ink);
  font: inherit;
  /* 實心的位移陰影，像貼紙疊在紙上 */
  box-shadow: 0.3rem 0.3rem 0 var(--ink);
}
</style>
