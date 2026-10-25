import { createRouter, createWebHashHistory } from 'vue-router'
import DefaultLayout from '../layouts/DefaultLayout.vue'

const routes = [
  {
    path: '/',
    component: DefaultLayout,
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('../views/Home.vue'),
      },
      {
        path: 'portfolio',
        name: 'portfolio',
        component: () => import('../views/Portfolio.vue'),
      },
      {
        path: 'blog',
        name: 'blog',
        component: () => import('../views/Blog.vue'),
      },
      {
        path: 'blog/archive',
        name: 'blog-archive',
        component: () => import('../views/BlogArchive.vue'),
      },
      {
        path: 'blog/:slug',
        name: 'blog-post',
        component: () => import('../views/BlogPost.vue'),
      },
      {
        path: 'devices',
        name: 'devices',
        component: () => import('../views/Devices.vue'),
      },
      {
        path: 'components',
        name: 'components',
        component: () => import('../views/Components.vue'),
      },
      {
        path: 'components/mood',
        name: 'mood',
        component: () => import('../views/Mood.vue'),
      },
      {
        path: 'components/calendar',
        name: 'calendar',
        component: () => import('../views/Calendar.vue'),
      },
      {
        path: 'components/vocab',
        name: 'vocab',
        component: () => import('../views/Vocab.vue'),
      },
      {
        path: 'components/focus',
        name: 'focus',
        component: () => import('../views/Focus.vue'),
      },
      {
        path: 'components/food',
        name: 'food',
        component: () => import('../views/Food.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// 部署新版本后，仍停留在旧页面的标签页会引用已经被替换掉的旧分块，
// 点击任意懒加载路由（如“归档”）就会加载失败、页面空白。
// 这里捕获这类错误并整页刷新一次，拿回新版本的资源。
const CHUNK_RELOAD_KEY = 'chunk-reload-at'

router.onError((error, to) => {
  const msg = String(error?.message || '')
  const isChunkError =
    /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(
      msg
    )
  if (!isChunkError) return

  // 10 秒内只自动刷新一次，避免资源真的缺失时无限刷新
  const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0)
  if (Date.now() - last < 10000) return
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))

  const base = window.location.href.split('#')[0]
  window.location.replace(base + '#' + (to?.fullPath || '/'))
  window.location.reload()
})

export default router
