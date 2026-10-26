<script setup>
import { ref, computed } from 'vue'
import { ArrowLeft, ArrowRight, Plus, Delete, Check, Edit } from '@element-plus/icons-vue'
import PageBack from '../components/PageBack.vue'
import {
  events,
  addEvent,
  updateEvent,
  removeEvent,
  toggleDone,
  dateKey,
  msLeft,
  urgencyColor,
  formatLeft,
  useNow,
  occursOn,
  isRepeating,
  isDoneOn,
  repeatText,
} from '../composables/useSchedule.js'
import SelectMenu from '../components/SelectMenu.vue'

const now = useNow(30000)
const today = ref(new Date())
const selected = ref(dateKey())

const EMPTY_FORM = {
  title: '',
  time: '',
  note: '',
  ddl: true,
  repeat: 'none',
  interval: 1,
  until: '',
}

const form = ref({ ...EMPTY_FORM })
// 非空表示正在编辑已有日程
const editingId = ref('')

const repeatOptions = [
  { value: 'none', label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
]

const intervalUnit = computed(() => {
  if (form.value.repeat === 'daily') return '天'
  if (form.value.repeat === 'weekly') return '周'
  return '个月'
})

function onRepeatChange() {
  form.value.interval = 1
}

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

// 某一天发生的所有日程（含重复日程的展开）
function eventsOnDay(key) {
  return events.value.filter((e) => occursOn(e, key))
}

const dayEvents = computed(() =>
  eventsOnDay(selected.value).slice().sort((a, b) => {
    // 有时间的排前面，再按时间
    const ta = a.time || '99:99'
    const tb = b.time || '99:99'
    return ta.localeCompare(tb)
  })
)

function dotColor(e, key) {
  if (isDoneOn(e, key)) return '#b7c2d6'
  if (!e.ddl) return '#60a5fa'
  return urgencyColor(msLeft(e, now.value))
}

function itemColor(e, key) {
  return e.ddl && !isDoneOn(e, key)
    ? urgencyColor(msLeft(e, now.value))
    : 'var(--accent)'
}

function leftText(e) {
  if (isDoneOn(e, selected.value)) return '已完成'
  const ms = msLeft(e, now.value)
  return ms <= 0 ? '已过期' : `剩 ${formatLeft(ms)}`
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

function resetForm() {
  editingId.value = ''
  form.value = { ...EMPTY_FORM }
}

function startEdit(e) {
  editingId.value = e.id
  form.value = {
    title: e.title || '',
    time: e.time || '',
    note: e.note || '',
    ddl: !!e.ddl,
    repeat: e.repeat || 'none',
    interval: Math.max(1, Number(e.interval) || 1),
    until: e.until || '',
  }
  // 让编辑表单滚动到可见区域
  requestAnimationFrame(() => {
    document.querySelector('.add-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

function submit() {
  const title = form.value.title.trim()
  if (!title) return

  const payload = {
    title,
    time: form.value.time,
    note: form.value.note.trim(),
    ddl: form.value.ddl,
    repeat: form.value.repeat,
    interval: Math.max(1, Number(form.value.interval) || 1),
    until: form.value.repeat === 'none' ? '' : form.value.until,
  }

  if (editingId.value) {
    // 编辑时保留原日期；重复日程的锚点日期也不变
    updateEvent(editingId.value, payload)
  } else {
    addEvent({ date: selected.value, ...payload })
  }
  resetForm()
}

function onDelete(e) {
  if (!window.confirm(`删除日程「${e.title}」？`)) return
  removeEvent(e.id)
  if (editingId.value === e.id) resetForm()
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
    <div class="cal-wrap">
      <PageBack class="cal-back" />

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
                  v-for="e in eventsOnDay(c.key).slice(0, 4)"
                  :key="e.id"
                  class="dot"
                  :style="{ backgroundColor: dotColor(e, c.key) }"
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
              :class="{ done: isDoneOn(e, selected) }"
              :style="{ '--ev': itemColor(e, selected) }"
            >
              <button
                class="check"
                :class="{ on: isDoneOn(e, selected) }"
                @click="toggleDone(e.id, selected)"
                aria-label="完成"
              >
                <el-icon v-if="isDoneOn(e, selected)"><Check /></el-icon>
              </button>
              <div class="event-body">
                <div class="event-top">
                  <span class="event-title">{{ e.title }}</span>
                  <span v-if="e.ddl" class="event-left">{{ leftText(e) }}</span>
                </div>
                <div class="event-meta">
                  <span v-if="e.time" class="time">{{ e.time }}</span>
                  <span v-if="e.ddl" class="badge">DDL</span>
                  <span v-if="isRepeating(e)" class="rep-badge">
                    ↻ {{ repeatText(e) }}
                  </span>
                  <span v-if="e.note" class="note">{{ e.note }}</span>
                </div>
              </div>
              <div class="ev-actions">
                <button
                  class="ev-btn"
                  :class="{ active: editingId === e.id }"
                  aria-label="编辑"
                  title="编辑"
                  @click="startEdit(e)"
                >
                  <el-icon><Edit /></el-icon>
                </button>
                <button class="ev-btn del" aria-label="删除" title="删除" @click="onDelete(e)">
                  <el-icon><Delete /></el-icon>
                </button>
              </div>
            </div>
          </div>

          <!-- 新增 / 编辑 -->
          <form class="add-form" @submit.prevent="submit">
            <div v-if="editingId" class="editing-bar">
              <span class="editing-label">正在编辑日程</span>
              <button type="button" class="cancel-edit" @click="resetForm">取消编辑</button>
            </div>
            <input v-model="form.title" class="inp" placeholder="日程标题" maxlength="30" />
            <div class="form-row">
              <input v-model="form.time" class="inp time-inp" type="time" />
              <label class="ddl-toggle">
                <input v-model="form.ddl" type="checkbox" />
                <span>设为 DDL</span>
              </label>
            </div>
            <div class="form-row repeat-row">
              <SelectMenu
                v-model="form.repeat"
                :options="repeatOptions"
                class="repeat-select"
                @change="onRepeatChange"
              />
              <template v-if="form.repeat !== 'none'">
                <span class="every-label">每</span>
                <input
                  v-model.number="form.interval"
                  class="inp interval-inp"
                  type="number"
                  min="1"
                  max="99"
                  title="重复间隔"
                />
                <span class="unit-label">{{ intervalUnit }}</span>
              </template>
              <input
                v-if="form.repeat !== 'none'"
                v-model="form.until"
                class="inp until-input"
                type="date"
                title="结束日期（可选）"
              />
            </div>
            <input v-model="form.note" class="inp" placeholder="备注（可选）" maxlength="60" />
            <button class="add-btn" type="submit" :disabled="!form.title.trim()">
              <el-icon><component :is="editingId ? Check : Plus" /></el-icon>
              {{ editingId ? '保存修改' : '添加到 ' + selectedLabel }}
            </button>
          </form>
        </div>
      </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 返回按钮与日历同列，按钮靠左、日历居中 */
.cal-wrap {
  width: 100%;
  max-width: 980px;
  display: flex;
  flex-direction: column;
}

.cal-back {
  align-self: flex-start;
  margin-bottom: 1.6rem;
}

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

.rep-badge {
  font-size: 0.6rem;
  padding: 1px 5px;
  border-radius: 6px;
  color: var(--accent);
  background: rgba(37, 99, 235, 0.09);
  border: 1px solid rgba(37, 99, 235, 0.2);
}

.note {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ev-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 2px;
}

.ev-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 7px;
  background: none;
  color: #b7c2d6;
  font-size: 0.82rem;
  transition: 0.18s;
}

.ev-btn:hover {
  color: var(--accent);
  background: rgba(37, 99, 235, 0.08);
}

.ev-btn.del:hover {
  color: #e04b4b;
  background: rgba(224, 75, 75, 0.08);
}

.ev-btn.active {
  color: #fff;
  background: var(--accent);
}

/* 编辑态提示条 */
.editing-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.3rem 0.6rem;
  font-size: 0.7rem;
  color: var(--accent);
  background: rgba(37, 99, 235, 0.08);
  border: 1px dashed rgba(37, 99, 235, 0.3);
  border-radius: 8px;
}

.cancel-edit {
  padding: 0;
  font-family: inherit;
  font-size: 0.68rem;
  color: var(--text-dim);
  background: none;
  border: none;
}

.cancel-edit:hover {
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

.repeat-row {
  flex-wrap: wrap;
}

.repeat-select {
  flex: 1;
  min-width: 90px;
}

.every-label,
.unit-label {
  flex-shrink: 0;
  font-size: 0.74rem;
  color: var(--text-dim);
}

.interval-inp {
  flex-shrink: 0;
  width: 54px;
  padding-left: 0.5rem;
  padding-right: 0.3rem;
  text-align: center;
}

.until-input {
  flex: 1;
  min-width: 120px;
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
