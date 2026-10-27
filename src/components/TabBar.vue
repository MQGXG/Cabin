<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCabinStore } from '@/stores/cabin'
import { openEditTab } from '@/composables/ui'
import type { NavTab } from '@/types'

const store = useCabinStore()

/* ---------- 右键菜单 ---------- */
const menu = ref<{ visible: boolean; x: number; y: number; tab: NavTab | null }>({
  visible: false,
  x: 0,
  y: 0,
  tab: null,
})

function onContext(e: MouseEvent, tab: NavTab) {
  e.preventDefault()
  menu.value = { visible: true, x: e.clientX, y: e.clientY, tab }
}

function closeMenu() {
  menu.value.visible = false
}
window.addEventListener('click', closeMenu)
window.addEventListener('scroll', closeMenu, true)

function menuEdit() {
  if (menu.value.tab) openEditTab(menu.value.tab)
  closeMenu()
}

async function menuSetDefault() {
  const tab = menu.value.tab
  closeMenu()
  if (!tab) return
  await store.updateTab(tab.id, { isDefault: true })
  ElMessage.success(`“${tab.name}”已设为默认标签`)
}

async function menuDelete() {
  const tab = menu.value.tab
  closeMenu()
  if (!tab) return
  const count = store.sitesOfTab(tab.id).length
  const sure = await ElMessageBox.confirm(
    `标签“${tab.name}”及其下 ${count} 个网站将一并删除（软删除，可通过备份恢复），确定？`,
    '删除标签',
    { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
  ).catch(() => false)
  if (!sure) return
  await store.removeTabCascade(tab.id)
  ElMessage.success('标签已删除')
}

/* ---------- 拖拽排序 ---------- */
const dragIndex = ref(-1)
function onDragStart(i: number) {
  dragIndex.value = i
}
function onDrop(i: number) {
  if (dragIndex.value < 0 || dragIndex.value === i) return (dragIndex.value = -1)
  const ids = store.visibleTabs.map((t) => t.id)
  const [moved] = ids.splice(dragIndex.value, 1)
  ids.splice(i, 0, moved)
  void store.reorderTabs(ids)
  dragIndex.value = -1
}
</script>

<template>
  <nav class="tab-bar">
    <div class="tab-pill-box">
      <span
        v-for="(tab, i) in store.visibleTabs"
        :key="tab.id"
        class="cabin-tab"
        :class="{ active: tab.id === store.activeTabId }"
        draggable="true"
        @click="store.setActiveTab(tab.id)"
        @contextmenu.prevent="onContext($event, tab)"
        @dragstart="onDragStart(i)"
        @dragover.prevent
        @drop="onDrop(i)"
        @dragend="dragIndex = -1"
      >
        <span class="tab-icon">{{ tab.icon }}</span>{{ tab.name }}
        <span v-if="tab.isDefault" class="default-mark" title="默认标签">●</span>
      </span>
    </div>
  </nav>

  <!-- 右键菜单 -->
  <Teleport to="body">
    <div
      v-if="menu.visible && menu.tab"
      class="tab-context-menu"
      :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
      @click.stop
    >
      <div class="ctx-item" @click="menuEdit">✏️ 编辑标签</div>
      <div v-if="!menu.tab.isDefault" class="ctx-item" @click="menuSetDefault">⭐ 设为默认标签</div>
      <div class="ctx-item danger" @click="menuDelete">🗑️ 删除标签</div>
    </div>
  </Teleport>
</template>

<style scoped>
.tab-bar {
  display: flex;
  justify-content: center;
  padding: 14px 0 4px;
}
.tab-pill-box {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--c-accent-bg);
  border-radius: 999px;
  padding: 5px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
  max-width: 100%;
  overflow-x: auto;
}
.tab-icon {
  font-size: 13px;
}
.default-mark {
  font-size: 7px;
  color: currentColor;
  opacity: 0.8;
}
.cabin-tab {
  cursor: grab;
}
.cabin-tab:active {
  cursor: grabbing;
}
html.theme-light .tab-pill-box {
  border: 1px solid var(--c-border);
}
</style>

<style>
/* 右键菜单样式（Teleport 到 body，需全局） */
.tab-context-menu {
  position: fixed;
  z-index: 3000;
  min-width: 150px;
  background: #16244f;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 6px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
}
html.theme-light .tab-context-menu {
  background: #fff;
  border-color: rgba(30, 40, 70, 0.12);
}
.tab-context-menu .ctx-item {
  padding: 8px 12px;
  border-radius: 7px;
  color: #e6eaf5;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}
html.theme-light .tab-context-menu .ctx-item {
  color: #22304f;
}
.tab-context-menu .ctx-item:hover {
  background: rgba(34, 197, 139, 0.15);
}
.tab-context-menu .ctx-item.danger:hover {
  background: rgba(245, 108, 108, 0.18);
}
</style>
