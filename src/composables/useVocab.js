import { ref, computed } from 'vue'

/* ============================================================
   背单词：词库 / 学习进度 / 统计
   存储走 IndexedDB，词书上万条也不受 localStorage 5MB 限制
   ============================================================ */

const DB_NAME = 'site-vocab'
const STORE = 'kv'
let dbPromise = null
let dbFailed = false

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (!('indexedDB' in window)) {
      dbFailed = true
      resolve(null)
      return
    }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbFailed = true
      resolve(null)
    }
  })
  return dbPromise
}

async function idbGet(key) {
  const db = await openDB()
  if (!db) return undefined
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(undefined)
  })
}

// Vue 的 reactive Proxy 无法被结构化克隆（会抛 DataCloneError），
// 写入 IndexedDB 前统一转成纯数据
function plain(value) {
  return JSON.parse(JSON.stringify(value))
}

async function idbSet(key, value) {
  const db = await openDB()
  if (!db) return false
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    try {
      tx.objectStore(STORE).put(value, key)
    } catch (err) {
      resolve(false)
      return
    }
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => resolve(false)
    tx.onabort = () => resolve(false)
  })
}

async function idbDel(key) {
  const db = await openDB()
  if (!db) return false
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => resolve(false)
  })
}

/* ---------------- 状态 ---------------- */
export const ready = ref(false)
export const libraries = ref([]) // [{ id, name, count, createdAt }]
export const activeLibId = ref(null)
export const words = ref([])
export const progress = ref({}) // { [wordKey]: { ease, interval, reps, lapses, due, lastSeen } }
export const settings = ref({ dailyNew: 20, dailyReview: 100, phonetic: 'uk', autoSpeak: false })
export const stats = ref({ days: {} })

export const activeLibrary = computed(
  () => libraries.value.find((l) => l.id === activeLibId.value) || null
)

function downloadJSON(filename, data, pretty = false) {
  const blob = new Blob([JSON.stringify(data, null, pretty ? 2 : 0)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// 一键导出学习数据（词库进度、统计、设置），数据不会上传
export function exportLearningData() {
  const lib = activeLibrary.value
  if (!lib) return false
  downloadJSON(
    `vocab-progress-${lib.name}-${todayKey()}.json`,
    {
      exportedAt: new Date().toISOString(),
      library: { id: lib.id, name: lib.name, count: lib.count },
      progress: progress.value,
      stats: stats.value,
      settings: settings.value,
    },
    true
  )
  return true
}

/* ---------------- 工具 ---------------- */
export function todayKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function wordKey(w) {
  return String(w.word || w.id || '').trim().toLowerCase()
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/* ---------------- 初始化 ---------------- */
let initPromise = null
export function initVocab() {
  if (initPromise) return initPromise
  initPromise = (async () => {
    libraries.value = (await idbGet('libraries')) || []
    settings.value = { ...settings.value, ...((await idbGet('settings')) || {}) }
    stats.value = (await idbGet('stats')) || { days: {} }
    if (!stats.value.days) stats.value.days = {}
    const savedActive = await idbGet('activeLib')
    activeLibId.value =
      savedActive && libraries.value.some((l) => l.id === savedActive)
        ? savedActive
        : libraries.value[0]?.id || null
    await loadLibrary(activeLibId.value)
    ready.value = true
  })()
  return initPromise
}

export async function loadLibrary(id) {
  activeLibId.value = id
  if (!id) {
    words.value = []
    progress.value = {}
    resetSession()
    return
  }
  words.value = (await idbGet(`words:${id}`)) || []
  progress.value = (await idbGet(`progress:${id}`)) || {}
  await idbSet('activeLib', id)
  resetSession()
}

/* ---------------- 词库管理 ---------------- */
// 去掉空字段，减小 IndexedDB 结构化克隆的体量
function compactWord(w) {
  const out = { id: String(w.id), word: String(w.word), meaning: String(w.meaning || '') }
  if (w.uk) out.uk = String(w.uk)
  if (w.us) out.us = String(w.us)
  if (w.example) out.example = String(w.example)
  if (w.exampleCn) out.exampleCn = String(w.exampleCn)
  if (w.phrases?.length) {
    const phrases = []
    for (const p of w.phrases) {
      if (p && p.en) phrases.push({ en: String(p.en), cn: String(p.cn || '') })
    }
    if (phrases.length) out.phrases = phrases
  }
  return out
}

export async function importLibrary(name, wordList, forcedId = null) {
  const id = forcedId || uid()
  // 按单词小写去重，保留首次出现
  const seen = new Set()
  const list = []
  for (const w of wordList) {
    const k = wordKey(w)
    if (!k || seen.has(k)) continue
    seen.add(k)
    list.push(compactWord({ ...w, id: k }))
  }
  const meta = { id, name: name || '未命名词库', count: list.length, createdAt: Date.now() }

  // list 已由 compactWord 构造成纯数据，无需再序列化一遍
  const stored = await idbSet(`words:${id}`, list)
  if (!stored) throw new Error('词库写入失败：浏览器存储空间不足或被禁用')

  // 重新导入（例如更新公开词库）时保留原有学习进度
  const keptProgress = (await idbGet(`progress:${id}`)) || {}
  await idbSet(`progress:${id}`, keptProgress)

  libraries.value = [...libraries.value.filter((l) => l.id !== id), meta]
  await idbSet('libraries', plain(libraries.value))

  // 直接复用刚解析好的内存数据，避免再完整读一次 IndexedDB
  activeLibId.value = id
  words.value = list
  progress.value = keptProgress
  await idbSet('activeLib', id)
  resetSession()
  return meta
}

export async function deleteLibrary(id) {
  libraries.value = libraries.value.filter((l) => l.id !== id)
  await idbSet('libraries', plain(libraries.value))
  await idbDel(`words:${id}`)
  await idbDel(`progress:${id}`)
  if (activeLibId.value === id) {
    await loadLibrary(libraries.value[0]?.id || null)
  }
}

export async function saveSettings(patch) {
  settings.value = { ...settings.value, ...patch }
  await idbSet('settings', plain(settings.value))
}

/* ---------------- 间隔重复（SM-2 简化版） ---------------- */
const DAY = 86400000

function applyGrade(p, g, now) {
  const cur = p || { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: 0, lastSeen: 0 }
  cur.reps++
  cur.lastSeen = now
  if (g === 0) {
    // 忘记：10 分钟后重来
    cur.lapses++
    cur.ease = Math.max(1.3, cur.ease - 0.2)
    cur.interval = 0
    cur.due = now + 10 * 60000
  } else if (g === 1) {
    // 模糊
    cur.ease = Math.max(1.3, cur.ease - 0.05)
    cur.interval = cur.interval ? Math.max(1, cur.interval * 1.2) : 1
    cur.due = now + cur.interval * DAY
  } else if (g === 2) {
    // 认识
    cur.interval = cur.interval ? cur.interval * cur.ease : 1
    cur.due = now + cur.interval * DAY
  } else {
    // 熟练
    cur.ease = Math.min(3.2, cur.ease + 0.1)
    cur.interval = cur.interval ? cur.interval * cur.ease * 1.3 : 2
    cur.due = now + cur.interval * DAY
  }
  cur.interval = Math.round(cur.interval * 10) / 10
  return cur
}

let saveProgressTimer = null
function scheduleSaveProgress() {
  clearTimeout(saveProgressTimer)
  saveProgressTimer = setTimeout(() => {
    if (activeLibId.value) idbSet(`progress:${activeLibId.value}`, plain(progress.value))
  }, 400)
}

let saveStatsTimer = null
function scheduleSaveStats() {
  clearTimeout(saveStatsTimer)
  saveStatsTimer = setTimeout(() => idbSet('stats', plain(stats.value)), 400)
}

/* ---------------- 今日队列 ---------------- */
export const session = ref({ queue: [], index: 0, finished: false })

export const currentItem = computed(() => {
  const s = session.value
  return s.queue[s.index] || null
})

export const todayStat = computed(() => {
  const d = stats.value.days[todayKey()]
  return d || { new: 0, review: 0, total: 0, correct: 0 }
})

// 自定义学习任务：为空时按每日计划自动组队
export const customSession = ref(false)

export function resetSession() {
  customSession.value = false
  session.value = { queue: [], index: 0, finished: false }
  buildSession()
}

// 用选中的单词开始一次自定义学习
export function startCustomSession(list) {
  const queue = list.map((w) => ({ w, isNew: !progress.value[wordKey(w)] }))
  customSession.value = true
  session.value = { queue, index: 0, finished: queue.length === 0 }
}

export function clearCustomSession() {
  customSession.value = false
  buildSession()
}

// 打开词书即从「未掌握 + 到期复习」的单词开始，不再受每日上限限制
export function buildSession() {
  customSession.value = false
  const now = Date.now()
  const queue = []
  for (const w of words.value) {
    const p = progress.value[wordKey(w)]
    if (!p) queue.push({ w, isNew: true })
    else if ((p.due || 0) <= now) queue.push({ w, isNew: false })
  }
  session.value = { queue, index: 0, finished: queue.length === 0 }
}

export function flipDone(current) {
  return !!(current && current.flipped)
}

export function gradeCurrent(g) {
  const item = currentItem.value
  if (!item) return
  const now = Date.now()
  const key = wordKey(item.w)

  progress.value = { ...progress.value, [key]: applyGrade(progress.value[key], g, now) }
  scheduleSaveProgress()

  const dayKey = todayKey()
  const day = stats.value.days[dayKey] || { new: 0, review: 0, total: 0, correct: 0 }
  if (item.isNew) day.new++
  else day.review++
  day.total++
  if (g >= 2) day.correct++
  stats.value = { ...stats.value, days: { ...stats.value.days, [dayKey]: day } }
  scheduleSaveStats()

  const s = session.value
  const next = s.index + 1
  session.value = { ...s, index: next, finished: next >= s.queue.length }
}

/* ---------------- 统计 ---------------- */
// 单个单词的学习状态：new / learning / familiar / mastered
export function wordStatus(w) {
  const p = progress.value[wordKey(w)]
  if (!p) return 'new'
  if (p.interval >= 21) return 'mastered'
  if (p.interval >= 7) return 'familiar'
  return 'learning'
}

export const mastery = computed(() => {
  let fresh = 0
  let learning = 0
  let familiar = 0
  let mastered = 0
  for (const w of words.value) {
    const p = progress.value[wordKey(w)]
    if (!p) fresh++
    else if (p.interval >= 21) mastered++
    else if (p.interval >= 7) familiar++
    else learning++
  }
  return { fresh, learning, familiar, mastered, total: words.value.length }
})

export const streak = computed(() => {
  const days = stats.value.days || {}
  const has = (offset) => {
    const d = new Date()
    d.setDate(d.getDate() - offset)
    const s = days[todayKey(d)]
    return !!(s && s.total > 0)
  }
  let n = 0
  let start = has(0) ? 0 : 1
  if (!has(0) && !has(1)) return 0
  while (has(start + n)) n++
  return n
})

export const upcomingReview = computed(() => {
  const now = Date.now()
  let n = 0
  for (const w of words.value) {
    const p = progress.value[wordKey(w)]
    if (p && (p.due || 0) <= now) n++
  }
  return n
})

/* ---------------- 词库文件解析 ---------------- */
const yieldUI = () => new Promise((r) => setTimeout(r, 0))
const CHUNK = 400 // 每处理这么多条让出一次主线程

// 支持：kajweb/dict 的 JSONL、普通 JSON 数组、CSV、TXT
// 分片处理并定期让出主线程，避免大文件解析时页面卡死
export async function parseWordFile(text, filename = '', onProgress) {
  const trimmed = text.replace(/^﻿/, '').trim()
  const name = filename.replace(/\.[^.]+$/, '').trim()
  const out = []

  if (trimmed.startsWith('[')) {
    // JSON 数组
    const arr = JSON.parse(trimmed)
    for (let i = 0; i < arr.length; i++) {
      const w = mapWord(arr[i])
      if (w) out.push(w)
      if (i % CHUNK === 0) {
        onProgress?.(i / Math.max(1, arr.length))
        await yieldUI()
      }
    }
    onProgress?.(1)
    return { name, list: out }
  }

  if (trimmed.startsWith('{')) {
    // JSONL：一行一个 JSON；也兼容整个文件是单个对象
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim())
    let parsedAny = false
    for (let i = 0; i < lines.length; i++) {
      try {
        const o = JSON.parse(lines[i])
        parsedAny = true
        if (Array.isArray(o)) {
          for (const x of o) {
            const w = mapWord(x)
            if (w) out.push(w)
          }
        } else {
          const w = mapWord(o)
          if (w) out.push(w)
        }
      } catch {
        // 跳过坏行
      }
      if (i % CHUNK === 0) {
        onProgress?.(i / Math.max(1, lines.length))
        await yieldUI()
      }
    }
    if (parsedAny) {
      onProgress?.(1)
      return { name, list: out }
    }
  }

  // CSV / TXT
  const lines = trimmed.split(/\r?\n/)
  let start = 0
  // 表头识别
  const header = lines[0] || ''
  const hasHeader = /word|单词|词汇|英文/i.test(header) && /meaning|释义|中文|翻译/i.test(header)
  if (hasHeader) start = 1

  for (let i = start; i < lines.length; i++) {
    if (i % CHUNK === 0) {
      onProgress?.(i / Math.max(1, lines.length))
      await yieldUI()
    }
    const line = lines[i].trim()
    if (!line) continue
    let cols
    if (hasHeader) cols = parseCsvLine(line)
    else if (line.includes('|')) cols = line.split('|')
    else if (line.includes('\t')) cols = line.split('\t')
    else if (line.includes(',')) cols = parseCsvLine(line)
    else {
      // 纯文本「单词 释义」，按第一个空白拆开
      const m = line.match(/^(\S+)\s+(.+)$/)
      cols = m ? [m[1], '', m[2]] : [line]
    }
    const word = (cols[0] || '').trim()
    if (!word) continue
    out.push({
      id: word.toLowerCase(),
      word,
      uk: (cols[1] || '').trim(),
      us: '',
      meaning: (cols[2] || cols[1] || '').trim(),
      example: (cols[3] || '').trim(),
      exampleCn: '',
      phrases: [],
    })
  }
  onProgress?.(1)
  return { name, list: out }
}

function parseCsvLine(line) {
  const cols = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      cols.push(cur)
      cur = ''
    } else cur += ch
  }
  cols.push(cur)
  return cols
}

// 把一条原始记录映射成卡片字段（兼容 kajweb/dict 与常见简易格式）
function mapWord(o) {
  if (!o || typeof o !== 'object') return null
  const head = o.headWord || o.word || o.wordHead || o.term
  if (!head) return null

  // kajweb/dict: content.word.content
  const c = o.content?.word?.content || o.content?.word || o.content || {}
  const trans = c.trans || o.trans || o.translations || []
  let meaning = ''
  if (Array.isArray(trans)) {
    meaning = trans
      .map((t) => (typeof t === 'string' ? t : t.tranCn || t.tran || t.meaning || ''))
      .filter(Boolean)
      .join('；')
  } else if (typeof trans === 'string') {
    meaning = trans
  }
  if (!meaning) meaning = o.meaning || o.definition || o.cn || ''

  const sents = c.sentence?.sentences || c.sentences || []
  const s0 = sents[0] || {}
  const phrases = (c.phrase?.phrases || [])
    .slice(0, 2)
    .map((p) => ({ en: p.pContent || p.en || '', cn: p.pCn || p.cn || '' }))

  return {
    id: String(head).toLowerCase(),
    word: String(head),
    uk: c.ukphone || o.ukphone || o.phonetic || '',
    us: c.usphone || o.usphone || '',
    meaning,
    example: s0.sContent || o.example || '',
    exampleCn: s0.sCn || o.exampleCn || '',
    phrases,
  }
}
