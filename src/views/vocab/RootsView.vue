<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { ArrowLeft, Search } from '@element-plus/icons-vue'
import {
  roots,
  rootType,
  TYPE_LABEL,
  TOTAL,
  rootProgress,
  masteredIds,
  masteredCount,
  percent,
  level,
  levelRemain,
  markMastered,
  unmarkMastered,
  recordQuiz,
  resetRootProgress,
  achievements,
  exportRootProgress,
  importRootProgress,
} from '../../composables/useRoots.js'

const tabs = [
  { key: 'index', label: '词根索引' },
  { key: 'flash', label: '闪卡' },
  { key: 'progress', label: '学习进度' },
]

const filters = [
  { key: 'all', label: '全部' },
  { key: 'prefix', label: '前缀' },
  { key: 'root', label: '词根' },
  { key: 'suffix', label: '后缀' },
]

const tab = ref('index')
const keyword = ref('')
const filter = ref('all')
const detail = ref(null)
const quizPick = ref(-1)
const importError = ref('')

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return roots.filter((r) => {
    if (filter.value !== 'all' && rootType(r.root) !== filter.value) return false
    if (!kw) return true
    return (
      r.root.toLowerCase().includes(kw) ||
      r.meaning.toLowerCase().includes(kw) ||
      r.description.toLowerCase().includes(kw) ||
      r.origin.toLowerCase().includes(kw) ||
      r.examples.some(
        (e) => e.word.toLowerCase().includes(kw) || e.meaning.includes(kw)
      )
    )
  })
})

watch(detail, () => {
  quizPick.value = -1
})

function openRoot(r) {
  detail.value = r
}

function answer(index, r) {
  if (quizPick.value >= 0) return
  quizPick.value = index
  const correct = index === r.quiz.correctAnswer
  recordQuiz(correct)
  if (correct) markMastered(r.id)
}

function optClass(i, r) {
  if (quizPick.value < 0) return ''
  if (i === r.quiz.correctAnswer) return 'correct'
  if (i === quizPick.value) return 'wrong'
  return 'dim'
}

function nextRoot() {
  const i = roots.findIndex((x) => x.id === detail.value?.id)
  const next = roots[(i + 1) % roots.length]
  detail.value = next
}

function clearAll() {
  if (!confirm('清空词根学习进度？此操作不可撤销。')) return
  resetRootProgress()
}

const fileInput = ref(null)
const importErrorMsg = importError

async function onImport(e) {
  const f = e.target.files?.[0]
  if (!f) return
  importError.value = ''
  try {
    importRootProgress(await f.text())
  } catch (err) {
    importError.value = `导入失败：${err.message}`
  }
  e.target.value = ''
}

/* ---------- 闪卡 ---------- */
const flashIndex = ref(0)
const flipped = ref(false)
const flashRoot = computed(() => roots[flashIndex.value] || roots[0])

function flashNext() {
  flashIndex.value = (flashIndex.value + 1) % TOTAL
  flipped.value = false
}

function flashPrev() {
  flashIndex.value = (flashIndex.value - 1 + TOTAL) % TOTAL
  flipped.value = false
}

function know() {
  markMastered(flashRoot.value.id)
  flashNext()
}

function onKey(e) {
  if (detail.value || tab.value !== 'flash') return
  const tag = (e.target?.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea') return
  if (e.code === 'Space') {
    e.preventDefault()
    flipped.value = !flipped.value
  } else if (e.key === 'ArrowRight') {
    flashNext()
  } else if (e.key === 'ArrowLeft') {
    flashPrev()
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="roots-view">
    <!-- ===== 顶部：标签页 + 掌握数 ===== -->
    <div class="root-tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="root-tab"
        :class="{ active: tab === t.key }"
        @click="tab = t.key"
      >
        {{ t.label }}
      </button>
      <span class="root-total">已掌握 {{ masteredCount }}/{{ TOTAL }}</span>
    </div>

    <!-- ===== 词根详情 ===== -->
    <div v-if="detail" class="root-detail">
      <button class="back-btn" @click="detail = null">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </button>

      <div class="detail-head">
        <div class="detail-root">{{ detail.root }}</div>
        <div class="detail-tags">
          <span class="tag type">{{ TYPE_LABEL[rootType(detail.root)] }}</span>
          <span class="tag origin">{{ detail.origin }}</span>
          <span v-if="masteredIds.has(detail.id)" class="tag done">已掌握</span>
        </div>
        <div class="detail-meaning">{{ detail.meaning }}</div>
      </div>

      <p class="detail-desc">{{ detail.description }}</p>

      <h4 class="block-title">例词解析</h4>
      <div class="example-list">
        <div v-for="ex in detail.examples" :key="ex.word" class="example-item">
          <div class="ex-head">
            <span class="ex-word">{{ ex.word }}</span>
            <span class="ex-meaning">{{ ex.meaning }}</span>
          </div>
          <div class="ex-breakdown">
            <span v-if="ex.breakdown?.prefix" class="part prefix">
              {{ ex.breakdown.prefix }}
            </span>
            <span v-if="ex.breakdown?.root" class="part root">
              {{ ex.breakdown.root }}
            </span>
            <span v-if="ex.breakdown?.suffix" class="part suffix">
              {{ ex.breakdown.suffix }}
            </span>
          </div>
          <div v-if="ex.explanation" class="ex-explanation">{{ ex.explanation }}</div>
        </div>
      </div>

      <h4 class="block-title">小测试</h4>
      <div class="quiz">
        <div class="quiz-q">{{ detail.quiz.question }}</div>
        <button
          v-for="(opt, i) in detail.quiz.options"
          :key="i"
          class="quiz-opt"
          :class="optClass(i, detail)"
          :disabled="quizPick >= 0"
          @click="answer(i, detail)"
        >
          <span class="opt-index">{{ 'ABCD'[i] }}</span>
          {{ opt }}
        </button>
        <div
          v-if="quizPick >= 0"
          class="quiz-feedback"
          :class="{ ok: quizPick === detail.quiz.correctAnswer }"
        >
          {{
            quizPick === detail.quiz.correctAnswer
              ? '答对了，已标记为已掌握'
              : `答错了，正确答案是 ${'ABCD'[detail.quiz.correctAnswer]}`
          }}
        </div>
      </div>

      <div class="detail-actions">
        <button
          v-if="!masteredIds.has(detail.id)"
          class="ghost-btn"
          @click="markMastered(detail.id)"
        >
          标记为已掌握
        </button>
        <button v-else class="ghost-btn" @click="unmarkMastered(detail.id)">
          取消掌握
        </button>
        <button class="primary-btn" @click="nextRoot">下一个词根 →</button>
      </div>
    </div>

    <!-- ===== 词根索引 ===== -->
    <div v-else-if="tab === 'index'" class="root-index">
      <div class="root-toolbar">
        <div class="search-box">
          <el-icon><Search /></el-icon>
          <input v-model="keyword" placeholder="搜索词根 / 含义 / 例词" />
        </div>
        <div class="filter-tabs">
          <button
            v-for="f in filters"
            :key="f.key"
            class="filter-tab"
            :class="{ active: filter === f.key }"
            @click="filter = f.key"
          >
            {{ f.label }}
          </button>
        </div>
      </div>

      <div class="root-count">显示 {{ filtered.length }} / {{ TOTAL }}</div>

      <div class="root-grid">
        <button
          v-for="r in filtered"
          :key="r.id"
          class="root-card"
          :class="{ mastered: masteredIds.has(r.id) }"
          @click="openRoot(r)"
        >
          <div class="root-card-top">
            <span class="root-name">{{ r.root }}</span>
            <span class="root-type">{{ TYPE_LABEL[rootType(r.root)] }}</span>
          </div>
          <div class="root-meaning">{{ r.meaning }}</div>
          <div class="root-examples">
            {{ r.examples.slice(0, 3).map((e) => e.word).join(' · ') }}
          </div>
          <span v-if="masteredIds.has(r.id)" class="mastered-badge">✓</span>
        </button>
      </div>

      <div v-if="!filtered.length" class="empty-mini">没有匹配的词根，换个关键词试试</div>
    </div>

    <!-- ===== 闪卡 ===== -->
    <div v-else-if="tab === 'flash'" class="flash-view">
      <div class="flash-top">{{ flashIndex + 1 }} / {{ TOTAL }}</div>

      <div class="flash-card" @click="flipped = !flipped">
        <div class="flash-inner" :class="{ flipped }">
          <div class="flash-face front">
            <div class="flash-root">{{ flashRoot.root }}</div>
            <div class="flash-origin">{{ flashRoot.origin }}</div>
            <div class="flash-hint">点击翻面</div>
          </div>
          <div class="flash-face back">
            <div class="flash-root small">{{ flashRoot.root }}</div>
            <div class="flash-meaning">{{ flashRoot.meaning }}</div>
            <div class="flash-ex">
              {{ flashRoot.examples.slice(0, 3).map((e) => e.word).join(' · ') }}
            </div>
          </div>
        </div>
      </div>

      <div class="flash-actions">
        <button class="ghost-btn" @click="flashPrev">← 上一个</button>
        <button class="ghost-btn" @click="flipped = !flipped">翻面</button>
        <button class="ghost-btn" @click="know">认识 ✓</button>
        <button class="ghost-btn" @click="flashNext">下一个 →</button>
      </div>
      <p class="hint">← → 切换 · 空格翻面</p>
    </div>

    <!-- ===== 学习进度 ===== -->
    <div v-else class="progress-view">
      <div class="stat-cards">
        <div class="stat-card">
          <div class="stat-num">{{ masteredCount }}</div>
          <div class="stat-lbl">已掌握词根</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">{{ level }}</div>
          <div class="stat-lbl">等级</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">{{ rootProgress.streak || 0 }}</div>
          <div class="stat-lbl">连续天数</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">{{ percent }}%</div>
          <div class="stat-lbl">总进度</div>
        </div>
      </div>

      <div class="overall">
        <div class="overall-head">
          <span>整体进度</span>
          <span>{{ masteredCount }} / {{ TOTAL }}</span>
        </div>
        <div class="bar">
          <div class="fill" :style="{ width: percent + '%' }"></div>
        </div>
        <p class="next-level">距离下一级还需掌握 {{ levelRemain }} 个词根</p>
      </div>

      <h4 class="block-title">成就</h4>
      <div class="ach-grid">
        <div v-for="a in achievements" :key="a.id" class="ach" :class="{ on: a.unlocked }">
          <span class="ach-icon">{{ a.unlocked ? a.icon : '🔒' }}</span>
          <span class="ach-name">{{ a.name }}</span>
          <span class="ach-desc">{{ a.desc }}</span>
        </div>
      </div>

      <h4 class="block-title">数据管理</h4>
      <div class="data-actions">
        <button class="ghost-btn" @click="exportRootProgress">导出进度</button>
        <button class="ghost-btn" @click="fileInput?.click()">导入进度</button>
        <button class="ghost-btn danger" @click="clearAll">清空进度</button>
        <input
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          hidden
          @change="onImport"
        />
      </div>
      <p v-if="importErrorMsg" class="parse-error">{{ importErrorMsg }}</p>
    </div>
  </div>
</template>

<style scoped>
.roots-view {
  margin-top: 0.2rem;
}

/* ===== 标签页 ===== */
.root-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  background: rgba(219, 234, 254, 0.55);
  border: 1px solid rgba(37, 99, 235, 0.14);
  margin-bottom: 1rem;
}

.root-tab {
  flex: 1;
  padding: 0.42rem 0.3rem;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--text-dim);
  background: transparent;
  border: none;
  border-radius: 9px;
  transition: 0.2s;
}

.root-tab.active {
  color: #fff;
  background: linear-gradient(135deg, #1d4ed8, #2563eb);
  box-shadow: 0 4px 12px -4px rgba(37, 99, 235, 0.5);
}

.root-total {
  flex-shrink: 0;
  padding: 0 0.6rem;
  font-size: 0.66rem;
  font-family: monospace;
  color: var(--accent);
}

/* ===== 搜索与筛选 ===== */
.root-toolbar {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 0.6rem;
}

.search-box {
  flex: 1;
  min-width: 180px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0.45rem 0.7rem;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(37, 99, 235, 0.18);
  border-radius: 10px;
  color: var(--text-dim);
}

.search-box input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 0.78rem;
  color: var(--text-dark);
}

.filter-tabs {
  display: flex;
  gap: 3px;
  padding: 3px;
  border-radius: 9px;
  background: rgba(219, 234, 254, 0.5);
}

.filter-tab {
  padding: 0.3rem 0.6rem;
  font-size: 0.72rem;
  color: var(--text-dim);
  background: transparent;
  border: none;
  border-radius: 7px;
  transition: 0.2s;
}

.filter-tab.active {
  background: #fff;
  color: var(--accent);
  font-weight: 700;
  box-shadow: 0 2px 8px -3px rgba(30, 60, 110, 0.25);
}

.root-count {
  font-size: 0.66rem;
  color: #9aa8c0;
  margin-bottom: 0.5rem;
}

/* ===== 词根卡片 ===== */
.root-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 0.6rem;
}

.root-card {
  position: relative;
  text-align: left;
  padding: 0.75rem 0.85rem;
  background: rgba(245, 249, 255, 0.78);
  border: 1px solid rgba(37, 99, 235, 0.13);
  border-radius: 14px;
  transition: 0.22s;
}

.root-card:hover {
  transform: translateY(-3px);
  border-color: var(--accent);
  background: rgba(37, 99, 235, 0.07);
  box-shadow: 0 10px 22px -14px rgba(30, 60, 110, 0.4);
}

.root-card.mastered {
  border-color: rgba(52, 168, 108, 0.45);
  background: rgba(52, 168, 108, 0.06);
}

.root-card-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem;
}

.root-name {
  font-size: 0.95rem;
  font-weight: 800;
  font-family: 'Courier New', monospace;
  color: var(--text-dark);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.root-type {
  flex-shrink: 0;
  font-size: 0.6rem;
  color: var(--accent);
  background: rgba(37, 99, 235, 0.09);
  border-radius: 6px;
  padding: 1px 5px;
}

.root-meaning {
  margin-top: 0.2rem;
  font-size: 0.76rem;
  color: var(--text-dim);
}

.root-examples {
  margin-top: 0.35rem;
  font-size: 0.65rem;
  color: #9aa8c0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mastered-badge {
  position: absolute;
  top: 0.55rem;
  right: 0.6rem;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.66rem;
  color: #fff;
  background: #34a86c;
  border-radius: 50%;
}

/* ===== 详情 ===== */
.root-detail {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0.32rem 0.75rem;
  font-size: 0.74rem;
  color: var(--accent);
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 20px;
  margin-bottom: 0.8rem;
}

.back-btn:hover {
  background: var(--accent);
  color: #fff;
}

.detail-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.detail-root {
  font-size: 2.2rem;
  font-weight: 800;
  font-family: 'Courier New', monospace;
  letter-spacing: -0.02em;
  color: #16305c;
}

.detail-tags {
  display: flex;
  gap: 4px;
}

.tag {
  font-size: 0.64rem;
  padding: 2px 8px;
  border-radius: 20px;
}

.tag.type {
  color: var(--accent);
  background: rgba(37, 99, 235, 0.09);
}

.tag.origin {
  color: var(--text-dim);
  background: rgba(120, 140, 170, 0.12);
}

.tag.done {
  color: #fff;
  background: #34a86c;
}

.detail-meaning {
  width: 100%;
  margin-top: 0.2rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--accent);
}

.detail-desc {
  margin: 0.8rem 0 1rem;
  font-size: 0.8rem;
  line-height: 1.85;
  color: var(--text-dim);
  padding: 0.8rem 1rem;
  border-radius: 12px;
  background: rgba(219, 234, 254, 0.45);
  border-left: 3px solid var(--accent-light);
}

.block-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--accent);
  margin: 1.1rem 0 0.6rem;
  padding-left: 0.6rem;
  border-left: 3px solid var(--accent);
}

/* 例词 */
.example-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.example-item {
  padding: 0.65rem 0.8rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(37, 99, 235, 0.1);
}

.ex-head {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.ex-word {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-dark);
}

.ex-meaning {
  font-size: 0.75rem;
  color: var(--text-dim);
}

.ex-breakdown {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 0.4rem;
}

.part {
  padding: 1px 7px;
  font-size: 0.68rem;
  font-family: 'Courier New', monospace;
  border-radius: 6px;
}

.part.prefix { background: rgba(96, 165, 250, 0.2); color: #1d4ed8; }
.part.root { background: rgba(37, 99, 235, 0.14); color: #1e3a8a; font-weight: 700; }
.part.suffix { background: rgba(147, 197, 253, 0.25); color: #2563eb; }

.ex-explanation {
  margin-top: 0.35rem;
  font-size: 0.7rem;
  line-height: 1.6;
  color: #8d9bb5;
}

/* 小测试 */
.quiz-q {
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--text-dark);
  margin-bottom: 0.6rem;
}

.quiz-opt {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  text-align: left;
  padding: 0.55rem 0.8rem;
  margin-bottom: 0.4rem;
  font-size: 0.78rem;
  color: var(--text-dark);
  background: #fff;
  border: 1.5px solid rgba(37, 99, 235, 0.18);
  border-radius: 10px;
  transition: 0.18s;
}

.quiz-opt:hover:not(:disabled) {
  border-color: var(--accent);
  background: rgba(37, 99, 235, 0.05);
}

.quiz-opt.correct {
  border-color: #34a86c;
  background: rgba(52, 168, 108, 0.1);
}

.quiz-opt.wrong {
  border-color: #e15b5b;
  background: rgba(225, 91, 91, 0.08);
}

.quiz-opt.dim {
  opacity: 0.45;
}

.opt-index {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.64rem;
  font-family: monospace;
  color: var(--accent);
  background: rgba(37, 99, 235, 0.08);
  border-radius: 6px;
}

.quiz-feedback {
  margin-top: 0.4rem;
  padding: 0.5rem 0.8rem;
  font-size: 0.76rem;
  border-radius: 9px;
  color: #b34747;
  background: rgba(225, 91, 91, 0.08);
}

.quiz-feedback.ok {
  color: #248a57;
  background: rgba(52, 168, 108, 0.1);
}

.detail-actions {
  display: flex;
  gap: 0.6rem;
  margin-top: 1.2rem;
  padding-top: 1rem;
  border-top: 1px dashed rgba(37, 99, 235, 0.16);
}

/* ===== 闪卡 ===== */
.flash-view {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.flash-top {
  font-size: 0.7rem;
  font-family: monospace;
  color: #9aa8c0;
  margin-bottom: 0.7rem;
}

.flash-card {
  width: min(100%, 420px);
  height: 240px;
  perspective: 1200px;
  cursor: pointer;
}

.flash-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.55s cubic-bezier(0.16, 1, 0.3, 1);
}

.flash-inner.flipped {
  transform: rotateY(180deg);
}

.flash-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 1.2rem;
}

.front {
  background: linear-gradient(150deg, #eaf2ff, #d7e6fb 60%, #c7dcfa);
  border: 1px solid rgba(37, 99, 235, 0.22);
  box-shadow: 0 16px 34px -18px rgba(30, 60, 110, 0.4);
}

.back {
  transform: rotateY(180deg);
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(37, 99, 235, 0.18);
  box-shadow: 0 16px 34px -18px rgba(30, 60, 110, 0.35);
}

.flash-root {
  font-size: 2.4rem;
  font-weight: 800;
  font-family: 'Courier New', monospace;
  color: #16305c;
}

.flash-root.small {
  font-size: 1.5rem;
}

.flash-origin {
  margin-top: 0.3rem;
  font-size: 0.72rem;
  color: var(--accent);
  letter-spacing: 0.08em;
}

.flash-meaning {
  margin-top: 0.5rem;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--text-dark);
}

.flash-ex {
  margin-top: 0.8rem;
  font-size: 0.76rem;
  color: var(--text-dim);
  line-height: 1.6;
}

.flash-hint {
  position: absolute;
  bottom: 0.8rem;
  font-size: 0.64rem;
  color: #7a8fab;
}

.flash-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}

.hint {
  margin-top: 0.6rem;
  font-size: 0.66rem;
  color: #9aa8c0;
}

/* ===== 进度 ===== */
.stat-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.stat-card {
  text-align: center;
  padding: 0.7rem 0.3rem;
  border-radius: 12px;
  background: rgba(219, 234, 254, 0.55);
  border: 1px solid rgba(37, 99, 235, 0.13);
}

.stat-num {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--accent);
}

.stat-lbl {
  margin-top: 2px;
  font-size: 0.64rem;
  color: var(--text-dim);
}

.overall {
  padding: 0.8rem 1rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(37, 99, 235, 0.12);
}

.overall-head {
  display: flex;
  justify-content: space-between;
  font-size: 0.74rem;
  color: var(--text-dim);
  margin-bottom: 0.45rem;
}

.bar {
  height: 8px;
  border-radius: 5px;
  background: rgba(37, 99, 235, 0.1);
  overflow: hidden;
}

.fill {
  height: 100%;
  border-radius: 5px;
  background: linear-gradient(90deg, #60a5fa, #2563eb);
  transition: width 0.4s ease;
}

.next-level {
  margin-top: 0.45rem;
  font-size: 0.66rem;
  color: #8d9bb5;
}

.ach-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.5rem;
}

.ach {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0.7rem 0.4rem;
  text-align: center;
  border-radius: 12px;
  background: rgba(245, 249, 255, 0.6);
  border: 1px solid rgba(37, 99, 235, 0.1);
  opacity: 0.55;
}

.ach.on {
  opacity: 1;
  background: rgba(255, 248, 230, 0.8);
  border-color: rgba(232, 162, 60, 0.4);
}

.ach-icon {
  font-size: 1.3rem;
}

.ach-name {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-dark);
}

.ach-desc {
  font-size: 0.62rem;
  color: var(--text-dim);
}

.data-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.parse-error {
  margin-top: 0.6rem;
  font-size: 0.74rem;
  color: #d64545;
}

/* ===== 通用按钮 ===== */
.ghost-btn {
  padding: 0.45rem 0.85rem;
  font-family: inherit;
  font-size: 0.76rem;
  color: var(--accent);
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 10px;
  transition: 0.2s;
}

.ghost-btn:hover {
  background: var(--accent);
  color: #fff;
}

.ghost-btn.danger:hover {
  background: #e15b5b;
  border-color: #e15b5b;
}

.primary-btn {
  padding: 0.5rem 1rem;
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #1d4ed8, #2563eb);
  border: none;
  border-radius: 10px;
  transition: 0.2s;
}

.primary-btn:hover {
  box-shadow: 0 6px 16px -4px rgba(37, 99, 235, 0.55);
}

.empty-mini {
  grid-column: 1 / -1;
  padding: 1.2rem;
  text-align: center;
  font-size: 0.76rem;
  color: var(--text-dim);
  background: rgba(219, 234, 254, 0.4);
  border: 1px dashed rgba(37, 99, 235, 0.22);
  border-radius: 12px;
}

@media (max-width: 560px) {
  .stat-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  .root-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
  .detail-root {
    font-size: 1.8rem;
  }
  .root-total {
    display: none;
  }
}
</style>
