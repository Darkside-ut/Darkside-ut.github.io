import { createApp } from 'vue'
// Element Plus 组件和样式由 vite 插件按需引入（见 vite.config.js），这里只补 base 样式（CSS 变量 + reset）
import 'element-plus/theme-chalk/base.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { Buffer } from 'buffer'

import App from './App.vue'
import router from './router'
import './style.css'
// 霞鹜文楷字体（本地引入，Vite 会把字体文件打进构建产物）
import 'lxgw-wenkai-webfont/lxgwwenkai-regular.css'
import 'lxgw-wenkai-webfont/lxgwwenkai-bold.css'

// 浏览器里没有 Node 的 Buffer 全局对象，gray-matter 解析 frontmatter 时用到，这里补上
window.Buffer = window.Buffer || Buffer

const app = createApp(App)

// 全局注册 Element Plus 的所有图标组件，方便在模板里直接 <el-icon><User /></el-icon>
for (const [name, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(name, component)
}

app.use(router)
app.mount('#app')
