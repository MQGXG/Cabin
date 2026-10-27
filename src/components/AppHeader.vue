<script setup lang="ts">
import { ref, watch } from 'vue'
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
        <span class="search-icon">🔍</span>
        <input v-model="keyword" class="search-input" type="text" placeholder="搜索导航..." />
      </div>

      <!-- 右侧操作 -->
      <div class="header-actions">
        <button class="icon-btn primary" title="添加网站" @click="openAddSite()">+</button>
        <button class="icon-btn" title="切换主题" @click="toggleTheme">
          {{ store.effectiveDark ? '☀️' : '🌙' }}
        </button>
        <button class="icon-btn" title="设置" @click="openSettings()">⚙️</button>
        <button class="icon-btn" title="备份 / 恢复" @click="openBackup()">💾</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
/* 顶栏固定浅色（还原原版浅灰顶栏 + 深色内容区的双色调布局） */
.app-header {
  background: #f2f4f8;
  border-bottom: 1px solid rgba(30, 40, 70, 0.08);
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
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15));
}
.brand-name {
  font-size: 21px;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: #16a06a;
}
.search-wrap {
  flex: 1;
  max-width: 560px;
  margin-left: auto;
  position: relative;
  display: flex;
  align-items: center;
  background: #fff;
  border: 1px solid rgba(30, 40, 70, 0.1);
  border-radius: 999px;
  padding: 8px 18px;
}
.search-icon {
  color: #8a94a8;
  margin-right: 10px;
  font-size: 14px;
}
.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #22304f;
  font-size: 14px;
}
.search-input::placeholder {
  color: #8a94a8;
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
  border: 1px solid rgba(30, 40, 70, 0.1);
  background: #fff;
  color: #3a4763;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.icon-btn:hover {
  border-color: #16a06a;
  background: rgba(34, 197, 139, 0.1);
}
/* 主题主色按钮（+ 添加网站） */
.icon-btn.primary {
  background: #22c58b;
  border-color: #22c58b;
  color: #fff;
  font-weight: 800;
  font-size: 20px;
  padding: 0 12px;
  box-shadow: 0 4px 12px rgba(34, 197, 139, 0.35);
}
.icon-btn.primary:hover {
  background: #1fb37f;
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
