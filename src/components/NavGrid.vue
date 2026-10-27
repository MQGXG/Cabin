<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Maximize2, Plus, Pencil, Trash2, FolderOpen, SearchX } from 'lucide-vue-next'
import { useCabinStore } from '@/stores/cabin'
import { domainOf } from '@/core/navCore'
import { openAddSite, openEditSite, openSectionPanel } from '@/composables/ui'
import AppIcon from '@/components/AppIcon.vue'
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

/** 分区布局：所有标签横向多列，每列 3 列紧凑网格（参照原版 Carefree） */
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
    .filter((sec) => sec.sites.length > 0 || !kw)
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

/** 悬停删除（分区与网格通用） */
async function confirmDelete(site: NavSite) {
  const sure = await ElMessageBox.confirm(`删除“${site.name}”？`, '删除网站', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  }).catch(() => false)
  if (sure) await store.removeSite(site.id)
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
        <!-- 悬停操作（原版同款，右键仍可用） -->
        <span class="card-actions" @click.prevent.stop>
          <button title="编辑" @click="openEditSite(site)"><Pencil :size="13" /></button>
          <button title="删除" @click="confirmDelete(site)"><Trash2 :size="13" /></button>
        </span>
        <div class="favicon">
          <img
            v-if="site.favicon && !hasErr(site)"
            :src="site.favicon"
            alt=""
            loading="lazy"
            @error="onImgError(site)"
          />
          <span v-else class="fallback">{{ site.name.slice(0, 1).toUpperCase() }}</span>
          <span v-if="site.isValid === 0" class="broken-dot" title="失效链接（设置中可重新检测）" />
        </div>
        <div class="name" :title="site.name">{{ site.name }}</div>
        <div class="domain" :title="site.url">{{ domainOf(site.url) }}</div>
      </a>

      <!-- 添加网站（虚线卡） -->
      <button class="cabin-add-card" @click="openAddSite()">
        <Plus :size="26" />
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

  <!-- 分区布局：横向多列，盒外区头 + 盒内 3 列紧凑网格（参照原版 Carefree） -->
  <template v-else>
    <div class="zones">
      <section v-for="sec in sections" :key="sec.tab.id" class="zone-wrapper">
        <!-- 区头（盒子外面） -->
        <header class="zone-title-bar">
          <AppIcon class="zone-title-icon" :name="sec.tab.icon" :size="15" />
          <button class="zone-title-text" :title="`在网格布局中管理“${sec.tab.name}”`" @click="jumpToTab(sec.tab)">
            {{ sec.tab.name }}
          </button>
          <span class="zone-count">{{ sec.sites.length }}</span>
          <button class="zone-expand-btn" title="查看详情" @click="openSectionPanel(sec.tab.id)">
            <Maximize2 :size="13" />
          </button>
        </header>

        <!-- 分区盒 -->
        <div class="zone-group">
          <div class="zone-items">
            <div v-for="site in sec.sites" :key="site.id" class="zone-item-wrapper">
              <a
                class="zone-item"
                :href="site.url"
                target="_blank"
                rel="noopener"
                :title="site.description || site.url"
                @click.prevent="openSite(site)"
                @contextmenu.prevent="onContext(site)"
              >
                <span class="zone-item-icon">
                  <img
                    v-if="site.favicon && !hasErr(site)"
                    :src="site.favicon"
                    alt=""
                    loading="lazy"
                    @error="onImgError(site)"
                  />
                  <span v-else class="zone-fallback">{{ site.name.slice(0, 1).toUpperCase() }}</span>
                  <span v-if="site.isValid === 0" class="zone-broken-dot" title="失效链接" />
                </span>
                <span class="zone-item-title">{{ site.name }}</span>
              </a>
              <!-- 悬停操作 -->
              <span class="zone-item-actions">
                <button title="编辑" @click="openEditSite(site)"><Pencil :size="11" /></button>
                <button title="删除" @click="confirmDelete(site)"><Trash2 :size="11" /></button>
              </span>
            </div>

            <!-- 空态 -->
            <div v-if="sec.sites.length === 0" class="zone-empty">
              <span>暂无网站</span>
              <button class="zone-add-btn" title="添加网站" @click="openAddSite(sec.tab.id)">
                <Plus :size="12" />
              </button>
            </div>
          </div>

          <!-- 盒底添加 -->
          <button
            v-if="sec.sites.length > 0"
            class="zone-item-add"
            @click="openAddSite(sec.tab.id)"
          >
            <Plus :size="11" /> 添加网站
          </button>
        </div>
      </section>
    </div>
  </template>

  <div v-if="!isSection && paged.total === 0" class="empty-tip">
    <FolderOpen v-if="store.searchKeyword" :size="40" :stroke-width="1.4" />
    <SearchX v-else :size="40" :stroke-width="1.4" />
    <p>{{ store.searchKeyword ? '没有找到匹配的网站' : '暂无网站' }}</p>
    <p class="empty-sub">
      {{ store.searchKeyword ? '请尝试其他关键词' : '点击“添加网站”或右上角“批量导入”开始' }}
    </p>
    <el-button v-if="!store.searchKeyword" type="primary" @click="openAddSite()">
      <Plus :size="14" class="mr-1" /> 添加网站
    </el-button>
  </div>
</template>

<style scoped>
.nav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 16px;
}

/* ---------- 网格卡片 ---------- */
.site-card {
  position: relative;
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
/* 悬停操作按钮（网格） */
.card-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s;
}
.site-card:hover .card-actions {
  opacity: 1;
  pointer-events: auto;
}
.card-actions button {
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 7px;
  background: color-mix(in srgb, var(--c-bg) 78%, transparent);
  color: var(--c-text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}
.card-actions button:hover {
  background: var(--c-primary);
  color: #fff;
}
.favicon {
  position: relative;
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
/* 失效链接红点 */
.broken-dot {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #f56c6c;
  border: 2px solid var(--c-bg-soft);
  box-sizing: border-box;
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
.cabin-add-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.nav-grid .cabin-add-card {
  min-height: 150px;
}
.pager {
  display: flex;
  justify-content: center;
  margin-top: 22px;
}

/* ---------- 空态 ---------- */
.empty-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 70px 0 60px;
  color: var(--c-text-dim);
  font-size: 15px;
}
.empty-tip .empty-sub {
  font-size: 13px;
  opacity: 0.8;
}

/* ---------- 分区布局（横向多列） ---------- */
.zones {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
  gap: 20px 22px;
  align-items: start;
}
.zone-wrapper {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
/* 区头（盒子外面） */
.zone-title-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 8px;
}
.zone-title-icon {
  font-size: 14px;
  line-height: 1;
}
.zone-title-text {
  border: none;
  background: transparent;
  padding: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--c-text);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.2s;
}
.zone-title-text:hover {
  color: var(--c-primary);
}
.zone-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--c-primary);
  background: var(--c-primary-soft);
  padding: 1px 8px;
  border-radius: 999px;
}
.zone-expand-btn {
  margin-left: auto;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--c-text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}
.zone-expand-btn:hover {
  background: var(--c-primary-soft);
  color: var(--c-primary);
}
/* 分区盒 */
.zone-group {
  background: var(--c-card);
  backdrop-filter: blur(12px);
  border: 1px solid var(--c-border);
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.25s;
}
.zone-group:hover {
  background: var(--c-card-hover);
  border-color: color-mix(in srgb, var(--c-primary) 22%, var(--c-border));
}
/* 内容：3 列紧凑网格，超出滚动 */
.zone-items {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  padding: 6px 8px;
  max-height: 200px;
  overflow-y: auto;
  overflow-x: hidden;
}
.zone-item-wrapper {
  position: relative;
  min-width: 0;
}
.zone-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px;
  border-radius: 4px;
  text-decoration: none;
  min-width: 0;
  transition: background 0.15s;
}
.zone-item:hover {
  background: color-mix(in srgb, var(--c-text) 9%, transparent);
}
.zone-item-icon {
  position: relative;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  overflow: visible;
  background: color-mix(in srgb, var(--c-text) 12%, transparent);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.zone-broken-dot {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f56c6c;
  border: 1.5px solid var(--c-bg-soft);
  box-sizing: border-box;
}
.zone-item-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #fff;
}
.zone-fallback {
  font-size: 9px;
  font-weight: 700;
  color: var(--c-primary);
}
.zone-item-title {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--c-text);
  opacity: 0.85;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.15s;
}
.zone-item:hover .zone-item-title {
  color: var(--c-primary);
  opacity: 1;
}
/* 悬停操作（分区） */
.zone-item-actions {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 2px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
}
.zone-item-wrapper:hover .zone-item-actions {
  opacity: 1;
  pointer-events: auto;
}
.zone-item-actions button {
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: color-mix(in srgb, var(--c-bg) 82%, transparent);
  color: var(--c-text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}
.zone-item-actions button:hover {
  background: var(--c-primary);
  color: #fff;
}
/* 空态 */
.zone-empty {
  grid-column: span 3;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 12px;
  color: var(--c-text-dim);
  font-size: 12px;
}
.zone-add-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: var(--c-primary-soft);
  color: var(--c-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}
.zone-add-btn:hover {
  background: var(--c-primary);
  color: #fff;
}
/* 盒底添加 */
.zone-item-add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: calc(100% - 16px);
  margin: 4px 8px 8px;
  padding: 6px;
  border: 1px dashed color-mix(in srgb, var(--c-text-dim) 45%, transparent);
  border-radius: 5px;
  background: transparent;
  color: var(--c-text-dim);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}
.zone-item-add:hover {
  border-color: var(--c-primary);
  color: var(--c-primary);
  background: var(--c-primary-soft);
}
/* 滚动条 */
.zone-items::-webkit-scrollbar {
  width: 4px;
}
.zone-items::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--c-text-dim) 35%, transparent);
  border-radius: 4px;
}
</style>
