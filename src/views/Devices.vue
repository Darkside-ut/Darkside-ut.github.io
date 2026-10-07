<script setup>
import { Calendar, Monitor, Iphone, Headset, Mouse, Watch } from '@element-plus/icons-vue'
import GamepadIcon from '../components/icons/GamepadIcon.vue'
import TabletIcon from '../components/icons/TabletIcon.vue'

// ===== 你的设备 =====
//   icon   图标组件
//   name   设备名称
//   model  具体型号（可选）
//   date   购买日期（格式 YYYY-MM）
//   desc   一段描述（可选）
const devices = [
  {
    icon: Monitor,
    name: '联想拯救者 Y9000P 2024',
    model: 'i9-14900HX|RTX4070|32GB|1TB',
    date: '2024-07',
  },
  {
    icon: Monitor,
    name: '机械革命星耀14',
    model: '锐龙 AI 9H 365|32GB|1TB',
    date: '2026-09',
  },
  {
    icon: Mouse,
    name: '漫步者 G3M Pro',
    date: '2026-09',
  },
  {
    icon: Mouse,
    name: '前行者X23',
    date: '2026-09',
  },
  {
    icon: Iphone,
    name: 'vivo iQOO Neo9S Pro',
    model: '天玑 9300+ 八核|16+16GB|512GB',
    date: '2024-07',
  },
  {
    icon: Headset,
    name: 'vivo iQOO YWS 1i',
    date: '2026-05',
  },
  {
    icon: Headset,
    name: '水月雨竹Ⅲ',
    date: '2026-10',
  },
  {
    icon: TabletIcon,
    name: 'HUAWEI MatePad 11.5S',
    model: '柔光版|8GB|256GB',
    date: '2025-04',
  },
  {
    icon: Watch,
    name: 'HUAWEI WATCH GT 5 Pro',
    date: '2025-02',
  },
  {
    icon: GamepadIcon,
    name: 'SteamDeck',
    model: '64GB',
    date: '2025-04',
  },
]

// 按购买日期从早到晚排序（date 是 YYYY-MM 格式，字符串排序即时间顺序）。
// 静态数据直接排序成常量即可，无需 computed。
const sortedDevices = [...devices].sort((a, b) => a.date.localeCompare(b.date))
</script>

<template>
  <div class="page">
    <div class="page-card devices-page">
      <h2 class="page-title">我的电子伙伴</h2>
      <div class="section-sub">这是我的电子伙伴们</div>

      <div class="timeline">
        <div
          v-for="(d, i) in sortedDevices"
          :key="d.name"
          class="timeline-item"
          :class="i % 2 ? 'right' : 'left'"
        >
          <span class="timeline-dot"></span>
          <div class="timeline-card">
            <div class="device-top">
              <div class="device-icon">
                <el-icon><component :is="d.icon" /></el-icon>
              </div>
              <div class="device-title">
                <h3 class="device-name">{{ d.name }}</h3>
                <div v-if="d.model" class="device-model">{{ d.model }}</div>
              </div>
            </div>
            <div class="device-date">
              <el-icon><Calendar /></el-icon>
              <span>{{ d.date }}</span>
            </div>
            <p v-if="d.desc" class="device-desc">{{ d.desc }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.devices-page {
  max-width: 900px;
}

.timeline {
  position: relative;
  padding: 0.5rem 0;
}

/* 中间竖线 */
.timeline::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(-50%);
  background: linear-gradient(
    to bottom,
    rgba(37, 99, 235, 0.05),
    rgba(37, 99, 235, 0.55),
    rgba(37, 99, 235, 0.05)
  );
}

.timeline-item {
  position: relative;
  width: 50%;
  padding: 0 2.4rem 2rem 0;
}

.timeline-item.right {
  left: 50%;
  padding: 0 0 2rem 2.4rem;
}

/* 时间节点圆点 */
.timeline-dot {
  position: absolute;
  top: 1.4rem;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  border: 3px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
}

.timeline-item.left .timeline-dot {
  right: 0;
  transform: translateX(50%);
}

.timeline-item.right .timeline-dot {
  left: 0;
  transform: translateX(-50%);
}

/* 设备卡片 */
.timeline-card {
  background: rgba(245, 249, 255, 0.7);
  backdrop-filter: blur(8px);
  border-radius: 20px;
  padding: 1.1rem 1.2rem;
  border: 1px solid rgba(37, 99, 235, 0.12);
  transition: 0.25s;
}

.timeline-card:hover {
  border-color: var(--accent);
  box-shadow: 0 10px 24px -10px rgba(37, 99, 235, 0.25);
}

.device-top {
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  margin-bottom: 0.7rem;
}

.device-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(37, 99, 235, 0.12);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  flex-shrink: 0;
}

.device-title {
  flex: 1;
  min-width: 0;
}

.device-name {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-dark);
  line-height: 1.3;
}

.device-model {
  font-size: 0.8rem;
  color: var(--accent);
  font-weight: 600;
  margin-top: 0.2rem;
}

.device-date {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  color: var(--text-dim);
  margin-bottom: 0.4rem;
}

.device-desc {
  font-size: 0.82rem;
  color: var(--text-dim);
  line-height: 1.6;
}

/* 手机端：收成单列，竖线靠左 */
@media (max-width: 640px) {
  .timeline::before {
    left: 1rem;
  }
  .timeline-item,
  .timeline-item.right {
    width: 100%;
    left: 0;
    padding: 0 0 1.6rem 2.8rem;
  }
  .timeline-item.left .timeline-dot,
  .timeline-item.right .timeline-dot {
    left: 1rem;
    right: auto;
    transform: translateX(-50%);
  }
}
</style>
