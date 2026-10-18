import { ref, computed } from 'vue'
import { wordRoots } from '../views/vocab/rootsData.js'

/* ============================================================
   词根词缀学习：进度 / 成就 / 导入导出
   数据来源：github.com/joeseesun/word-root-workshop (MIT)
   ============================================================ */

const KEY = 'vocab-roots-progress'

export const roots = wordRoots

export const TOTAL = roots.length

export function rootType(root) {
  const r = String(root || '')
  if (r.startsWith('-')) return 'suffix'
  if (r.endsWith('-')) return 'prefix'
  return 'root'
}

export const TYPE_LABEL = { prefix: '前缀', root: '词根', suffix: '后缀' }

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

function defaultProgress() {
  return {
    mastered: [],
    streak: 0,
    lastStudyDate: null,
    sessionCount: 0,
    quizCorrect: 0,
    quizTotal: 0,
  }
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY))
    if (!raw || typeof raw !== 'object') return defaultProgress()
    return { ...defaultProgress(), ...raw, mastered: Array.isArray(raw.mastered) ? raw.mastered : [] }
  } catch {
    return defaultProgress()
  }
}

export const rootProgress = ref(load())

function save() {
  localStorage.setItem(KEY, JSON.stringify(rootProgress.value))
}

export const masteredIds = computed(() => new Set(rootProgress.value.mastered))
export const masteredCount = computed(() => rootProgress.value.mastered.length)
export const percent = computed(() => Math.round((masteredCount.value / TOTAL) * 100))
export const level = computed(() => Math.floor(masteredCount.value / 10) + 1)
export const levelRemain = computed(() => Math.max(0, level.value * 10 - masteredCount.value))

// 记录一次学习，维护连续天数
function touchStudy() {
  const today = todayKey()
  const p = rootProgress.value
  if (p.lastStudyDate === today) return
  const y = new Date()
  y.setDate(y.getDate() - 1)
  p.streak = p.lastStudyDate === todayKey(y) ? (p.streak || 0) + 1 : 1
  p.lastStudyDate = today
  p.sessionCount = (p.sessionCount || 0) + 1
}

export function markMastered(id) {
  const p = rootProgress.value
  if (!p.mastered.includes(id)) {
    p.mastered = [...p.mastered, id]
    touchStudy()
    save()
  }
}

export function unmarkMastered(id) {
  const p = rootProgress.value
  p.mastered = p.mastered.filter((x) => x !== id)
  save()
}

export function recordQuiz(correct) {
  const p = rootProgress.value
  p.quizTotal = (p.quizTotal || 0) + 1
  if (correct) p.quizCorrect = (p.quizCorrect || 0) + 1
  save()
}

export function resetRootProgress() {
  rootProgress.value = defaultProgress()
  save()
}

/* ---------------- 成就 ---------------- */
export const achievementDefs = [
  { id: 'first', icon: '🌱', name: '初出茅庐', desc: '掌握第一个词根', check: (p) => p.mastered.length >= 1 },
  { id: 'ten', icon: '🌿', name: '积少成多', desc: '掌握 10 个词根', check: (p) => p.mastered.length >= 10 },
  { id: 'fifty', icon: '🌳', name: '枝繁叶茂', desc: '掌握 50 个词根', check: (p) => p.mastered.length >= 50 },
  { id: 'hundred', icon: '🏔️', name: '登堂入室', desc: '掌握 100 个词根', check: (p) => p.mastered.length >= 100 },
  { id: 'all', icon: '🏆', name: '词根大师', desc: '掌握全部词根', check: (p) => p.mastered.length >= TOTAL },
  { id: 'streak3', icon: '🔥', name: '三日不辍', desc: '连续学习 3 天', check: (p) => p.streak >= 3 },
  { id: 'streak7', icon: '⚡', name: '七日之功', desc: '连续学习 7 天', check: (p) => p.streak >= 7 },
  { id: 'quiz50', icon: '🎯', name: '百发百中', desc: '累计答对 50 道小测', check: (p) => p.quizCorrect >= 50 },
]

export const achievements = computed(() =>
  achievementDefs.map((a) => ({ ...a, unlocked: a.check(rootProgress.value) }))
)

/* ---------------- 导入导出 ---------------- */
export function exportRootProgress() {
  const blob = new Blob(
    [
      JSON.stringify(
        { exportedAt: new Date().toISOString(), progress: rootProgress.value },
        null,
        2
      ),
    ],
    { type: 'application/json' }
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `roots-progress-${todayKey()}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function importRootProgress(text) {
  const data = JSON.parse(text)
  const p = data.progress || data
  if (!p || !Array.isArray(p.mastered)) throw new Error('文件格式不正确')
  rootProgress.value = { ...defaultProgress(), ...p }
  save()
}
