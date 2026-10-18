<script setup>
import { ref, computed } from 'vue'
import { ArrowLeft, ArrowRight, Plus, Delete, Check } from '@element-plus/icons-vue'
import {
  events,
  addEvent,
  removeEvent,
  toggleDone,
  dateKey,
  eventDateTime,
  msLeft,
  urgencyColor,
  formatLeft,
  useNow,
} from '../composables/useSchedule.js'

const now = useNow(30000)
const today = ref(new Date())
const selected = ref(dateKey())

const form = ref({ title: '', time: '', note: '', ddl: true })

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

// 当前月网格：补齐前后空白，固定 6 行
const monthGrid = computed(() => {
  const y = today.value.getFullYear()
  const m = today.value.getMonth()
  const first = new Date(y, m, 1)
  const start = new Date(y, m, 1 - first.getDay())
  const cells = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    cells.push({
      key: dateKey(d),
      day: d.getDate(),
      inMonth: d.getMonth() === m,
      isToday: dateKey(d) === dateKey(),
    })
  }
  return cells
})

const monthLabel = computed(
  () => `${today.value.getFullYear()} 年 ${today.value.getMonth() + 1} 月`
)

// 每天的事件（含颜色）
const eventsByDay = computed(() => {
  const map = {}
  for (const e of events.value) {
    ;(map[e.date] ||= []).push(e)
  }
  return map
})

const dayEvents = computed(() =>
  (eventsByDay.value[selected.value] || []).slice().sort((a, b) => {
    // 有时间的排前面，再按时间
    const ta = a.time || '99:99'
    const tb = b.time || '99:99'
    return ta.localeCompare(tb)
  })
)

function dotColor(e) {
  if (e.done) return '#b7c2d6'
  if (!e.ddl) return '#60a5fa'
  return urgencyColor(msLeft(e, now.value))
}

function itemColor(e) {
  return e.ddl && !e.done ? urgencyColor(msLeft(e, now.value)) : 'var(--accent)'
}

function prevMonth() {
  const d = today.value
  today.value = new Date(d.getFullYear(), d.getMonth() - 1, 1)
}

function nextMonth() {
  const d = today.value
  today.value = new Date(d.getFullYear(), d.getMonth() + 1, 1)
}

function goToday() {
  today.value = new Date()
  selected.value = dateKey()
}

function selectDay(key, inMonth) {
  selected.value = key
  if (!inMonth) {
    const [y, m] = key.split('-').map(Number)
    today.value = new Date(y, m - 1, 1)
  }
}

function submit() {
  const title = form.value.title.trim()
  if (!title) return
  addEvent({
    date: selected.value,
    title,
    time: form.value.time,
    note: form.value.note.trim(),
    ddl: form.value.ddl,
  })
  form.value = { title: '', time: '', note: '', ddl: true }
}

function leftText(e) {
  if (e.done) return '已完成'
  const ms = msLeft(e, now.value)
  return ms <= 0 ? '已过期' : `剩 ${formatLeft(ms)}`
}

const selectedLabel = computed(() => {
  const [y, m, d] = selected.value.split('-').map(Number)
  return `${y} 年 ${m} 月 ${d} 日`
})

const monthStats = computed(() => {
  const prefix = `${today.value.getFullYear()}-${String(today.value.getMonth() + 1).padStart(2, '0')}`
  const list = events.value.filter((e) => e.date.startsWith(prefix))
  return {
    total: list.length,
    ddl: list.filter((e) => e.ddl).length,
    todo: list.filter((e) => !e.done).length,
  }
})
</script>

<template>
  <div class="page">
    <div class="page-card calendar-card">
      <h2 class="page-title">日历</h2>
      <div class="section-sub">日程与 DDL 管理，临近任务会出现在侧栏头像旁</div>

      <div class="cal-layout">
        <!-- ============ 月历 ============ -->
        <div class="cal-main">
          <div class="cal-head">
            <button class="nav-btn" @click="prevMonth" aria-label="上个月">
              <el-icon><ArrowLeft /></el-icon>
            </button>
            <div class="cal-month">
              {{ monthLabel }}
              <span class="month-stat">{{ monthStats.todo }} 项未完成</span>
            </div>
            <button class="nav-btn" @click="nextMonth" aria-label="下个月">
              <el-icon><ArrowRight /></el-icon>
            </button>
            <button class="today-btn" @click="goToday">今天</button>
          </div>

          <div class="weekdays">
            <span v-for="w in WEEKDAYS" :key="w">{{ w }}</span>
          </div>

          <div class="grid">
            <button
              v-for="c in monthGrid"
              :key="c.key"
              class="cell"
              :class="{
                out: !c.inMonth,
                today: c.isToday,
                selected: c.key === selected,
              }"
              @click="selectDay(c.key, c.inMonth)"
            >
              <span class="cell-day">{{ c.day }}</span>
              <span class="dots">
                <span
                  v-for="e in (eventsByDay[c.key] || []).slice(0, 4)"
                  :key="e.id"
                  class="dot"
                  :style="{ backgroundColor: dotColor(e) }"
                ></span>
              </span>
            </button>
          </div>
        </div>

        <!-- ============ 当天日程 ============ -->
        <div class="cal-side">
          <div class="side-head">
            <span class="side-date">{{ selectedLabel }}</span>
            <span class="side-count">{{ dayEvents.length }} 项</span>
          </div>

          <div class="day-list">
            <div v-if="!dayEvents.length" class="empty">这一天还没有安排</div>
            <div
              v-for="e in dayEvents"
              :key="e.id"
              class="event"
              :class="{ done: e.done }"
              :style="{ '--ev': itemColor(e) }"
            >
              <button class="check" :class="{ on: e.done }" @click="toggleDone(e.id)" aria-label="完成">
                <el-icon v-if="e.done"><Check /></el-icon>
              </button>
              <div class="event-body">
                <div class="event-top">
                  <span class="event-title">{{ e.title }}</span>
                  <span v-if="e.ddl" class="event-left">{{ leftText(e) }}</span>
                </div>
                <div class="event-meta">
                  <span v-if="e.time" class="time">{{ e.time }}</span>
                  <span v-if="e.ddl" class="badge">DDL</span>
                  <span v-if="e.note" class="note">{{ e.note }}</span>
                </div>
              </div>
              <button class="del" @click="removeEvent(e.id)" aria-label="删除">
                <el-icon><Delete /></el-icon>
              </button>
            </div>
          </div>

          <!-- 新增 -->
          <form class="add-form" @submit.prevent="submit">
            <input v-model="form.title" class="inp" placeholder="日程标题" maxlength="30" />
            <div class="form-row">
              <input v-model="form.time" class="inp time-inp" type="time" />
              <label class="ddl-toggle">
                <input v-model="form.ddl" type="checkbox" />
                <span>设为 DDL</span>
              </label>
            </div>
            <input v-model="form.note" class="inp" placeholder="备注（可选）" maxlength="60" />
            <button class="add-btn" type="submit" :disabled="!form.title.trim()">
              <el-icon><Plus /></el-icon>
              添加到 {{ selectedLabel }}
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar-card {
  max-width: 980px;
}

.cal-layout {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  gap: 1.6rem;
  align-items: start;
}

/* ===== 月历 ===== */
.cal-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.9rem;
}

.cal-month {
  flex: 1;
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--text-dark);
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}

.month-stat {
  font-size: 0.7rem;
  font-weight: 400;
  color: var(--accent);
}

.nav-btn,
.today-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(37, 99, 235, 0.2);
  background: rgba(219, 234, 254, 0.6);
  color: var(--accent);
  border-radius: 10px;
  transition: 0.2s;
}

.nav-btn {
  width: 30px;
  height: 30px;
}

.today-btn {
  height: 30px;
  padding: 0 0.8rem;
  font-size: 0.76rem;
}

.nav-btn:hover,
.today-btn:hover {
  background: var(--accent);
  color: #fff;
}

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 4px;
}

.weekdays span {
  text-align: center;
  font-size: 0.7rem;
  color: var(--text-dim);
  padding: 0.3rem 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.cell {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.45);
  color: var(--text-dark);
  font-size: 0.82rem;
  transition: 0.18s;
}

.cell:hover {
  background: rgba(37, 99, 235, 0.1);
  border-color: rgba(37, 99, 235, 0.25);
}

.cell.out {
  color: #a9b4c8;
  background: transparent;
}

.cell.today .cell-day {
  color: var(--accent);
  font-weight: 800;
}

.cell.today::after {
  content: '';
  position: absolute;
  inset: 2px;
  border: 1.5px solid rgba(37, 99, 235, 0.45);
  border-radius: 11px;
  pointer-events: none;
}

.cell.selected {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  box-shadow: 0 6px 16px -4px rgba(37, 99, 235, 0.5);
}

.cell.selected .cell-day {
  color: #fff;
}

.cell.selected::after {
  display: none;
}

.dots {
  display: flex;
  gap: 3px;
  height: 4px;
}

.dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
}

.cell.selected .dot {
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.7);
}

/* ===== 当天日程 ===== */
.cal-side {
  border-left: 1px solid rgba(37, 99, 235, 0.12);
  padding-left: 1.4rem;
}

.side-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.8rem;
}

.side-date {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text-dark);
}

.side-count {
  font-size: 0.72rem;
  color: var(--text-dim);
}

.day-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 1rem;
  padding-right: 2px;
}

.empty {
  font-size: 0.78rem;
  color: #9aa8c0;
  text-align: center;
  padding: 1.6rem 0;
}

.event {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.6rem 0.7rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.65);
  border-left: 3px solid var(--ev);
  transition: 0.2s;
}

.event:hover {
  background: rgba(255, 255, 255, 0.9);
}

.event.done {
  opacity: 0.55;
}

.event.done .event-title {
  text-decoration: line-through;
}

.check {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  border-radius: 50%;
  border: 1.5px solid var(--ev);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 0.65rem;
}

.check.on {
  background: var(--ev);
}

.event-body {
  flex: 1;
  min-width: 0;
}

.event-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.event-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-dark);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-left {
  flex-shrink: 0;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--ev);
}

.event-meta {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.25rem;
  font-size: 0.68rem;
  color: var(--text-dim);
  flex-wrap: wrap;
}

.badge {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #fff;
  background: var(--ev);
  border-radius: 6px;
  padding: 1px 5px;
}

.note {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.del {
  flex-shrink: 0;
  border: none;
  background: none;
  color: #b7c2d6;
  font-size: 0.85rem;
  padding: 2px;
  transition: 0.2s;
}

.del:hover {
  color: #e04b4b;
}

/* ===== 新增表单 ===== */
.add-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px dashed rgba(37, 99, 235, 0.2);
}

.inp {
  width: 100%;
  padding: 0.5rem 0.7rem;
  font-family: inherit;
  font-size: 0.8rem;
  color: var(--text-dark);
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 10px;
  outline: none;
  transition: 0.2s;
}

.inp::placeholder {
  color: #a9b4c8;
}

.inp:focus {
  border-color: var(--accent);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.form-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.time-inp {
  flex: 1;
}

.ddl-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.76rem;
  color: var(--text-dim);
  white-space: nowrap;
}

.ddl-toggle input {
  accent-color: var(--accent);
}

.add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0.55rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #1d4ed8, #2563eb);
  border: none;
  border-radius: 10px;
  transition: 0.2s;
}

.add-btn:hover:not(:disabled) {
  box-shadow: 0 6px 16px -4px rgba(37, 99, 235, 0.55);
  transform: translateY(-1px);
}

.add-btn:disabled {
  opacity: 0.45;
}

/* ===== 响应式 ===== */
@media (max-width: 820px) {
  .cal-layout {
    grid-template-columns: 1fr;
  }
  .cal-side {
    border-left: none;
    border-top: 1px solid rgba(37, 99, 235, 0.12);
    padding-left: 0;
    padding-top: 1.2rem;
  }
  .day-list {
    max-height: 220px;
  }
}

@media (max-width: 480px) {
  .cell {
    border-radius: 9px;
    font-size: 0.78rem;
  }
  .calendar-card {
    padding: 1rem;
  }
}
</style>
