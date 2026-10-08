<script setup>
import { ref, computed } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { getPosts, getAllTags } from '../utils/posts'

const posts = getPosts()
const allTags = getAllTags()

const keyword = ref('')
const activeTag = ref('')

const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  return posts.filter((p) => {
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
      <h2 class="page-title">随笔</h2>
      <div class="section-sub">分享思考与笔记</div>

      <!-- 搜索 -->
      <el-input
        v-model="keyword"
        placeholder="搜索随笔…"
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

      <el-empty v-if="filtered.length === 0" description="没有找到相关随笔" />

      <router-link
        v-for="p in filtered"
        :key="p.slug"
        :to="'/blog/' + p.slug"
        class="post-card"
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
    </div>
  </div>
</template>

<style scoped>
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

.post-card {
  display: block;
  text-decoration: none;
  background: rgba(245, 249, 255, 0.7);
  backdrop-filter: blur(8px);
  border-radius: 20px;
  padding: 1.1rem 1.3rem;
  border: 1px solid rgba(37, 99, 235, 0.12);
  transition: 0.25s;
  margin-bottom: 1rem;
}

.post-card:hover {
  border-color: var(--accent);
  background: rgba(37, 99, 235, 0.12);
  transform: translateY(-2px);
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
