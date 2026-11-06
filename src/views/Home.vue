<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowRight, Back, Box, Grid, Notebook } from '@element-plus/icons-vue'

const now = ref(new Date())
const descriptorIndex = ref(0)
const latestPost = ref(null)
const overviewReady = ref(false)

const descriptors = ['在代码里探索', '在笔记中沉淀', '在实践里成长', '把想法变成作品']

const quickLinks = [
  {
    title: '阅读随笔',
    desc: '学习记录、课程笔记与一些思考',
    path: '/blog',
    icon: Notebook,
    color: '#2563eb',
    index: '01',
  },
  {
    title: '查看作品',
    desc: '从想法、实现到持续打磨的项目',
    path: '/portfolio',
    icon: Grid,
    color: '#7c3aed',
    index: '02',
  },
  {
    title: '体验组件',
    desc: '日历、专注、词汇等实用小工具',
    path: '/components',
    icon: Box,
    color: '#0891b2',
    index: '03',
  },
]

const stats = ref([
  { value: '—', label: '篇随笔' },
  { value: '—', label: '份笔记' },
  { value: '—', label: '篇杂谈' },
])

const greeting = computed(() => {
  const hour = now.value.getHours()
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const timeText = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now.value)
)

const dateText = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(now.value)
)

let clockTimer = 0
let descriptorTimer = 0
let overviewIdle = 0

async function loadPostOverview() {
  try {
    // markdown 解析器比较大，首页首屏完成后再加载，不阻塞进入动画。
    const { getPosts } = await import('../utils/posts.js')
    const posts = getPosts()
    const notes = posts.filter((post) => post.type === 'note').length
    const essays = posts.filter((post) => post.type === 'essay').length
    stats.value = [
      { value: posts.length, label: '篇随笔' },
      { value: notes, label: '份笔记' },
      { value: essays, label: '篇杂谈' },
    ]
    latestPost.value = posts[0] || null
  } finally {
    overviewReady.value = true
  }
}

onMounted(() => {
  clockTimer = window.setInterval(() => (now.value = new Date()), 1000)
  descriptorTimer = window.setInterval(() => {
    descriptorIndex.value = (descriptorIndex.value + 1) % descriptors.length
  }, 2800)

  if ('requestIdleCallback' in window) {
    overviewIdle = window.requestIdleCallback(loadPostOverview, { timeout: 1800 })
  } else {
    overviewIdle = window.setTimeout(loadPostOverview, 600)
  }
})

onBeforeUnmount(() => {
  clearInterval(clockTimer)
  clearInterval(descriptorTimer)
  if ('cancelIdleCallback' in window) window.cancelIdleCallback(overviewIdle)
  else clearTimeout(overviewIdle)
})
</script>

<template>
  <div class="page home-page">
    <div class="page-card home-card">
      <header class="home-bar">
        <div class="presence" aria-label="当前在线">
          <span class="presence-dot"></span>
          <span>ONLINE</span>
          <span class="presence-separator"></span>
          <time :datetime="now.toISOString()">{{ timeText }}</time>
        </div>

        <router-link to="/" class="start-link">
          <el-icon><Back /></el-icon>
          <span>返回开始页</span>
        </router-link>
      </header>

      <section class="hero">
        <div class="hero-copy">
          <p class="hero-kicker">{{ greeting }}，欢迎来到我的数字空间</p>
          <h1>
            <span class="name-cn">王浩然</span>
            <span class="name-en">JIMSSS</span>
          </h1>

          <p class="hero-role" aria-label="计算机专业学生，持续学习与创造">
            <span>计算机专业学生 ·</span>
            <transition name="word-swap" mode="out-in">
              <strong :key="descriptorIndex">{{ descriptors[descriptorIndex] }}</strong>
            </transition>
          </p>

          <p class="intro-text">
            这里记录我做过的项目、学到的知识和仍在思考的问题。
            我相信好奇心让学习发生，而动手让想法真正落地。
          </p>

          <div class="hero-actions">
            <router-link to="/portfolio" class="primary-action">
              <span>看看我在做什么</span>
              <el-icon><ArrowRight /></el-icon>
            </router-link>
            <router-link to="/blog" class="secondary-action">开始阅读</router-link>
          </div>
        </div>

        <div class="hero-visual" aria-hidden="true">
          <span class="orbit orbit-outer"></span>
          <span class="orbit orbit-inner"></span>
          <span class="orbit-dot dot-one"></span>
          <span class="orbit-dot dot-two"></span>
          <div class="portrait">
            <span>J</span>
            <img src="/profile.jpg" alt="" @error="$event.currentTarget.remove()" />
          </div>
          <span class="tech-chip chip-vue">VUE</span>
          <span class="tech-chip chip-cs">CS</span>
          <span class="tech-chip chip-ustc">USTC</span>
        </div>
      </section>

      <section class="overview" aria-label="内容概览">
        <div class="stats-row" :class="{ ready: overviewReady }">
          <div
            v-for="(item, index) in stats"
            :key="item.label"
            class="metric"
            :style="{ '--metric-index': index }"
          >
            <strong>{{ item.value }}</strong>
            <span>{{ item.label }}</span>
          </div>
          <div class="metric date-metric">
            <strong>{{ dateText }}</strong>
            <span>此刻 · 合肥</span>
          </div>
        </div>
      </section>

      <section class="home-content">
        <div class="explore-panel">
          <div class="section-heading">
            <div>
              <span class="heading-index">EXPLORE</span>
              <h2>从这里开始</h2>
            </div>
            <span class="heading-line"></span>
          </div>

          <div class="quick-grid">
            <router-link
              v-for="link in quickLinks"
              :key="link.path"
              :to="link.path"
              class="quick-card"
              :style="{ '--quick-color': link.color }"
            >
              <span class="quick-index">{{ link.index }}</span>
              <span class="quick-icon">
                <el-icon><component :is="link.icon" /></el-icon>
              </span>
              <span class="quick-copy">
                <strong>{{ link.title }}</strong>
                <small>{{ link.desc }}</small>
              </span>
              <el-icon class="quick-arrow"><ArrowRight /></el-icon>
            </router-link>
          </div>
        </div>

        <aside class="latest-panel">
          <div class="section-heading compact">
            <div>
              <span class="heading-index">LATEST</span>
              <h2>最近更新</h2>
            </div>
          </div>

          <router-link
            v-if="latestPost"
            :to="`/blog/${latestPost.slug}`"
            class="latest-card"
          >
            <span class="latest-type">{{ latestPost.type === 'note' ? '笔记' : '杂谈' }}</span>
            <time>{{ latestPost.date }}</time>
            <h3>{{ latestPost.title }}</h3>
            <p>{{ latestPost.summary || '打开文章继续阅读' }}</p>
            <span class="latest-link">
              阅读全文
              <el-icon><ArrowRight /></el-icon>
            </span>
          </router-link>

          <div v-else class="latest-skeleton" :class="{ done: overviewReady }" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </aside>
      </section>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  padding-top: 1.4rem;
  padding-bottom: 2.6rem;
}

.home-card {
  max-width: 1080px;
  overflow: hidden;
  padding: 1.35rem;
  background: rgba(238, 246, 255, 0.64);
}

.home-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.15rem 0.2rem 1rem;
}

.presence {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.64rem;
  letter-spacing: 0.1em;
  color: #60708d;
  font-variant-numeric: tabular-nums;
}

.presence-dot {
  position: relative;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.12);
}

.presence-dot::after {
  content: '';
  position: absolute;
  inset: -4px;
  border: 1px solid rgba(34, 197, 94, 0.55);
  border-radius: inherit;
  animation: presence-pulse 2.2s ease-out infinite;
}

.presence-separator {
  width: 1px;
  height: 12px;
  margin: 0 0.15rem;
  background: rgba(37, 99, 235, 0.2);
}

.start-link {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0.42rem 0.9rem 0.42rem 0.75rem;
  font-size: 0.75rem;
  color: var(--text-dim);
  background: rgba(255, 255, 255, 0.54);
  border: 1px solid rgba(37, 99, 235, 0.16);
  border-radius: 60px;
  transition: 0.24s ease;
}

.start-link:hover {
  color: var(--accent);
  border-color: rgba(37, 99, 235, 0.42);
  background: rgba(255, 255, 255, 0.86);
  transform: translateX(-3px);
}

.start-link .el-icon {
  transition: transform 0.24s ease;
}

.start-link:hover .el-icon {
  transform: translateX(-2px);
}

.hero {
  position: relative;
  isolation: isolate;
  min-height: 390px;
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.65fr);
  align-items: center;
  gap: 2rem;
  padding: clamp(2rem, 5vw, 4rem);
  overflow: hidden;
  color: #fff;
  background:
    linear-gradient(125deg, rgba(13, 32, 69, 0.98), rgba(30, 64, 175, 0.9) 62%, rgba(14, 116, 144, 0.82)),
    #102347;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 26px;
  box-shadow: 0 24px 50px -28px rgba(30, 64, 175, 0.68);
}

.hero::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 0;
  background:
    radial-gradient(circle 310px at 68% 38%, rgba(125, 211, 252, 0.2), transparent 72%),
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  background-size: auto, 38px 38px, 38px 38px;
  transition: background-position 0.15s ease-out;
}

.hero::after {
  content: '';
  position: absolute;
  z-index: -1;
  width: 360px;
  height: 360px;
  right: -150px;
  top: -190px;
  border-radius: 50%;
  border: 70px solid rgba(255, 255, 255, 0.035);
}

.hero-copy {
  position: relative;
  z-index: 2;
}

.hero-kicker {
  margin-bottom: 0.75rem;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  color: rgba(219, 234, 254, 0.72);
}

.hero h1 {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0;
  line-height: 1.1;
}

.name-cn {
  font-size: clamp(2.5rem, 5vw, 4.4rem);
  font-weight: 800;
  letter-spacing: -0.06em;
}

.name-en {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.24em;
  color: #7dd3fc;
}

.hero-role {
  min-height: 1.75rem;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 1rem 0 0;
  font-size: clamp(0.86rem, 1.6vw, 1rem);
  color: rgba(255, 255, 255, 0.75);
}

.hero-role strong {
  display: inline-block;
  color: #bfdbfe;
  font-weight: 700;
}

.word-swap-enter-active,
.word-swap-leave-active {
  transition: opacity 0.28s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), filter 0.28s ease;
}

.word-swap-enter-from {
  opacity: 0;
  transform: translateY(8px);
  filter: blur(4px);
}

.word-swap-leave-to {
  opacity: 0;
  transform: translateY(-8px);
  filter: blur(4px);
}

.intro-text {
  max-width: 560px;
  margin: 1rem 0 0;
  font-size: 0.88rem;
  line-height: 1.9;
  color: rgba(239, 246, 255, 0.76);
}

.hero-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.6rem;
}

.primary-action,
.secondary-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  min-height: 42px;
  padding: 0.65rem 1.1rem;
  border-radius: 13px;
  font-size: 0.78rem;
  font-weight: 700;
  transition: transform 0.24s ease, background 0.24s ease, box-shadow 0.24s ease;
}

.primary-action {
  color: #153260;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 10px 24px -14px rgba(0, 0, 0, 0.55);
}

.primary-action .el-icon {
  transition: transform 0.24s ease;
}

.primary-action:hover {
  transform: translateY(-2px);
  background: #fff;
  box-shadow: 0 14px 26px -14px rgba(0, 0, 0, 0.62);
}

.primary-action:hover .el-icon {
  transform: translateX(3px);
}

.secondary-action {
  color: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.06);
}

.secondary-action:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.13);
}

.hero-visual {
  position: relative;
  justify-self: center;
  width: min(250px, 25vw);
  aspect-ratio: 1;
}

.portrait {
  position: absolute;
  z-index: 3;
  inset: 22%;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.44);
  border-radius: 42% 58% 55% 45% / 45% 43% 57% 55%;
  background: linear-gradient(135deg, rgba(125, 211, 252, 0.92), rgba(37, 99, 235, 0.95));
  box-shadow: 0 18px 40px -15px rgba(0, 0, 0, 0.58), inset 0 0 24px rgba(255, 255, 255, 0.15);
  animation: portrait-morph 8s ease-in-out infinite alternate;
}

.portrait span {
  font-size: clamp(2.3rem, 5vw, 4rem);
  font-weight: 800;
  color: #fff;
}

.portrait img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.orbit {
  position: absolute;
  border: 1px solid rgba(186, 230, 253, 0.23);
  border-radius: 50%;
}

.orbit-outer {
  inset: 4%;
  animation: orbit-spin 22s linear infinite;
}

.orbit-inner {
  inset: 14%;
  border-style: dashed;
  animation: orbit-spin 16s linear infinite reverse;
}

.orbit-dot {
  position: absolute;
  z-index: 2;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #7dd3fc;
  box-shadow: 0 0 16px #38bdf8;
}

.dot-one {
  top: 13%;
  right: 20%;
  animation: dot-float 4s ease-in-out infinite;
}

.dot-two {
  left: 7%;
  bottom: 28%;
  width: 6px;
  height: 6px;
  background: #c4b5fd;
  box-shadow: 0 0 14px #8b5cf6;
  animation: dot-float 5s 1s ease-in-out infinite reverse;
}

.tech-chip {
  position: absolute;
  z-index: 4;
  padding: 0.24rem 0.52rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: clamp(0.48rem, 0.8vw, 0.62rem);
  letter-spacing: 0.08em;
  color: rgba(239, 246, 255, 0.9);
  background: rgba(15, 35, 73, 0.72);
  border: 1px solid rgba(186, 230, 253, 0.25);
  border-radius: 9px;
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 20px -12px rgba(0, 0, 0, 0.7);
}

.chip-vue { right: 4%; top: 25%; animation: chip-float 4.8s ease-in-out infinite; }
.chip-cs { left: 5%; top: 22%; animation: chip-float 5.4s 0.8s ease-in-out infinite reverse; }
.chip-ustc { right: 12%; bottom: 14%; animation: chip-float 5s 1.4s ease-in-out infinite; }

.overview {
  position: relative;
  z-index: 3;
  margin: -22px 1.3rem 0;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(85px, 0.7fr)) minmax(180px, 1.4fr);
  padding: 0.8rem;
  background: rgba(251, 253, 255, 0.86);
  border: 1px solid rgba(37, 99, 235, 0.14);
  border-radius: 18px;
  box-shadow: 0 16px 34px -24px rgba(30, 64, 175, 0.5);
  backdrop-filter: blur(18px);
}

.metric {
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.42rem;
  padding: 0.55rem 0.7rem;
  border-right: 1px solid rgba(37, 99, 235, 0.11);
}

.metric strong {
  font-size: 1.25rem;
  color: #1d4ed8;
  font-variant-numeric: tabular-nums;
}

.metric span {
  font-size: 0.66rem;
  color: var(--text-dim);
}

.stats-row.ready .metric:not(.date-metric) strong {
  animation: metric-pop 0.42s calc(var(--metric-index) * 0.08s) cubic-bezier(0.16, 1, 0.3, 1) both;
}

.date-metric {
  justify-content: flex-start;
  border-right: none;
  padding-left: 1.1rem;
}

.date-metric strong {
  font-size: 0.8rem;
  color: var(--text-dark);
}

.home-content {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(240px, 0.75fr);
  gap: 1.2rem;
  padding: 2rem 0.2rem 0.2rem;
}

.explore-panel,
.latest-panel {
  min-width: 0;
}

.section-heading {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  margin-bottom: 0.9rem;
}

.section-heading > div {
  flex-shrink: 0;
}

.heading-index {
  display: block;
  margin-bottom: 0.15rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.56rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--accent);
}

.section-heading h2 {
  margin: 0;
  font-size: 1rem;
  color: var(--text-dark);
}

.heading-line {
  flex: 1;
  height: 1px;
  margin-bottom: 0.35rem;
  background: linear-gradient(90deg, rgba(37, 99, 235, 0.2), transparent);
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.quick-card {
  position: relative;
  min-height: 170px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  overflow: hidden;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(37, 99, 235, 0.12);
  border-radius: 18px;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease, box-shadow 0.3s ease, background 0.25s ease;
}

.quick-card::before {
  content: '';
  position: absolute;
  width: 120px;
  height: 120px;
  right: -65px;
  top: -70px;
  border-radius: 50%;
  background: var(--quick-color);
  opacity: 0.08;
  transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
}

.quick-card:hover {
  transform: translateY(-6px);
  border-color: color-mix(in srgb, var(--quick-color) 48%, transparent);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 18px 32px -24px var(--quick-color);
}

.quick-card:hover::before {
  opacity: 0.14;
  transform: scale(1.5);
}

.quick-index {
  align-self: flex-end;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.56rem;
  color: #9aabc5;
}

.quick-icon {
  width: 37px;
  height: 37px;
  display: grid;
  place-items: center;
  margin: 0.2rem 0 0.8rem;
  color: #fff;
  background: var(--quick-color);
  border-radius: 11px;
  box-shadow: 0 8px 18px -10px var(--quick-color);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.quick-card:hover .quick-icon {
  transform: rotate(-6deg) scale(1.08);
}

.quick-copy {
  display: flex;
  flex-direction: column;
  gap: 0.24rem;
}

.quick-copy strong {
  font-size: 0.82rem;
  color: var(--text-dark);
}

.quick-copy small {
  font-size: 0.66rem;
  line-height: 1.55;
  color: var(--text-dim);
}

.quick-arrow {
  margin-top: auto;
  align-self: flex-end;
  color: var(--quick-color);
  opacity: 0;
  transform: translateX(-5px);
  transition: opacity 0.24s ease, transform 0.24s ease;
}

.quick-card:hover .quick-arrow {
  opacity: 1;
  transform: translateX(0);
}

.latest-panel {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.42);
  border: 1px solid rgba(37, 99, 235, 0.1);
  border-radius: 20px;
}

.section-heading.compact {
  margin-bottom: 0.7rem;
}

.latest-card {
  display: block;
  position: relative;
  min-height: 170px;
  padding: 1rem;
  overflow: hidden;
  background: linear-gradient(145deg, rgba(219, 234, 254, 0.74), rgba(255, 255, 255, 0.7));
  border: 1px solid rgba(37, 99, 235, 0.13);
  border-radius: 15px;
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease, box-shadow 0.28s ease;
}

.latest-card::after {
  content: '';
  position: absolute;
  width: 100px;
  height: 100px;
  right: -48px;
  bottom: -56px;
  border: 22px solid rgba(37, 99, 235, 0.06);
  border-radius: 50%;
  transition: transform 0.4s ease;
}

.latest-card:hover {
  transform: translateY(-4px);
  border-color: rgba(37, 99, 235, 0.34);
  box-shadow: 0 16px 30px -24px rgba(30, 64, 175, 0.55);
}

.latest-card:hover::after {
  transform: scale(1.2) rotate(15deg);
}

.latest-type,
.latest-card time {
  display: inline-block;
  font-size: 0.6rem;
}

.latest-type {
  padding: 0.12rem 0.45rem;
  margin-right: 0.35rem;
  color: #1d4ed8;
  background: rgba(37, 99, 235, 0.1);
  border-radius: 20px;
}

.latest-card time {
  color: #7c8ca5;
}

.latest-card h3 {
  position: relative;
  z-index: 1;
  margin: 0.72rem 0 0.38rem;
  font-size: 0.88rem;
  line-height: 1.45;
  color: var(--text-dark);
}

.latest-card p {
  position: relative;
  z-index: 1;
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  font-size: 0.66rem;
  line-height: 1.6;
  color: var(--text-dim);
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.latest-link {
  position: absolute;
  z-index: 2;
  left: 1rem;
  bottom: 0.85rem;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.64rem;
  font-weight: 700;
  color: var(--accent);
}

.latest-link .el-icon {
  transition: transform 0.24s ease;
}

.latest-card:hover .latest-link .el-icon {
  transform: translateX(3px);
}

.latest-skeleton {
  min-height: 170px;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.45);
  border-radius: 15px;
}

.latest-skeleton span {
  height: 10px;
  border-radius: 20px;
  background: linear-gradient(90deg, rgba(148, 163, 184, 0.14), rgba(255, 255, 255, 0.68), rgba(148, 163, 184, 0.14));
  background-size: 200% 100%;
  animation: skeleton-flow 1.4s linear infinite;
}

.latest-skeleton span:nth-child(1) { width: 35%; }
.latest-skeleton span:nth-child(2) { width: 88%; height: 16px; margin-top: 0.3rem; }
.latest-skeleton span:nth-child(3) { width: 68%; }
.latest-skeleton.done { opacity: 0.45; }

@keyframes presence-pulse {
  from { opacity: 0.85; transform: scale(0.7); }
  to { opacity: 0; transform: scale(1.8); }
}

@keyframes portrait-morph {
  from { border-radius: 42% 58% 55% 45% / 45% 43% 57% 55%; transform: translateY(-2px); }
  to { border-radius: 56% 44% 45% 55% / 52% 58% 42% 48%; transform: translateY(4px); }
}

@keyframes orbit-spin { to { transform: rotate(360deg); } }
@keyframes dot-float { 50% { transform: translateY(-8px) scale(1.12); } }
@keyframes chip-float { 50% { transform: translateY(-7px); } }
@keyframes metric-pop {
  from { opacity: 0; transform: translateY(6px) scale(0.88); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes skeleton-flow { to { background-position: -200% 0; } }

@media (max-width: 900px) {
  .hero {
    grid-template-columns: minmax(0, 1fr) 210px;
    padding: 2.4rem;
  }
  .hero-visual { width: 210px; }
  .home-content { grid-template-columns: 1fr; }
  .latest-panel { display: grid; grid-template-columns: 150px 1fr; align-items: center; gap: 0.8rem; }
  .section-heading.compact { margin: 0; }
}

@media (max-width: 680px) {
  .home-page { padding: 0.8rem; }
  .home-card { padding: 0.8rem; border-radius: 22px; }
  .hero {
    min-height: auto;
    grid-template-columns: 1fr;
    padding: 2rem 1.3rem 1.5rem;
  }
  .hero-visual {
    width: 180px;
    grid-row: 1;
  }
  .hero-copy { grid-row: 2; }
  .hero h1 { justify-content: center; }
  .hero-kicker,
  .hero-role,
  .intro-text { text-align: center; justify-content: center; }
  .hero-actions { justify-content: center; }
  .stats-row { grid-template-columns: repeat(3, 1fr); }
  .date-metric { grid-column: 1 / -1; justify-content: center; border-top: 1px solid rgba(37, 99, 235, 0.1); padding-top: 0.8rem; }
  .metric:nth-child(3) { border-right: none; }
  .quick-grid { grid-template-columns: 1fr; }
  .quick-card { min-height: 115px; display: grid; grid-template-columns: auto 1fr auto; grid-template-rows: auto 1fr; column-gap: 0.8rem; align-items: center; }
  .quick-index { grid-column: 3; grid-row: 1; }
  .quick-icon { grid-column: 1; grid-row: 1 / 3; margin: 0; }
  .quick-copy { grid-column: 2; grid-row: 1 / 3; }
  .quick-arrow { grid-column: 3; grid-row: 2; margin: 0; opacity: 1; }
  .latest-panel { display: block; }
  .section-heading.compact { margin-bottom: 0.7rem; }
}

@media (max-width: 430px) {
  .presence-separator,
  .presence time { display: none; }
  .start-link span { display: none; }
  .start-link { width: 34px; height: 34px; justify-content: center; padding: 0; }
  .name-cn { font-size: 2.35rem; }
  .hero-role { flex-direction: column; gap: 0.1rem; }
  .stats-row { margin-inline: -0.35rem; }
  .metric { flex-direction: column; align-items: center; gap: 0; }
  .metric strong { font-size: 1.05rem; }
  .date-metric { flex-direction: row; gap: 0.45rem; }
}
</style>
