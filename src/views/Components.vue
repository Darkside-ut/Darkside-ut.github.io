<script setup>
import { Sunny, MapLocation } from '@element-plus/icons-vue'

// 组件列表：新增组件在这里登记即可，卡片会自动渲染
const components = [
  {
    name: '情绪调色盘',
    desc: '禅意情绪状态切换，五色心情呼吸圆环',
    path: '/components/mood',
    icon: Sunny,
    color: '#f2a33c',
  },
  {
    name: '旅迹',
    desc: '交互式中国旅游指南，点选省份探索景点',
    path: '/components/lvji',
    icon: MapLocation,
    color: '#c06060',
  },
]
</script>

<template>
  <div class="page">
    <div class="page-card">
      <h2 class="page-title">组件</h2>
      <div class="section-sub">可复用的交互组件</div>

      <div class="component-grid">
        <router-link
          v-for="c in components"
          :key="c.name"
          :to="c.path"
          class="component-card"
        >
          <div class="cover" :style="{ background: `linear-gradient(135deg, ${c.color}33, ${c.color}99)` }">
            <el-icon :size="40"><component :is="c.icon" /></el-icon>
          </div>
          <h3>{{ c.name }}</h3>
          <p class="desc">{{ c.desc }}</p>
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.component-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.2rem;
}

.component-card {
  background: rgba(245, 249, 255, 0.7);
  backdrop-filter: blur(8px);
  border-radius: 24px;
  padding: 1.2rem;
  border: 1px solid rgba(37, 99, 235, 0.12);
  transition: 0.25s;
}

.component-card:hover {
  transform: translateY(-6px);
  border-color: var(--accent);
  background: rgba(37, 99, 235, 0.1);
  box-shadow: 0 10px 24px -10px rgba(37, 99, 235, 0.25);
}

.cover {
  height: 100px;
  border-radius: 14px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.9rem;
}

.component-card h3 {
  margin-bottom: 0.4rem;
  color: var(--text-dark);
}

.desc {
  font-size: 0.82rem;
  color: var(--text-dim);
  line-height: 1.6;
}
</style>
