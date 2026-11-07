<script setup>
import { Sunny, Calendar, Reading, Timer, Food, Memo } from '@element-plus/icons-vue'

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
    name: '日历',
    desc: '月历日程管理，DDL 倒计时侧栏提醒',
    path: '/components/calendar',
    icon: Calendar,
    color: '#2563eb',
  },
  {
    name: '背单词',
    desc: '本地词库导入，卡片翻转与间隔重复记忆',
    path: '/components/vocab',
    icon: Reading,
    color: '#e15b5b',
  },
  {
    name: '专注中心',
    desc: '番茄钟、喝水提醒与护眼提醒',
    path: '/components/focus',
    icon: Timer,
    color: '#34a86c',
  },
  {
    name: '美食评价',
    desc: '记录探店店铺，为每道菜打分写评价',
    path: '/components/food',
    icon: Food,
    color: '#c05621',
  },
  {
    name: '小便条',
    desc: '收藏金句、诗词、歌词、游戏截图和生活片刻',
    path: '/components/notes',
    icon: Memo,
    color: '#7c6bb3',
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
          v-for="(c, index) in components"
          :key="c.name"
          :to="c.path"
          class="component-card"
          :style="{ '--component-index': index, '--component-color': c.color }"
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
  position: relative;
  overflow: hidden;
  background: rgba(245, 249, 255, 0.7);
  backdrop-filter: blur(8px);
  border-radius: 24px;
  padding: 1.2rem;
  border: 1px solid rgba(37, 99, 235, 0.12);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease, background 0.25s ease, box-shadow 0.3s ease;
  animation: component-rise 0.48s calc(var(--component-index) * 70ms) cubic-bezier(0.16, 1, 0.3, 1) both;
}

.component-card::after {
  content: '';
  position: absolute;
  width: 130px;
  height: 130px;
  right: -85px;
  bottom: -90px;
  border-radius: 50%;
  background: var(--component-color);
  opacity: 0.08;
  transition: transform 0.42s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
}

.component-card:hover {
  transform: translateY(-7px);
  border-color: color-mix(in srgb, var(--component-color) 62%, transparent);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 16px 30px -18px var(--component-color);
}

.component-card:hover::after {
  opacity: 0.14;
  transform: scale(1.75);
}

.component-card:hover .cover .el-icon {
  transform: rotate(-7deg) scale(1.1);
}

.cover {
  position: relative;
  z-index: 1;
  height: 100px;
  border-radius: 14px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.9rem;
}

.cover .el-icon {
  transition: transform 0.34s cubic-bezier(0.16, 1, 0.3, 1);
}

.component-card h3,
.component-card .desc {
  position: relative;
  z-index: 1;
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

@keyframes component-rise {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
