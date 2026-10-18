import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

// 日程数据在侧栏和日历页之间共享：模块级 ref + localStorage 持久化
const STORAGE_KEY = 'site-schedule-events'

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export const events = ref(load())

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events.value))
}

// 跨标签页同步
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) events.value = load()
})

export function addEvent(ev) {
  events.value.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    done: false,
    ...ev,
  })
  persist()
}

export function updateEvent(id, patch) {
  const ev = events.value.find((e) => e.id === id)
  if (!ev) return
  Object.assign(ev, patch)
  persist()
}

export function removeEvent(id) {
  events.value = events.value.filter((e) => e.id !== id)
  persist()
}

export function toggleDone(id) {
  const ev = events.value.find((e) => e.id === id)
  if (!ev) return
  ev.done = !ev.done
  persist()
}

// YYYY-MM-DD（本地时区，避免 toISOString 的 UTC 偏移）
export function dateKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function eventDateTime(ev) {
  // 无时间（全天）默认当天 23:59 截止
  return new Date(`${ev.date}T${ev.time || '23:59'}:00`)
}

export function msLeft(ev, now = Date.now()) {
  return eventDateTime(ev).getTime() - now
}

// 紧迫度配色：7 天以上黄，越近越红
export function urgencyColor(ms) {
  const DAY = 86400000
  const t = Math.min(1, Math.max(0, 1 - ms / (7 * DAY))) // 0 宽松 → 1 最紧迫
  const hue = 45 * (1 - t) // 45 黄 → 0 红
  return `hsl(${hue.toFixed(1)}, 82%, ${52 - 4 * t}%)`
}

// 剩余时间简写：2天3小时 / 5小时 / 23分钟 / 已过期
export function formatLeft(ms) {
  if (ms <= 0) return '已过期'
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min}分钟`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}小时`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh ? `${d}天${rh}小时` : `${d}天`
}

// 每 30 秒刷新一次“现在”，让倒计时和颜色随时间推进
export function useNow(interval = 30000) {
  const now = ref(Date.now())
  let timer
  onMounted(() => {
    timer = setInterval(() => (now.value = Date.now()), interval)
  })
  onBeforeUnmount(() => clearInterval(timer))
  return now
}

// 临近的 ddl：未完成、未过期、按截止时间升序
export function useUpcomingDdl(now, withinDays = 7, limit = 3) {
  return computed(() => {
    const DAY = 86400000
    return events.value
      .filter((e) => e.ddl && !e.done)
      .map((e) => ({ ...e, left: msLeft(e, now.value) }))
      .filter((e) => e.left > 0 && e.left <= withinDays * DAY)
      .sort((a, b) => a.left - b.left)
      .slice(0, limit)
  })
}
