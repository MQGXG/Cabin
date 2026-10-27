<script setup lang="ts">
import { useCabinStore } from '@/stores/cabin'

const store = useCabinStore()
</script>

<template>
  <nav class="tab-bar">
    <div class="tab-pill-box">
      <span
        v-for="tab in store.visibleTabs"
        :key="tab.id"
        class="cabin-tab"
        :class="{ active: tab.id === store.activeTabId }"
        @click="store.setActiveTab(tab.id)"
      >
        <span class="tab-icon">{{ tab.icon }}</span>{{ tab.name }}
      </span>
    </div>
  </nav>
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
html.theme-light .tab-pill-box {
  border: 1px solid var(--c-border);
}
</style>
