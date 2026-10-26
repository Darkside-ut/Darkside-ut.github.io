import { computed, ref } from 'vue'
import { getSupabase, isRemote, projectRef } from '../lib/supabase.js'

/* ============================================================
   全站登录状态（Supabase Auth）
   - 侧栏统一提供登录 / 退出入口
   - 未配置 Supabase 时 remoteEnabled = false，站点保持纯本地模式
   - Supabase SDK 动态加载，不阻塞首屏
   ============================================================ */

export const remoteEnabled = isRemote
export const authUser = ref(null)
export const authReady = ref(!isRemote)
export const isLoggedIn = computed(() => !!authUser.value)

/* ---------------- 同步读取本地会话 ----------------
   supabase-js 把会话写在 localStorage 的 sb-<ref>-auth-token 里。
   启动时先同步读取，避免为了判断登录状态而阻塞加载 260KB 的 SDK。
   （真正的有效性由 SDK 后台刷新校验） */
function readStoredSession() {
  if (!isRemote || !projectRef) return null
  const prefix = `sb-${projectRef}-auth-token`
  try {
    const raw = localStorage.getItem(prefix)
    if (raw) return JSON.parse(raw)
    // 新版 SDK 可能把较大的会话分块存储
    const parts = Object.keys(localStorage)
      .filter((k) => k.startsWith(prefix + '.'))
      .sort()
    if (parts.length) return JSON.parse(parts.map((k) => localStorage.getItem(k)).join(''))
  } catch {
    // 解析失败按未登录处理
  }
  return null
}

function userFromToken(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(decodeURIComponent(escape(atob(part))))
    return payload?.sub ? { id: payload.sub, email: payload.email || '' } : null
  } catch {
    return null
  }
}

const cachedSession = readStoredSession()

export function hasStoredSession() {
  if (!isRemote) return true
  return !!readStoredSession()?.access_token
}

// 先用本地令牌里的信息渲染，SDK 加载后再校准
if (cachedSession?.access_token) {
  const cachedUser = userFromToken(cachedSession.access_token)
  if (cachedUser) authUser.value = cachedUser
}

// 管理员邮箱（用于前端隐藏编辑入口，真正的权限由数据库 RLS 控制）
const OWNER_EMAIL = (import.meta.env.VITE_OWNER_EMAIL || '').trim().toLowerCase()

export const isOwner = computed(() => {
  if (!isRemote) return true
  if (!authUser.value) return false
  // 没配置管理员邮箱时，退回“登录即可编辑”（与升级前的行为一致）
  if (!OWNER_EMAIL) return true
  return String(authUser.value.email || '').toLowerCase() === OWNER_EMAIL
})

let initPromise = null

// 恢复会话；重复调用只执行一次
export function initAuth() {
  if (!isRemote) {
    authReady.value = true
    return Promise.resolve()
  }
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      const supabase = await getSupabase()
      const { data } = await supabase.auth.getSession()
      authUser.value = data.session?.user || null
      supabase.auth.onAuthStateChange((_event, session) => {
        authUser.value = session?.user || null
        authReady.value = true
      })
    } catch {
      // 网络异常时按未登录处理，不阻塞页面
    } finally {
      authReady.value = true
    }
  })()

  return initPromise
}

// 路由守卫用：最多等 4 秒，避免 Supabase 不可达时白屏
export function ensureAuthReady() {
  if (!isRemote || authReady.value) return Promise.resolve()
  return Promise.race([
    initAuth(),
    new Promise((resolve) => setTimeout(resolve, 4000)),
  ])
}

export async function signInWithPassword(email, password) {
  const supabase = await getSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  authUser.value = data.user || null
}

export async function signOut() {
  if (!isRemote) return
  const supabase = await getSupabase()
  await supabase.auth.signOut()
  authUser.value = null
}
