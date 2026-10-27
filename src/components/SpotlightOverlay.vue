<script setup lang="ts">
/**
 * Spotlight 全局搜索浮层（Alt+K 唤起）
 * 快捷键逻辑参考 easy-web-tab spotlightCore/useWorkbenchShortcuts，按 Cabin 单数据源裁剪
 */
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { Search, CornerDownLeft } from 'lucide-vue-next'
import { useCabinStore } from '@/stores/cabin'
import { ui } from '@/composables/ui'
import { domainOf } from '@/core/navCore'
import type { NavSite } from '@/types'

const store = useCabinStore()
const query = ref('')
const activeIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

/** 焦点在输入控件时跳过快捷键 */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable
  )
}

function onKeydown(e: KeyboardEvent) {
  // Alt+K 唤起
  if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && e.key.toLowerCase() === 'k') {
    if (isTypingTarget(e.target)) return
    e.preventDefault()
    ui.spotlightOpen = !ui.spotlightOpen
    return
  }
  if (e.key === 'Escape' && ui.spotlightOpen) {
    ui.spotlightOpen = false
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

watch(
  () => ui.spotlightOpen,
  (open) => {
    if (open) {
      query.value = ''
      activeIndex.value = 0
      void nextTick(() => inputRef.value?.focus())
    }
  },
)

/** 结果：名称/URL/描述 匹配，取前 8 条 */
const results = computed(() => {
  const kw = query.value.trim().toLowerCase()
  if (!kw) return []
  return store.sites
    .filter(
      (s) =>
        !s.isDeleted &&
        (s.name.toLowerCase().includes(kw) ||
          s.url.toLowerCase().includes(kw) ||
          s.description.toLowerCase().includes(kw)),
    )
    .slice(0, 8)
})

const tabName = (site: NavSite) =>
  store.visibleTabs.find((t) => t.id === site.tabId)?.name ?? ''

function openSite(site: NavSite) {
  void store.clickSite(site.id)
  window.open(site.url, '_blank', 'noopener')
  ui.spotlightOpen = false
}

function onInputKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, results.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const site = results.value[activeIndex.value]
    if (site) openSite(site)
  }
}

/** 结果变化时重置选中 */
watch(results, () => {
  activeIndex.value = 0
})
</script>

<template>
  <Transition name="fade">
    <div v-if="ui.spotlightOpen" class="spotlight-mask" @click="ui.spotlightOpen = false">
      <div class="spotlight-panel" @click.stop>
        <div class="spotlight-input-row">
          <Search :size="18" class="spotlight-icon" />
          <input
            ref="inputRef"
            v-model="query"
            class="spotlight-input"
            type="text"
            placeholder="搜索网站、网址、描述…（Alt+K 随时唤起）"
            @keydown="onInputKeydown"
          />
          <span class="spotlight-hint">Esc 关闭</span>
        </div>

        <div v-if="results.length" class="spotlight-results">
          <a
            v-for="(site, i) in results"
            :key="site.id"
            class="spotlight-item"
            :class="{ active: i === activeIndex }"
            :href="site.url"
            target="_blank"
            rel="noopener"
            @click.prevent="openSite(site)"
            @mouseenter="activeIndex = i"
          >
            <span class="sp-icon">
              <img v-if="site.favicon" :src="site.favicon" alt="" loading="lazy" @error="($event.target as HTMLImageElement).style.display = 'none'" />
              <span v-else class="sp-fallback">{{ site.name.slice(0, 1).toUpperCase() }}</span>
            </span>
            <span class="sp-main">
              <span class="sp-name">{{ site.name }}</span>
              <span class="sp-url">{{ domainOf(site.url) }}</span>
            </span>
            <span class="sp-tab">{{ tabName(site) }}</span>
            <CornerDownLeft v-if="i === activeIndex" class="sp-enter" :size="14" />
          </a>
        </div>
        <div v-else-if="query.trim()" class="spotlight-empty">没有匹配的网站</div>
        <div v-else class="spotlight-empty">输入关键字开始搜索，↑↓ 选择，Enter 打开</div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.spotlight-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 14vh;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.spotlight-panel {
  width: 620px;
  max-width: 92vw;
  background: var(--c-bg-soft);
  border: 1px solid var(--c-border);
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}
.spotlight-input-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--c-border);
}
.spotlight-icon {
  color: var(--c-text-dim);
  flex-shrink: 0;
}
.spotlight-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--c-text);
  font-size: 16px;
}
.spotlight-input::placeholder {
  color: var(--c-text-dim);
}
.spotlight-hint {
  font-size: 11px;
  color: var(--c-text-dim);
  border: 1px solid var(--c-border);
  border-radius: 5px;
  padding: 2px 7px;
  flex-shrink: 0;
}
.spotlight-results {
  max-height: 380px;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.spotlight-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  text-decoration: none;
  transition: background 0.12s;
}
.spotlight-item.active {
  background: var(--c-primary-soft);
}
.sp-icon {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  overflow: hidden;
  background: #fff;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sp-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 3px;
  box-sizing: border-box;
}
.sp-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-primary-soft);
  color: var(--c-primary);
  font-weight: 700;
  font-size: 14px;
}
.sp-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sp-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--c-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sp-url {
  font-size: 12px;
  color: var(--c-text-dim);
}
.sp-tab {
  font-size: 11px;
  color: var(--c-text-dim);
  background: color-mix(in srgb, var(--c-text) 10%, transparent);
  border-radius: 4px;
  padding: 2px 8px;
  flex-shrink: 0;
}
.sp-enter {
  color: var(--c-primary);
  flex-shrink: 0;
}
.spotlight-empty {
  padding: 28px 20px;
  text-align: center;
  color: var(--c-text-dim);
  font-size: 13px;
}
</style>
