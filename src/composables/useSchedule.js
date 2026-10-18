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
    repeat: 'none',
    interval: 1,
    doneOn: [],
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

// 重复日程按「日期」记录完成状态，普通日程只记录一个 done
export function isRepeating(ev) {
  return !!ev.repeat && ev.repeat !== 'none'
}

export function isDoneOn(ev, key) {
  if (isRepeating(ev)) return (ev.doneOn || []).includes(key)
  return !!ev.done
}

export function toggleDone(id, key) {
  const ev = events.value.find((e) => e.id === id)
  if (!ev) return
  if (isRepeating(ev) && key) {
    const set = new Set(ev.doneOn || [])
    set.has(key) ? set.delete(key) : set.add(key)
    ev.doneOn = [...set]
  } else {
    ev.done = !ev.done
  }
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

export const REPEAT_LABEL = {
  none: '',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
}

const REPEAT_UNIT = { daily: '天', weekly: '周', monthly: '个月' }

// 「每 2 周」这样的完整描述
export function repeatText(ev) {
  const base = REPEAT_LABEL[ev.repeat || 'none']
  if (!base) return ''
  const n = Math.max(1, Number(ev.interval) || 1)
  return n === 1 ? base : `每 ${n} ${REPEAT_UNIT[ev.repeat]}`
}

function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// 某条日程是否发生在 key 这一天
export function occursOn(ev, key) {
  if (!isRepeating(ev)) return ev.date === key
  if (key < ev.date) return false
  if (ev.until && key > ev.until) return false
  const anchor = keyToDate(ev.date)
  const day = keyToDate(key)
  const every = Math.max(1, Number(ev.interval) || 1)
  const diffDays = Math.round((day - anchor) / 86400000)

  if (ev.repeat === 'daily') return diffDays % every === 0
  if (ev.repeat === 'weekly') {
    return anchor.getDay() === day.getDay() && diffDays % (7 * every) === 0
  }
  if (ev.repeat === 'monthly') {
    const months =
      (day.getFullYear() - anchor.getFullYear()) * 12 + (day.getMonth() - anchor.getMonth())
    return day.getDate() === anchor.getDate() && months % every === 0
  }
  return false
}

// 下一次发生的时间戳（含时间），找不到则回退到首次时间
export function nextOccurrenceTime(ev, now = Date.now()) {
  const base = eventDateTime(ev).getTime()
  if (!isRepeating(ev)) return base
  const [hh, mm] = (ev.time || '23:59').split(':').map(Number)
  const start = keyToDate(ev.date)
  const today = new Date()
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (cursor < start) cursor = new Date(start)
  // 每天步进，最多找 10 年，覆盖较大间隔（如每 2 周、每 3 月）
  for (let i = 0; i < 3660; i++) {
    const key = dateKey(cursor)
    if (occursOn(ev, key)) {
      const t = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), hh, mm).getTime()
      if (t > now) return t
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return base
}

export function msLeft(ev, now = Date.now()) {
  return nextOccurrenceTime(ev, now) - now
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
