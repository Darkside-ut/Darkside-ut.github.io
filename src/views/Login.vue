<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { signInWithPassword } from '../composables/useAuth.js'

const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

function errorText(e) {
  const msg = String(e?.message || e || '未知错误')
  if (/invalid login credentials/i.test(msg)) return '邮箱或密码不正确'
  if (/email not confirmed/i.test(msg)) return '邮箱尚未验证，请在 Supabase 后台确认该用户'
  if (/rate limit/i.test(msg)) return '尝试太频繁，请稍后再试'
  if (/invalid api key/i.test(msg)) return 'Supabase key 配置有误'
  if (/failed to fetch|network/i.test(msg)) return '无法连接服务器，请检查网络'
  return msg
}

async function submit() {
  error.value = ''
  const mail = email.value.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
    error.value = '请输入有效的邮箱'
    return
  }
  if (!password.value) {
    error.value = '请输入密码'
    return
  }

  loading.value = true
  try {
    await signInWithPassword(mail, password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.replace(redirect)
  } catch (e) {
    error.value = errorText(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="brand">
        <div class="avatar">
          <span class="avatar-fallback">J</span>
          <img src="/profile.jpg" alt="Jimsss" onerror="this.remove()" />
        </div>
        <div>
          <h1 class="name">Jimsss</h1>
          <p class="tagline">王浩然 USTC:Computer Science</p>
        </div>
      </div>

      <h2 class="title">登录</h2>
      <p class="desc">本站内容仅对管理员可见，请先登录。</p>

      <div class="form">
        <el-input
          v-model="email"
          size="large"
          placeholder="邮箱"
          autocomplete="username"
          @keyup.enter="submit"
        />
        <el-input
          v-model="password"
          size="large"
          type="password"
          show-password
          placeholder="密码"
          autocomplete="current-password"
          @keyup.enter="submit"
        />
        <p v-if="error" class="error">{{ error }}</p>
        <button class="submit-btn" :disabled="loading" @click="submit">
          {{ loading ? '登录中…' : '登录' }}
        </button>
      </div>

      <p class="hint">忘记密码可在 Supabase → Authentication → Users 中重置。</p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.2rem;
}

.login-card {
  width: 100%;
  max-width: 380px;
  padding: 2rem 2rem 1.7rem;
  border-radius: 24px;
  background: rgba(245, 249, 255, 0.78);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(37, 99, 235, 0.14);
  box-shadow: 0 24px 60px -30px rgba(30, 60, 110, 0.45);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-bottom: 1.8rem;
}

.avatar {
  position: relative;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, #60a5fa, #2563eb);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  color: #fff;
  font-weight: 800;
  font-size: 1.2rem;
}

.name {
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-dark);
}

.tagline {
  margin-top: 0.15rem;
  font-size: 0.66rem;
  color: var(--text-dim);
}

.title {
  font-size: 1.55rem;
  font-weight: 800;
  color: var(--text-dark);
  margin-bottom: 0.35rem;
}

.desc {
  font-size: 0.76rem;
  line-height: 1.7;
  color: var(--text-dim);
  margin-bottom: 1.4rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.error {
  font-size: 0.72rem;
  color: #c2410c;
  background: rgba(194, 65, 12, 0.07);
  border: 1px solid rgba(194, 65, 12, 0.18);
  border-radius: 8px;
  padding: 0.4rem 0.65rem;
}

.submit-btn {
  margin-top: 0.2rem;
  padding: 0.65rem 1rem;
  font-family: inherit;
  font-size: 0.86rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #1d4ed8, #2563eb);
  border: none;
  border-radius: 12px;
  transition: 0.2s;
}

.submit-btn:hover:not(:disabled) {
  box-shadow: 0 10px 22px -8px rgba(37, 99, 235, 0.65);
  transform: translateY(-1px);
}

.submit-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.hint {
  margin-top: 1.2rem;
  font-size: 0.64rem;
  line-height: 1.6;
  color: #9aa8c0;
  text-align: center;
}
</style>
