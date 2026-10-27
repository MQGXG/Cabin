<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useCabinStore } from '@/stores/cabin'
import { domainOf } from '@/core/navCore'
import { openAddSite, openEditSite } from '@/composables/ui'
import type { NavSite, NavTab } from '@/types/index'

const store = useCabinStore()

/* ---------- 分页（仅网格布局生效） ---------- */
const page = ref(1)
watch(
  () => [store.activeTabId, store.searchKeyword],
  () => {
    page.value = 1
  },
)
watch(
  () => store.settings.pageSize,
  () => {
    page.value = 1
  },
)

const isSection = computed(() => store.settings.layout === 'section')

/** 网格布局：当前标签（或筛选）分页后的站点 */
const paged = computed(() => {
  const size = store.settings.pageSize
  const total = store.filteredSites.length
  const totalPages = Math.max(1, Math.ceil(total / size))
  const cur = Math.min(page.value, totalPages)
  return {
    list: store.filteredSites.slice((cur - 1) * size, cur * size),
    cur,
    totalPages,
    total,
  }
})

/** 分区布局：所有标签纵向堆叠，每区显示该标签全部网站 */
const sections = computed(() => {
  const kw = store.searchKeyword.trim().toLowerCase()
  return store.visibleTabs
    .map((tab) => ({
      tab,
      sites: store
        .sitesOfTab(tab.id)
        .filter(
          (s) => !kw || s.name.toLowerCase().includes(kw) || s.url.toLowerCase().includes(kw),
        ),
    }))
    .filter((sec) => sec.sites.length > 0)
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

/* ---------- 拖拽排序（仅网格布局 + 无搜索关键词时可用） ---------- */
const dragId = ref('')
const canDrag = computed(() => !isSection.value && !store.searchKeyword.trim())

function onDragStart(id: string) {
  if (!canDrag.value) return
  dragId.value = id
}
async function onDrop(targetId: string) {
  const from = dragId.value
  dragId.value = ''
  if (!from || from === targetId) return
  const ids = paged.value.list.map((s) => s.id)
  const fromIdx = ids.indexOf(from)
  const toIdx = ids.indexOf(targetId)
  if (fromIdx < 0 || toIdx < 0) return
  ids.splice(toIdx, 0, ids.splice(fromIdx, 1)[0])
  await store.reorderSites(store.activeTabId, ids)
}

/** 右键快捷操作：选模式后编辑或删除 */
async function onContext(site: NavSite) {
  const action: 'delete' | 'edit' | null = await ElMessageBox.confirm(
    site.description ? `${site.name} — ${site.description}` : `${site.name}（${domainOf(site.url)}）`,
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

/** 分区标题点击跳回网格布局并激活该标签 */
function jumpToTab(tab: NavTab) {
  store.setActiveTab(tab.id)
  void store.patchSetting('layout', 'grid')
}
</script>

<template>
  <!-- 网格布局 -->
  <template v-if="!isSection">
    <div class="nav-grid">
      <a
        v-for="site in paged.list"
        :key="site.id"
        class="site-card cabin-card"
        :href="site.url"
        target="_blank"
        rel="noopener"
        :draggable="canDrag"
        :title="site.description || site.url"
        @click.prevent="openSite(site)"
        @contextmenu.prevent="onContext(site)"
        @dragstart="onDragStart(site.id)"
        @dragover.prevent
        @drop="onDrop(site.id)"
        @dragend="dragId = ''"
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

    <!-- 翻页 -->
    <div v-if="paged.totalPages > 1" class="pager">
      <el-pagination
        v-model:current-page="page"
        :page-size="store.settings.pageSize"
        :total="paged.total"
        layout="prev, pager, next, total"
        background
      />
    </div>
  </template>

  <!-- 分区布局：所有标签纵向堆叠 -->
  <template v-else>
    <section v-for="sec in sections" :key="sec.tab.id" class="zone">
      <header class="zone-head">
        <span class="zone-icon">{{ sec.tab.icon }}</span>
        <span class="zone-name">{{ sec.tab.name }}</span>
        <span class="zone-count">{{ sec.sites.length }}</span>
        <span class="zone-line" />
        <button class="zone-jump" title="回到网格布局管理该标签" @click="jumpToTab(sec.tab)">管理</button>
      </header>
      <div class="nav-grid zone-grid">
        <a
          v-for="site in sec.sites"
          :key="site.id"
          class="site-card cabin-card"
          :href="site.url"
          target="_blank"
          rel="noopener"
          :title="site.description || site.url"
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
        <button class="cabin-add-card zone-add" @click="openAddSite()">
          <span class="add-plus">+</span>
          <span>添加网站</span>
        </button>
      </div>
    </section>
  </template>

  <div v-if="!isSection && paged.total === 0" class="empty-tip">
    暂无网站，点击下方“添加网站”或右上角“批量导入”开始
  </div>
  <div v-else-if="isSection && sections.length === 0" class="empty-tip">
    暂无网站，点击卡片区“添加网站”或右上角“批量导入”开始
  </div>
</template>

<style scoped>
.nav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 16px;
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
.site-card:active {
  cursor: grabbing;
}
.favicon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}
.favicon img {
  width: 40px;
  height: 40px;
  border-radius: 9px;
  object-fit: contain;
  background: #fff;
  padding: 4px;
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
.pager {
  display: flex;
  justify-content: center;
  margin-top: 22px;
}
.empty-tip {
  text-align: center;
  color: var(--c-text-dim);
  padding: 48px 0;
  font-size: 14px;
}

/* ---------- 分区布局 ---------- */
.zone {
  margin-bottom: 34px;
}
.zone-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  position: sticky;
  top: 66px;
  z-index: 10;
  background: color-mix(in srgb, var(--c-bg) 82%, transparent);
  backdrop-filter: blur(8px);
  padding: 8px 2px;
  border-radius: 10px;
}
.zone-icon {
  font-size: 17px;
}
.zone-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--c-text);
}
.zone-count {
  font-size: 12px;
  color: var(--c-primary);
  background: var(--c-primary-soft);
  border-radius: 999px;
  padding: 2px 9px;
  font-weight: 600;
}
.zone-line {
  flex: 1;
  height: 1px;
  background: var(--c-border);
}
.zone-jump {
  border: 1px solid var(--c-border);
  background: transparent;
  color: var(--c-text-dim);
  border-radius: 8px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.zone-jump:hover {
  color: var(--c-primary);
  border-color: var(--c-primary);
}
.zone-grid .cabin-add-card {
  min-height: 150px;
}
</style>
