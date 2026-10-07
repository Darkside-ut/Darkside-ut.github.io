<script setup>
const projects = []
</script>

<template>
  <div class="page">
    <div class="page-card">
      <h2 class="page-title">作品集</h2>
      <div class="section-sub">项目与实践</div>

      <el-empty v-if="projects.length === 0" description="还没有作品，敬请期待" />

      <div class="project-grid">
        <div v-for="p in projects" :key="p.title" class="project-card">
          <div class="cover">{{ p.tag }}</div>
          <h3>{{ p.title }}</h3>
          <p class="desc">{{ p.desc }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 1.2rem;
}

.project-card {
  background: rgba(245, 249, 255, 0.7);
  backdrop-filter: blur(8px);
  border-radius: 24px;
  padding: 1.2rem;
  border: 1px solid rgba(37, 99, 235, 0.12);
  transition: 0.25s;
}

.project-card:hover {
  transform: translateY(-6px);
  border-color: var(--accent);
  background: rgba(37, 99, 235, 0.12);
}

.cover {
  height: 100px;
  border-radius: 14px;
  background: linear-gradient(135deg, #60a5fa, #2563eb);
  color: #fff;
  font-size: 1.5rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.9rem;
}

.project-card h3 {
  margin-bottom: 0.4rem;
  color: var(--text-dark);
}

.desc {
  font-size: 0.82rem;
  color: var(--text-dim);
  line-height: 1.6;
}
</style>
