<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCabinStore } from '@/stores/cabin'
import { openCreateTab, openImport } from '@/composables/ui'

const store = useCabinStore()

/** 区级筛选：跟随激活标签（对应截图 [常用] 徽标） */
watch(
  () => store.activeTabId,
  () => store.setFilterTab(''),
  { immediate: true },
)

const keyword = ref('')
watch(keyword, (v) => store.setSearch(v))

const layoutIcon = computed(() => (store.settings.layout === 'grid' ? '▦' : '☰'))

function toggleLayout() {
  void store.patchSetting('layout', store.settings.layout === 'grid' ? 'list' : 'grid')
}
</script>

<template>
  <div class="stats-bar cabin-card">
    <div class="left">
      <span class="stat">{{ store.filteredSites.length }} 个网站</span>
      <span class="divider">|</span>
      <span class="stat">{{ store.totalClicks }} 总点击</span>
      <span class="divider">|</span>
      <span class="filter-badge">
        <span class="badge-icon">📂</span>
        {{ store.activeTab?.name ?? '全部' }}
      </span>
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input v-model="keyword" type="text" placeholder="搜索网站..." />
      </div>
    </div>
    <div class="right">
      <button class="action-btn" @click="openCreateTab()">
        <span class="plus">+</span> 创建标签
      </button>
      <button class="action-btn" @click="openImport()">📥 批量导入</button>
      <button class="layout-btn" :title="layoutIcon === '▦' ? '切换为列表' : '切换为网格'" @click="toggleLayout">
        <span :class="{ active: store.settings.layout === 'grid' }">▦</span>
        <span :class="{ active: store.settings.layout === 'list' }">☰</span>
      </button>
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
.divider {
  color: var(--c-border);
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
  cursor: pointer;
}
.search-box {
  display: flex;
  align-items: center;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: 10px;
  padding: 7px 12px;
  min-width: 220px;
}
.search-icon {
  color: var(--c-text-dim);
  margin-right: 8px;
  font-size: 13px;
}
.search-box input {
  flex: 1;
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
  background: var(--c-bg-soft);
  border: 1px solid var(--c-border);
  color: var(--c-text);
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.action-btn:hover {
  border-color: var(--c-primary);
  color: var(--c-primary);
  background: var(--c-primary-soft);
}
.plus {
  font-weight: 700;
}
.layout-btn {
  display: flex;
  background: var(--c-bg-soft);
  border: 1px solid var(--c-border);
  border-radius: 10px;
  overflow: hidden;
}
.layout-btn span {
  padding: 8px 12px;
  cursor: pointer;
  color: var(--c-text-dim);
  font-size: 14px;
  transition: all 0.2s;
}
.layout-btn span.active {
  background: var(--c-primary-soft);
  color: var(--c-primary);
}
</style>
