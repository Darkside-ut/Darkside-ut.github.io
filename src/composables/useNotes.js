import { computed, ref } from 'vue'

const DB_NAME = 'jimsss-pocket-notes'
const DB_VERSION = 1
const STORE = 'notes'

export const notes = ref([])
export const notesReady = ref(false)
export const notesError = ref('')

let dbPromise = null
let initPromise = null

function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
        store.createIndex('position', 'position')
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('无法打开便条数据库'))
  })
  return dbPromise
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('数据库操作失败'))
  })
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('数据库写入失败'))
    transaction.onabort = () => reject(transaction.error || new Error('数据库写入已取消'))
  })
}

function normalize(note) {
  const legacyImage = note.image
    ? [{ data: note.image, name: note.imageName || '', alt: String(note.imageAlt || '').trim() }]
    : []
  const images = (Array.isArray(note.images) && note.images.length ? note.images : legacyImage)
    .map((image) => ({
      data: image?.data || image?.src || '',
      name: String(image?.name || '').trim(),
      alt: String(image?.alt || '').trim(),
    }))
    .filter((image) => image.data)
    .slice(0, 12)
  const poems = (Array.isArray(note.poems) ? note.poems : [])
    .map((poem) => ({
      title: String(poem?.title || '').trim(),
      content: String(poem?.content || '').trim(),
      source: String(poem?.source || '').trim(),
    }))
    .filter((poem) => poem.title || poem.content || poem.source)
    .slice(0, 20)
  const firstImage = images[0]

  return {
    id: note.id || uid(),
    type: note.type || 'quote',
    title: String(note.title || '').trim(),
    content: String(note.content || '').trim(),
    source: String(note.source || '').trim(),
    link: String(note.link || '').trim(),
    tags: Array.isArray(note.tags) ? note.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 12) : [],
    color: note.color || '#4f7fd8',
    images,
    poems,
    // 保留首图字段，让旧版导出文件和已有读取逻辑仍可使用。
    image: firstImage?.data || '',
    imageName: firstImage?.name || '',
    imageAlt: firstImage?.alt || '',
    pinned: !!note.pinned,
    favorite: !!note.favorite,
    position: Number.isFinite(Number(note.position)) ? Number(note.position) : Date.now(),
    createdAt: Number(note.createdAt) || Date.now(),
    updatedAt: Number(note.updatedAt) || Date.now(),
  }
}

function sortByPosition(list) {
  return [...list].sort((a, b) => (a.position || 0) - (b.position || 0) || b.updatedAt - a.updatedAt)
}

export async function initNotes() {
  if (initPromise) return initPromise
  initPromise = (async () => {
    notesError.value = ''
    try {
      const db = await openDb()
      const tx = db.transaction(STORE, 'readonly')
      const all = await requestResult(tx.objectStore(STORE).getAll())
      notes.value = sortByPosition(all.map(normalize))
      notesReady.value = true
    } catch (error) {
      notesError.value = error?.message || '便条加载失败'
      notesReady.value = true
      throw error
    }
  })()
  return initPromise
}

export async function saveNote(input) {
  const now = Date.now()
  const old = input.id ? notes.value.find((note) => note.id === input.id) : null
  const note = normalize({
    ...old,
    ...input,
    id: old?.id || input.id || uid(),
    createdAt: old?.createdAt || input.createdAt || now,
    updatedAt: now,
    position: old?.position ?? input.position ?? notes.value.length,
  })

  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).put(note)
  await transactionDone(tx)

  const index = notes.value.findIndex((item) => item.id === note.id)
  if (index >= 0) notes.value.splice(index, 1, note)
  else notes.value.push(note)
  notes.value = sortByPosition(notes.value)
  return note
}

export async function removeNote(id) {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).delete(id)
  await transactionDone(tx)
  notes.value = notes.value.filter((note) => note.id !== id)
}

export async function patchNote(id, patch) {
  const current = notes.value.find((note) => note.id === id)
  if (!current) return null
  return saveNote({ ...current, ...patch, id })
}

export async function reorderNotes(ids) {
  if (!Array.isArray(ids) || !ids.length) return
  const order = new Map(ids.map((id, index) => [id, index]))
  const changed = notes.value.map((note) => ({
    ...note,
    position: order.has(note.id) ? order.get(note.id) : note.position,
  }))

  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  changed.forEach((note) => store.put(note))
  await transactionDone(tx)
  notes.value = sortByPosition(changed)
}

export async function importNotes(list, { replace = false } = {}) {
  if (!Array.isArray(list)) throw new Error('文件中没有有效的便条列表')
  const now = Date.now()
  const normalized = list.map((item, index) =>
    normalize({
      ...item,
      id: replace ? item.id || uid() : uid(),
      position: index,
      createdAt: item.createdAt || now,
      updatedAt: item.updatedAt || now,
    })
  )

  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  if (replace) store.clear()
  normalized.forEach((note) => store.put(note))
  await transactionDone(tx)

  if (replace) notes.value = normalized
  else notes.value = sortByPosition([...notes.value, ...normalized])
  return normalized.length
}

export const noteStats = computed(() => ({
  total: notes.value.length,
  favorite: notes.value.filter((note) => note.favorite).length,
  image: notes.value.reduce((total, note) => total + (note.images?.length || (note.image ? 1 : 0)), 0),
  pinned: notes.value.filter((note) => note.pinned).length,
}))
