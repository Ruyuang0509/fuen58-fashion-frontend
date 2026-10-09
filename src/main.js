import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
// 身形 store 要一開站就在：登入那一刻把訪客在商品頁輸入的身形併進帳號，不管人在哪一頁（第十六輪子輪 2）
import './stores/body'
import './styles/tokens.css'
import './styles/base.css'

createApp(App).use(router).mount('#app')
