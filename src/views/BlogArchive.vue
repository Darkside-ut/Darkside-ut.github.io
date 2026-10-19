<script setup>
import { computed } from 'vue'
import { ArrowLeft } from '@element-plus/icons-vue'
import { getPosts } from '../utils/posts'

const posts = getPosts()

// 按年份分组，组内保持按日期倒序
const years = computed(() => {
  const map = new Map()
  for (const p of posts) {
    const year = (p.date || '').slice(0, 4) || '未标注日期'
    if (!map.has(year)) map.set(year, [])
    map.get(year).push(p)
  }
  return [...map.entries()]
})

function monthDay(date) {
  return (date || '').slice(5) || '--'
}
</script>

<template>
  <div class="page">
    <div class="page-card archive-page">
      <router-link to="/blog" class="back">
        <el-icon><ArrowLeft /></el-icon>
        <span>返回随笔</span>
      </router-link>

      <h2 class="page-title">归档</h2>
      <div class="section-sub">共 {{ posts.length }} 篇随笔</div>

      <el-empty v-if="!posts.length" description="还没有随笔" />

      <div v-for="[year, list] in years" :key="year" class="year-group">
        <div class="year-head">
          <span class="year-num">{{ year }}</span>
          <span class="year-count">{{ list.length }} 篇</span>
        </div>

        <router-link
          v-for="p in list"
          :key="p.slug"
          :to="'/blog/' + p.slug"
          class="archive-item"
        >
          <span class="archive-date">{{ monthDay(p.date) }}</span>
          <span class="archive-title">{{ p.title }}</span>
          <span v-if="p.tags && p.tags.length" class="archive-tags">
            {{ p.tags.join(' · ') }}
          </span>
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.archive-page {
  max-width: 760px;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 1.2rem;
  padding: 0.45rem 1rem 0.45rem 0.85rem;
  color: var(--text-dim);
  font-size: 0.85rem;
  font-weight: 500;
  background: rgba(245, 249, 255, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(37, 99, 235, 0.16);
  border-radius: 60px;
  transition: 0.25s;
}

.back:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(37, 99, 235, 0.12);
  transform: translateX(-3px);
}

.year-group {
  margin-bottom: 1.8rem;
}

.year-head {
  display: flex;
  align-items: baseline;
  gap: 0.7rem;
  padding-bottom: 0.5rem;
  margin-bottom: 0.6rem;
  border-bottom: 1px solid rgba(37, 99, 235, 0.15);
}

.year-num {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-dark);
  letter-spacing: -0.02em;
}

.year-count {
  font-size: 0.68rem;
  color: var(--text-dim);
}

.archive-item {
  display: flex;
  align-items: baseline;
  gap: 0.9rem;
  padding: 0.5rem 0.7rem;
  border-radius: 10px;
  text-decoration: none;
  transition: 0.18s;
}

.archive-item:hover {
  background: rgba(37, 99, 235, 0.08);
}

.archive-date {
  flex-shrink: 0;
  width: 2.6em;
  font-size: 0.7rem;
  font-family: monospace;
  color: var(--text-dim);
}

.archive-title {
  flex: 1;
  min-width: 0;
  font-size: 0.85rem;
  color: var(--text-dark);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.archive-item:hover .archive-title {
  color: var(--accent);
}

.archive-tags {
  flex-shrink: 0;
  font-size: 0.66rem;
  color: #9aa8c0;
}

@media (max-width: 560px) {
  .archive-tags {
    display: none;
  }
}
</style>
