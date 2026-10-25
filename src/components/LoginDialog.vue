<script setup>
import { ref } from 'vue'
import { loginOpen, signInWithPassword } from '../composables/useAuth.js'

const email = ref('')
const password = ref('')
const sending = ref(false)

function errorText(e) {
  const msg = String(e?.message || e || '未知错误')
  if (/invalid login credentials/i.test(msg)) return '邮箱或密码不正确'
  if (/email not confirmed/i.test(msg)) return '邮箱尚未验证，请在 Supabase 后台确认该用户'
  if (/rate limit/i.test(msg)) return '尝试太频繁，请稍后再试'
  if (/invalid api key/i.test(msg)) return 'Supabase key 配置有误'
  return msg
}

async function submit() {
  const mail = email.value.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
    ElMessage.warning('请输入有效的邮箱')
    return
  }
  if (!password.value) {
    ElMessage.warning('请输入密码')
    return
  }
  sending.value = true
  try {
    await signInWithPassword(mail, password.value)
    loginOpen.value = false
    password.value = ''
    ElMessage.success('登录成功')
  } catch (e) {
    ElMessage.error(errorText(e))
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <el-dialog v-model="loginOpen" title="登录" width="400px" align-center>
    <div class="login-box">
      <p class="login-tip">使用在 Supabase 后台创建的管理员账号登录。</p>
      <el-input
        v-model="email"
        placeholder="邮箱"
        autocomplete="username"
        @keyup.enter="submit"
      />
      <el-input
        v-model="password"
        type="password"
        show-password
        placeholder="密码"
        autocomplete="current-password"
        @keyup.enter="submit"
      />
      <p class="login-hint">忘记密码可在 Supabase → Authentication → Users 中重置。</p>
    </div>
    <template #footer>
      <button class="dlg-btn ghost" @click="loginOpen = false">取消</button>
      <button class="dlg-btn primary" :disabled="sending" @click="submit">
        {{ sending ? '登录中…' : '登录' }}
      </button>
    </template>
  </el-dialog>
</template>

<style scoped>
.login-box {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.login-tip {
  font-size: 0.76rem;
  line-height: 1.7;
  color: var(--text-dim);
}

.login-hint {
  font-size: 0.66rem;
  color: #8d9bb5;
}

.dlg-btn {
  padding: 0.42rem 1rem;
  font-family: inherit;
  font-size: 0.76rem;
  font-weight: 600;
  border-radius: 9px;
  transition: 0.18s;
}

.dlg-btn.ghost {
  color: var(--accent);
  background: rgba(37, 99, 235, 0.07);
  border: 1px solid rgba(37, 99, 235, 0.2);
}

.dlg-btn.ghost:hover {
  background: var(--accent);
  color: #fff;
}

.dlg-btn.primary {
  margin-left: 0.5rem;
  color: #fff;
  background: linear-gradient(135deg, #1d4ed8, #2563eb);
  border: none;
}

.dlg-btn.primary:hover:not(:disabled) {
  box-shadow: 0 6px 16px -4px rgba(37, 99, 235, 0.55);
}

.dlg-btn.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
