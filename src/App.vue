<script setup lang="ts">
import { onMounted, watchEffect } from 'vue'
import { useCabinStore } from '@/stores/cabin'
import AppHeader from '@/components/AppHeader.vue'
import TabBar from '@/components/TabBar.vue'
import StatsBar from '@/components/StatsBar.vue'
import NavGrid from '@/components/NavGrid.vue'
import WallpaperFab from '@/components/WallpaperFab.vue'
import TabDialog from '@/components/TabDialog.vue'
import SiteDialog from '@/components/SiteDialog.vue'
import ImportDialog from '@/components/ImportDialog.vue'
import BackupDialog from '@/components/BackupDialog.vue'
import SettingsDialog from '@/components/SettingsDialog.vue'
import SectionPanel from '@/components/SectionPanel.vue'

const store = useCabinStore()

onMounted(async () => {
  await store.init()
})

// 主题切换（防闪烁：跟随系统时实时跟随 matchMedia 变化）
watchEffect(() => {
  if (!store.ready) return
  document.documentElement.classList.toggle('theme-light', !store.effectiveDark)
})
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <main class="app-main">
      <TabBar />
      <StatsBar />
      <NavGrid v-if="store.ready" />
      <div v-else class="loading-tip">正在加载本地数据库…</div>
    </main>
    <WallpaperFab />
    <TabDialog />
    <SiteDialog />
    <ImportDialog />
    <BackupDialog />
    <SettingsDialog />
    <SectionPanel />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100%;
  /* 背景交给壁纸层（.wall-bg，默认 var(--c-bg)）；
     此处若保留不透明背景，会因普通块背景绘制在负 z-index 壁纸层之上而将其完全遮挡 */
  background: transparent;
}
.app-main {
  max-width: 1720px;
  margin: 0 auto;
  padding: 18px 40px 90px;
}
.loading-tip {
  text-align: center;
  color: var(--c-text-dim);
  padding: 80px 0;
  font-size: 15px;
}
@media (max-width: 720px) {
  .app-main {
    padding: 12px 16px 80px;
  }
}
</style>
