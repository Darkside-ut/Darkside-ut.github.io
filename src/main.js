import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { Buffer } from 'buffer'

import App from './App.vue'
import router from './router'
import './style.css'

// 浏览器里没有 Node 的 Buffer 全局对象，gray-matter 解析 frontmatter 时用到，这里补上
window.Buffer = window.Buffer || Buffer

const app = createApp(App)

// 全局注册 Element Plus 的所有图标组件，方便在模板里直接 <el-icon><User /></el-icon>
for (const [name, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(name, component)
}

app.use(ElementPlus)
app.use(router)
app.mount('#app')
