<script setup lang="ts">
import { ref, watch } from 'vue'
import { useCabinStore } from '@/stores/cabin'
import { openBackup } from '@/composables/ui'

const store = useCabinStore()
const keyword = ref('')
watch(keyword, (v) => store.setSearch(v))

function toggleTheme() {
  const next = store.settings.theme === 'dark' ? 'light' : 'dark'
  void store.patchSetting('theme', next)
}
</script>

<template>
  <header class="app-header">
    <div class="header-inner">
      <!-- 品牌 -->
      <div class="brand">
        <span class="brand-logo">🛖</span>
        <span class="brand-name">Cabin</span>
      </div>

      <!-- 顶部搜索 -->
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input v-model="keyword" class="search-input" type="text" placeholder="搜索导航..." />
      </div>

      <!-- 右侧操作 -->
      <div class="header-actions">
        <button class="icon-btn" title="切换主题" @click="toggleTheme">
          {{ store.settings.theme === 'dark' ? '☀️' : '🌙' }}
        </button>
        <button class="icon-btn" title="备份 / 恢复" @click="openBackup()">💾</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  background: var(--c-header-bg);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--c-border);
  position: sticky;
  top: 0;
  z-index: 50;
}
.header-inner {
  max-width: 1720px;
  margin: 0 auto;
  padding: 12px 40px;
  display: flex;
  align-items: center;
  gap: 24px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  user-select: none;
}
.brand-logo {
  font-size: 26px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}
.brand-name {
  font-size: 21px;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: var(--c-primary);
}
.search-wrap {
  flex: 1;
  max-width: 560px;
  margin-left: auto;
  position: relative;
  display: flex;
  align-items: center;
  background: var(--c-bg-soft);
  border: 1px solid var(--c-border);
  border-radius: 999px;
  padding: 8px 18px;
}
.search-icon {
  color: var(--c-text-dim);
  margin-right: 10px;
  font-size: 14px;
}
.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--c-text);
  font-size: 14px;
}
.search-input::placeholder {
  color: var(--c-text-dim);
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--c-border);
  background: var(--c-bg-soft);
  color: var(--c-text);
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.icon-btn:hover {
  border-color: var(--c-primary);
  background: var(--c-primary-soft);
}
@media (max-width: 720px) {
  .header-inner {
    padding: 10px 16px;
    gap: 12px;
  }
  .brand-name {
    display: none;
  }
}
</style>
