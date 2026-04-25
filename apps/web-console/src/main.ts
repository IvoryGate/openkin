import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import './styles/base.css'
import './styles/layout.css'

const app = createApp(App)
app.use(router)
app.mount('#app')
