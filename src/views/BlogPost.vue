<script setup>
import { computed, onMounted, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import mermaid from 'mermaid'
import { getPost, renderMarkdown } from '../utils/posts'

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
})

const route = useRoute()
const post = computed(() => getPost(route.params.slug))
const rendered = computed(() =>
  post.value ? renderMarkdown(post.value.content) : { html: '', toc: [] }
)

function scrollTo(slug) {
  const el = document.getElementById(slug)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// 把页面里的 .mermaid 占位节点渲染成真正的图表
async function renderMermaid() {
  const nodes = document.querySelectorAll('.mermaid')
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i]
    const code = (el.textContent || '').trim()
    if (!code) continue
    try {
      const { svg } = await mermaid.render(`mermaid-${Date.now()}-${i}`, code)
      el.innerHTML = svg
    } catch (e) {
      el.textContent = '（Mermaid 图表渲染失败）'
    }
  }
}

onMounted(async () => {
  await nextTick()
  renderMermaid()
})

// 同一篇文章组件被复用时（切换 slug），重新渲染
watch(
  () => route.params.slug,
  async () => {
    await nextTick()
    renderMermaid()
  }
)
</script>

<template>
  <div class="page">
    <div class="page-card post-page">
      <router-link to="/blog" class="back">
        <el-icon><ArrowLeft /></el-icon>
        <span>返回随笔</span>
      </router-link>

      <template v-if="post">
        <h2 class="post-title">{{ post.title }}</h2>
        <div class="post-meta">
          <span class="post-date">{{ post.date }}</span>
          <el-tag
            v-for="t in post.tags || []"
            :key="t"
            size="small"
            type="info"
            effect="plain"
          >
            {{ t }}
          </el-tag>
        </div>

        <div class="post-layout">
          <article class="post-content" v-html="rendered.html"></article>

          <aside v-if="rendered.toc.length" class="post-toc">
            <div class="toc-title">目录</div>
            <a
              v-for="h in rendered.toc"
              :key="h.slug"
              :href="'#' + h.slug"
              class="toc-link"
              :class="'toc-level-' + h.level"
              @click.prevent="scrollTo(h.slug)"
            >
              {{ h.text }}
            </a>
          </aside>
        </div>
      </template>

      <el-empty v-else description="随笔不存在" />
    </div>
  </div>
</template>

<style scoped>
.post-page {
  max-width: 1000px;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 1.2rem;
  padding: 0.45rem 1rem 0.45rem 0.85rem;
  color: var(--text-dim);
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 500;
  background: rgba(245, 249, 255, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(37, 99, 235, 0.16);
  border-radius: 60px;
  transition: 0.25s;
}

.back .el-icon {
  font-size: 1rem;
  transition: 0.25s;
}

.back:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(37, 99, 235, 0.12);
  transform: translateX(-3px);
}

.back:hover .el-icon {
  transform: translateX(-2px);
}

.post-title {
  font-size: 1.9rem;
  font-weight: 800;
  color: var(--text-dark);
  margin: 0 0 0.6rem;
  line-height: 1.25;
}

.post-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.6rem;
}

.post-date {
  font-size: 0.8rem;
  color: var(--text-dim);
}

.post-layout {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
}

.post-content {
  flex: 1;
  min-width: 0;
}

/* 目录 */
.post-toc {
  width: 220px;
  flex-shrink: 0;
  position: sticky;
  top: 1rem;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  background: rgba(245, 249, 255, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(37, 99, 235, 0.12);
  border-radius: 16px;
  padding: 1rem;
}

.toc-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-dark);
  margin-bottom: 0.6rem;
}

.toc-link {
  display: block;
  padding: 0.25rem 0;
  font-size: 0.8rem;
  color: var(--text-dim);
  text-decoration: none;
  line-height: 1.4;
  transition: 0.15s;
}

.toc-link:hover {
  color: var(--accent);
}

.toc-level-2 {
  padding-left: 0;
}
.toc-level-3 {
  padding-left: 14px;
}
.toc-level-4 {
  padding-left: 28px;
}

/* Markdown 正文样式（v-html 内容） */
.post-content :deep(h1),
.post-content :deep(h2),
.post-content :deep(h3),
.post-content :deep(h4) {
  color: var(--text-dark);
  line-height: 1.3;
  margin: 1.6em 0 0.6em;
}

.post-content :deep(h2) {
  font-size: 1.35rem;
  padding-bottom: 0.3em;
  border-bottom: 1px solid rgba(37, 99, 235, 0.2);
}

.post-content :deep(h3) {
  font-size: 1.15rem;
}

.post-content :deep(p) {
  line-height: 1.8;
  color: var(--text-dark);
  margin: 0.8em 0;
}

.post-content :deep(a) {
  color: var(--accent);
}

.post-content :deep(ul),
.post-content :deep(ol) {
  padding-left: 1.5em;
  line-height: 1.8;
  color: var(--text-dark);
}

.post-content :deep(blockquote) {
  margin: 1em 0;
  padding: 0.5em 1em;
  border-left: 4px solid var(--accent);
  background: rgba(37, 99, 235, 0.08);
  border-radius: 0 10px 10px 0;
  color: var(--text-dim);
}

.post-content :deep(img) {
  max-width: 100%;
  border-radius: 12px;
}

.post-content :deep(code) {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 0.85em;
}

.post-content :deep(p code),
.post-content :deep(li code) {
  background: rgba(37, 99, 235, 0.1);
  color: #1e40af;
  padding: 0.15em 0.4em;
  border-radius: 5px;
}

.post-content :deep(pre.hljs) {
  padding: 1em 1.2em;
  border-radius: 12px;
  overflow-x: auto;
  line-height: 1.6;
  margin: 1em 0;
  font-size: 0.85rem;
  background: #eef2f8;
  box-shadow:
    inset 0 2px 6px rgba(23, 35, 61, 0.1),
    inset 0 0 0 1px rgba(23, 35, 61, 0.05);
}

/* Mermaid 图表 */
.post-content :deep(.mermaid) {
  display: flex;
  justify-content: center;
  margin: 1.2em 0;
  padding: 1em;
  overflow-x: auto;
  background: #f7fafd;
  border: 1px solid rgba(37, 99, 235, 0.1);
  border-radius: 12px;
}

.post-content :deep(.mermaid svg) {
  max-width: 100%;
  height: auto;
}

.post-content :deep(table) {
  border-collapse: collapse;
  margin: 1em 0;
}

.post-content :deep(th),
.post-content :deep(td) {
  border: 1px solid rgba(37, 99, 235, 0.2);
  padding: 0.5em 0.9em;
}

.post-content :deep(th) {
  background: rgba(37, 99, 235, 0.08);
}

/* 手机端：目录移到正文上方 */
@media (max-width: 800px) {
  .post-layout {
    flex-direction: column;
  }
  .post-toc {
    width: 100%;
    position: static;
    max-height: none;
    order: -1;
  }
}
</style>
