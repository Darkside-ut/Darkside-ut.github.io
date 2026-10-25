<script setup>
import { ref, computed } from 'vue'
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
const current = computed(() => moods.find((m) => m.key === currentKey.value))
const history = ref(loadHistory())

function moodColor(key) {
  const m = moods.find((x) => x.key === key)
  return m ? m.orb : '#999'
}

function select(key) {
  currentKey.value = key
  localStorage.setItem(CURRENT_KEY, key)
  history.value.push({ key, time: Date.now() })
  if (history.value.length > 48) history.value = history.value.slice(-48)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value))
}

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
        <div class="orb" :style="orbStyle">
          <span class="orb-emoji">{{ current.emoji }}</span>
        </div>
      </div>

      <h2 class="mood-label" :style="{ color: current.text }">{{ current.label }}</h2>
      <p class="mood-desc" :style="{ color: current.sub }">{{ current.desc }}</p>

      <div class="dots">
        <button
          v-for="m in moods"
          :key="m.key"
          class="dot"
          :class="{ active: m.key === currentKey }"
          :style="{ backgroundColor: m.orb, '--dot': m.orb }"
          :title="m.label"
          :aria-label="m.label"
          @click="select(m.key)"
        ></button>
      </div>

      <div v-if="history.length" class="history" :style="{ color: current.sub }">
        <span class="history-label">近期状态</span>
        <span class="history-dots">
          <span
            v-for="(h, i) in history.slice(-18)"
            :key="i"
            class="h-dot"
            :style="{ backgroundColor: moodColor(h.key) }"
          ></span>
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
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 800ms cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 800ms cubic-bezier(0.4, 0, 0.2, 1);
  animation: breathe 5.5s ease-in-out infinite;
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
  z-index: 1;
  filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.18));
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

/* ===== 底部状态点 ===== */
.dots {
  display: flex;
  gap: 1.2rem;
  margin-top: 3.2rem;
}

.dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: none;
  padding: 0;
  cursor: pointer;
  opacity: 0.4;
  transform: scale(0.85);
  transition: opacity 800ms cubic-bezier(0.4, 0, 0.2, 1),
    transform 800ms cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 800ms cubic-bezier(0.4, 0, 0.2, 1);
}

.dot:hover {
  opacity: 0.7;
}

.dot.active {
  opacity: 1;
  transform: scale(1.28);
  box-shadow: 0 0 14px var(--dot);
}

/* ===== 近期状态（localStorage 历史） ===== */
.history {
  margin-top: 2.2rem;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  transition: color 800ms cubic-bezier(0.4, 0, 0.2, 1);
}

.history-label {
  flex-shrink: 0;
}

.history-dots {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.h-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  opacity: 0.85;
}

@media (max-width: 640px) {
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
}
</style>
