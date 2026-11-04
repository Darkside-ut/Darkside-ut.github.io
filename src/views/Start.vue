<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  authUser,
  hasStoredSession,
  initAuth,
  isLoggedIn,
  remoteEnabled,
  signInWithPassword,
} from '../composables/useAuth.js'

const route = useRoute()
const router = useRouter()

/* ---------------- 每次打开轮换一句 ----------------
   每行单独设置缩进，形成错落的排版 */
const QUOTES = [
  {
    lines: [
      { text: '不积跬步，无以至千里；', indent: 0 },
      { text: '不积小流，无以成江海。', indent: 2.4 },
    ],
    source: '《劝学》 · 荀子',
  },
  {
    lines: [
      { text: '路漫漫其修远兮，', indent: 0 },
      { text: '吾将上下而求索。', indent: 2.8 },
    ],
    source: '《离骚》 · 屈原',
  },
  {
    lines: [
      { text: '博学之，审问之，', indent: 0 },
      { text: '慎思之，明辨之，', indent: 1.6 },
      { text: '笃行之。', indent: 3.2 },
    ],
    source: '《礼记 · 中庸》',
  },
  {
    lines: [
      { text: '纸上得来终觉浅，', indent: 0 },
      { text: '绝知此事要躬行。', indent: 2.6 },
    ],
    source: '《冬夜读书示子聿》 · 陆游',
  },
  {
    lines: [
      { text: '山重水复疑无路，', indent: 0 },
      { text: '柳暗花明又一村。', indent: 2.6 },
    ],
    source: '《游山西村》 · 陆游',
  },
  {
    lines: [
      { text: '锲而舍之，朽木不折；', indent: 0 },
      { text: '锲而不舍，金石可镂。', indent: 2.2 },
    ],
    source: '《劝学》 · 荀子',
  },
  {
    lines: [
      { text: '问渠那得清如许？', indent: 0 },
      { text: '为有源头活水来。', indent: 2.8 },
    ],
    source: '《观书有感》 · 朱熹',
  },
  {
    lines: [
      { text: '千淘万漉虽辛苦，', indent: 0 },
      { text: '吹尽狂沙始到金。', indent: 2.6 },
    ],
    source: '《浪淘沙》 · 刘禹锡',
  },
  {
    lines: [
      { text: '长风破浪会有时，', indent: 0 },
      { text: '直挂云帆济沧海。', indent: 2.6 },
    ],
    source: '《行路难》 · 李白',
  },
  {
    lines: [
      { text: '知不足，然后能自反也；', indent: 0 },
      { text: '知困，然后能自强也。', indent: 2.2 },
    ],
    source: '《礼记 · 学记》',
  },
]

const QUOTE_KEY = 'start-quote-index'

function pickQuote() {
  let stored = NaN
  try {
    stored = Number(localStorage.getItem(QUOTE_KEY))
  } catch {
    // 隐私模式下 storage 不可用时直接随机
  }

  const index =
    !Number.isFinite(stored) || stored < 0
      ? Math.floor(Math.random() * QUOTES.length)
      : (stored + 1) % QUOTES.length

  try {
    localStorage.setItem(QUOTE_KEY, String(index))
  } catch {
    // 写入失败不影响展示
  }
  return QUOTES[index]
}

const quote = ref(pickQuote())

/* ---------------- 登录 ---------------- */
const loginOpen = ref(false)
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

// 登录成功后去哪：优先回到被拦截的页面，否则进入主页
const target = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/home'
})

function openLogin() {
  error.value = ''
  loginOpen.value = true
}

function closeLogin() {
  if (loading.value) return
  loginOpen.value = false
  error.value = ''
}

/* ---------------- 离场：开始页逐渐消散 ---------------- */
const leaving = ref(false)
const navigating = ref(false)

function revealTo(path) {
  if (navigating.value) return
  navigating.value = true

  // 系统开启“减少动态效果”时直接跳转
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    router.push(path)
    return
  }

  // 开始页自身淡出、模糊、轻微放大，快结束时再切换路由，
  // 让首页从消散后的画面里出现
  leaving.value = true
  setTimeout(() => router.push(path), 680)
  setTimeout(() => {
    leaving.value = false
    navigating.value = false
  }, 1600)
}

function enter() {
  if (!remoteEnabled) {
    revealTo('/home')
    return
  }
  if (isLoggedIn.value || hasStoredSession()) {
    revealTo(target.value)
    return
  }
  openLogin()
}

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
    loginOpen.value = false
    password.value = ''
    ElMessage.success('登录成功')
    revealTo(target.value)
  } catch (e) {
    error.value = errorText(e)
  } finally {
    loading.value = false
  }
}

/* ---------------- 日期 ---------------- */
const WEEK = ['日', '一', '二', '三', '四', '五', '六']
const now = ref(new Date())
let clockTimer = null

const dateText = computed(() => {
  const d = now.value
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} 周${
    WEEK[d.getDay()]
  } ${p(d.getHours())}:${p(d.getMinutes())}`
})

function onKeydown(e) {
  if (e.key === 'Escape' && loginOpen.value) closeLogin()
}

onMounted(() => {
  initAuth()
  clockTimer = setInterval(() => (now.value = new Date()), 30000)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  clearInterval(clockTimer)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="start" :class="{ leaving }">
    <!-- 背景 -->
    <div class="bg-fallback"></div>
    <div class="veil"></div>

    <!-- 顶部标识 -->
    <header class="start-top">
      <div class="logo">
        <span class="logo-mark">J</span>
        <span class="logo-text">Jimsss · 王浩然</span>
      </div>
      <span class="top-tag">Personal Site</span>
    </header>

    <!-- 中央内容 -->
    <main class="start-center">
      <p class="eyebrow">KEEP WALKING</p>

      <blockquote class="start-quote">
        <span class="quote-deco">“</span>
        <p
          v-for="(line, i) in quote.lines"
          :key="line.text"
          class="quote-line"
          :style="{
            marginLeft: line.indent + 'em',
            animationDelay: 0.18 + i * 0.12 + 's',
          }"
        >
          {{ line.text }}
        </p>
        <cite :style="{ animationDelay: 0.18 + quote.lines.length * 0.12 + 's' }">
          {{ quote.source }}
        </cite>
      </blockquote>

      <button class="enter-btn" @click="enter">
        <span>点此开始</span>
        <span class="arrow">→</span>
      </button>

      <div class="start-actions">
        <button
          v-if="remoteEnabled && !isLoggedIn"
          class="login-link"
          @click="openLogin"
        >
          登录
        </button>
        <span v-else-if="isLoggedIn" class="logged-in" :title="authUser.email">
          已登录 · {{ authUser.email }}
        </span>
      </div>
    </main>

    <!-- 底部 -->
    <footer class="start-foot">
      <span>📍 中国 · 合肥</span>
      <span class="dot">·</span>
      <span>{{ dateText }}</span>
    </footer>

    <!-- 登录浮层 -->
    <transition name="login-fade">
      <div v-if="loginOpen" class="login-mask" @click.self="closeLogin">
        <div class="login-card">
          <button class="login-close" aria-label="关闭" @click="closeLogin">×</button>
          <h2>登录</h2>
          <p class="login-sub">使用管理员账号进入站点</p>
          <input
            v-model="email"
            type="email"
            placeholder="邮箱"
            autocomplete="username"
            @keyup.enter="submit"
          />
          <input
            v-model="password"
            type="password"
            placeholder="密码"
            autocomplete="current-password"
            @keyup.enter="submit"
          />
          <p v-if="error" class="login-error">{{ error }}</p>
          <button class="login-submit" :disabled="loading" @click="submit">
            {{ loading ? '登录中…' : '登录并进入' }}
          </button>
          <p class="login-hint">忘记密码可在 Supabase → Authentication → Users 中重置。</p>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.start {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #0b1526;
  color: #fff;
}

/* 兜底离场动画：开始页自身消散 */
.start.leaving {
  animation: page-dissolve 0.72s cubic-bezier(0.4, 0, 0.2, 1) both;
  pointer-events: none;
}

@keyframes page-dissolve {
  from {
    opacity: 1;
    filter: blur(0);
    transform: scale(1);
  }
  to {
    opacity: 0;
    filter: blur(22px);
    transform: scale(1.035);
  }
}

/* ===== 背景 ===== */
.bg-fallback {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 22% 30%, rgba(96, 165, 250, 0.35), transparent 45%),
    radial-gradient(circle at 78% 70%, rgba(30, 64, 175, 0.5), transparent 50%),
    linear-gradient(135deg, #0b1526, #16305c 55%, #0b1526);
}

.bg-fallback::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: radial-gradient(circle at 50% 45%, #000 20%, transparent 78%);
}

.veil {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 42%, rgba(5, 12, 26, 0.15), rgba(5, 12, 26, 0.66) 78%),
    linear-gradient(180deg, rgba(5, 12, 26, 0.55), rgba(5, 12, 26, 0.35) 40%, rgba(5, 12, 26, 0.72));
}

/* ===== 顶部 ===== */
.start-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 2rem;
  animation: fade-down 0.8s ease both;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.logo-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  font-weight: 800;
  font-size: 0.9rem;
  color: #0b1526;
  background: #fff;
  border-radius: 9px;
}

.logo-text {
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.82);
}

.top-tag {
  font-size: 0.62rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
}

/* ===== 中央 ===== */
.start-center {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
  text-align: center;
}

.eyebrow {
  font-size: 0.62rem;
  letter-spacing: 0.42em;
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 1.3rem;
  animation: fade-up 0.8s 0.1s ease both;
}

.start-quote {
  position: relative;
  display: inline-block;
  margin: 0;
  padding-left: 2.4rem;
  text-align: left;
}

.quote-deco {
  position: absolute;
  left: 0;
  top: -0.6rem;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 3.6rem;
  line-height: 1;
  color: rgba(255, 255, 255, 0.16);
  pointer-events: none;
}

.quote-line {
  font-family: 'Songti SC', 'STSong', 'SimSun', 'LXGW WenKai', serif;
  font-size: clamp(1.4rem, 3.4vw, 2.4rem);
  font-weight: 500;
  line-height: 1.7;
  letter-spacing: 0.1em;
  white-space: nowrap;
  text-shadow: 0 2px 24px rgba(0, 0, 0, 0.55);
  animation: fade-up 0.8s ease both;
}

.start-quote cite {
  display: block;
  margin-top: 1rem;
  font-size: 0.72rem;
  font-style: normal;
  letter-spacing: 0.16em;
  text-align: right;
  color: rgba(255, 255, 255, 0.6);
  animation: fade-up 0.8s ease both;
}

.enter-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 2.4rem;
  padding: 0.78rem 1.9rem;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: #0b1526;
  background: rgba(255, 255, 255, 0.92);
  border: none;
  border-radius: 60px;
  box-shadow: 0 14px 40px -18px rgba(0, 0, 0, 0.8);
  transition: 0.28s;
  animation: fade-up 1s 0.35s ease both;
}

.enter-btn:hover {
  background: #fff;
  transform: translateY(-2px);
  box-shadow: 0 18px 46px -16px rgba(0, 0, 0, 0.85);
}

.enter-btn .arrow {
  transition: transform 0.28s;
}

.enter-btn:hover .arrow {
  transform: translateX(4px);
}

.start-actions {
  min-height: 2.2rem;
  margin-top: 1.1rem;
  animation: fade-up 1s 0.5s ease both;
}

.login-link {
  padding: 0.2rem 0.4rem;
  font-family: inherit;
  font-size: 0.74rem;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.66);
  background: none;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.28);
  transition: 0.2s;
}

.login-link:hover {
  color: #fff;
  border-bottom-color: #fff;
}

.logged-in {
  display: inline-block;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.62);
}

/* ===== 底部 / 指示点 ===== */
.start-foot {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 1.4rem;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.5);
  animation: fade-up 1s 0.6s ease both;
}

.start-foot .dot {
  opacity: 0.5;
}

/* ===== 登录浮层 ===== */
.login-mask {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.2rem;
  background: rgba(4, 10, 22, 0.55);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.login-card {
  position: relative;
  width: 100%;
  max-width: 360px;
  padding: 1.7rem 1.7rem 1.4rem;
  border-radius: 20px;
  background: rgba(245, 249, 255, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 30px 80px -30px rgba(0, 0, 0, 0.8);
  color: var(--text-dark);
  animation: card-in 0.28s ease both;
}

.login-close {
  position: absolute;
  top: 0.6rem;
  right: 0.75rem;
  width: 28px;
  height: 28px;
  font-size: 1.15rem;
  line-height: 1;
  color: #9aa8c0;
  background: none;
  border: none;
  border-radius: 8px;
}

.login-close:hover {
  color: var(--text-dark);
  background: rgba(37, 99, 235, 0.08);
}

.login-card h2 {
  font-size: 1.3rem;
  font-weight: 800;
}

.login-sub {
  margin: 0.25rem 0 1rem;
  font-size: 0.72rem;
  color: var(--text-dim);
}

.login-card input {
  width: 100%;
  margin-bottom: 0.65rem;
  padding: 0.62rem 0.8rem;
  font-family: inherit;
  font-size: 0.82rem;
  color: var(--text-dark);
  background: #fff;
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 10px;
  outline: none;
  transition: 0.2s;
}

.login-card input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.login-error {
  margin-bottom: 0.6rem;
  padding: 0.4rem 0.6rem;
  font-size: 0.7rem;
  color: #c2410c;
  background: rgba(194, 65, 12, 0.07);
  border: 1px solid rgba(194, 65, 12, 0.18);
  border-radius: 8px;
}

.login-submit {
  width: 100%;
  padding: 0.62rem;
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #1d4ed8, #2563eb);
  border: none;
  border-radius: 10px;
  transition: 0.2s;
}

.login-submit:hover:not(:disabled) {
  box-shadow: 0 10px 24px -10px rgba(37, 99, 235, 0.7);
}

.login-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-hint {
  margin-top: 0.9rem;
  font-size: 0.62rem;
  line-height: 1.6;
  color: #9aa8c0;
  text-align: center;
}

/* ===== 动画 ===== */
@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fade-down {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.login-fade-enter-active,
.login-fade-leave-active {
  transition: opacity 0.25s ease;
}

.login-fade-enter-from,
.login-fade-leave-to {
  opacity: 0;
}

@media (max-width: 600px) {
  .start-top {
    padding: 1rem 1.1rem;
  }
  .top-tag {
    display: none;
  }
  .start-quote {
    padding-left: 1.4rem;
  }
  .quote-deco {
    font-size: 2.4rem;
    top: -0.3rem;
  }
  .quote-line {
    font-size: 1.25rem;
    letter-spacing: 0.04em;
  }
}

@media (prefers-reduced-motion: reduce) {
  .start-top,
  .eyebrow,
  .quote-line,
  .start-quote cite,
  .enter-btn,
  .start-actions,
  .start-foot,
  .login-card {
    animation: none;
  }
}
</style>
