import { ref, computed } from 'vue'

/* ============================================================
   专注中心：番茄钟 + 喝水提醒 + 护眼提醒
   模块级单例，切到其他页面后计时与提醒仍继续运行
   ============================================================ */

const KEY = 'focus-center-state'

function todayKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const DEFAULTS = {
  settings: {
    focus: 25,
    short: 5,
    long: 15,
    autoNext: false,
    waterEnabled: true,
    waterGoal: 8,
    waterInterval: 45,
    eyeEnabled: true,
    eyeInterval: 45,
  },
  stats: { day: todayKey(), focusCount: 0, focusSeconds: 0, cups: 0 },
  timer: { mode: 'focus', remaining: 25 * 60, running: false, endAt: 0 },
  reminders: { waterNext: 0, eyeNext: 0 },
}

function load() {
  let saved = null
  try {
    saved = JSON.parse(localStorage.getItem(KEY))
  } catch {
    saved = null
  }
  const s = saved && typeof saved === 'object' ? saved : {}
  const state = {
    settings: { ...DEFAULTS.settings, ...(s.settings || {}) },
    stats: { ...DEFAULTS.stats, ...(s.stats || {}) },
    timer: { ...DEFAULTS.timer, ...(s.timer || {}) },
    reminders: { ...DEFAULTS.reminders, ...(s.reminders || {}) },
  }

  // 跨天后重置当日统计
  if (state.stats.day !== todayKey()) {
    state.stats = { day: todayKey(), focusCount: 0, focusSeconds: 0, cups: 0 }
  }

  // 上次关闭时正在计时：按真实时间补齐
  if (state.timer.running) {
    const remain = Math.round((state.timer.endAt - Date.now()) / 1000)
    if (remain > 0) state.timer.remaining = remain
    else {
      state.timer.running = false
      state.timer.remaining = state.settings[state.timer.mode] * 60
    }
  }

  // 提醒时间未初始化时，从当前时刻开始计时
  const now = Date.now()
  if (!state.reminders.waterNext) {
    state.reminders.waterNext = now + state.settings.waterInterval * 60000
  }
  if (!state.reminders.eyeNext) {
    state.reminders.eyeNext = now + state.settings.eyeInterval * 60000
  }

  return state
}

export const focusState = ref(load())

function save() {
  localStorage.setItem(KEY, JSON.stringify(focusState.value))
}

// 计时过程中每秒写一次 localStorage 没必要，5 秒落盘一次即可
let lastTickSave = 0
function tickSave() {
  const now = Date.now()
  if (now - lastTickSave < 5000) return
  lastTickSave = now
  save()
}

/* ---------------- 提醒/通知 ---------------- */
export const alerts = ref([])

function pushAlert(title, body) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  alerts.value.push({ id, title, body })
  setTimeout(() => dismissAlert(id), 6000)
}

export function dismissAlert(id) {
  alerts.value = alerts.value.filter((a) => a.id !== id)
}

function notify(title, body) {
  pushAlert(title, body)
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body })
    } catch {
      // 某些浏览器要求 Service Worker，静默降级为页内提示
    }
  }
}

export function requestNotifyPermission() {
  if (!('Notification' in window)) return Promise.resolve('unsupported')
  return Notification.requestPermission()
}

export function notifyPermission() {
  return 'Notification' in window ? Notification.permission : 'unsupported'
}

/* ---------------- 番茄钟 ---------------- */
const MODE_LABEL = { focus: '专注', short: '短休息', long: '长休息' }

export const TIMER_MODE_LABEL = MODE_LABEL

export const timerRemaining = computed(() => focusState.value.timer.remaining)
export const timerRunning = computed(() => focusState.value.timer.running)
export const timerMode = computed(() => focusState.value.timer.mode)

export const timerText = computed(() => {
  const s = focusState.value.timer.remaining
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
})

export const timerProgress = computed(() => {
  const total = Math.max(1, focusState.value.settings[focusState.value.timer.mode] * 60)
  return 1 - focusState.value.timer.remaining / total
})

export function switchMode(mode) {
  const t = focusState.value.timer
  t.mode = mode
  t.remaining = focusState.value.settings[mode] * 60
  t.running = false
  t.endAt = 0
  save()
}

export function startTimer() {
  const t = focusState.value.timer
  if (t.running) return
  if (t.remaining <= 0) t.remaining = focusState.value.settings[t.mode] * 60
  t.endAt = Date.now() + t.remaining * 1000
  t.running = true
  save()
}

export function pauseTimer() {
  const t = focusState.value.timer
  if (!t.running) return
  t.remaining = Math.max(0, Math.round((t.endAt - Date.now()) / 1000))
  t.running = false
  t.endAt = 0
  save()
}

export function resetTimer() {
  const t = focusState.value.timer
  t.remaining = focusState.value.settings[t.mode] * 60
  t.running = false
  t.endAt = 0
  save()
}

// 跳过不记为完成，只切换阶段
export function skipTimer() {
  const state = focusState.value
  const t = state.timer
  t.running = false
  t.endAt = 0
  if (t.mode === 'focus') {
    const next = state.stats.focusCount % 4 === 0 ? 'long' : 'short'
    t.mode = next
    t.remaining = state.settings[next] * 60
  } else {
    t.mode = 'focus'
    t.remaining = state.settings.focus * 60
  }
  save()
}

function completeTimer() {
  const state = focusState.value
  const t = state.timer
  const mode = t.mode
  t.running = false
  t.endAt = 0

  if (mode === 'focus') {
    state.stats.focusCount++
    state.stats.focusSeconds += state.settings.focus * 60
    // 每完成 4 个专注进入长休息
    const next = state.stats.focusCount % 4 === 0 ? 'long' : 'short'
    t.mode = next
    t.remaining = state.settings[next] * 60
    notify('🍅 专注完成', `休息一下，${MODE_LABEL[next]} ${state.settings[next]} 分钟`)
  } else {
    t.mode = 'focus'
    t.remaining = state.settings.focus * 60
    notify('☕ 休息结束', '准备好了就开始下一轮专注')
  }

  if (state.settings.autoNext) {
    t.endAt = Date.now() + t.remaining * 1000
    t.running = true
  }
  save()
}

/* ---------------- 喝水 ---------------- */
export function addCup() {
  const s = focusState.value
  s.stats.cups++
  s.reminders.waterNext = Date.now() + s.settings.waterInterval * 60000
  save()
}

export function removeCup() {
  const s = focusState.value
  s.stats.cups = Math.max(0, s.stats.cups - 1)
  save()
}

/* ---------------- 护眼 ---------------- */
export const eyeResting = ref(0) // 20 秒护眼倒计时剩余
let eyeTimer = null

export function stopEyeRest() {
  if (eyeTimer) clearInterval(eyeTimer)
  eyeTimer = null
  eyeResting.value = 0
}

export function startEyeRest() {
  if (eyeTimer) clearInterval(eyeTimer)
  eyeResting.value = 20
  focusState.value.reminders.eyeNext = Date.now() + focusState.value.settings.eyeInterval * 60000
  save()
  eyeTimer = setInterval(() => {
    eyeResting.value--
    if (eyeResting.value <= 0) {
      clearInterval(eyeTimer)
      eyeTimer = null
      eyeResting.value = 0
    }
  }, 1000)
}

/* ---------------- 设置 ---------------- */
export function setSetting(key, value) {
  const s = focusState.value
  s.settings[key] = value
  // 正在计时的时长类设置：未运行时同步剩余时间
  if (['focus', 'short', 'long'].includes(key) && !s.timer.running && s.timer.mode === key) {
    s.timer.remaining = value * 60
  }
  if (key === 'waterInterval') {
    s.reminders.waterNext = Date.now() + value * 60000
  }
  if (key === 'eyeInterval') {
    s.reminders.eyeNext = Date.now() + value * 60000
  }
  if (key === 'waterEnabled' && value) {
    s.reminders.waterNext = Date.now() + s.settings.waterInterval * 60000
  }
  if (key === 'eyeEnabled' && value) {
    s.reminders.eyeNext = Date.now() + s.settings.eyeInterval * 60000
  }
  save()
}

/* ---------------- 引擎 ---------------- */
export const tickNow = ref(Date.now())
let engineTimer = null

function rollDay() {
  const st = focusState.value.stats
  const k = todayKey()
  if (st.day !== k) {
    st.day = k
    st.focusCount = 0
    st.focusSeconds = 0
    st.cups = 0
  }
}

function step() {
  const state = focusState.value
  tickNow.value = Date.now()
  rollDay()

  // 番茄钟
  const t = state.timer
  if (t.running) {
    const remain = Math.max(0, Math.round((t.endAt - Date.now()) / 1000))
    t.remaining = remain
    if (remain <= 0) completeTimer()
  }

  // 提醒
  const now = Date.now()
  if (state.settings.waterEnabled && now >= state.reminders.waterNext) {
    state.reminders.waterNext = now + state.settings.waterInterval * 60000
    notify('💧 该喝水了', `今天已喝 ${state.stats.cups} 杯，目标 ${state.settings.waterGoal} 杯`)
  }
  if (state.settings.eyeEnabled && now >= state.reminders.eyeNext) {
    state.reminders.eyeNext = now + state.settings.eyeInterval * 60000
    notify('👀 让眼睛休息一下', '20-20-20：看 6 米外的东西 20 秒')
  }

  tickSave()
}

export function ensureFocusEngine() {
  if (engineTimer) return
  engineTimer = setInterval(step, 1000)
}

// 导入即启动，保证离开组件页面后提醒仍然有效
if (typeof window !== 'undefined') ensureFocusEngine()
