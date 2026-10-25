<script setup>
import { ArrowLeft } from '@element-plus/icons-vue'

// 组件页通用返回按钮
defineProps({
  to: { type: String, default: '/components' },
  label: { type: String, default: '返回组件' },
})
</script>

<template>
  <router-link :to="to" class="page-back">
    <el-icon><ArrowLeft /></el-icon>
    <span>{{ label }}</span>
  </router-link>
</template>

<style scoped>
.page-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 1.1rem;
  padding: 0.45rem 1rem 0.45rem 0.85rem;
  color: var(--text-dim);
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 500;
  background: rgba(245, 249, 255, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(37, 99, 235, 0.16);
  border-radius: 60px;
  transition: 0.25s;
}

.page-back .el-icon {
  font-size: 1rem;
  transition: 0.25s;
}

.page-back:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(37, 99, 235, 0.12);
  transform: translateX(-3px);
}

.page-back:hover .el-icon {
  transform: translateX(-2px);
}
</style>
