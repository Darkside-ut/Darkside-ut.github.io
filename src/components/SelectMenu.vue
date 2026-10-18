<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] }, // [{ value, label }]
  placeholder: { type: String, default: '请选择' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'change'])

const open = ref(false)
const root = ref(null)

const current = computed(
  () => props.options.find((o) => o.value === props.modelValue) || null
)

function toggle() {
  if (props.disabled) return
  open.value = !open.value
}

function choose(opt) {
  emit('update:modelValue', opt.value)
  emit('change', opt.value)
  open.value = false
}

function onClickOutside(e) {
  if (root.value && !root.value.contains(e.target)) open.value = false
}

function onKey(e) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onClickOutside)
  document.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onClickOutside)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="select-menu" :class="{ open, disabled }" ref="root">
    <button
      type="button"
      class="sm-btn"
      :disabled="disabled"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="sm-text">{{ current ? current.label : placeholder }}</span>
      <span class="sm-arrow" aria-hidden="true">
        <svg viewBox="0 0 12 12" width="11" height="11">
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    </button>

    <transition name="sm-pop">
      <div v-if="open" class="sm-pop" role="listbox">
        <button
          v-for="opt in options"
          :key="opt.value"
          type="button"
          class="sm-opt"
          :class="{ active: opt.value === modelValue }"
          role="option"
          :aria-selected="opt.value === modelValue"
          @click="choose(opt)"
        >
          <span class="sm-label">{{ opt.label }}</span>
          <span v-if="opt.value === modelValue" class="sm-check">✓</span>
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.select-menu {
  position: relative;
  min-width: 0;
}

.sm-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.45rem 0.7rem;
  font-family: inherit;
  font-size: 0.78rem;
  color: var(--text-dark);
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(37, 99, 235, 0.18);
  border-radius: 10px;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}

.sm-btn:hover:not(:disabled) {
  border-color: rgba(37, 99, 235, 0.45);
  background: #fff;
}

.select-menu.open .sm-btn {
  border-color: var(--accent);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.sm-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sm-arrow {
  flex-shrink: 0;
  display: flex;
  color: var(--accent);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.select-menu.open .sm-arrow {
  transform: rotate(180deg);
}

.select-menu.disabled {
  opacity: 0.5;
}

/* ===== 下拉面板 ===== */
.sm-pop {
  position: absolute;
  z-index: 40;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  min-width: 100%;
  padding: 4px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.97);
  border: 1px solid rgba(37, 99, 235, 0.16);
  box-shadow: 0 14px 32px -12px rgba(30, 60, 110, 0.35);
  backdrop-filter: blur(10px);
  max-height: 240px;
  overflow-y: auto;
  transform-origin: top center;
}

.sm-opt {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.42rem 0.6rem;
  font-family: inherit;
  font-size: 0.76rem;
  color: var(--text-dark);
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 8px;
  transition: background 0.15s, color 0.15s;
}

.sm-opt:hover {
  background: rgba(37, 99, 235, 0.08);
}

.sm-opt.active {
  color: var(--accent);
  font-weight: 700;
  background: rgba(37, 99, 235, 0.1);
}

.sm-check {
  flex-shrink: 0;
  font-size: 0.68rem;
  color: var(--accent);
}

/* 过渡 */
.sm-pop-enter-active,
.sm-pop-leave-active {
  transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.sm-pop-enter-from,
.sm-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
