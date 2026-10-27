<script setup lang="ts">
import { ref, watch } from 'vue'
import { Search, Plus, Sun, Moon, Settings, DatabaseBackup } from 'lucide-vue-next'
import { useCabinStore } from '@/stores/cabin'
import { openBackup, openSettings, openAddSite } from '@/composables/ui'

const store = useCabinStore()
const keyword = ref('')
watch(keyword, (v) => store.setSearch(v))

function toggleTheme() {
  void store.toggleTheme()
}
</script>

<template>
  <header class="app-header">
    <div class="header-inner">
      <!-- 品牌 -->
      <div class="brand">
        <img class="brand-logo" src="/logo.svg" alt="Cabin" />
        <span class="brand-name">Cabin</span>
      </div>

      <!-- 顶部搜索 -->
      <div class="search-wrap">
        <Search :size="15" class="search-icon" />
        <input v-model="keyword" class="search-input" type="text" placeholder="搜索导航..." />
      </div>

      <!-- 右侧操作 -->
      <div class="header-actions">
        <button class="icon-btn primary" title="添加网站" @click="openAddSite()"><Plus :size="18" :stroke-width="2.6" /></button>
        <button class="icon-btn" title="切换主题" @click="toggleTheme">
          <Sun v-if="store.effectiveDark" :size="17" />
          <Moon v-else :size="17" />
        </button>
        <button class="icon-btn" title="设置" @click="openSettings()"><Settings :size="17" /></button>
        <button class="icon-btn" title="备份 / 恢复" @click="openBackup()"><DatabaseBackup :size="17" /></button>
      </div>
    </div>
  </header>
</template>

<style scoped>
/* 顶栏：半透明毛玻璃，颜色全部走主题变量（深/浅色自动适配） */
.app-header {
  background: color-mix(in srgb, var(--c-header-bg) 72%, transparent);
  backdrop-filter: blur(16px) saturate(1.25);
  -webkit-backdrop-filter: blur(16px) saturate(1.25);
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
  width: 30px;
  height: 30px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25));
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
  background: color-mix(in srgb, var(--c-bg) 45%, transparent);
  border: 1px solid var(--c-border);
  border-radius: 999px;
  padding: 8px 18px;
  transition: border-color 0.2s;
}
.search-wrap:focus-within {
  border-color: var(--c-primary);
}
.search-icon {
  color: var(--c-text-dim);
  margin-right: 10px;
  flex-shrink: 0;
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
  height: 38px;
  min-width: 38px;
  padding: 0 8px;
  border-radius: 10px;
  border: 1px solid var(--c-border);
  background: color-mix(in srgb, var(--c-bg-soft) 55%, transparent);
  color: var(--c-text-dim);
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.icon-btn:hover {
  border-color: var(--c-primary);
  color: var(--c-primary);
  background: var(--c-primary-soft);
}
/* 主题主色按钮（+ 添加网站） */
.icon-btn.primary {
  background: var(--c-primary);
  border-color: var(--c-primary);
  color: #fff;
  font-weight: 800;
  font-size: 20px;
  padding: 0 12px;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--c-primary) 40%, transparent);
}
.icon-btn.primary:hover {
  filter: brightness(1.08);
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
