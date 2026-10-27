<script setup lang="ts">
import { computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useCabinStore } from '@/stores/cabin'
import { domainOf } from '@/core/navCore'
import { openAddSite, openEditSite } from '@/composables/ui'
import type { NavSite } from '@/types/index'

const store = useCabinStore()

/** 分页显示（pageSize 可在设置中调整） */
const paged = computed(() => {
  const size = store.settings.pageSize
  return { list: store.filteredSites.slice(0, size), hasMore: store.filteredSites.length > size }
})

function openSite(site: NavSite) {
  void store.clickSite(site.id)
  window.open(site.url, '_blank', 'noopener')
}

/** favicon 加载失败集合：切首字母占位 */
const errored = new Set<string>()
function hasErr(site: NavSite) {
  return errored.has(site.id)
}
function onImgError(site: NavSite) {
  errored.add(site.id)
}

/** 右键快捷操作：选模式后编辑或删除 */
async function onContext(site: NavSite) {
  const action: 'delete' | 'edit' | null = await ElMessageBox.confirm(
    `${site.name}（${domainOf(site.url)}）`,
    '右键快捷操作：确认删除该网站？',
    {
      confirmButtonText: '删除',
      cancelButtonText: '编辑',
      distinguishCancelAndClose: true,
      type: 'warning',
    },
  )
    .then(() => 'delete' as const)
    .catch((a) => (a === 'cancel' ? ('edit' as const) : null))
  if (action === 'delete') {
    await store.removeSite(site.id)
  } else if (action === 'edit') {
    openEditSite(site)
  }
}
</script>

<template>
  <div :class="['nav-grid', store.settings.layout === 'list' ? 'as-list' : '']">
    <a
      v-for="site in paged.list"
      :key="site.id"
      class="site-card cabin-card"
      :href="site.url"
      target="_blank"
      rel="noopener"
      @click.prevent="openSite(site)"
      @contextmenu.prevent="onContext(site)"
    >
      <div class="favicon">
        <img
          v-if="site.favicon && !hasErr(site)"
          :src="site.favicon"
          alt=""
          loading="lazy"
          @error="onImgError(site)"
        />
        <span v-else class="fallback">{{ site.name.slice(0, 1).toUpperCase() }}</span>
      </div>
      <div class="name" :title="site.name">{{ site.name }}</div>
      <div class="domain" :title="site.url">{{ domainOf(site.url) }}</div>
    </a>

    <!-- 添加网站（虚线卡） -->
    <button class="cabin-add-card" @click="openAddSite()">
      <span class="add-plus">+</span>
      <span>添加网站</span>
    </button>
  </div>

  <div v-if="paged.hasMore" class="more-tip">
    共 {{ store.filteredSites.length }} 个，当前显示前 {{ store.settings.pageSize }} 个（可在备份弹窗中调整每页数量）
  </div>
</template>

<style scoped>
.nav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 16px;
}
.nav-grid.as-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.site-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 26px 14px 20px;
  gap: 8px;
  cursor: pointer;
  text-decoration: none;
  min-height: 150px;
  color: var(--c-text);
}
.nav-grid.as-list .site-card {
  flex-direction: row;
  min-height: 0;
  padding: 12px 18px;
  text-align: left;
  justify-content: flex-start;
}
.favicon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}
.nav-grid.as-list .favicon {
  margin-bottom: 0;
  width: 36px;
  height: 36px;
}
.favicon img {
  width: 40px;
  height: 40px;
  border-radius: 9px;
  object-fit: contain;
  background: #fff;
  padding: 4px;
}
.nav-grid.as-list .favicon img {
  width: 30px;
  height: 30px;
}
.fallback {
  width: 40px;
  height: 40px;
  border-radius: 9px;
  background: var(--c-primary-soft);
  color: var(--c-primary);
  font-weight: 800;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-grid.as-list .fallback {
  width: 30px;
  height: 30px;
  font-size: 14px;
}
.name {
  font-size: 14px;
  font-weight: 600;
  color: var(--c-text);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.domain {
  font-size: 12px;
  color: var(--c-text-dim);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.add-plus {
  font-size: 30px;
  line-height: 1;
}
.nav-grid .cabin-add-card {
  min-height: 150px;
}
.nav-grid.as-list .cabin-add-card {
  min-height: 52px;
  flex-direction: row;
}
.more-tip {
  margin-top: 18px;
  text-align: center;
  color: var(--c-text-dim);
  font-size: 12px;
}
</style>
