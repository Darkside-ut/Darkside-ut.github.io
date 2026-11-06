<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChatLineRound, Notebook, Search } from '@element-plus/icons-vue'
import { getPosts } from '../utils/posts'

const posts = getPosts()
const route = useRoute()
const router = useRouter()

// 两个分类：杂谈 / 笔记
const TYPES = [
  {
    value: 'essay',
    label: '杂谈',
    desc: '分享思考与生活',
    color: '#8b5cf6',
    icon: ChatLineRound,
  },
  {
    value: 'note',
    label: '笔记',
    desc: '课程与学习笔记',
    color: '#2563eb',
    icon: Notebook,
  },
]

const activeType = ref(route.query.type === 'note' ? 'note' : 'essay')
const keyword = ref('')
const activeTag = ref('')

const typedPosts = computed(() => posts.filter((p) => p.type === activeType.value))

const activeMeta = computed(
  () => TYPES.find((t) => t.value === activeType.value) || TYPES[0]
)

// 分类卡片：数量 + 最近一篇
const typeCards = computed(() =>
  TYPES.map((t) => {
    const list = posts.filter((p) => p.type === t.value)
    return {
      ...t,
      count: list.length,
      latest: list[0] || null,
    }
  })
)

// 标签只展示当前分类下的
const allTags = computed(
  () => [...new Set(typedPosts.value.flatMap((p) => p.tags || []))]
)

function setType(type) {
  if (type === activeType.value) return
  activeType.value = type
  activeTag.value = ''
  router.replace({ query: { ...route.query, type } })
}

// 浏览器前进/后退时同步分类
watch(
  () => route.query.type,
  (t) => {
    const next = t === 'note' ? 'note' : 'essay'
    if (next !== activeType.value) {
      activeType.value = next
      activeTag.value = ''
    }
  }
)

const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  return typedPosts.value.filter((p) => {
    const matchTag = !activeTag.value || (p.tags || []).includes(activeTag.value)
    const matchKw =
      !k ||
      (p.title || '').toLowerCase().includes(k) ||
      (p.summary || '').toLowerCase().includes(k) ||
      (p.content || '').toLowerCase().includes(k)
    return matchTag && matchKw
  })
})
</script>

<template>
  <div class="page">
    <div class="page-card">
      <div class="blog-head">
        <div>
          <h2 class="page-title">随笔</h2>
          <div class="section-sub">{{ activeMeta.desc }}</div>
        </div>
        <router-link to="/blog/archive" class="archive-link">归档 →</router-link>
      </div>

      <!-- 分类选择 -->
      <div class="type-cards">
        <button
          v-for="t in typeCards"
          :key="t.value"
          type="button"
          class="type-card"
          :class="{ active: activeType === t.value }"
          :style="{ '--tc': t.color }"
          @click="setType(t.value)"
        >
          <span class="tc-icon">
            <el-icon><component :is="t.icon" /></el-icon>
          </span>
          <span class="tc-main">
            <span class="tc-head">
              <span class="tc-name">{{ t.label }}</span>
              <span class="tc-count">{{ t.count }} 篇</span>
            </span>
            <span class="tc-desc">{{ t.desc }}</span>
            <span class="tc-latest">
              {{ t.latest ? '最近：' + t.latest.title : '还没有内容' }}
            </span>
          </span>
          <span class="tc-state">{{ activeType === t.value ? '当前分类' : '查看' }}</span>
        </button>
      </div>

      <!-- 搜索 -->
      <el-input
        v-model="keyword"
        :placeholder="`在${activeMeta.label}中搜索…`"
        clearable
        class="search-box"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <!-- 标签筛选 -->
      <div v-if="allTags.length" class="tag-filter">
        <el-tag
          :effect="activeTag === '' ? 'dark' : 'plain'"
          class="tag"
          :class="{ active: activeTag === '' }"
          @click="activeTag = ''"
        >
          全部
        </el-tag>
        <el-tag
          v-for="t in allTags"
          :key="t"
          :effect="activeTag === t ? 'dark' : 'plain'"
          class="tag"
          :class="{ active: activeTag === t }"
          @click="activeTag = t"
        >
          {{ t }}
        </el-tag>
      </div>

      <el-empty
        v-if="filtered.length === 0"
        :description="keyword || activeTag ? '没有找到相关内容' : `还没有${activeMeta.label}`"
      />

      <TransitionGroup name="post-list" tag="div" class="post-list">
        <router-link
          v-for="(p, index) in filtered"
          :key="p.slug"
          :to="'/blog/' + p.slug"
          class="post-card"
          :style="{ '--post-index': index }"
        >
          <div class="post-date">{{ p.date }}</div>
          <h3>{{ p.title }}</h3>
          <p v-if="p.summary" class="summary">{{ p.summary }}</p>
          <div v-if="p.tags && p.tags.length" class="post-tags">
            <el-tag v-for="t in p.tags" :key="t" size="small" type="info" effect="plain">
              {{ t }}
            </el-tag>
          </div>
        </router-link>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
.blog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.archive-link {
  flex-shrink: 0;
  margin-top: 0.4rem;
  padding: 0.35rem 0.9rem;
  font-size: 0.76rem;
  color: var(--accent);
  text-decoration: none;
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 20px;
  transition: 0.2s;
}

.archive-link:hover {
  background: var(--accent);
  color: #fff;
}

/* ===== 分类选择卡片 ===== */
.type-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
  margin-bottom: 1.4rem;
}

.type-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 1rem 4.6rem 1rem 1.05rem;
  font-family: inherit;
  text-align: left;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(37, 99, 235, 0.12);
  border-radius: 18px;
  overflow: hidden;
  transition: 0.22s;
}

.type-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--tc);
  opacity: 0;
  transition: opacity 0.22s;
  pointer-events: none;
}

.type-card:hover {
  transform: translateY(-2px);
  border-color: var(--tc);
  box-shadow: 0 10px 24px -16px var(--tc);
}

.type-card:hover::before {
  opacity: 0.04;
}

.type-card.active {
  border-color: var(--tc);
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 10px 26px -14px var(--tc);
}

.type-card.active::before {
  opacity: 0.07;
}

.tc-icon {
  position: relative;
  flex-shrink: 0;
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  color: #fff;
  background: var(--tc);
  border-radius: 14px;
  box-shadow: 0 8px 18px -10px var(--tc);
}

.tc-main {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.16rem;
}

.tc-head {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
}

.tc-name {
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-dark);
}

.tc-count {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--tc);
  font-variant-numeric: tabular-nums;
}

.tc-desc {
  font-size: 0.72rem;
  color: var(--text-dim);
}

.tc-latest {
  margin-top: 0.2rem;
  font-size: 0.66rem;
  color: #9aa8c0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tc-state {
  position: absolute;
  top: 0.75rem;
  right: 0.85rem;
  padding: 0.12rem 0.5rem;
  font-size: 0.6rem;
  font-weight: 600;
  color: #9aa8c0;
  background: rgba(148, 163, 184, 0.12);
  border-radius: 20px;
}

.type-card.active .tc-state {
  color: #fff;
  background: var(--tc);
}

@media (max-width: 620px) {
  .type-cards {
    grid-template-columns: 1fr;
  }
}

.search-box {
  max-width: 360px;
  margin-bottom: 1rem;
}

.tag-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.4rem;
}

.tag {
  cursor: url('/cursor/pointer.cur'), pointer;
}

.post-list {
  position: relative;
}

.post-list-move,
.post-list-enter-active,
.post-list-leave-active {
  transition: opacity 0.28s ease, transform 0.34s cubic-bezier(0.16, 1, 0.3, 1);
}

.post-list-enter-active {
  transition-delay: calc(var(--post-index, 0) * 35ms);
}

.post-list-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.985);
}

.post-list-leave-to {
  opacity: 0;
  transform: translateX(12px) scale(0.985);
}

.post-list-leave-active {
  position: absolute;
  width: 100%;
}

.post-card {
  position: relative;
  display: block;
  overflow: hidden;
  text-decoration: none;
  background: rgba(245, 249, 255, 0.7);
  backdrop-filter: blur(8px);
  border-radius: 20px;
  padding: 1.1rem 1.3rem;
  border: 1px solid rgba(37, 99, 235, 0.12);
  transition: 0.25s;
  margin-bottom: 1rem;
}

.post-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 18%;
  bottom: 18%;
  width: 3px;
  border-radius: 0 4px 4px 0;
  background: linear-gradient(#60a5fa, #2563eb);
  transform: scaleY(0);
  transform-origin: center;
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.post-card:hover {
  border-color: var(--accent);
  background: rgba(37, 99, 235, 0.12);
  transform: translateY(-3px) translateX(2px);
  box-shadow: 0 14px 26px -22px rgba(30, 64, 175, 0.52);
}

.post-card:hover::before {
  transform: scaleY(1);
}

.post-date {
  font-size: 0.72rem;
  color: var(--text-dim);
  margin-bottom: 0.4rem;
}

.post-card h3 {
  margin: 0 0 0.4rem;
  color: var(--text-dark);
}

.summary {
  font-size: 0.85rem;
  color: var(--text-dim);
  line-height: 1.6;
  margin: 0 0 0.6rem;
}

.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
</style>
