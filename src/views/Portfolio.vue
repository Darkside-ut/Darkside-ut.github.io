<script setup>
import { ref } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'

// 作品列表：每个作品一行，点击行头展开/收起详情
const projects = [
  {
    title: 'Relax 音乐播放器',
    subtitle: '完全离线的本地音乐播放器',
    icon: '/relax-icon.png',
    short: 'R',
    tagline: 'Electron · 原生 JavaScript · 4,500+ 行',
    badges: ['离线可用', '无账号', '无广告', '便携版'],
    cover: 'linear-gradient(135deg, #7c5cff 0%, #5b7cfa 48%, #22d3ee 100%)',
    lead: `一款为日常听歌而做的桌面应用。所有歌曲、封面、歌词和听歌数据都留在本机，
      不联网、不登录、不上传。除了播放本身，它还试图把「听过什么」变成可以回看的记录：
      星空下的频谱、逐字滚动的弧形歌词、每天的第一首歌，以及一墙慢慢点亮的徽章。`,
    sections: [
      {
        title: '播放体验',
        items: [
          '双音源交叉淡入淡出，切歌无断点（无缝电台）',
          'Web Audio 实时频谱 + 四套情绪场景星空，15 秒平滑轮换',
          '界面主色随封面提取渐变，切歌时全屏氛围一闪',
          '弧形歌词布局，逐字「推门」式高亮',
          '置顶毛玻璃悬浮窗：封面、歌名、两行歌词与播放控制',
        ],
      },
      {
        title: '曲库管理',
        items: [
          '文件夹 / 文件 / 拖拽三种导入方式，自动拷贝到曲库目录',
          '自写 ID3 解析：标题、歌手、专辑、内嵌封面，兼容 GBK 等编码',
          '按同名批量匹配歌词与封面，可指定固定导入目录',
          '自定义专辑与分类、「我喜欢」收藏，拖拽排序与折叠列表',
        ],
      },
      {
        title: '听歌记录',
        items: [
          '听歌画像：本周热力、时段分布、累计时长与播放次数',
          '35 枚成就徽章，覆盖播放量、连续天数、盲听与签到',
          '签到日历、晨曲日记（每天听的第一首歌）',
          '时空胶囊：随机播放一首曾经常听、如今快忘了的歌',
          '音乐签、盲听猜歌、带歌词的长图卡片导出',
        ],
      },
      {
        title: '工程实现',
        items: [
          '主进程 / 渲染进程经 contextBridge 白名单 IPC 通信，开启上下文隔离',
          'JSON 落盘管理曲库、专辑、分类、统计与续播状态',
          '便携版通过 PORTABLE_EXECUTABLE_DIR 将数据放在 exe 旁',
          '等首帧绘制后再显示窗口，规避启动白屏与透明窗闪黑',
          'electron-builder 打包 NSIS 安装包',
        ],
      },
    ],
    stack: ['Electron 31', 'JavaScript', 'Web Audio API', 'Canvas 2D', 'SortableJS', 'electron-builder'],
  },
]

// 默认全部收起
const openSet = ref(new Set())

function toggle(i) {
  const next = new Set(openSet.value)
  next.has(i) ? next.delete(i) : next.add(i)
  openSet.value = next
}

function isOpen(i) {
  return openSet.value.has(i)
}
</script>

<template>
  <div class="page">
    <div class="page-card portfolio-card">
      <h2 class="page-title">作品集</h2>
      <div class="section-sub">项目与实践 · 点击卡片展开详情</div>

      <el-empty v-if="!projects.length" description="还没有作品，敬请期待" />

      <div v-else class="project-list">
        <article
          v-for="(p, i) in projects"
          :key="p.title"
          class="project-row"
          :class="{ open: isOpen(i) }"
        >
          <!-- 行头 -->
          <button class="row-head" @click="toggle(i)" :aria-expanded="isOpen(i)">
            <div
              class="row-thumb"
              :class="{ 'has-img': p.icon }"
              :style="p.icon ? null : { background: p.cover }"
            >
              <img v-if="p.icon" :src="p.icon" :alt="p.title" />
              <span v-else>{{ p.short }}</span>
            </div>

            <div class="row-main">
              <div class="row-title-line">
                <h3>{{ p.title }}</h3>
                <span class="row-tagline">{{ p.tagline }}</span>
              </div>
              <p class="row-sub">{{ p.subtitle }}</p>
              <div class="row-badges">
                <span v-for="b in p.badges" :key="b" class="row-badge">{{ b }}</span>
              </div>
            </div>

            <el-icon class="chevron"><ArrowDown /></el-icon>
          </button>

          <!-- 展开内容 -->
          <div class="row-body-wrap">
            <div class="row-body">
              <p class="lead">{{ p.lead }}</p>

              <div class="feat-grid">
                <section v-for="s in p.sections" :key="s.title" class="feat-block">
                  <h4>{{ s.title }}</h4>
                  <ul>
                    <li v-for="item in s.items" :key="item">{{ item }}</li>
                  </ul>
                </section>
              </div>

              <div class="stack">
                <span v-for="t in p.stack" :key="t" class="stack-item">{{ t }}</span>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped>
.portfolio-card {
  max-width: 860px;
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

/* ===== 作品行 ===== */
.project-row {
  background: rgba(245, 249, 255, 0.72);
  border: 1px solid rgba(37, 99, 235, 0.14);
  border-radius: 20px;
  overflow: hidden;
  transition: border-color 0.25s, box-shadow 0.25s, background 0.25s;
}

.project-row:hover {
  border-color: rgba(37, 99, 235, 0.32);
}

.project-row.open {
  background: rgba(248, 251, 255, 0.9);
  border-color: rgba(37, 99, 235, 0.3);
  box-shadow: 0 12px 30px -18px rgba(30, 60, 110, 0.35);
}

/* 行头 */
.row-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.2rem;
  border: none;
  background: transparent;
  text-align: left;
}

.row-thumb {
  flex-shrink: 0;
  width: 54px;
  height: 54px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  box-shadow: 0 6px 16px -6px rgba(80, 80, 180, 0.55);
  overflow: hidden;
}

.row-thumb.has-img {
  background: transparent;
  box-shadow: 0 6px 16px -6px rgba(20, 20, 50, 0.5);
}

.row-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.row-main {
  flex: 1;
  min-width: 0;
}

.row-title-line {
  display: flex;
  align-items: baseline;
  gap: 0.7rem;
  flex-wrap: wrap;
}

.row-title-line h3 {
  font-size: 1.05rem;
  color: var(--text-dark);
}

.row-tagline {
  font-size: 0.68rem;
  font-family: monospace;
  color: var(--accent);
}

.row-sub {
  margin-top: 0.15rem;
  font-size: 0.78rem;
  color: var(--text-dim);
}

.row-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 0.45rem;
}

.row-badge {
  font-size: 0.64rem;
  padding: 1px 8px;
  border-radius: 20px;
  color: var(--accent);
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.16);
}

.chevron {
  flex-shrink: 0;
  color: var(--accent);
  font-size: 1rem;
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.project-row.open .chevron {
  transform: rotate(180deg);
}

/* 展开/收起：grid-template-rows 0fr → 1fr，无需测量高度 */
.row-body-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}

.project-row.open .row-body-wrap {
  grid-template-rows: 1fr;
}

.row-body {
  overflow: hidden;
  min-height: 0;
  padding: 0 1.4rem;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.35s ease, transform 0.35s ease, padding 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}

.project-row.open .row-body {
  padding: 0 1.4rem 1.4rem;
  opacity: 1;
  transform: translateY(0);
}

/* ===== 详情内容 ===== */
.lead {
  margin: 0 0 1.2rem;
  padding-top: 1rem;
  border-top: 1px dashed rgba(37, 99, 235, 0.16);
  font-size: 0.84rem;
  line-height: 1.85;
  color: var(--text-dim);
}

.feat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 1.1rem 1.6rem;
}

.feat-block h4 {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 0.45rem;
  padding-left: 0.6rem;
  border-left: 3px solid var(--accent);
}

.feat-block ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.feat-block li {
  position: relative;
  padding-left: 0.95rem;
  font-size: 0.77rem;
  line-height: 1.65;
  color: var(--text-dim);
}

.feat-block li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.62em;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent-light);
}

.stack {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 1.2rem;
  padding-top: 1rem;
  border-top: 1px dashed rgba(37, 99, 235, 0.18);
}

.stack-item {
  font-size: 0.68rem;
  font-family: monospace;
  padding: 0.18rem 0.7rem;
  border-radius: 20px;
  color: var(--accent);
  background: rgba(37, 99, 235, 0.09);
  border: 1px solid rgba(37, 99, 235, 0.18);
}

/* ===== 响应式 ===== */
@media (max-width: 600px) {
  .row-head {
    gap: 0.75rem;
    padding: 0.9rem;
  }
  .row-thumb {
    width: 44px;
    height: 44px;
    font-size: 1.2rem;
    border-radius: 12px;
  }
  .row-tagline {
    display: none;
  }
  .row-body {
    padding: 0 0.9rem;
  }
  .project-row.open .row-body {
    padding: 0 0.9rem 1.1rem;
  }
}
</style>
