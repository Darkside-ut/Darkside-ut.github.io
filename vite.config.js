import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    // mathjax3 依赖使用了 top-level await，需要 ES2022 目标（现代浏览器均支持）
    target: 'es2022',
  },
})
