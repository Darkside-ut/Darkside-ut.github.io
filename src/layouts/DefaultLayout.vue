<script setup>
import { onMounted } from 'vue'

// 路由是懒加载的，首次点击导航会先下载对应页面 chunk 才跳转，产生「点击延时」。
// 这里趁浏览器空闲时把几个页面组件提前下载好，之后点击就是秒开。
const routeComponents = {
  home: () => import('../views/Home.vue'),
  portfolio: () => import('../views/Portfolio.vue'),
  blog: () => import('../views/Blog.vue'),
  devices: () => import('../views/Devices.vue'),
}

onMounted(() => {
  const prefetch = () => Object.values(routeComponents).forEach((load) => load())
  if ('requestIdleCallback' in window) {
    requestIdleCallback(prefetch)
  } else {
    setTimeout(prefetch, 2000)
  }
})
</script>

<template>
  <div class="layout">
    <!-- 左侧栏 -->
    <aside class="sidebar">
      <div class="brand">
        <div class="avatar">
          <span class="avatar-fallback">J</span>
          <img src="/profile.jpg" alt="Jimsss" onerror="this.remove()" />
        </div>
        <h1 class="brand-name">Jimsss</h1>
        <div class="tagline">王浩然 USTC:Computer Science</div>
      </div>

      <nav class="nav">
        <router-link class="nav-item" to="/">
          <el-icon><House /></el-icon>
          <span>首页</span>
        </router-link>
        <router-link class="nav-item" to="/portfolio">
          <el-icon><Grid /></el-icon>
          <span>作品集</span>
        </router-link>
        <router-link class="nav-item" to="/blog">
          <el-icon><Notebook /></el-icon>
          <span>随笔</span>
        </router-link>
        <router-link class="nav-item" to="/devices">
          <el-icon><Monitor /></el-icon>
          <span>我的电子伙伴</span>
        </router-link>
      </nav>

      <div class="social">
        <div class="location">
          <el-icon><Location /></el-icon>
          中国 · 合肥
        </div>
        <div class="social-links">
          <a
            href="https://github.com/Darkside-ut"
            target="_blank"
            rel="noopener"
            class="social-icon"
            aria-label="GitHub"
            title="GitHub"
          >
            <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
          <a
            href="https://space.bilibili.com/525563224"
            target="_blank"
            rel="noopener"
            class="social-icon"
            aria-label="Bilibili"
            title="Bilibili"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h.107c.053-.071.116-.142.187-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373z" />
            </svg>
          </a>
          <a
            href="mailto:jimsss@126.com"
            class="social-icon"
            aria-label="邮箱"
            title="邮箱"
          >
            <el-icon><Message /></el-icon>
          </a>
        </div>
      </div>
    </aside>

    <!-- 右侧内容区 -->
    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  width: 100%;
  position: relative;
  z-index: 2;
}

.sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  background: rgba(226, 238, 252, 0.7);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-right: 1px solid var(--glass-edge);
  display: flex;
  flex-direction: column;
  padding: 2rem 1.5rem;
  box-shadow: 8px 0 25px -12px rgba(30, 60, 110, 0.15);
  overflow-y: auto;
}

/* 头像 + 品牌 */
.brand {
  text-align: left;
  margin-bottom: 2rem;
  padding-bottom: 1.2rem;
  border-bottom: 1px solid rgba(37, 99, 235, 0.25);
}

.avatar {
  position: relative;
  width: 76px;
  height: 76px;
  border-radius: 50%;
  border: 2px solid var(--accent);
  box-shadow: 0 0 15px rgba(37, 99, 235, 0.25);
  background: linear-gradient(135deg, #60a5fa, #2563eb);
  margin-bottom: 1rem;
  overflow: hidden;
}

.avatar-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 2rem;
  font-weight: 800;
}

.avatar img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.brand-name {
  font-size: 1.7rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #1e3a8a, #2563eb);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.tagline {
  font-size: 0.72rem;
  font-family: monospace;
  color: var(--accent);
  margin-top: 0.3rem;
}

/* 导航胶囊 */
.nav {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0.7rem 1rem;
  border-radius: 60px;
  font-weight: 500;
  font-size: 0.95rem;
  color: var(--text-dim);
  cursor: pointer;
  transition: var(--transition);
  border: 1px solid transparent;
}

.nav-item .el-icon {
  width: 24px;
  font-size: 1.1rem;
  color: var(--accent);
}

.nav-item:hover {
  background: rgba(37, 99, 235, 0.15);
  border-color: rgba(37, 99, 235, 0.35);
  color: var(--text-dark);
  transform: translateX(6px);
}

.nav-item.router-link-exact-active {
  background: rgba(37, 99, 235, 0.25);
  border-color: var(--accent);
  color: var(--text-dark);
  box-shadow: 0 6px 14px rgba(37, 99, 235, 0.15);
}

/* 社交区 */
.social {
  margin-top: auto;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(37, 99, 235, 0.2);
}

.location {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  color: var(--text-dim);
}

.social-links {
  display: flex;
  gap: 0.6rem;
  margin-top: 0.9rem;
}

.social-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: var(--text-dim);
  background: rgba(219, 234, 254, 0.7);
  border: 1px solid rgba(37, 99, 235, 0.2);
  transition: 0.2s;
}

.social-icon:hover {
  background: var(--accent);
  color: #fff;
  transform: translateY(-2px);
}

.social-icon .el-icon {
  font-size: 1rem;
}

/* 内容区 */
.content {
  flex: 1;
  overflow-y: auto;
  position: relative;
  background: transparent;
}

.content::-webkit-scrollbar {
  width: 5px;
}
.content::-webkit-scrollbar-thumb {
  background: var(--accent);
  border-radius: 10px;
}

/* 响应式 */
@media (max-width: 800px) {
  .layout {
    flex-direction: column;
  }
  .sidebar {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
    padding: 1rem;
    border-right: none;
    border-bottom: 1px solid var(--glass-edge);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
  .avatar {
    width: 48px;
    height: 48px;
    margin-bottom: 0;
  }
  .brand-name {
    font-size: 1.2rem;
  }
  .tagline {
    display: none;
  }
  .nav {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .nav-item {
    padding: 0.3rem 0.8rem;
    font-size: 0.72rem;
  }
  .social {
    display: none;
  }
}
</style>
