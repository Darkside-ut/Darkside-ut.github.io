<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import PageBack from '../components/PageBack.vue'

// 五种情绪状态：CSS 变量驱动配色（背景 / 圆环发光 / 文字色）
const moods = [
  {
    key: 'creating',
    label: '创作中',
    emoji: '✍️',
    desc: '灵感涌动，正在创造',
    bg: '#f4e9d6', // 暖米白
    orb: '#f2a33c', // 暖琥珀
    glow: 'rgba(242, 163, 60, 0.55)',
    text: '#5b4636',
    sub: '#a08663',
  },
  {
    key: 'slacking',
    label: '摸鱼',
    emoji: '🐟',
    desc: '暂时下线，放空一下',
    bg: '#efe8df', // 沙石灰
    orb: '#ef8f86', // 暖粉
    glow: 'rgba(239, 143, 134, 0.5)',
    text: '#6b4f4f',
    sub: '#a58888',
  },
  {
    key: 'busy',
    label: '忙碌',
    emoji: '⚡',
    desc: '火力全开，专注推进',
    bg: '#1d2230', // 深邃夜蓝
    orb: '#f6f1de', // 暖月白
    glow: 'rgba(246, 241, 222, 0.4)',
    text: '#eae6da',
    sub: '#9aa2b5',
  },
  {
    key: 'learning',
    label: '学习中',
    emoji: '📖',
    desc: '吸收知识，沉淀成长',
    bg: '#dae7f5', // 柔雾蓝
    orb: '#7087d4', // 柔靛
    glow: 'rgba(112, 135, 212, 0.5)',
    text: '#2e3a55',
    sub: '#7a86a2',
  },
  {
    key: 'resting',
    label: '放松',
    emoji: '🍵',
    desc: '慢下来，享受当下',
    bg: '#eef0f4', // 极淡雾蓝
    orb: '#b2a1d6', // 柔薰衣草
    glow: 'rgba(178, 161, 214, 0.5)',
    text: '#3b4055',
    sub: '#8a90a5',
  },
]

const CURRENT_KEY = 'mood-palette-current'
const HISTORY_KEY = 'mood-palette-history'

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []
  } catch {
    return []
  }
}

const currentKey = ref(localStorage.getItem(CURRENT_KEY) || 'creating')
const current = computed(() => moods.find((m) => m.key === currentKey.value) || moods[0])
const currentIndex = computed(() => moods.findIndex((m) => m.key === currentKey.value))
const history = ref(loadHistory())

function moodColor(key) {
  const m = moods.find((x) => x.key === key)
  return m ? m.orb : '#999'
}

function select(key) {
  if (key === currentKey.value) return
  currentKey.value = key
  localStorage.setItem(CURRENT_KEY, key)
  history.value.push({ key, time: Date.now() })
  if (history.value.length > 48) history.value = history.value.slice(-48)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value))
}

function selectOffset(offset) {
  const index = (currentIndex.value + offset + moods.length) % moods.length
  select(moods[index].key)
}

function clearHistory() {
  history.value = []
  localStorage.removeItem(HISTORY_KEY)
}

function historyTitle(item) {
  const mood = moods.find((m) => m.key === item.key)
  const time = new Date(item.time).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${mood?.label || '状态'} · ${time}`
}

function onKeydown(event) {
  const tag = (event.target?.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea') return
  if (event.key === 'ArrowLeft') selectOffset(-1)
  else if (event.key === 'ArrowRight') selectOffset(1)
  else if (/^[1-5]$/.test(event.key)) select(moods[Number(event.key) - 1].key)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

// 圆环：背景色 + 多层光晕，随心情平滑过渡
const orbStyle = computed(() => ({
  backgroundColor: current.value.orb,
  boxShadow: `0 0 0 1px ${current.value.glow}, 0 0 55px ${current.value.glow}, 0 0 130px ${current.value.glow}`,
}))
</script>

<template>
  <div class="mood" :style="{ backgroundColor: current.bg }">
    <PageBack class="mood-back" />

    <div class="mood-inner">
      <div class="orb-wrap">
        <button
          class="orb"
          :style="orbStyle"
          type="button"
          aria-label="切换到下一个状态"
          title="点击切换下一个状态"
          @click="selectOffset(1)"
        >
          <transition name="emoji-pop" mode="out-in">
            <span :key="currentKey" class="orb-emoji">{{ current.emoji }}</span>
          </transition>
          <span class="orb-ring ring-one"></span>
          <span class="orb-ring ring-two"></span>
        </button>
      </div>

      <transition name="label-shift" mode="out-in">
        <div :key="currentKey" class="mood-copy">
          <h2 class="mood-label" :style="{ color: current.text }">{{ current.label }}</h2>
          <p class="mood-desc" :style="{ color: current.sub }">{{ current.desc }}</p>
        </div>
      </transition>

      <div class="mood-options" role="list" aria-label="选择当前状态">
        <button
          v-for="(m, index) in moods"
          :key="m.key"
          type="button"
          class="mood-option"
          :class="{ active: m.key === currentKey }"
          :style="{ '--dot': m.orb, '--option-text': m.text }"
          :aria-pressed="m.key === currentKey"
          @click="select(m.key)"
        >
          <span class="option-emoji">{{ m.emoji }}</span>
          <span class="option-label">{{ m.label }}</span>
          <kbd>{{ index + 1 }}</kbd>
        </button>
      </div>

      <p class="keyboard-hint" :style="{ color: current.sub }">← → 切换状态 · 数字 1–5 快速选择</p>

      <div v-if="history.length" class="history" :style="{ color: current.sub }">
        <div class="history-head">
          <span class="history-label">近期状态 · {{ history.length }}</span>
          <button type="button" class="history-clear" @click="clearHistory">清空</button>
        </div>
        <span class="history-dots">
          <button
            v-for="(h, i) in history.slice(-18)"
            :key="`${h.time}-${i}`"
            type="button"
            class="h-dot"
            :style="{ backgroundColor: moodColor(h.key) }"
            :title="historyTitle(h)"
            :aria-label="historyTitle(h)"
            @click="select(h.key)"
          ></button>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 禅意极简：高亮度低饱和背景，圆环当主角 */
.mood {
  position: relative;
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 2.5rem;
  transition: background-color 800ms cubic-bezier(0.4, 0, 0.2, 1);
}

.mood-back {
  position: absolute;
  top: 1.6rem;
  left: 1.6rem;
  margin-bottom: 0;
  z-index: 5;
}

.mood-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

/* ===== 中央 Mood Orb ===== */
.orb-wrap {
  width: 260px;
  height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2.4rem;
}

.orb {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 800ms cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 800ms cubic-bezier(0.4, 0, 0.2, 1), transform 0.28s ease;
  animation: breathe 5.5s ease-in-out infinite;
}

.orb:hover {
  transform: scale(1.025);
}

.orb:active {
  transform: scale(0.98);
}

/* 多层渐变：高光 + 暗部，营造球体质感 */
.orb::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.55), transparent 44%),
    radial-gradient(circle at 68% 74%, rgba(0, 0, 0, 0.2), transparent 56%),
    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.05), transparent 72%);
}

.orb-emoji {
  font-size: 4.2rem;
  position: relative;
  z-index: 2;
  filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.18));
}

.orb-ring {
  position: absolute;
  inset: -14px;
  border: 1px solid currentColor;
  border-radius: 50%;
  opacity: 0.13;
  animation: ring-expand 3.2s ease-out infinite;
}

.ring-two {
  animation-delay: 1.6s;
}

.emoji-pop-enter-active,
.emoji-pop-leave-active,
.label-shift-enter-active,
.label-shift-leave-active {
  transition: opacity 0.3s ease, transform 0.38s cubic-bezier(0.16, 1, 0.3, 1), filter 0.3s ease;
}

.emoji-pop-enter-from {
  opacity: 0;
  transform: scale(0.5) rotate(-18deg);
  filter: blur(4px);
}

.emoji-pop-leave-to {
  opacity: 0;
  transform: scale(1.35) rotate(12deg);
  filter: blur(4px);
}

.label-shift-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.label-shift-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.mood-copy {
  min-height: 78px;
}

@keyframes ring-expand {
  0% { opacity: 0.18; transform: scale(0.9); }
  75%, 100% { opacity: 0; transform: scale(1.16); }
}

@keyframes breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.045);
  }
}

.mood-label {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  transition: color 800ms cubic-bezier(0.4, 0, 0.2, 1);
}

.mood-desc {
  margin-top: 0.6rem;
  font-size: 0.95rem;
  letter-spacing: 0.12em;
  transition: color 800ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* ===== 状态选择器 ===== */
.mood-options {
  display: grid;
  grid-template-columns: repeat(5, minmax(82px, 1fr));
  gap: 0.55rem;
  margin-top: 2.4rem;
}

.mood-option {
  position: relative;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.65rem;
  color: var(--option-text);
  background: rgba(255, 255, 255, 0.34);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 14px;
  backdrop-filter: blur(8px);
  opacity: 0.68;
  transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background 0.25s ease, box-shadow 0.3s ease;
}

.mood-option::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 3px;
  border-radius: 4px;
  background: var(--dot);
  transform: scaleY(0);
  transition: transform 0.25s ease;
}

.mood-option:hover {
  opacity: 1;
  transform: translateY(-3px);
  background: rgba(255, 255, 255, 0.52);
}

.mood-option.active {
  opacity: 1;
  transform: translateY(-4px);
  background: rgba(255, 255, 255, 0.62);
  box-shadow: 0 10px 25px -16px var(--dot);
}

.mood-option.active::before {
  transform: scaleY(1);
}

.option-emoji {
  font-size: 1rem;
}

.option-label {
  min-width: 0;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.mood-option kbd {
  margin-left: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.56rem;
  opacity: 0.45;
}

.keyboard-hint {
  margin-top: 0.8rem;
  font-size: 0.65rem;
  letter-spacing: 0.05em;
  opacity: 0.75;
  transition: color 800ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* ===== 近期状态（localStorage 历史） ===== */
.history {
  width: min(520px, 90vw);
  margin-top: 1.6rem;
  padding-top: 0.8rem;
  border-top: 1px solid currentColor;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  opacity: 0.82;
  transition: color 800ms cubic-bezier(0.4, 0, 0.2, 1);
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.55rem;
}

.history-clear {
  padding: 0.1rem 0.35rem;
  color: currentColor;
  background: transparent;
  border: none;
  font-size: 0.62rem;
  opacity: 0.6;
}

.history-clear:hover {
  opacity: 1;
}

.history-dots {
  display: flex;
  justify-content: center;
  gap: 5px;
  flex-wrap: wrap;
}

.h-dot {
  width: 8px;
  height: 8px;
  padding: 0;
  border: none;
  border-radius: 50%;
  opacity: 0.75;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.h-dot:hover {
  opacity: 1;
  transform: scale(1.55);
}

@media (max-width: 640px) {
  .mood {
    padding: 5rem 1rem 2rem;
  }
  .orb-wrap {
    width: 200px;
    height: 200px;
  }
  .orb-emoji {
    font-size: 3.2rem;
  }
  .mood-label {
    font-size: 1.6rem;
  }
  .mood-options {
    width: min(330px, 90vw);
    grid-template-columns: repeat(5, 1fr);
    gap: 0.35rem;
  }
  .mood-option {
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.48rem 0.2rem;
  }
  .mood-option kbd {
    display: none;
  }
  .option-label {
    font-size: 0.62rem;
  }
}
</style>
