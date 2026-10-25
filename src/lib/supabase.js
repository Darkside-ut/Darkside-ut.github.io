import { createClient } from '@supabase/supabase-js'

/* ============================================================
   Supabase 客户端
   - 只有在 .env.local / GitHub Actions 里配置了下面两个变量时才启用
   - 未配置时整个站点继续使用 localStorage（本地模式），不会报错
   ============================================================ */

const rawUrl = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// 允许直接粘贴 Data API 地址（.../rest/v1/），统一去掉后缀
const url = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')

export const supabase = url && key ? createClient(url, key) : null

export const isRemote = !!supabase
