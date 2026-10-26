import { computed, ref } from 'vue'
import { getSupabase, isRemote } from '../lib/supabase.js'

/* ============================================================
   美食评价：店铺 + 菜品星级
   - 配置了 Supabase 时：数据在云端，所有人可读，登录后可写
   - 未配置时：退回 localStorage（本地模式）
   ============================================================ */

const STORAGE_KEY = 'food-review-shops'

export const remoteEnabled = isRemote
export const loading = ref(false)

let inited = false

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function persistLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shops.value))
}

export const shops = ref(isRemote ? [] : loadLocal())

// 本地模式下跨标签页同步
if (!isRemote && typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) shops.value = loadLocal()
  })
}

/* ---------------- 云端数据映射 ---------------- */
function fromShopRow(row, dishes) {
  return {
    id: row.id,
    name: row.name || '',
    category: row.category || '',
    location: row.location || '',
    note: row.note || '',
    createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
    dishes,
  }
}

function fromDishRow(row) {
  return {
    id: row.id,
    name: row.name || '',
    rating: Number(row.rating) || 0,
    price: row.price ?? '',
    note: row.note || '',
    createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
  }
}

async function fetchAll() {
  loading.value = true
  try {
    const supabase = await getSupabase()
    const [shopRes, dishRes] = await Promise.all([
      supabase.from('shops').select('*').order('created_at', { ascending: false }),
      supabase.from('dishes').select('*').order('created_at', { ascending: false }),
    ])
    if (shopRes.error) throw shopRes.error
    if (dishRes.error) throw dishRes.error

    const byShop = new Map()
    for (const d of dishRes.data || []) {
      const list = byShop.get(d.shop_id) || []
      list.push(fromDishRow(d))
      byShop.set(d.shop_id, list)
    }
    shops.value = (shopRes.data || []).map((s) => fromShopRow(s, byShop.get(s.id) || []))
  } finally {
    loading.value = false
  }
}

/* ---------------- 初始化 ---------------- */
export async function initFood() {
  if (inited) return
  inited = true
  if (!isRemote) return
  await fetchAll()
}

/* ---------------- 旧本地数据迁移 ---------------- */
// 云端模式下，旧版本写在 localStorage 里的数据不会自动出现，这里提供一次性导入
export function localShopCount() {
  if (!isRemote) return 0
  return loadLocal().length
}

export async function importLocalData() {
  if (!isRemote) return 0
  const local = loadLocal()
  if (!local.length) return 0

  const supabase = await getSupabase()
  let done = 0
  for (const s of local) {
    const { data: shopRow, error } = await supabase
      .from('shops')
      .insert({
        name: s.name || '未命名店铺',
        category: s.category || '',
        location: s.location || '',
        note: s.note || '',
      })
      .select()
      .single()
    if (error) throw error

    const dishes = (s.dishes || [])
      .filter((d) => d.name)
      .map((d) => ({
        shop_id: shopRow.id,
        name: d.name,
        rating: Number(d.rating) || 0,
        price: String(d.price ?? ''),
        note: d.note || '',
      }))
    if (dishes.length) {
      const { error: dishError } = await supabase.from('dishes').insert(dishes)
      if (dishError) throw dishError
    }
    done++
  }

  // 成功后再清理本地旧数据，并留一份备份
  localStorage.setItem(`${STORAGE_KEY}-backup`, JSON.stringify(local))
  localStorage.removeItem(STORAGE_KEY)

  await fetchAll()
  return done
}

/* ---------------- 店铺 ---------------- */
export async function addShop(payload) {
  if (!isRemote) {
    shops.value.unshift({
      id: uid(),
      name: '',
      category: '',
      location: '',
      note: '',
      createdAt: Date.now(),
      dishes: [],
      ...payload,
    })
    persistLocal()
    return
  }

  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('shops')
    .insert({
      name: payload.name,
      category: payload.category || '',
      location: payload.location || '',
      note: payload.note || '',
    })
    .select()
    .single()
  if (error) throw error
  shops.value.unshift(fromShopRow(data, []))
}

export async function updateShop(id, patch) {
  if (!isRemote) {
    const shop = shops.value.find((s) => s.id === id)
    if (!shop) return
    Object.assign(shop, patch)
    persistLocal()
    return
  }

  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('shops')
    .update({
      name: patch.name,
      category: patch.category || '',
      location: patch.location || '',
      note: patch.note || '',
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  const shop = shops.value.find((s) => s.id === id)
  if (shop) Object.assign(shop, fromShopRow(data, shop.dishes || []))
}

export async function removeShop(id) {
  if (!isRemote) {
    shops.value = shops.value.filter((s) => s.id !== id)
    persistLocal()
    return
  }

  const supabase = await getSupabase()
  const { error } = await supabase.from('shops').delete().eq('id', id)
  if (error) throw error
  shops.value = shops.value.filter((s) => s.id !== id)
}

/* ---------------- 菜品 ---------------- */
export async function addDish(shopId, payload) {
  if (!isRemote) {
    const shop = shops.value.find((s) => s.id === shopId)
    if (!shop) return
    shop.dishes.unshift({
      id: uid(),
      name: '',
      rating: 5,
      price: '',
      note: '',
      createdAt: Date.now(),
      ...payload,
    })
    persistLocal()
    return
  }

  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('dishes')
    .insert({
      shop_id: shopId,
      name: payload.name,
      rating: Number(payload.rating) || 0,
      price: payload.price || '',
      note: payload.note || '',
    })
    .select()
    .single()
  if (error) throw error
  const shop = shops.value.find((s) => s.id === shopId)
  if (shop) {
    if (!Array.isArray(shop.dishes)) shop.dishes = []
    shop.dishes.unshift(fromDishRow(data))
  }
}

export async function updateDish(shopId, dishId, patch) {
  if (!isRemote) {
    const shop = shops.value.find((s) => s.id === shopId)
    const dish = shop?.dishes?.find((d) => d.id === dishId)
    if (!dish) return
    Object.assign(dish, patch)
    persistLocal()
    return
  }

  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('dishes')
    .update({
      name: patch.name,
      rating: Number(patch.rating) || 0,
      price: patch.price || '',
      note: patch.note || '',
    })
    .eq('id', dishId)
    .select()
    .single()
  if (error) throw error

  const shop = shops.value.find((s) => s.id === shopId)
  const dish = shop?.dishes?.find((d) => d.id === dishId)
  if (dish) Object.assign(dish, fromDishRow(data))
}

export async function removeDish(shopId, dishId) {
  if (!isRemote) {
    const shop = shops.value.find((s) => s.id === shopId)
    if (!shop) return
    shop.dishes = (shop.dishes || []).filter((d) => d.id !== dishId)
    persistLocal()
    return
  }

  const supabase = await getSupabase()
  const { error } = await supabase.from('dishes').delete().eq('id', dishId)
  if (error) throw error
  const shop = shops.value.find((s) => s.id === shopId)
  if (shop) shop.dishes = (shop.dishes || []).filter((d) => d.id !== dishId)
}

/* ---------------- 统计 ---------------- */
export function dishCount(shop) {
  return (shop?.dishes || []).length
}

// 店铺星级 = 所有菜品的平均分；没有菜品时为 0
export function shopRating(shop) {
  const dishes = shop?.dishes || []
  if (!dishes.length) return 0
  return dishes.reduce((sum, d) => sum + (Number(d.rating) || 0), 0) / dishes.length
}

export const totals = computed(() => {
  const list = shops.value
  const allDishes = list.flatMap((s) => s.dishes || [])
  const rated = allDishes.filter((d) => Number(d.rating) > 0)
  return {
    shops: list.length,
    dishes: allDishes.length,
    average: rated.length
      ? rated.reduce((sum, d) => sum + Number(d.rating), 0) / rated.length
      : 0,
  }
})

export function formatDay(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
