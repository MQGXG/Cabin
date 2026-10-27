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
      <!-- 品牌（小木屋 logo：插画图标 + 中英文品牌名） -->
      <div class="brand" title="小木屋 LittleWoodHouse">
        <img class="brand-logo" src="/logo.svg" alt="小木屋" />
        <span class="brand-text">
          <span class="brand-name">小木屋</span>
          <span class="brand-sub">LittleWoodHouse</span>
        </span>
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
  padding: 10px 40px;
  display: flex;
  align-items: center;
  gap: 32px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  user-select: none;
  /* 品牌文字：暗色用暖白，亮色用 logo 原图棕 */
  --brand-ink: #ecdbc8;
}
html.theme-light .brand {
  --brand-ink: #542a1b;
}
.brand-logo {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  flex-shrink: 0;
  filter: drop-shadow(0 3px 7px rgba(0, 0, 0, 0.28));
}
.brand-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
  /* 与 logo 等高，保证两侧垂直对齐 */
  height: 58px;
  line-height: 1.15;
}
.brand-name {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: 5px;
  color: var(--brand-ink);
}
.brand-sub {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 3px;
  color: var(--brand-ink);
  opacity: 0.65;
  margin-top: 3px;
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
  padding: 11px 20px;
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
  height: 42px;
  min-width: 42px;
  padding: 0 9px;
  border-radius: 12px;
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
  font-size: 22px;
  padding: 0 13px;
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
  .brand-text {
    display: none;
  }
}
</style>
