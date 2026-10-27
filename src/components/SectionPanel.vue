<script setup lang="ts">
import { computed, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { X, Plus, Pencil, Trash2, FolderOpen } from 'lucide-vue-next'
import { useCabinStore } from '@/stores/cabin'
import { domainOf } from '@/core/navCore'
import { ui, openAddSite, openEditSite } from '@/composables/ui'
import AppIcon from '@/components/AppIcon.vue'
import type { NavSite } from '@/types'

const store = useCabinStore()

/** favicon 加载失败集合（切首字母占位） */
const failedSet = new Set<string>()
function failed(site: NavSite) {
  return failedSet.has(site.id)
}
function markFailed(site: NavSite) {
  failedSet.add(site.id)
}

const open = computed(() => !!ui.sectionPanelTabId)
const tab = computed(() => store.visibleTabs.find((t) => t.id === ui.sectionPanelTabId))
const sites = computed(() =>
  ui.sectionPanelTabId ? store.sitesOfTab(ui.sectionPanelTabId) : [],
)

function close() {
  ui.sectionPanelTabId = ''
}

// ESC 关闭
watch(open, (v) => {
  if (!v) return
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close()
  }
  window.addEventListener('keydown', onKey)
  watch(
    () => ui.sectionPanelTabId,
    (id) => {
      if (!id) window.removeEventListener('keydown', onKey)
    },
  )
})

function openSite(site: NavSite) {
  void store.clickSite(site.id)
  window.open(site.url, '_blank', 'noopener')
}

async function confirmDelete(site: NavSite) {
  const sure = await ElMessageBox.confirm(`删除“${site.name}”？`, '删除网站', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  }).catch(() => false)
  if (sure) await store.removeSite(site.id)
}
</script>

<template>
  <!-- 遮罩 -->
  <Transition name="fade">
    <div v-if="open" class="panel-overlay" @click="close" />
  </Transition>

  <!-- 右侧面板（原版 section-panel 规格：400px 毛玻璃滑入） -->
  <Transition name="slide">
    <aside v-if="open && tab" class="section-panel">
      <header class="panel-header">
        <span class="panel-title">
          <AppIcon :name="tab.icon" :size="17" />
          {{ tab.name }}
          <span class="panel-count">{{ sites.length }}</span>
        </span>
        <button class="panel-close" title="关闭 (Esc)" @click="close"><X :size="17" /></button>
      </header>

      <div class="panel-content">
        <!-- 空态 -->
        <div v-if="sites.length === 0" class="panel-empty">
          <FolderOpen :size="40" :stroke-width="1.4" />
          <p>暂无网站</p>
        </div>

        <!-- 站点列表 -->
        <a
          v-for="site in sites"
          :key="site.id"
          class="panel-item"
          :href="site.url"
          target="_blank"
          rel="noopener"
          :title="site.description || site.url"
          @click.prevent="openSite(site)"
        >
          <span class="panel-item-icon">
            <img
              v-if="site.favicon && !failed(site)"
              :src="site.favicon"
              alt=""
              loading="lazy"
              @error="markFailed(site)"
            />
            <span v-else class="fallback">{{ site.name.slice(0, 1).toUpperCase() }}</span>
          </span>
          <span class="panel-item-info">
            <span class="panel-item-title">{{ site.name }}</span>
            <span class="panel-item-url">{{ domainOf(site.url) }}</span>
          </span>
          <span class="panel-item-actions" @click.prevent.stop>
            <button title="编辑" @click="openEditSite(site)"><Pencil :size="12" /></button>
            <button title="删除" @click="confirmDelete(site)"><Trash2 :size="12" /></button>
          </span>
        </a>
      </div>

      <!-- 底部添加 -->
      <footer class="panel-footer">
        <button class="panel-add" @click="openAddSite(tab.id); close()">
          <Plus :size="14" /> 添加网站到「{{ tab.name }}」
        </button>
      </footer>
    </aside>
  </Transition>
</template>

<style scoped>
/* 遮罩 */
.panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 998;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 面板 */
.section-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  max-width: 90vw;
  height: 100vh;
  background: color-mix(in srgb, var(--c-bg-soft) 94%, transparent);
  backdrop-filter: blur(20px);
  border-left: 1px solid var(--c-border);
  z-index: 999;
  display: flex;
  flex-direction: column;
}
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

/* 头部 */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 20px;
  border-bottom: 1px solid var(--c-border);
  background: color-mix(in srgb, var(--c-text) 5%, transparent);
}
.panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 700;
  color: var(--c-text);
}
.panel-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--c-primary);
  background: var(--c-primary-soft);
  border-radius: 999px;
  padding: 1px 8px;
}
.panel-close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--c-text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}
.panel-close:hover {
  background: color-mix(in srgb, var(--c-text) 10%, transparent);
  color: var(--c-text);
}

/* 内容 */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px;
}
.panel-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 12px;
  border-radius: 9px;
  text-decoration: none;
  position: relative;
  transition: background 0.15s;
}
.panel-item:hover {
  background: color-mix(in srgb, var(--c-text) 8%, transparent);
}
.panel-item-icon {
  width: 38px;
  height: 38px;
  border-radius: 9px;
  overflow: hidden;
  flex-shrink: 0;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.panel-item-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 3px;
  box-sizing: border-box;
}
.panel-item-icon .fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-primary-soft);
  color: var(--c-primary);
  font-weight: 800;
  font-size: 17px;
}
.panel-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.panel-item-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--c-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.15s;
}
.panel-item:hover .panel-item-title {
  color: var(--c-primary);
}
.panel-item-url {
  font-size: 12px;
  color: var(--c-text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 悬停操作 */
.panel-item-actions {
  display: flex;
  gap: 3px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
}
.panel-item:hover .panel-item-actions {
  opacity: 1;
  pointer-events: auto;
}
.panel-item-actions button {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: color-mix(in srgb, var(--c-bg) 75%, transparent);
  color: var(--c-text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}
.panel-item-actions button:hover {
  background: var(--c-primary);
  color: #fff;
}

/* 空态 */
.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 60px 0;
  color: var(--c-text-dim);
  font-size: 14px;
}

/* 底部 */
.panel-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--c-border);
}
.panel-add {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border: 1px dashed color-mix(in srgb, var(--c-text-dim) 45%, transparent);
  border-radius: 9px;
  background: transparent;
  color: var(--c-text-dim);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.panel-add:hover {
  border-color: var(--c-primary);
  color: var(--c-primary);
  background: var(--c-primary-soft);
}
</style>
