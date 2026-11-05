<script setup>
import { Back } from '@element-plus/icons-vue'
</script>

<template>
  <div class="page">
    <div class="page-card">
      <div class="home-head">
        <div>
          <h2 class="page-title">王浩然</h2>
          <div class="section-sub">中国科学技术大学 · 计算机专业学生</div>
        </div>

        <router-link to="/" class="start-link">
          <el-icon><Back /></el-icon>
          <span>返回开始页</span>
        </router-link>
      </div>

      <p class="intro-text">
        这里是我的个人主页，用来展示我的作品、记录学习与思考。
        对技术充满好奇，喜欢动手实践。
      </p>
    </div>
  </div>
</template>

<style scoped>
.home-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.start-link {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 0.3rem;
  padding: 0.4rem 0.9rem 0.4rem 0.75rem;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-dim);
  text-decoration: none;
  background: rgba(245, 249, 255, 0.7);
  border: 1px solid rgba(37, 99, 235, 0.16);
  border-radius: 60px;
  transition: 0.22s;
}

.start-link:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(37, 99, 235, 0.1);
  transform: translateX(-3px);
}

.start-link .el-icon {
  font-size: 1rem;
  transition: 0.22s;
}

.start-link:hover .el-icon {
  transform: translateX(-2px);
}

.intro-text {
  line-height: 1.8;
  color: var(--text-dark);
}

@media (max-width: 520px) {
  .home-head {
    flex-direction: column;
  }
  .start-link {
    margin-top: 0;
  }
}
</style>
