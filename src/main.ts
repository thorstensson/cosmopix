import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/css/main.css'
import App from './App.vue'
import { createHead } from '@unhead/vue/client'

const app = createApp(App)
const head = createHead()
app.use(head)

app.use(createPinia())
app.mount('#app')
