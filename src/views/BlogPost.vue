<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, Printer } from '@element-plus/icons-vue'
import { getPost, getPosts, renderMarkdown, renderPrintableHtml } from '../utils/posts'

const route = useRoute()
const post = computed(() => getPost(route.params.slug))
const rendered = computed(() =>
  post.value ? renderMarkdown(post.value.content) : { html: '', toc: [] }
)

function scrollTo(slug) {
  const el = document.getElementById(slug)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/* ---------- 导出 / 打印：打开自包含文档并触发打印 ---------- */
function exportPrint() {
  if (!post.value) return
  // 带上页面里已经渲染好的 Mermaid 图表，避免打印稿只剩源码
  const mermaidHtml = [...document.querySelectorAll('.post-content .mermaid')].map(
    (el) => el.innerHTML
  )
  const doc = renderPrintableHtml(post.value, mermaidHtml)
  const w = window.open('', '_blank')
  if (!w) {
    // 被拦截时退化为直接下载 HTML 文件
    const blob = new Blob([doc], { type: 'text/html' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${post.value.slug}.html`
    a.click()
    URL.revokeObjectURL(a.href)
    return
  }
  w.document.open()
  w.document.write(doc)
  w.document.close()
}

/* ---------- 相关文章：按共享标签数排序 ---------- */
const related = computed(() => {
  const cur = post.value
  if (!cur) return []
  const tags = new Set(cur.tags || [])
  return getPosts()
    .filter((p) => p.slug !== cur.slug)
    .map((p) => ({
      post: p,
      score: (p.tags || []).filter((t) => tags.has(t)).length,
    }))
    .sort((a, b) => b.score - a.score || String(b.post.date).localeCompare(String(a.post.date)))
    .slice(0, 3)
    .map((x) => x.post)
})

/* ---------- 阅读进度条 / 目录高亮 ---------- */
const progress = ref(0)
const activeSlug = ref('')
let scrollEl = null

function updateActiveHeading() {
  if (!scrollEl) return
  const toc = rendered.value.toc
  if (!toc.length) {
    activeSlug.value = ''
    return
  }

  // 标题进入屏幕中间区域时切换高亮
  const line = scrollEl.getBoundingClientRect().top + scrollEl.clientHeight * 0.5
  let current = ''

  for (const h of toc) {
    const el = document.getElementById(h.slug)
    if (!el) continue
    if (el.getBoundingClientRect().top <= line) current = h.slug
    else break
  }

  // 滚到底部时高亮最后一个小节
  if (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 4) {
    current = toc[toc.length - 1].slug
  }

  activeSlug.value = current
}

function onScroll() {
  if (!scrollEl) return
  const max = scrollEl.scrollHeight - scrollEl.clientHeight
  progress.value = max > 0 ? Math.min(100, (scrollEl.scrollTop / max) * 100) : 0
  updateActiveHeading()
}


/* ---------- 代码复制 / 图片灯箱 ---------- */
const articleRef = ref(null)
const lightboxSrc = ref('')

async function copyCode(btn) {
  const code = btn.closest('.code-block')?.querySelector('pre code')
  if (!code) return
  try {
    await navigator.clipboard.writeText(code.innerText)
    btn.textContent = '已复制'
    setTimeout(() => (btn.textContent = '复制'), 1500)
  } catch {
    btn.textContent = '复制失败'
    setTimeout(() => (btn.textContent = '复制'), 1500)
  }
}

function onArticleClick(e) {
  const copy = e.target.closest('.code-copy')
  if (copy) {
    copyCode(copy)
    return
  }
  const img = e.target.closest('img')
  if (img && articleRef.value?.contains(img)) {
    lightboxSrc.value = img.src
  }
}

function onKeydown(e) {
  if (e.key === 'Escape') lightboxSrc.value = ''
}

// mermaid 体积很大（含 elk 布局引擎约 1.5MB），只有文章里真的用到图表时才动态加载
let mermaidInstance = null
async function getMermaid() {
  if (!mermaidInstance) {
    const { default: mermaid } = await import('mermaid')
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      // 脑图根节点（.section-root）的颜色取自 git0 / gitBranchLabel0，
      // 默认是深蓝底 + 深色字，在浅色卡片里看不清，改为深蓝底 + 白字。
      // cScale0 一并设置，兼容 neo look 下的 section--1 规则。
      themeVariables: {
        git0: '#1e3a8a',
        gitBranchLabel0: '#ffffff',
        cScale0: '#1e3a8a',
        cScaleLabel0: '#ffffff',
      },
    })
    mermaidInstance = mermaid
  }
  return mermaidInstance
}

// 把页面里的 .mermaid 占位节点渲染成真正的图表
async function renderMermaid() {
  const nodes = document.querySelectorAll('.mermaid')
  if (nodes.length === 0) return

  const mermaid = await getMermaid()
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
  scrollEl = document.querySelector('.content')
  await renderMermaid()
  scrollEl?.addEventListener('scroll', onScroll)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onScroll)
  onScroll()
})

onBeforeUnmount(() => {
  scrollEl?.removeEventListener('scroll', onScroll)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onScroll)
})

// 同一篇文章组件被复用时（切换 slug），重新渲染
watch(
  () => route.params.slug,
  async () => {
    lightboxSrc.value = ''
    activeSlug.value = ''
    await nextTick()
    scrollEl?.scrollTo({ top: 0 })
    await renderMermaid()
    onScroll()
  }
)
</script>

<template>
  <div class="page">
    <div class="page-card post-page">
      <!-- 阅读进度条 -->
      <div class="read-progress">
        <span :style="{ width: progress + '%' }"></span>
      </div>

      <div class="post-toolbar">
        <router-link to="/blog" class="back">
          <el-icon><ArrowLeft /></el-icon>
          <span>返回随笔</span>
        </router-link>
        <button v-if="post" class="print-btn" @click="exportPrint">
          <el-icon><Printer /></el-icon>
          <span>导出 / 打印</span>
        </button>
      </div>

      <template v-if="post">
        <h2 class="post-title">{{ post.title }}</h2>
        <div class="post-meta">
          <span class="post-type">{{ post.type === 'note' ? '笔记' : '杂谈' }}</span>
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
          <article
            ref="articleRef"
            class="post-content"
            v-html="rendered.html"
            @click="onArticleClick"
          ></article>

          <aside v-if="rendered.toc.length" class="post-toc">
            <div class="toc-title">目录</div>
            <a
              v-for="h in rendered.toc"
              :key="h.slug"
              :href="'#' + h.slug"
              class="toc-link"
              :class="['toc-level-' + h.level, { active: activeSlug === h.slug }]"
              @click.prevent="scrollTo(h.slug)"
            >
              {{ h.text }}
            </a>
          </aside>
        </div>

        <!-- 相关文章 -->
        <section v-if="related.length" class="related">
          <h3 class="related-title">相关随笔</h3>
          <div class="related-list">
            <router-link
              v-for="p in related"
              :key="p.slug"
              :to="'/blog/' + p.slug"
              class="related-item"
            >
              <span class="related-date">{{ p.date }}</span>
              <span class="related-name">{{ p.title }}</span>
            </router-link>
          </div>
        </section>
      </template>

      <el-empty v-else description="随笔不存在" />
    </div>

    <!-- 图片灯箱 -->
    <teleport to="body">
      <div v-if="lightboxSrc" class="lightbox" @click="lightboxSrc = ''">
        <img :src="lightboxSrc" alt="" @click.stop />
      </div>
    </teleport>
  </div>
</template>

<style scoped>
/* 阅读模式：整页铺开，无卡片边框 */
.page {
  flex-direction: column;
  align-items: center;
}

.post-page {
  width: 67%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.post-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.2rem;
}

.post-toolbar .back {
  margin-bottom: 0;
}

.print-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0.45rem 1rem 0.45rem 0.85rem;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--accent);
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 60px;
  transition: 0.25s;
}

.print-btn:hover {
  color: #fff;
  background: var(--accent);
  border-color: var(--accent);
  box-shadow: 0 6px 16px -6px rgba(37, 99, 235, 0.5);
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

.post-type {
  padding: 0.1rem 0.55rem;
  font-size: 0.66rem;
  font-weight: 700;
  color: var(--accent);
  background: rgba(37, 99, 235, 0.09);
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 20px;
}

/* 正文保持 67% 居中；目录固定在视口最右侧，不参与这 67% */
.post-layout {
  display: block;
}

.post-content {
  width: 100%;
  min-width: 0;
}

/* 目录：无卡片边框，只用一条细线与正文分隔 */
.post-toc {
  position: fixed;
  top: 9rem;
  right: 2.2rem;
  width: clamp(150px, 12vw, 200px);
  max-height: calc(100vh - 10rem);
  overflow-y: auto;
  padding: 0 0 0 1.1rem;
  background: transparent;
  border: none;
  border-left: 1px solid rgba(37, 99, 235, 0.18);
  border-radius: 0;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* 目录滚动条：与页面滚动条一致的细蓝色圆角样式 */
.post-toc::-webkit-scrollbar {
  width: 5px;
}
.post-toc::-webkit-scrollbar-thumb {
  background: var(--accent);
  border-radius: 10px;
}
.post-toc::-webkit-scrollbar-track {
  background: transparent;
}

.toc-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-dark);
  margin-bottom: 0.5rem;
}

.toc-link {
  display: block;
  padding: 0.18rem 0.35rem;
  font-size: 0.8rem;
  color: #aab6c8;
  text-decoration: none;
  line-height: 1.4;
  border-radius: 6px;
  transition: color 0.18s, background 0.18s;
}

.toc-link:hover {
  color: #7c8aa3;
}

/* 当前阅读到的小节：蓝色高亮 */
.toc-link.active {
  color: var(--accent);
  font-weight: 700;
  background: rgba(37, 99, 235, 0.08);
}

.toc-level-1 {
  padding-left: 0.35rem;
  font-size: 0.84rem;
  font-weight: 700;
}
.toc-level-2 {
  padding-left: 1em;
  font-size: 0.76rem;
  font-weight: 600;
}
.toc-level-3 {
  padding-left: 2em;
  font-size: 0.7rem;
}
.toc-level-4 {
  padding-left: 3em;
  font-size: 0.65rem;
}
.toc-level-5 {
  padding-left: 4em;
  font-size: 0.62rem;
}
.toc-level-6 {
  padding-left: 5em;
  font-size: 0.6rem;
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

/* 配图 */
.post-content :deep(figure) {
  margin: 1.5em 0;
  text-align: center;
}

.post-content :deep(figure img) {
  max-width: 100%;
  border-radius: 12px;
  border: 1px solid rgba(37, 99, 235, 0.12);
  box-shadow: 0 10px 26px -18px rgba(30, 60, 110, 0.55);
}

.post-content :deep(figcaption) {
  margin-top: 0.55em;
  font-size: 0.72rem;
  line-height: 1.65;
  color: var(--text-dim);
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

/* 伪代码块：```pseudocode 渲染的带行号 + 关键字高亮代码 */
.post-content :deep(.pseudocode) {
  margin: 1.2em 0;
  background: #f5f8fc;
  border: 1px solid rgba(37, 99, 235, 0.12);
  border-left: 4px solid var(--accent);
  border-radius: 12px;
  padding: 0.9em 1.1em;
  overflow-x: auto;
}

.post-content :deep(.pc-line) {
  display: flex;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 0.85rem;
  line-height: 1.7;
}

.post-content :deep(.pc-no) {
  flex-shrink: 0;
  width: 2em;
  margin-right: 1em;
  text-align: right;
  color: rgba(37, 99, 235, 0.45);
  user-select: none;
}

.post-content :deep(.pc-line code) {
  white-space: pre-wrap;
  color: var(--text-dark);
  background: none;
  padding: 0;
  font-family: inherit;
  font-size: inherit;
}

.post-content :deep(.pc-kw) {
  color: #7c3aed;
  font-weight: 700;
}

.post-content :deep(.pc-op) {
  color: var(--accent);
  font-weight: 600;
}

/* 伪代码标题栏：算法名 + 输入 / 输出 */
.post-content :deep(.pc-head) {
  padding-bottom: 0.7em;
  margin-bottom: 0.7em;
  border-bottom: 1px dashed rgba(37, 99, 235, 0.25);
}

.post-content :deep(.pc-title) {
  font-weight: 800;
  font-size: 0.95rem;
  color: var(--text-dark);
  margin-bottom: 0.35em;
}

.post-content :deep(.pc-meta) {
  font-size: 0.8rem;
  color: var(--text-dim);
  line-height: 1.7;
}

.post-content :deep(.pc-meta-label) {
  color: var(--accent);
  font-weight: 600;
}

/* 伪代码注解区 */
.post-content :deep(.pc-note) {
  margin-top: 0.7em;
  padding-top: 0.7em;
  border-top: 1px dashed rgba(37, 99, 235, 0.25);
}

.post-content :deep(.pc-note-line) {
  font-size: 0.8rem;
  color: var(--text-dim);
  line-height: 1.7;
}

/* KaTeX 块级公式：居中、可横向滚动 */
.post-content :deep(.katex-display) {
  display: block;
  margin: 1.2em 0;
  padding: 0.4em 0;
  text-align: center;
  overflow-x: auto;
  overflow-y: hidden;
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

/* 脑图根节点：强制白字，避免主题变量失效时和深色圆底混在一起。
   Mermaid 的 markdown 标签是 <span class="nodeLabel"><p>…</p></span>，
   而 .post-content p 会给里面的 <p> 直接上深色，所以必须连 p/div 一起覆盖。 */
.post-content :deep(.mermaid svg .section-root text),
.post-content :deep(.mermaid svg .section-root span),
.post-content :deep(.mermaid svg .section-root p),
.post-content :deep(.mermaid svg .section-root div),
.post-content :deep(.mermaid svg .section-root .mindmap-node-label) {
  fill: #ffffff !important;
  color: #ffffff !important;
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

/* 折叠块：```fold 标题 ... ```，点击标题栏展开/收起 */
.post-content :deep(.fold) {
  margin: 1em 0;
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 12px;
  background: rgba(245, 249, 255, 0.65);
  backdrop-filter: blur(8px);
  overflow: hidden;
  width: fit-content;
  max-width: 100%;
}

/* 展开时占满整行 */
.post-content :deep(.fold.open) {
  width: 100%;
}

.post-content :deep(.fold-head) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5em;
  padding: 0.42em 1.1em;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-dark);
  background: transparent;
  border: none;
  user-select: none;
  transition: background 0.2s;
}

.post-content :deep(.fold-head:hover) {
  background: rgba(37, 99, 235, 0.08);
}

.post-content :deep(.fold-arrow) {
  display: none;
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--accent);
  border-bottom: 2px solid var(--accent);
  flex-shrink: 0;
}

/* 展开态：文字靠左，右侧显示 ▾ 箭头 */
.post-content :deep(.fold.open .fold-head) {
  justify-content: space-between;
}

.post-content :deep(.fold.open .fold-arrow) {
  display: block;
  transform: rotate(45deg);
}

/* 收起时正文彻底隐藏（不占宽高），展开时淡入 */
.post-content :deep(.fold-body) {
  display: none;
}

.post-content :deep(.fold.open .fold-body) {
  display: block;
  animation: fold-in 0.25s ease;
}

.post-content :deep(.fold-inner) {
  padding: 0.2em 1.1em 0.9em;
  color: var(--text-dark);
}

@keyframes fold-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 外链按钮：正文里的 http(s) 链接显示为按钮 */
.post-content :deep(a[href^="http"]) {
  display: inline-block;
  padding: 0.4em 1em;
  margin: 0.1em 0;
  border-radius: 60px;
  background: rgba(37, 99, 235, 0.1);
  border: 1px solid rgba(37, 99, 235, 0.3);
  color: var(--accent);
  font-weight: 600;
  font-size: 0.9rem;
  text-decoration: none;
  transition: 0.2s;
}

.post-content :deep(a[href^="http"]:hover) {
  background: var(--accent);
  color: #fff;
}

/* ===== 阅读进度条 ===== */
.read-progress {
  position: sticky;
  top: 0;
  z-index: 20;
  width: 100%;
  height: 3px;
  margin: 0 0 1.4rem;
  background: rgba(37, 99, 235, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.read-progress span {
  display: block;
  height: 100%;
  width: 0;
  background: linear-gradient(90deg, #60a5fa, #2563eb);
  transition: width 0.1s linear;
}

/* ===== 代码块：语言标签 + 复制 + 行号 ===== */
.post-content :deep(.code-block) {
  margin: 1.2em 0;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(37, 99, 235, 0.14);
  background: #eef2f8;
}

.post-content :deep(.code-head) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35em 0.9em;
  background: rgba(37, 99, 235, 0.07);
  border-bottom: 1px solid rgba(37, 99, 235, 0.1);
}

.post-content :deep(.code-lang) {
  font-family: monospace;
  font-size: 0.7rem;
  color: var(--accent);
  text-transform: lowercase;
}

.post-content :deep(.code-copy) {
  font-family: inherit;
  font-size: 0.68rem;
  padding: 0.15em 0.65em;
  color: var(--accent);
  background: #fff;
  border: 1px solid rgba(37, 99, 235, 0.25);
  border-radius: 6px;
  transition: 0.2s;
}

.post-content :deep(.code-copy:hover) {
  background: var(--accent);
  color: #fff;
}

.post-content :deep(.code-block pre.hljs) {
  margin: 0;
  padding: 0.9em 1.1em;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
  counter-reset: code-line;
}

.post-content :deep(.code-line) {
  display: block;
}

.post-content :deep(.code-line)::before {
  counter-increment: code-line;
  content: counter(code-line);
  display: inline-block;
  width: 2em;
  margin-right: 1em;
  text-align: right;
  color: rgba(37, 99, 235, 0.32);
  user-select: none;
}

/* ===== 相关文章 ===== */
.related {
  margin-top: 2rem;
  padding-top: 1.2rem;
  border-top: 1px dashed rgba(37, 99, 235, 0.2);
}

.related-title {
  font-size: 0.9rem;
  color: var(--text-dark);
  margin-bottom: 0.7rem;
}

.related-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.related-item {
  display: flex;
  align-items: baseline;
  gap: 0.8rem;
  padding: 0.5rem 0.8rem;
  border-radius: 10px;
  text-decoration: none;
  background: rgba(245, 249, 255, 0.7);
  border: 1px solid rgba(37, 99, 235, 0.1);
  transition: 0.2s;
}

.related-item:hover {
  border-color: var(--accent);
  background: rgba(37, 99, 235, 0.08);
}

.related-date {
  flex-shrink: 0;
  font-size: 0.68rem;
  font-family: monospace;
  color: var(--text-dim);
}

.related-name {
  font-size: 0.82rem;
  color: var(--text-dark);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== 图片灯箱 ===== */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4vh 4vw;
  background: rgba(10, 20, 40, 0.82);
  backdrop-filter: blur(6px);
  cursor: zoom-out;
  animation: lightbox-in 0.2s ease;
}

.lightbox img {
  max-width: 100%;
  max-height: 92vh;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  cursor: default;
}

@keyframes lightbox-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 手机端：目录移到正文上方 */
@media (max-width: 800px) {
  .post-layout {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .post-toc {
    width: 100%;
    position: static;
    max-height: none;
    overflow: visible;
    order: -1;
    padding: 0 0 0.8rem;
    border-left: none;
    border-bottom: 1px solid rgba(37, 99, 235, 0.18);
  }
  .post-page,
  .read-progress {
    width: 100%;
  }
  .read-progress {
    margin: 0 0 1rem;
  }
}
</style>
