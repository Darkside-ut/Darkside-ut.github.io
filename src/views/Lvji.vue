<script setup>
import { ref, computed, reactive, onMounted, onBeforeUnmount } from 'vue'
import { ArrowLeft, MapLocation, ZoomIn, ZoomOut, RefreshLeft } from '@element-plus/icons-vue'
import { chinaViewBox, provinces, cityMaps } from './lvji/mapData.js'
import { attractionsByProvince, provinceHasAttractions } from './lvji/attractions.js'

// ---------- 市名智能缩写 ----------
const ABBR = {
  克孜勒苏柯尔克孜自治州: '克州',
  巴音郭楞蒙古自治州: '巴州',
  博尔塔拉蒙古自治州: '博州',
  昌吉回族自治州: '昌吉州',
  伊犁哈萨克自治州: '伊犁州',
  恩施土家族苗族自治州: '恩施州',
  湘西土家族苗族自治州: '湘西州',
  黔东南苗族侗族自治州: '黔东南州',
  黔南布依族苗族自治州: '黔南州',
  黔西南布依族苗族自治州: '黔西南州',
  西双版纳傣族自治州: '西双版纳',
  德宏傣族景颇族自治州: '德宏州',
  怒江傈僳族自治州: '怒江州',
  大理白族自治州: '大理州',
  楚雄彝族自治州: '楚雄州',
  红河哈尼族彝族自治州: '红河州',
  文山壮族苗族自治州: '文山州',
  迪庆藏族自治州: '迪庆州',
  甘孜藏族自治州: '甘孜州',
  阿坝藏族羌族自治州: '阿坝州',
  凉山彝族自治州: '凉山州',
  延边朝鲜族自治州: '延边州',
  海北藏族自治州: '海北州',
  海南藏族自治州: '海南州',
  黄南藏族自治州: '黄南州',
  果洛藏族自治州: '果洛州',
  玉树藏族自治州: '玉树州',
  海西蒙古族藏族自治州: '海西州',
  临夏回族自治州: '临夏州',
  甘南藏族自治州: '甘南州',
}

function shortName(name) {
  if (ABBR[name]) return ABBR[name]
  return name
    .replace(/特别行政区$/, '')
    .replace(/壮族自治区$|回族自治区$|维吾尔自治区$|自治区$/, '')
    .replace(/自治州$|自治县$|自治旗$/, '')
    .replace(/(市|地区|区|县|旗)$/, '')
}

const PROV_SHORT = {
  内蒙古自治区: '内蒙古',
  广西壮族自治区: '广西',
  西藏自治区: '西藏',
  宁夏回族自治区: '宁夏',
  新疆维吾尔自治区: '新疆',
  香港特别行政区: '香港',
  澳门特别行政区: '澳门',
}

// ---------- 状态 ----------
const view = ref('home') // 'home' | 'province'
const activeProvince = ref(null) // adcode
const activeCity = ref(null) // 悬停/触摸的市区名（显示全称）
const activeAttraction = ref(null) // 当前选中的景点

const currentProvince = computed(() =>
  provinces.find((p) => p.adcode === activeProvince.value)
)
const currentCityMap = computed(() => cityMaps[activeProvince.value])
const currentAttractions = computed(() =>
  attractionsByProvince[activeProvince.value] || []
)

// ---------- 投影：把景点经纬度投影到市区地图坐标 ----------
function projectLngLat(bbox, W, H, pad, coord) {
  const midLat = ((bbox[1] + bbox[3]) / 2) * (Math.PI / 180)
  const cosMid = Math.cos(midLat)
  const lonSpan = (bbox[2] - bbox[0]) * cosMid
  const latSpan = bbox[3] - bbox[1]
  const scale = Math.min((W - pad * 2) / lonSpan, (H - pad * 2) / latSpan)
  const w = lonSpan * scale
  const h = latSpan * scale
  const ox = (W - w) / 2
  const oy = (H - h) / 2
  return [
    ox + (coord[0] - bbox[0]) * cosMid * scale,
    oy + (bbox[3] - coord[1]) * scale,
  ]
}

function attractionPoint(a) {
  const bbox = currentCityMap.value?.bbox
  if (!bbox) return { x: 0, y: 0 }
  const [x, y] = projectLngLat(bbox, 800, 620, 20, [a.lng, a.lat])
  return { x, y }
}

// ---------- 平移 / 缩放 ----------
const pan = reactive({ x: 0, y: 0, k: 1 })
const panTransform = computed(() => `translate(${pan.x} ${pan.y}) scale(${pan.k})`)

const drag = reactive({ active: false, moved: false, sx: 1, sy: 1, startX: 0, startY: 0, panX: 0, panY: 0 })
const dragged = ref(false) // 拖拽后抑制 click

function resetPan() {
  pan.x = 0
  pan.y = 0
  pan.k = 1
}

function svgScale(el) {
  const vb = el.viewBox.baseVal
  const rect = el.getBoundingClientRect()
  return { sx: vb.width / rect.width, sy: vb.height / rect.height }
}

function onPointerDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  const { sx, sy } = svgScale(e.currentTarget)
  drag.active = true
  drag.moved = false
  drag.sx = sx
  drag.sy = sy
  drag.startX = e.clientX
  drag.startY = e.clientY
  drag.panX = pan.x
  drag.panY = pan.y
}

// 拖动的 move/up 挂在 window 上，避免 pointer 移出 svg 后丢事件；
// 同时不调用 setPointerCapture，否则会把 click 重定向到 svg，导致省份/景点点不开。
function onPointerMove(e) {
  if (!drag.active) return
  const dx = e.clientX - drag.startX
  const dy = e.clientY - drag.startY
  if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true
  pan.x = drag.panX + dx * drag.sx
  pan.y = drag.panY + dy * drag.sy
}

function onPointerUp() {
  if (drag.active && drag.moved) {
    dragged.value = true
    setTimeout(() => (dragged.value = false), 0)
  }
  drag.active = false
}

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
})

function onWheel(e) {
  e.preventDefault()
  const el = e.currentTarget
  const rect = el.getBoundingClientRect()
  const vb = el.viewBox.baseVal
  const sx = vb.width / rect.width
  const sy = vb.height / rect.height
  const mx = (e.clientX - rect.left) * sx
  const my = (e.clientY - rect.top) * sy
  const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2
  applyZoom(factor, mx, my)
}

function applyZoom(factor, cx, cy) {
  const k1 = Math.min(12, Math.max(1, pan.k * factor))
  const r = k1 / pan.k
  pan.x = cx - (cx - pan.x) * r
  pan.y = cy - (cy - pan.y) * r
  pan.k = k1
}

function zoomCenter(factor) {
  const vbH = view.value === 'home' ? 700 : 620
  applyZoom(factor, 400, vbH / 2)
}

// 切换视图时重置地图
function enterProvince(adcode) {
  if (dragged.value) return
  activeProvince.value = adcode
  activeCity.value = null
  activeAttraction.value = null
  view.value = 'province'
  resetPan()
}

function backHome() {
  view.value = 'home'
  activeProvince.value = null
  activeCity.value = null
  activeAttraction.value = null
  resetPan()
}

function pickAttraction(a) {
  if (dragged.value) return
  activeAttraction.value = a
}

function onSvgClick(e) {
  if (dragged.value) return
  if (e.target === e.currentTarget) activeAttraction.value = null
}

function provShort(p) {
  return PROV_SHORT[p.name] || shortName(p.name)
}
</script>

<template>
  <div class="lvji">
    <transition name="swap" mode="out-in">
      <!-- ===================== 首页：中国地图 ===================== -->
      <div v-if="view === 'home'" key="home" class="stage">
        <header class="head">
          <h2 class="page-title">旅迹</h2>
          <div class="section-sub">点击省份，探索那一方山水 · 滚轮缩放，拖动平移</div>
        </header>

        <div class="map-wrap">
          <svg
            :viewBox="chinaViewBox"
            class="map"
            preserveAspectRatio="xMidYMid meet"
            @pointerdown="onPointerDown"
            @wheel.prevent="onWheel"
            @click="onSvgClick"
          >
            <g class="viewport" :transform="panTransform">
              <g class="provinces">
                <g
                  v-for="p in provinces"
                  :key="p.adcode"
                  class="province"
                  :class="{ 'has-data': provinceHasAttractions.has(String(p.adcode)) }"
                  @click="enterProvince(p.adcode)"
                >
                  <path :d="p.d" class="province-shape" />
                  <circle
                    v-if="p.adcode === 810000 || p.adcode === 820000"
                    :cx="p.center[0]"
                    :cy="p.center[1]"
                    r="16"
                    class="hot-zone"
                  />
                  <text
                    :x="p.center[0]"
                    :y="p.center[1]"
                    class="province-label"
                    text-anchor="middle"
                  >{{ provShort(p) }}</text>
                </g>
              </g>
            </g>
          </svg>

          <div class="zoom-bar">
            <button class="zoom-btn" @click="zoomCenter(1.3)" aria-label="放大"><el-icon><ZoomIn /></el-icon></button>
            <button class="zoom-btn" @click="zoomCenter(1 / 1.3)" aria-label="缩小"><el-icon><ZoomOut /></el-icon></button>
            <button class="zoom-btn" @click="resetPan" aria-label="复位"><el-icon><RefreshLeft /></el-icon></button>
          </div>
        </div>

        <p class="guide">有 <span class="pulse-dot"></span> 呼吸光效的省份已收录景点</p>
      </div>

      <!-- ===================== 省份详情：市区地图 + 景点 ===================== -->
      <div v-else key="province" class="stage">
        <header class="head">
          <button class="back" @click="backHome" aria-label="返回">
            <el-icon><ArrowLeft /></el-icon>
            <span>返回首页</span>
          </button>
          <h2 class="page-title">{{ currentProvince?.name }}</h2>
          <div class="section-sub">
            {{ currentCityMap?.cities.length || 0 }} 个市 · {{ currentAttractions.length }} 个景点
          </div>
        </header>

        <div class="map-wrap city-wrap">
          <svg
            v-if="currentCityMap?.viewBox"
            :viewBox="currentCityMap.viewBox"
            class="map"
            preserveAspectRatio="xMidYMid meet"
            @pointerdown="onPointerDown"
            @wheel.prevent="onWheel"
            @click="onSvgClick"
          >
            <g class="viewport" :transform="panTransform">
              <g class="cities">
                <g
                  v-for="c in currentCityMap.cities"
                  :key="c.adcode"
                  class="city"
                  @mouseenter="activeCity = c"
                  @mouseleave="activeCity = null"
                  @touchstart="activeCity = c"
                >
                  <path :d="c.d" class="city-shape" />
                </g>
              </g>

              <g class="city-labels" pointer-events="none">
                <text
                  v-for="c in currentCityMap.cities"
                  :key="'l' + c.adcode"
                  :x="c.centroid[0]"
                  :y="c.centroid[1]"
                  class="city-label"
                  text-anchor="middle"
                >{{ shortName(c.name) }}</text>
              </g>

              <g class="attractions" pointer-events="none">
                <g
                  v-for="a in currentAttractions"
                  :key="a.name"
                  class="attraction"
                  :transform="`translate(${attractionPoint(a).x}, ${attractionPoint(a).y})`"
                >
                  <circle class="pulse pulse-a" r="14" />
                  <circle class="pulse pulse-b" r="12" />
                  <circle class="core" r="4" />
                  <circle class="hit" r="16" pointer-events="all" @click="pickAttraction(a)" />
                </g>
              </g>
            </g>
          </svg>

          <div class="zoom-bar">
            <button class="zoom-btn" @click="zoomCenter(1.3)" aria-label="放大"><el-icon><ZoomIn /></el-icon></button>
            <button class="zoom-btn" @click="zoomCenter(1 / 1.3)" aria-label="缩小"><el-icon><ZoomOut /></el-icon></button>
            <button class="zoom-btn" @click="resetPan" aria-label="复位"><el-icon><RefreshLeft /></el-icon></button>
          </div>

          <div class="city-hint" v-if="activeCity">{{ activeCity.name }}</div>

          <transition name="card">
            <div v-if="activeAttraction" class="info-card" @click.self="activeAttraction = null">
              <div class="card-emoji">{{ activeAttraction.emoji }}</div>
              <div class="card-body">
                <div class="card-top">
                  <h3>{{ activeAttraction.name }}</h3>
                  <span class="rating">★ {{ activeAttraction.rating }}</span>
                </div>
                <div class="tags">
                  <span v-for="t in activeAttraction.tags" :key="t" class="tag">{{ t }}</span>
                </div>
                <p class="card-desc">{{ activeAttraction.desc }}</p>
              </div>
              <button class="card-close" @click="activeAttraction = null" aria-label="关闭">×</button>
            </div>
          </transition>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.lvji {
  --primary: #c06060;
  --title: #4a3030;
  min-height: 100%;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #fafafa;
  padding: 2rem 2.5rem;
  box-sizing: border-box;
  font-family: '微软雅黑', 'Microsoft YaHei', -apple-system, sans-serif;
}

.stage {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.head {
  margin-bottom: 1.2rem;
}

.head .page-title {
  margin: 0;
  font-size: 1.9rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--title);
}

.section-sub {
  margin-top: 0.3rem;
  font-size: 0.86rem;
  color: #b08a8a;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 0.6rem;
  padding: 0.4rem 0.9rem;
  font-size: 0.82rem;
  color: var(--primary);
  background: #f5e6e0;
  border: 1px solid rgba(192, 96, 96, 0.35);
  border-radius: 20px;
  cursor: pointer;
  transition: 0.2s;
}

.back:hover {
  background: var(--primary);
  color: #fff;
}

.map-wrap {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
}

.map {
  width: 100%;
  height: 100%;
  max-height: 76vh;
  cursor: grab;
  touch-action: none;
  user-select: none;
  overflow: visible;
}

.map:active {
  cursor: grabbing;
}

/* ---------- 缩放控制条 ---------- */
.zoom-bar {
  position: absolute;
  right: 0.8rem;
  bottom: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.zoom-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(192, 96, 96, 0.3);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  color: var(--primary);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(120, 60, 60, 0.12);
  transition: 0.2s;
}

.zoom-btn:hover {
  background: var(--primary);
  color: #fff;
}

/* ---------- 省份地图 ---------- */
.province {
  cursor: pointer;
}

.province-shape {
  fill: #f5e6e0;
  stroke: #fff;
  stroke-width: 1.2;
  filter: drop-shadow(-1px -1px 1px rgba(255, 255, 255, 0.8))
    drop-shadow(3px 3px 3px rgba(120, 60, 60, 0.18));
  transition: fill 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    filter 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.province:hover .province-shape {
  fill: #f0cfc6;
  filter: drop-shadow(0 0 6px rgba(192, 96, 96, 0.5));
}

.province-label {
  font-size: 9px;
  fill: #a87878;
  pointer-events: none;
  user-select: none;
}

.hot-zone {
  fill: transparent;
  cursor: pointer;
  pointer-events: all;
}

/* 有数据的省份呼吸光效 */
.province.has-data .province-shape {
  animation: breathe-prov 2.8s ease-in-out infinite;
}

@keyframes breathe-prov {
  0%,
  100% {
    filter: drop-shadow(-1px -1px 1px rgba(255, 255, 255, 0.8))
      drop-shadow(0 0 2px rgba(192, 96, 96, 0.15));
  }
  50% {
    filter: drop-shadow(-1px -1px 1px rgba(255, 255, 255, 0.8))
      drop-shadow(0 0 9px rgba(192, 96, 96, 0.55));
  }
}

.guide {
  margin-top: 0.8rem;
  text-align: center;
  font-size: 0.78rem;
  color: #b08a8a;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary);
  animation: pulse-dot 1.6s ease-out infinite;
}

@keyframes pulse-dot {
  0% {
    box-shadow: 0 0 0 0 rgba(192, 96, 96, 0.6);
  }
  100% {
    box-shadow: 0 0 0 9px rgba(192, 96, 96, 0);
  }
}

/* ---------- 市区地图 ---------- */
.city {
  cursor: pointer;
}

.city-shape {
  fill: #f8e8e4;
  stroke: #e3b7ae;
  stroke-width: 1;
  filter: drop-shadow(-1px -1px 1px rgba(255, 255, 255, 0.7))
    drop-shadow(2px 2px 2px rgba(120, 60, 60, 0.12));
  transition: fill 0.28s cubic-bezier(0.16, 1, 0.3, 1),
    filter 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.city:hover .city-shape {
  fill: #f3d6cd;
  filter: drop-shadow(0 0 6px rgba(192, 96, 96, 0.55));
}

.city-label {
  font-size: 8px;
  fill: #7a4a4a;
  user-select: none;
}

.city-hint {
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.3rem 0.9rem;
  font-size: 0.8rem;
  color: #fff;
  background: var(--primary);
  border-radius: 14px;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(192, 96, 96, 0.35);
  transition: opacity 0.2s;
}

/* ---------- 景点脉冲光点 ---------- */
.attraction {
  cursor: pointer;
}

.pulse {
  fill: none;
  stroke: var(--primary);
  stroke-width: 2;
  opacity: 0;
  transform-origin: center;
  animation: pulse-ring 2.2s ease-out infinite;
}

.pulse-b {
  animation-delay: 0.7s;
}

.core {
  fill: var(--primary);
  filter: drop-shadow(0 0 6px rgba(192, 96, 96, 0.9));
  animation: core-glow 2.2s ease-in-out infinite;
}

.hit {
  fill: transparent;
  cursor: pointer;
}

@keyframes pulse-ring {
  0% {
    transform: scale(0.3);
    opacity: 0.9;
  }
  100% {
    transform: scale(1.9);
    opacity: 0;
  }
}

@keyframes core-glow {
  0%,
  100% {
    fill: var(--primary);
  }
  50% {
    fill: #e07a7a;
  }
}

/* ---------- 景点信息卡片 ---------- */
.info-card {
  position: absolute;
  bottom: 1.4rem;
  left: 50%;
  transform: translateX(-50%);
  width: min(360px, 88%);
  display: flex;
  gap: 0.9rem;
  padding: 1rem 1.1rem;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(192, 96, 96, 0.25);
  border-radius: 18px;
  box-shadow: 0 12px 32px rgba(120, 60, 60, 0.25);
  backdrop-filter: blur(8px);
}

.card-emoji {
  font-size: 2.2rem;
  line-height: 1;
}

.card-body {
  flex: 1;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.card-top h3 {
  margin: 0;
  font-size: 1.05rem;
  color: var(--title);
}

.rating {
  font-size: 0.82rem;
  color: #e08a3c;
  white-space: nowrap;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 0.4rem;
}

.tag {
  font-size: 0.68rem;
  padding: 2px 8px;
  color: var(--primary);
  background: #f5e6e0;
  border-radius: 10px;
}

.card-desc {
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
  line-height: 1.55;
  color: #7a5a5a;
}

.card-close {
  align-self: flex-start;
  border: none;
  background: none;
  font-size: 1.3rem;
  line-height: 1;
  color: #b08a8a;
  cursor: pointer;
}

/* ---------- 过渡 ---------- */
.swap-enter-active,
.swap-leave-active {
  transition: opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}

.swap-enter-from {
  opacity: 0;
  transform: translateY(14px);
}

.swap-leave-to {
  opacity: 0;
  transform: translateY(-14px);
}

.card-enter-active,
.card-leave-active {
  transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.card-enter-from,
.card-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}

/* ---------- 响应式 ---------- */
@media (max-width: 768px) {
  .lvji {
    padding: 1.2rem 1rem;
  }
  .head .page-title {
    font-size: 1.5rem;
  }
  .map {
    max-height: 64vh;
  }
  .city-label {
    font-size: 7px;
  }
  .province-label {
    font-size: 8px;
  }
}

@media (max-width: 480px) {
  .map {
    max-height: 56vh;
  }
  .info-card {
    bottom: 0.6rem;
  }
}
</style>
