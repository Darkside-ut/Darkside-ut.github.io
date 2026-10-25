<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ArrowLeft, Delete, Download, Edit, Food, Plus, Search } from '@element-plus/icons-vue'
import SelectMenu from '../components/SelectMenu.vue'
import PageBack from '../components/PageBack.vue'
import {
  addDish,
  addShop,
  dishCount,
  formatDay,
  importLocalData,
  initFood,
  loading,
  localShopCount,
  removeDish,
  removeShop,
  shopRating,
  shops,
  totals,
  updateDish,
  updateShop,
} from '../composables/useFood.js'
import { isOwner, remoteEnabled } from '../composables/useAuth.js'

/* ---------------- 权限 / 登录 ---------------- */
// 本地模式始终可编辑；云端模式只有管理员邮箱可编辑（访客登录后只读）
const canEdit = computed(() => !remoteEnabled || isOwner.value)

/* ---------------- 旧本地数据导入 ---------------- */
const localCount = ref(localShopCount())
const importing = ref(false)

async function doImportLocal() {
  importing.value = true
  try {
    const n = await importLocalData()
    localCount.value = 0
    ElMessage.success(`已导入 ${n} 家店铺到云端`)
  } catch (e) {
    ElMessage.error('导入失败：' + (e?.message || e))
  } finally {
    importing.value = false
  }
}

/* ---------------- 列表 / 筛选 ---------------- */
const keyword = ref('')
const sortBy = ref('rating')

const SORT_OPTIONS = [
  { value: 'rating', label: '按星级' },
  { value: 'recent', label: '按最近记录' },
  { value: 'name', label: '按名称' },
]

const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  const list = shops.value.filter((s) => {
    if (!k) return true
    if ((s.name || '').toLowerCase().includes(k)) return true
    if ((s.category || '').toLowerCase().includes(k)) return true
    if ((s.location || '').toLowerCase().includes(k)) return true
    return (s.dishes || []).some((d) => (d.name || '').toLowerCase().includes(k))
  })

  return [...list].sort((a, b) => {
    if (sortBy.value === 'name') return a.name.localeCompare(b.name, 'zh-CN')
    if (sortBy.value === 'recent') {
      const at = Math.max(a.createdAt || 0, ...(a.dishes || []).map((d) => d.createdAt || 0))
      const bt = Math.max(b.createdAt || 0, ...(b.dishes || []).map((d) => d.createdAt || 0))
      return bt - at
    }
    return shopRating(b) - shopRating(a) || (b.createdAt || 0) - (a.createdAt || 0)
  })
})

const avgText = computed(() => (totals.value.average ? totals.value.average.toFixed(1) : '—'))

function rateText(shop) {
  const r = shopRating(shop)
  return r ? r.toFixed(1) : '—'
}

/* ---------------- 选中店铺 ---------------- */
const selectedId = ref('')
const selected = computed(() => shops.value.find((s) => s.id === selectedId.value) || null)

const sortedDishes = computed(() => {
  if (!selected.value) return []
  return [...(selected.value.dishes || [])].sort(
    (a, b) => (b.rating || 0) - (a.rating || 0) || (b.createdAt || 0) - (a.createdAt || 0)
  )
})

function selectShop(id) {
  selectedId.value = id
}

/* ---------------- 店铺表单 ---------------- */
const shopDialog = ref(false)
const shopForm = reactive({ id: '', name: '', category: '', location: '', note: '' })

function openShopDialog(shop) {
  Object.assign(shopForm, {
    id: shop?.id || '',
    name: shop?.name || '',
    category: shop?.category || '',
    location: shop?.location || '',
    note: shop?.note || '',
  })
  shopDialog.value = true
}

async function saveShop() {
  const name = shopForm.name.trim()
  if (!name) {
    ElMessage.warning('请填写店铺名称')
    return
  }
  const payload = {
    name,
    category: shopForm.category.trim(),
    location: shopForm.location.trim(),
    note: shopForm.note.trim(),
  }
  try {
    if (shopForm.id) {
      await updateShop(shopForm.id, payload)
    } else {
      await addShop(payload)
    }
    shopDialog.value = false
  } catch (e) {
    ElMessage.error('保存失败：' + (e?.message || e))
  }
}

async function onDeleteShop(shop) {
  if (!window.confirm(`删除店铺「${shop.name}」及其全部菜品评价？`)) return
  try {
    await removeShop(shop.id)
    selectedId.value = ''
  } catch (e) {
    ElMessage.error('删除失败：' + (e?.message || e))
  }
}

/* ---------------- 菜品表单 ---------------- */
const dishDialog = ref(false)
const dishForm = reactive({ id: '', name: '', rating: 5, price: '', note: '' })

function openDishDialog(dish) {
  Object.assign(dishForm, {
    id: dish?.id || '',
    name: dish?.name || '',
    rating: Number(dish?.rating) || 5,
    price: dish?.price ?? '',
    note: dish?.note || '',
  })
  dishDialog.value = true
}

async function saveDish() {
  if (!selected.value) return
  const name = dishForm.name.trim()
  if (!name) {
    ElMessage.warning('请填写菜名')
    return
  }
  const payload = {
    name,
    rating: Number(dishForm.rating) || 0,
    price: String(dishForm.price ?? '').trim(),
    note: dishForm.note.trim(),
  }
  try {
    if (dishForm.id) {
      await updateDish(selected.value.id, dishForm.id, payload)
    } else {
      await addDish(selected.value.id, payload)
    }
    dishDialog.value = false
  } catch (e) {
    ElMessage.error('保存失败：' + (e?.message || e))
  }
}

async function onDeleteDish(dish) {
  if (!selected.value) return
  if (!window.confirm(`删除菜品「${dish.name}」？`)) return
  try {
    await removeDish(selected.value.id, dish.id)
  } catch (e) {
    ElMessage.error('删除失败：' + (e?.message || e))
  }
}

/* ---------------- 导出 ---------------- */
const exportOpen = ref(false)
const exportRoot = ref(null)

function onDocPointerDown(e) {
  if (exportRoot.value && !exportRoot.value.contains(e.target)) exportOpen.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
  initFood().catch((e) => ElMessage.error('加载数据失败：' + (e?.message || e)))
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointerDown))

function dateStamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

function download(filename, content, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// JSON：完整数据备份，包含店铺与全部菜品
function exportJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    shops: shops.value,
  }
  download(`美食评价-${dateStamp()}.json`, JSON.stringify(payload, null, 2), 'application/json')
  exportOpen.value = false
  ElMessage.success('已导出 JSON 备份')
}

function csvCell(value) {
  const s = String(value ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// CSV：一行一道菜，可直接用 Excel / WPS 打开
function exportCsv() {
  const rows = [['店铺', '类型', '位置', '店铺评价', '菜品', '价格', '星级', '菜品评价', '记录日期']]
  for (const s of shops.value) {
    const dishes = s.dishes || []
    if (!dishes.length) {
      rows.push([s.name, s.category, s.location, s.note, '', '', '', '', ''])
      continue
    }
    for (const d of dishes) {
      rows.push([
        s.name,
        s.category,
        s.location,
        s.note,
        d.name,
        d.price,
        d.rating,
        d.note,
        formatDay(d.createdAt),
      ])
    }
  }
  // BOM 让 Excel 正确识别 UTF-8 中文
  const csv = '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
  download(`美食评价-${dateStamp()}.csv`, csv, 'text/csv;charset=utf-8')
  exportOpen.value = false
  ElMessage.success('已导出 CSV 表格')
}

/* ---------------- 星级显示 ---------------- */
// el-rate 的 display-only 模式对小数显示不稳定，统一吸附到最近的 0.5 星
function starValue(rating) {
  return Math.round((Number(rating) || 0) * 2) / 2
}

function starsText(rating) {
  const r = Number(rating) || 0
  if (r <= 0) return '未评分'
  if (r < 2) return '不推荐'
  if (r < 3.5) return '一般'
  if (r < 4.5) return '还不错'
  if (r < 5) return '推荐'
  return '强烈推荐'
}
</script>

<template>
  <div class="page">
    <PageBack />

    <div class="page-card food-page">
      <!-- ===================== 店铺列表 ===================== -->
      <template v-if="!selected">
        <div class="food-head">
          <div>
            <h2 class="page-title">美食评价</h2>
            <div class="section-sub">记录店铺与菜品，给每一道菜打分</div>
          </div>
          <div class="head-actions">
            <div class="export-wrap" ref="exportRoot">
              <button
                class="ghost-btn"
                :disabled="!shops.length"
                @click="exportOpen = !exportOpen"
              >
                <el-icon><Download /></el-icon>
                <span>导出</span>
                <span class="caret">▾</span>
              </button>
              <transition name="export-fade">
                <div v-if="exportOpen" class="export-menu">
                  <button type="button" @click="exportJson">
                    <b>JSON 备份</b>
                    <span>完整数据，含全部店铺与菜品</span>
                  </button>
                  <button type="button" @click="exportCsv">
                    <b>CSV 表格</b>
                    <span>一行一道菜，可用 Excel 打开</span>
                  </button>
                </div>
              </transition>
            </div>

            <button v-if="canEdit" class="primary-btn" @click="openShopDialog()">
              <el-icon><Plus /></el-icon>
              <span>添加店铺</span>
            </button>
          </div>
        </div>

        <div v-if="canEdit && localCount > 0" class="import-hint">
          <span>检测到本机有 {{ localCount }} 家旧店铺数据（切换云端前保存的）</span>
          <button class="ghost-btn small" :disabled="importing" @click="doImportLocal">
            {{ importing ? '导入中…' : '导入到云端' }}
          </button>
        </div>

        <div class="food-stats">
          <span><b>{{ totals.shops }}</b> 家店铺</span>
          <span class="dot">·</span>
          <span><b>{{ totals.dishes }}</b> 道菜品</span>
          <span class="dot">·</span>
          <span>平均 <b>{{ avgText }}</b> 星</span>
        </div>

        <div class="food-tools">
          <el-input v-model="keyword" placeholder="搜索店铺、类型或菜品…" clearable class="search-box">
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <SelectMenu v-model="sortBy" :options="SORT_OPTIONS" class="sort-menu" />
        </div>

        <div v-if="loading" class="empty-wrap">
          <div class="loading-tip">加载中…</div>
        </div>

        <div v-else-if="!filtered.length" class="empty-wrap">
          <el-empty :description="keyword ? '没有匹配的店铺' : canEdit ? '还没有店铺，先添加一家吧' : '还没有店铺'" />
        </div>

        <div v-else class="shop-grid">
          <button
            v-for="s in filtered"
            :key="s.id"
            type="button"
            class="shop-card"
            @click="selectShop(s.id)"
          >
            <div class="shop-top">
              <h3>{{ s.name }}</h3>
              <span v-if="s.category" class="shop-tag">{{ s.category }}</span>
            </div>

            <div class="shop-rate">
              <el-rate :model-value="starValue(shopRating(s))" disabled allow-half />
              <span class="rate-num">{{ rateText(s) }}</span>
              <span class="rate-desc">{{ starsText(shopRating(s)) }}</span>
            </div>

            <p class="shop-note">
              {{ s.note || s.location || '暂无备注' }}
            </p>

            <div class="shop-foot">
              <span>{{ dishCount(s) }} 道菜</span>
              <span class="enter">查看 ›</span>
            </div>
          </button>
        </div>
      </template>

      <!-- ===================== 店铺详情 ===================== -->
      <template v-else>
        <div class="detail-toolbar">
          <button class="back-btn" @click="selectedId = ''">
            <el-icon><ArrowLeft /></el-icon>
            <span>全部店铺</span>
          </button>
          <div v-if="canEdit" class="detail-actions">
            <button class="ghost-btn" @click="openShopDialog(selected)">
              <el-icon><Edit /></el-icon>
              <span>编辑店铺</span>
            </button>
            <button class="ghost-btn danger" @click="onDeleteShop(selected)">
              <el-icon><Delete /></el-icon>
              <span>删除</span>
            </button>
          </div>
        </div>

        <div class="shop-hero">
          <div class="hero-icon">
            <el-icon><Food /></el-icon>
          </div>
          <div class="hero-main">
            <h2 class="shop-title">{{ selected.name }}</h2>
            <div class="hero-meta">
              <el-rate :model-value="starValue(shopRating(selected))" disabled allow-half />
              <span class="rate-num">{{ rateText(selected) }}</span>
              <span class="rate-desc">{{ starsText(shopRating(selected)) }}</span>
              <span v-if="selected.category" class="shop-tag">{{ selected.category }}</span>
              <span v-if="selected.location" class="hero-loc">📍 {{ selected.location }}</span>
            </div>
            <p v-if="selected.note" class="hero-note">{{ selected.note }}</p>
          </div>
        </div>

        <div class="dish-head">
          <div class="dish-head-title">
            菜品评价
            <span class="dish-count">{{ dishCount(selected) }} 道</span>
          </div>
          <button v-if="canEdit" class="primary-btn small" @click="openDishDialog()">
            <el-icon><Plus /></el-icon>
            <span>添加菜品</span>
          </button>
        </div>

        <el-empty
          v-if="!selected.dishes || !selected.dishes.length"
          description="还没有菜品，记录第一道吧"
        />

        <div v-else class="dish-list">
          <div v-for="d in sortedDishes" :key="d.id" class="dish-row">
            <div class="dish-main">
              <div class="dish-title-line">
                <span class="dish-name">{{ d.name }}</span>
                <span v-if="d.price" class="dish-price">¥{{ d.price }}</span>
              </div>
              <div class="dish-rate">
                <el-rate :model-value="starValue(d.rating)" disabled allow-half size="small" />
                <span class="dish-rate-text">{{ starsText(Number(d.rating) || 0) }}</span>
              </div>
              <p v-if="d.note" class="dish-note">{{ d.note }}</p>
              <div v-if="d.createdAt" class="dish-date">{{ formatDay(d.createdAt) }}</div>
            </div>
            <div v-if="canEdit" class="dish-actions">
              <button class="icon-btn" @click="openDishDialog(d)">编辑</button>
              <button class="icon-btn danger" @click="onDeleteDish(d)">删除</button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- ===================== 店铺弹窗 ===================== -->
    <el-dialog
      v-model="shopDialog"
      :title="shopForm.id ? '编辑店铺' : '添加店铺'"
      width="420px"
      align-center
    >
      <div class="form-grid">
        <label class="field">
          <span>店铺名称 <i>*</i></span>
          <el-input v-model="shopForm.name" maxlength="40" placeholder="例如：老乡鸡（科大店）" />
        </label>
        <div class="field-row">
          <label class="field">
            <span>类型</span>
            <el-input v-model="shopForm.category" maxlength="12" placeholder="中餐 / 火锅 / 咖啡…" />
          </label>
          <label class="field">
            <span>位置</span>
            <el-input v-model="shopForm.location" maxlength="30" placeholder="例如：之心城 4F" />
          </label>
        </div>
        <label class="field">
          <span>整体评价</span>
          <el-input
            v-model="shopForm.note"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="整体印象、推荐理由…"
          />
        </label>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <button class="ghost-btn" @click="shopDialog = false">取消</button>
          <button class="primary-btn" @click="saveShop">保存</button>
        </div>
      </template>
    </el-dialog>

    <!-- ===================== 菜品弹窗 ===================== -->
    <el-dialog
      v-model="dishDialog"
      :title="dishForm.id ? '编辑菜品' : '添加菜品'"
      width="420px"
      align-center
    >
      <div class="form-grid">
        <div class="field-row">
          <label class="field">
            <span>菜名 <i>*</i></span>
            <el-input v-model="dishForm.name" maxlength="30" placeholder="例如：招牌红烧肉" />
          </label>
          <label class="field price-field">
            <span>价格</span>
            <el-input v-model="dishForm.price" maxlength="10" placeholder="选填" />
          </label>
        </div>
        <label class="field">
          <span>星级</span>
          <div class="rate-input">
            <el-rate v-model="dishForm.rating" allow-half show-score score-template="{value} 星" />
          </div>
        </label>
        <label class="field">
          <span>评价</span>
          <el-input
            v-model="dishForm.note"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="口味、分量、性价比…"
          />
        </label>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <button class="ghost-btn" @click="dishDialog = false">取消</button>
          <button class="primary-btn" @click="saveDish">保存</button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.food-page {
  max-width: 880px;
}

/* ===== 顶部 ===== */
.food-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.import-hint {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin: -0.4rem 0 1rem;
  padding: 0.55rem 0.9rem;
  font-size: 0.7rem;
  color: #8a5a2b;
  background: rgba(217, 119, 6, 0.08);
  border: 1px dashed rgba(217, 119, 6, 0.35);
  border-radius: 10px;
}

.import-hint .ghost-btn.small {
  padding: 0.28rem 0.7rem;
  font-size: 0.68rem;
}

.loading-tip {
  padding: 2.5rem 0;
  text-align: center;
  font-size: 0.78rem;
  color: var(--text-dim);
}

/* 导出下拉 */
.export-wrap {
  position: relative;
}

.export-wrap .caret {
  font-size: 0.62rem;
  opacity: 0.7;
}

.export-wrap .ghost-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.export-menu {
  position: absolute;
  z-index: 40;
  top: calc(100% + 6px);
  right: 0;
  width: 220px;
  padding: 5px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(37, 99, 235, 0.16);
  border-radius: 12px;
  box-shadow: 0 14px 32px -12px rgba(30, 60, 110, 0.35);
  backdrop-filter: blur(10px);
}

.export-menu button {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0.5rem 0.65rem;
  font-family: inherit;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 8px;
  transition: background 0.15s;
}

.export-menu button:hover {
  background: rgba(192, 86, 33, 0.08);
}

.export-menu b {
  font-size: 0.76rem;
  color: var(--text-dark);
}

.export-menu span {
  font-size: 0.66rem;
  color: var(--text-dim);
}

.export-fade-enter-active,
.export-fade-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.export-fade-enter-from,
.export-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.food-stats {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  margin: 0.2rem 0 1.1rem;
  font-size: 0.74rem;
  color: var(--text-dim);
}

.food-stats b {
  color: var(--accent);
  font-size: 0.82rem;
}

.food-stats .dot {
  color: #b9c5d8;
}

.food-tools {
  display: flex;
  gap: 0.6rem;
  margin-bottom: 1.2rem;
}

.search-box {
  max-width: 300px;
}

.sort-menu {
  width: 128px;
  flex-shrink: 0;
}

.empty-wrap {
  padding: 1.5rem 0;
}

/* ===== 店铺卡片 ===== */
.shop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.9rem;
}

.shop-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem 1.1rem;
  font-family: inherit;
  text-align: left;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(37, 99, 235, 0.12);
  border-radius: 18px;
  backdrop-filter: blur(8px);
  transition: 0.22s;
}

.shop-card:hover {
  transform: translateY(-3px);
  border-color: rgba(192, 86, 33, 0.45);
  background: rgba(253, 246, 240, 0.9);
  box-shadow: 0 12px 26px -14px rgba(150, 70, 20, 0.35);
}

.shop-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.shop-top h3 {
  min-width: 0;
  font-size: 0.95rem;
  color: var(--text-dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shop-tag {
  flex-shrink: 0;
  padding: 0.1rem 0.5rem;
  font-size: 0.64rem;
  color: #a85a2b;
  background: rgba(192, 86, 33, 0.1);
  border: 1px solid rgba(192, 86, 33, 0.2);
  border-radius: 20px;
}

.shop-rate {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.rate-num {
  font-size: 0.72rem;
  font-weight: 700;
  color: #d97706;
  font-variant-numeric: tabular-nums;
}

.rate-desc {
  font-size: 0.66rem;
  color: var(--text-dim);
}

.shop-note {
  min-height: 2.4em;
  font-size: 0.72rem;
  line-height: 1.6;
  color: var(--text-dim);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.shop-foot {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.55rem;
  border-top: 1px dashed rgba(37, 99, 235, 0.12);
  font-size: 0.66rem;
  color: #8d9bb5;
}

.shop-foot .enter {
  margin-left: auto;
  flex-shrink: 0;
  color: #c05621;
}

/* ===== 详情 ===== */
.detail-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.2rem;
}

.detail-actions {
  display: flex;
  gap: 0.5rem;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0.4rem 0.9rem 0.4rem 0.75rem;
  font-family: inherit;
  font-size: 0.78rem;
  color: var(--text-dim);
  background: rgba(245, 249, 255, 0.7);
  border: 1px solid rgba(37, 99, 235, 0.16);
  border-radius: 60px;
  transition: 0.22s;
}

.back-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(37, 99, 235, 0.1);
  transform: translateX(-3px);
}

.shop-hero {
  display: flex;
  gap: 1rem;
  padding: 1.1rem 1.2rem;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.9), rgba(255, 236, 217, 0.55));
  border: 1px solid rgba(192, 86, 33, 0.16);
}

.hero-icon {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
  color: #fff;
  background: linear-gradient(135deg, #e08a4b, #c05621);
  border-radius: 16px;
  box-shadow: 0 8px 20px -8px rgba(192, 86, 33, 0.6);
}

.hero-main {
  flex: 1;
  min-width: 0;
}

.shop-title {
  font-size: 1.25rem;
  color: var(--text-dark);
  margin-bottom: 0.35rem;
}

.hero-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  font-size: 0.7rem;
}

.hero-loc {
  color: var(--text-dim);
  font-size: 0.7rem;
}

.hero-note {
  margin-top: 0.55rem;
  font-size: 0.74rem;
  line-height: 1.6;
  color: var(--text-dim);
  white-space: pre-wrap;
}

/* ===== 菜品列表 ===== */
.dish-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 1.4rem 0 0.8rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid rgba(37, 99, 235, 0.12);
}

.dish-head-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-dark);
}

.dish-count {
  margin-left: 0.4rem;
  font-size: 0.66rem;
  font-weight: 400;
  color: var(--text-dim);
}

.dish-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.dish-row {
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  padding: 0.85rem 1rem;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(37, 99, 235, 0.1);
  border-radius: 14px;
  transition: 0.2s;
}

.dish-row:hover {
  background: rgba(253, 246, 240, 0.85);
  border-color: rgba(192, 86, 33, 0.28);
}

.dish-main {
  flex: 1;
  min-width: 0;
}

.dish-title-line {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.dish-name {
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--text-dark);
}

.dish-price {
  font-size: 0.7rem;
  color: #c05621;
  font-variant-numeric: tabular-nums;
}

.dish-rate {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.18rem;
}

.dish-rate-text {
  font-size: 0.66rem;
  color: #d97706;
}

.dish-note {
  margin-top: 0.4rem;
  font-size: 0.74rem;
  line-height: 1.65;
  color: var(--text-dim);
  white-space: pre-wrap;
}

.dish-date {
  margin-top: 0.4rem;
  font-size: 0.62rem;
  font-family: monospace;
  color: #a4b0c4;
}

.dish-actions {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex-shrink: 0;
}

.icon-btn {
  padding: 0.22rem 0.6rem;
  font-family: inherit;
  font-size: 0.68rem;
  color: var(--accent);
  background: rgba(37, 99, 235, 0.07);
  border: 1px solid rgba(37, 99, 235, 0.18);
  border-radius: 8px;
  transition: 0.18s;
}

.icon-btn:hover {
  background: var(--accent);
  color: #fff;
}

.icon-btn.danger {
  color: #c2410c;
  background: rgba(194, 65, 12, 0.06);
  border-color: rgba(194, 65, 12, 0.2);
}

.icon-btn.danger:hover {
  background: #c2410c;
  color: #fff;
}

/* ===== 表单 ===== */
.form-grid {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.field > span {
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--text-dark);
}

.field > span i {
  color: #e15b5b;
  font-style: normal;
}

.field-row {
  display: flex;
  gap: 0.8rem;
}

.field-row .field {
  flex: 1;
}

.price-field {
  max-width: 110px;
}

.rate-input {
  display: flex;
  align-items: center;
  min-height: 32px;
}

/* ===== 弹窗底部按钮 ===== */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.7rem;
}

/* ===== 按钮 ===== */
.primary-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0.48rem 1.1rem;
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #d97a3f, #c05621);
  border: none;
  border-radius: 10px;
  transition: 0.2s;
}

.primary-btn:hover {
  box-shadow: 0 8px 18px -8px rgba(192, 86, 33, 0.7);
  transform: translateY(-1px);
}

.primary-btn.small {
  padding: 0.36rem 0.85rem;
  font-size: 0.72rem;
}

.ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0.4rem 0.9rem;
  font-family: inherit;
  font-size: 0.74rem;
  color: var(--accent);
  background: rgba(37, 99, 235, 0.07);
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 10px;
  transition: 0.18s;
}

.ghost-btn:hover {
  background: var(--accent);
  color: #fff;
}

.ghost-btn.danger {
  color: #c2410c;
  background: rgba(194, 65, 12, 0.06);
  border-color: rgba(194, 65, 12, 0.22);
}

.ghost-btn.danger:hover {
  background: #c2410c;
  color: #fff;
}

/* ===== 响应式 ===== */
@media (max-width: 640px) {
  .food-head {
    flex-direction: column;
  }
  .food-tools {
    flex-wrap: wrap;
  }
  .search-box {
    max-width: none;
    flex: 1;
  }
  .shop-grid {
    grid-template-columns: 1fr;
  }
  .dish-row {
    flex-direction: column;
  }
  .dish-actions {
    flex-direction: row;
  }
  .field-row {
    flex-direction: column;
  }
  .price-field {
    max-width: none;
  }
}
</style>
