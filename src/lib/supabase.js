/* ============================================================
   Supabase 客户端（按需加载）
   - 只有配置了 URL + key 时才启用；否则站点保持本地模式
   - @supabase/supabase-js 体积较大（约 260KB），用动态 import，
     避免打进主包拖慢首屏
   ============================================================ */

const rawUrl = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// 允许直接粘贴 Data API 地址（.../rest/v1/），统一去掉后缀
const url = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')

export const isRemote = !!(url && key)

// 项目 ref，用于读取 supabase-js 存在 localStorage 里的会话
export const projectRef = (() => {
  try {
    return new URL(url).hostname.split('.')[0]
  } catch {
    return ''
  }
})()

let clientPromise = null

export function getSupabase() {
  if (!isRemote) return Promise.resolve(null)
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) => createClient(url, key))
      .catch((e) => {
        // 加载失败时允许下次重试
        clientPromise = null
        throw e
      })
  }
  return clientPromise
}
