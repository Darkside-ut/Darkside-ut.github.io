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
        path: 'components/lvji',
        name: 'lvji',
        component: () => import('../views/Lvji.vue'),
      },
      {
        path: 'components/calendar',
        name: 'calendar',
        component: () => import('../views/Calendar.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
