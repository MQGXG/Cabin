<script setup lang="ts">
import { ref, watch } from 'vue'
import { Search, Plus, Upload, LayoutGrid, Columns3, Folder } from 'lucide-vue-next'
import { useCabinStore } from '@/stores/cabin'
import { openCreateTab, openImport } from '@/composables/ui'

const store = useCabinStore()

/** 区级筛选：跟随激活标签 */
watch(
  () => store.activeTabId,
  () => store.setFilterTab(''),
  { immediate: true },
)

const keyword = ref('')
watch(keyword, (v) => store.setSearch(v))

function toggleLayout() {
  void store.patchSetting('layout', store.settings.layout === 'grid' ? 'section' : 'grid')
}
</script>

<template>
  <div class="stats-bar cabin-card">
    <div class="left">
      <span class="stat">{{ store.filteredSites.length }} 个网站</span>
      <span class="divider" />
      <span class="stat accent">{{ store.totalClicks }} 总点击</span>
      <span class="divider" />
      <span class="filter-badge" title="点击显示全部标签的网站" @click="store.setFilterTab(store.activeFilterTabId ? '' : store.activeTabId)">
        <Folder :size="13" />
        {{ store.activeTab?.name ?? '全部' }}
      </span>
      <div class="search-box">
        <Search :size="14" class="search-icon" />
        <input v-model="keyword" type="text" placeholder="搜索网站..." />
      </div>
    </div>
    <div class="right">
      <button class="action-btn" @click="openCreateTab()">
        <Plus :size="14" /> 创建标签
      </button>
      <button class="action-btn" @click="openImport()">
        <Upload :size="14" /> 批量导入
      </button>
      <div class="layout-btn" title="切换布局">
        <button
          class="layout-ic"
          :class="{ active: store.settings.layout === 'grid' }"
          title="卡片布局"
          @click="toggleLayout()"
        >
          <LayoutGrid :size="15" />
        </button>
        <button
          class="layout-ic"
          :class="{ active: store.settings.layout === 'section' }"
          title="分区布局"
          @click="toggleLayout()"
        >
          <Columns3 :size="15" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 18px;
  margin: 16px 0 22px;
  flex-wrap: wrap;
}
.left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.stat {
  font-size: 14px;
  color: var(--c-text);
  font-weight: 600;
}
.stat.accent {
  color: var(--c-primary);
}
.divider {
  width: 1px;
  height: 16px;
  background: var(--c-border);
}
.filter-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--c-primary-soft);
  color: var(--c-primary);
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.15s;
}
.filter-badge:hover {
  filter: brightness(1.15);
}
.search-box {
  display: flex;
  align-items: center;
  gap: 7px;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: 10px;
  padding: 7px 12px;
  min-width: 220px;
  transition: border-color 0.2s;
}
.search-box:focus-within {
  border-color: var(--c-primary);
}
.search-icon {
  color: var(--c-text-dim);
  flex-shrink: 0;
}
.search-box input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  color: var(--c-text);
  font-size: 13px;
}
.search-box input::placeholder {
  color: var(--c-text-dim);
}
.right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--c-bg-soft);
  border: 1px solid var(--c-border);
  color: var(--c-text);
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.action-btn:hover {
  border-color: var(--c-primary);
  color: var(--c-primary);
  background: var(--c-primary-soft);
}
.layout-btn {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--c-bg-soft);
  border: 1px solid var(--c-border);
  border-radius: 10px;
  overflow: hidden;
  padding: 2px;
}
.layout-ic {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 9px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--c-text-dim);
  cursor: pointer;
  transition: all 0.2s;
}
.layout-ic:hover {
  color: var(--c-text);
}
.layout-ic.active {
  background: var(--c-primary-soft);
  color: var(--c-primary);
}
</style>
