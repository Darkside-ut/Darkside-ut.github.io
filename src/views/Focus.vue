<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  focusState,
  timerText,
  timerRunning,
  timerMode,
  timerProgress,
  TIMER_MODE_LABEL,
  startTimer,
  pauseTimer,
  resetTimer,
  skipTimer,
  switchMode,
  setSetting,
  addCup,
  removeCup,
  startEyeRest,
  stopEyeRest,
  eyeResting,
  tickNow,
  notifyPermission,
  requestNotifyPermission,
} from '../composables/useFocus.js'

const CIRC = 2 * Math.PI * 86

const permission = ref(notifyPermission())

const settings = computed(() => focusState.value.settings)
const stats = computed(() => focusState.value.stats)

const ringOffset = computed(() => CIRC * (1 - timerProgress.value))

const focusMinutes = computed(() => Math.round(stats.value.focusSeconds / 60))

const cups = computed(() =>
  Array.from({ length: Math.max(settings.value.waterGoal, stats.value.cups) }, (_, i) => i)
)

function nextText(at) {
  const ms = at - tickNow.value
  if (ms <= 0) return '即将提醒'
  const min = Math.ceil(ms / 60000)
  return min >= 1 ? `${min} 分钟后` : '不到 1 分钟'
}

const waterNextText = computed(() => nextText(focusState.value.reminders.waterNext))
const eyeNextText = computed(() => nextText(focusState.value.reminders.eyeNext))

async function enableNotify() {
  permission.value = await requestNotifyPermission()
}

function setNumber(key, e, min = 1, max = 999) {
  const v = Math.min(max, Math.max(min, Number(e.target.value) || min))
  e.target.value = v
  setSetting(key, v)
}

onMounted(() => {
  // 通知权限可能在别处已变更
  permission.value = notifyPermission()
})

const modes = ['focus', 'short', 'long']
</script>

<template>
  <div class="page">
    <div class="page-card focus-card">
      <h2 class="page-title">专注中心</h2>
      <div class="section-sub">番茄钟 · 喝水提醒 · 护眼提醒</div>

      <!-- ===== 番茄钟 ===== -->
      <div class="timer-card">
        <div class="mode-tabs">
          <button
            v-for="m in modes"
            :key="m"
            class="mode-tab"
            :class="{ active: timerMode === m }"
            @click="switchMode(m)"
          >
            {{ TIMER_MODE_LABEL[m] }}
          </button>
        </div>

        <div class="ring-wrap">
          <svg class="ring" viewBox="0 0 200 200">
            <circle class="ring-bg" cx="100" cy="100" r="86" />
            <circle
              class="ring-fg"
              :class="timerMode"
              cx="100"
              cy="100"
              r="86"
              :stroke-dasharray="CIRC"
              :stroke-dashoffset="ringOffset"
            />
          </svg>
          <div class="ring-center">
            <div class="time">{{ timerText }}</div>
            <div class="mode-label">{{ TIMER_MODE_LABEL[timerMode] }}</div>
          </div>
        </div>

        <div class="timer-controls">
          <button class="primary-btn" @click="timerRunning ? pauseTimer() : startTimer()">
            {{ timerRunning ? '暂停' : '开始' }}
          </button>
          <button class="ghost-btn" @click="resetTimer">重置</button>
          <button class="ghost-btn" @click="skipTimer">跳过</button>
        </div>

        <div class="timer-stats">
          今日完成 <b>{{ stats.focusCount }}</b> 个番茄 · 专注
          <b>{{ focusMinutes }}</b> 分钟
        </div>

        <button
          v-if="permission !== 'granted' && permission !== 'unsupported'"
          class="notify-btn"
          @click="enableNotify"
        >
          🔔 开启系统通知
        </button>
        <div v-else-if="permission === 'denied'" class="notify-hint">
          通知已被浏览器拦截，提醒会显示在页面右上角
        </div>
      </div>

      <!-- ===== 提醒 ===== -->
      <div class="reminder-grid">
        <!-- 喝水 -->
        <section class="reminder-card">
          <div class="rc-head">
            <span class="rc-icon">💧</span>
            <span class="rc-title">喝水提醒</span>
            <label class="switch">
              <input
                type="checkbox"
                :checked="settings.waterEnabled"
                @change="setSetting('waterEnabled', $event.target.checked)"
              />
              <span class="slider"></span>
            </label>
          </div>

          <div class="cups">
            <span
              v-for="i in cups"
              :key="i"
              class="cup"
              :class="{ filled: i < stats.cups }"
            >
              {{ i < stats.cups ? '🥤' : '○' }}
            </span>
          </div>

          <div class="rc-meta">
            {{ stats.cups }} / {{ settings.waterGoal }} 杯
            <span v-if="settings.waterEnabled">· 下次 {{ waterNextText }}</span>
          </div>

          <div class="rc-actions">
            <button class="ghost-btn small" @click="removeCup">−1</button>
            <button class="primary-btn small" @click="addCup">+1 杯</button>
          </div>

          <div class="rc-settings">
            <label>
              目标
              <input
                type="number"
                min="1"
                max="20"
                :value="settings.waterGoal"
                @change="setNumber('waterGoal', $event, 1, 20)"
              />
              杯
            </label>
            <label>
              间隔
              <input
                type="number"
                min="10"
                max="180"
                :value="settings.waterInterval"
                @change="setNumber('waterInterval', $event, 10, 180)"
              />
              分
            </label>
          </div>
        </section>

        <!-- 护眼 -->
        <section class="reminder-card">
          <div class="rc-head">
            <span class="rc-icon">👀</span>
            <span class="rc-title">护眼提醒</span>
            <label class="switch">
              <input
                type="checkbox"
                :checked="settings.eyeEnabled"
                @change="setSetting('eyeEnabled', $event.target.checked)"
              />
              <span class="slider"></span>
            </label>
          </div>

          <p class="eye-desc">20-20-20 法则：每 20 分钟，看 6 米外的东西 20 秒。</p>

          <div class="rc-meta">
            <span v-if="settings.eyeEnabled">下次 {{ eyeNextText }}</span>
            <span v-else>提醒已关闭</span>
          </div>

          <div class="rc-actions">
            <button class="primary-btn small" @click="startEyeRest">开始 20 秒休息</button>
          </div>

          <div class="rc-settings">
            <label>
              间隔
              <input
                type="number"
                min="10"
                max="180"
                :value="settings.eyeInterval"
                @change="setNumber('eyeInterval', $event, 10, 180)"
              />
              分
            </label>
          </div>
        </section>
      </div>

      <!-- ===== 番茄钟设置 ===== -->
      <div class="timer-settings">
        <label>
          专注
          <input
            type="number"
            min="1"
            max="120"
            :value="settings.focus"
            @change="setNumber('focus', $event, 1, 120)"
          />
          分
        </label>
        <label>
          短休
          <input
            type="number"
            min="1"
            max="60"
            :value="settings.short"
            @change="setNumber('short', $event, 1, 60)"
          />
          分
        </label>
        <label>
          长休
          <input
            type="number"
            min="1"
            max="90"
            :value="settings.long"
            @change="setNumber('long', $event, 1, 90)"
          />
          分
        </label>
        <label class="auto-next">
          <input
            type="checkbox"
            :checked="settings.autoNext"
            @change="setSetting('autoNext', $event.target.checked)"
          />
          自动开始下一轮
        </label>
      </div>
    </div>

    <!-- ===== 护眼倒计时遮罩 ===== -->
    <teleport to="body">
      <div v-if="eyeResting > 0" class="eye-overlay">
        <div class="eye-count">{{ eyeResting }}</div>
        <p>看看 6 米外的东西</p>
        <button class="ghost-btn" @click="stopEyeRest">结束休息</button>
      </div>
    </teleport>
  </div>
</template>

<style scoped>
.focus-card {
  max-width: 760px;
}

/* ===== 番茄钟 ===== */
.timer-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.2rem 0 1.4rem;
  margin-bottom: 1.2rem;
  border-radius: 20px;
  background: rgba(245, 249, 255, 0.62);
  border: 1px solid rgba(37, 99, 235, 0.12);
}

.mode-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 11px;
  background: rgba(219, 234, 254, 0.6);
  margin-bottom: 1.1rem;
}

.mode-tab {
  padding: 0.32rem 0.9rem;
  font-family: inherit;
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--text-dim);
  background: transparent;
  border: none;
  border-radius: 8px;
  transition: 0.2s;
}

.mode-tab.active {
  color: #fff;
  background: linear-gradient(135deg, #1d4ed8, #2563eb);
  box-shadow: 0 4px 12px -4px rgba(37, 99, 235, 0.5);
}

.ring-wrap {
  position: relative;
  width: 230px;
  height: 230px;
}

.ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-bg {
  fill: none;
  stroke: rgba(37, 99, 235, 0.1);
  stroke-width: 10;
}

.ring-fg {
  fill: none;
  stroke: #2563eb;
  stroke-width: 10;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s linear, stroke 0.3s;
}

.ring-fg.short {
  stroke: #34a86c;
}

.ring-fg.long {
  stroke: #8b5cf6;
}

.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.time {
  font-size: 2.9rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  color: #16305c;
}

.mode-label {
  margin-top: 0.2rem;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  color: var(--text-dim);
}

.timer-controls {
  display: flex;
  gap: 0.55rem;
  margin-top: 1rem;
}

.timer-stats {
  margin-top: 0.8rem;
  font-size: 0.74rem;
  color: var(--text-dim);
}

.timer-stats b {
  color: var(--accent);
}

.notify-btn {
  margin-top: 0.7rem;
  padding: 0.32rem 0.9rem;
  font-size: 0.7rem;
  color: var(--accent);
  background: rgba(37, 99, 235, 0.08);
  border: 1px dashed rgba(37, 99, 235, 0.35);
  border-radius: 20px;
}

.notify-hint {
  margin-top: 0.7rem;
  font-size: 0.66rem;
  color: #9aa8c0;
}

/* ===== 提醒卡片 ===== */
.reminder-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;
  margin-bottom: 1rem;
}

.reminder-card {
  padding: 0.9rem 1rem;
  border-radius: 16px;
  background: rgba(245, 249, 255, 0.62);
  border: 1px solid rgba(37, 99, 235, 0.12);
}

.rc-head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.rc-icon {
  font-size: 1.1rem;
}

.rc-title {
  flex: 1;
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--text-dark);
}

/* 开关 */
.switch {
  position: relative;
  width: 36px;
  height: 20px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  inset: 0;
  border-radius: 20px;
  background: rgba(120, 140, 170, 0.3);
  transition: 0.25s;
}

.slider::before {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  top: 3px;
  left: 3px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: 0.25s;
}

.switch input:checked + .slider {
  background: var(--accent);
}

.switch input:checked + .slider::before {
  transform: translateX(16px);
}

.cups {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin: 0.7rem 0 0.5rem;
  font-size: 1rem;
  line-height: 1;
}

.cup {
  color: #c3cfe0;
  opacity: 0.7;
}

.cup.filled {
  opacity: 1;
}

.rc-meta {
  font-size: 0.7rem;
  color: var(--text-dim);
}

.eye-desc {
  margin: 0.55rem 0;
  font-size: 0.7rem;
  line-height: 1.6;
  color: #8d9bb5;
}

.rc-actions {
  display: flex;
  gap: 0.45rem;
  margin-top: 0.6rem;
}

.rc-settings {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin-top: 0.7rem;
  padding-top: 0.6rem;
  border-top: 1px dashed rgba(37, 99, 235, 0.15);
}

.rc-settings label,
.timer-settings label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  color: var(--text-dim);
}

.rc-settings input[type='number'],
.timer-settings input[type='number'] {
  width: 52px;
  padding: 0.2rem 0.35rem;
  font-family: inherit;
  font-size: 0.72rem;
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 7px;
  outline: none;
  background: #fff;
  text-align: center;
}

/* ===== 番茄钟设置 ===== */
.timer-settings {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem 1.2rem;
  padding: 0.8rem 1rem;
  border-radius: 14px;
  background: rgba(219, 234, 254, 0.45);
  border: 1px solid rgba(37, 99, 235, 0.1);
}

.auto-next input {
  accent-color: var(--accent);
}

/* ===== 按钮 ===== */
.primary-btn {
  padding: 0.5rem 1.2rem;
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

.primary-btn.small {
  padding: 0.36rem 0.8rem;
  font-size: 0.72rem;
}

.ghost-btn {
  padding: 0.5rem 1rem;
  font-family: inherit;
  font-size: 0.78rem;
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

.ghost-btn.small {
  padding: 0.36rem 0.7rem;
  font-size: 0.72rem;
}

/* ===== 护眼遮罩 ===== */
.eye-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  background: rgba(12, 30, 60, 0.82);
  backdrop-filter: blur(6px);
  color: #fff;
  animation: eye-in 0.3s ease;
}

.eye-count {
  font-size: 5rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.eye-overlay p {
  font-size: 0.95rem;
  letter-spacing: 0.1em;
  opacity: 0.85;
}

.eye-overlay .ghost-btn {
  margin-top: 1rem;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.35);
}

@keyframes eye-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* ===== 响应式 ===== */
@media (max-width: 640px) {
  .reminder-grid {
    grid-template-columns: 1fr;
  }
  .ring-wrap {
    width: 190px;
    height: 190px;
  }
  .time {
    font-size: 2.3rem;
  }
}
</style>
