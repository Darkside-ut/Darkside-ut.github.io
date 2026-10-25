import { computed, ref } from 'vue'
import { isRemote, supabase } from '../lib/supabase.js'

/* ============================================================
   全站登录状态（Supabase Auth）
   - 侧栏统一提供登录 / 退出入口
   - 未配置 Supabase 时 remoteEnabled = false，站点保持纯本地模式
   ============================================================ */

export const remoteEnabled = isRemote
export const authUser = ref(null)
export const authReady = ref(!isRemote)
export const isLoggedIn = computed(() => !!authUser.value)

let authInited = false

export function initAuth() {
  if (!isRemote || authInited) return
  authInited = true

  supabase.auth
    .getSession()
    .then(({ data }) => {
      authUser.value = data.session?.user || null
    })
    .finally(() => {
      authReady.value = true
    })

  supabase.auth.onAuthStateChange((_event, session) => {
    authUser.value = session?.user || null
    authReady.value = true
  })
}

export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  authUser.value = data.user || null
}

export async function signOut() {
  if (!isRemote) return
  await supabase.auth.signOut()
  authUser.value = null
}

/* ---------------- 登录弹窗（任意页面都可唤起） ---------------- */
export const loginOpen = ref(false)

export function openLogin() {
  if (!isRemote) return
  loginOpen.value = true
}

export function closeLogin() {
  loginOpen.value = false
}
