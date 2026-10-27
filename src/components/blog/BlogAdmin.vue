<script setup lang="ts">
/**
 * 博客后台：Tab 式布局（文章 / 分类与标签 / 设置），区别于原版侧栏式
 * 编辑器为全屏覆盖（BlogEditor）
 */
import { ref, computed, watch } from 'vue'
import {
  ArrowLeft, Plus, Pencil, Pin, PinOff, Send, Undo2, Trash2,
  RotateCcw, X, Download, FileText, FolderTree, Settings,
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useBlogStore } from '@/stores/blog'
import { ui, backToNav, openBlog } from '@/composables/ui'
import { formatDateTime, relativeTime, canTransit } from '@/core/blogCore'
import BlogEditor from './BlogEditor.vue'
import type { BlogPost, BlogPostStatus } from '@/types'

const blog = useBlogStore()

type Tab = 'posts' | 'taxonomy' | 'settings'
const activeTab = ref<Tab>('posts')

/* ==================== 文章列表 ==================== */
const keyword = ref('')
const statusFilter = ref<BlogPostStatus | 'all'>('all')
const showRecycled = ref(false)

const visiblePosts = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return blog.activePosts
    .filter((p) => statusFilter.value === 'all' || p.status === statusFilter.value)
    .filter((p) => !kw || p.title.toLowerCase().includes(kw) || p.slug.includes(kw))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updatedAt - a.updatedAt
    })
})

function newPost() {
  ui.blogEditing = 'new'
}
function editPost(p: BlogPost) {
  ui.blogEditing = p.id
}

function transit(p: BlogPost, action: 'publish' | 'unpublish') {
  if (blog.transit(p.id, action)) {
    ElMessage.success(action === 'publish' ? '已发布' : '已撤回为草稿')
  }
}

function togglePin(p: BlogPost) {
  blog.togglePin(p.id)
}

async function removePost(p: BlogPost) {
  const sure = await ElMessageBox.confirm(`把「${p.title}」移入回收站？`, '删除', {
    type: 'warning',
    confirmButtonText: '移入回收站',
    cancelButtonText: '取消',
  }).catch(() => false)
  if (sure) {
    blog.softDelete(p.id)
    ElMessage.success('已移入回收站')
  }
}

async function purgePost(p: BlogPost) {
  const sure = await ElMessageBox.confirm(`彻底删除「${p.title}」？不可恢复！`, '彻底删除', {
    type: 'warning',
    confirmButtonText: '彻底删除',
    cancelButtonText: '取消',
  }).catch(() => false)
  if (sure) {
    blog.purge(p.id)
    ElMessage.success('已彻底删除')
  }
}

/* ==================== 分类与标签 ==================== */
const newCat = ref('')
const newTag = ref('')
const editingCatId = ref('')
const editingCatName = ref('')
const editingTagId = ref('')
const editingTagName = ref('')

function addCategory() {
  const r = blog.createCategory(newCat.value)
  if (!r.ok) return void ElMessage.warning(r.msg)
  ElMessage.success('分类已创建')
  newCat.value = ''
}
function saveCatName(id: string) {
  const r = blog.renameCategory(id, editingCatName.value)
  if (!r.ok) return void ElMessage.warning(r.msg)
  editingCatId.value = ''
  ElMessage.success('已重命名')
}
async function removeCategory(id: string, name: string) {
  const sure = await ElMessageBox.confirm(
    `删除分类「${name}」？其下文章将变为「未分类」。`,
    '删除',
    { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
  ).catch(() => false)
  if (sure) {
    blog.removeCategory(id)
    ElMessage.success('已删除')
  }
}
function addTag() {
  const r = blog.createTag(newTag.value)
  if (!r.ok) return void ElMessage.warning(r.msg)
  ElMessage.success('标签已创建')
  newTag.value = ''
}
function saveTagName(id: string) {
  const r = blog.renameTag(id, editingTagName.value)
  if (!r.ok) return void ElMessage.warning(r.msg)
  editingTagId.value = ''
  ElMessage.success('已重命名')
}
async function removeTag(id: string, name: string) {
  const sure = await ElMessageBox.confirm(`删除标签「${name}」？文章上的引用会一并移除。`, '删除', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  }).catch(() => false)
  if (sure) {
    blog.removeTag(id)
    ElMessage.success('已删除')
  }
}
const postCountOfCat = (id: string) => blog.activePosts.filter((p) => p.categoryId === id).length
const postCountOfTag = (id: string) => blog.activePosts.filter((p) => p.tagIds.includes(id)).length

/* ==================== 设置 ==================== */
const sName = ref('')
const sDesc = ref('')
const sPageSize = ref(9)

watch(
  () => ui.view === 'blogAdmin' && activeTab.value === 'settings',
  (on) => {
    if (on) {
      sName.value = blog.settings.blogName
      sDesc.value = blog.settings.blogDescription
      sPageSize.value = blog.settings.pageSize
    }
  },
  { immediate: true },
)

async function saveSettingsForm() {
  await blog.saveSettings({
    blogName: sName.value.trim() || '小木屋手记',
    blogDescription: sDesc.value.trim(),
    pageSize: Number(sPageSize.value) || 9,
  })
  ElMessage.success('设置已保存')
}

function exportStatic() {
  blog.exportStaticHtml()
  ElMessage.success('已导出单文件静态博客（cabin-blog.html）')
}
</script>

<template>
  <div class="admin-shell">
    <!-- 顶栏 -->
    <header class="ba-top">
      <button class="ba-back" @click="backToNav()">
        <ArrowLeft :size="16" /> 返回导航
      </button>
      <div class="ba-tabs">
        <button class="ba-tab" :class="{ active: activeTab === 'posts' }" @click="activeTab = 'posts'">
          <FileText :size="14" /> 文章
          <span class="cnt">{{ blog.activePosts.length }}</span>
        </button>
        <button class="ba-tab" :class="{ active: activeTab === 'taxonomy' }" @click="activeTab = 'taxonomy'">
          <FolderTree :size="14" /> 分类与标签
        </button>
        <button class="ba-tab" :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'">
          <Settings :size="14" /> 设置
        </button>
      </div>
      <button class="ba-view-site" @click="openBlog()">查看博客前台 →</button>
    </header>

    <div class="ba-body">
      <!-- ========== 文章 ========== -->
      <template v-if="activeTab === 'posts'">
        <div class="ba-toolbar">
          <button class="ba-primary" @click="newPost">
            <Plus :size="15" /> 新建文章
          </button>
          <input v-model="keyword" class="ba-search" placeholder="搜索标题 / slug…" />
          <select v-model="statusFilter" class="ba-select">
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
          </select>
          <button class="ba-ghost" @click="exportStatic">
            <Download :size="14" /> 导出静态 HTML
          </button>
        </div>

        <div v-if="visiblePosts.length" class="ba-table">
          <div class="ba-row head">
            <span class="c-title">标题</span>
            <span class="c-status">状态</span>
            <span class="c-cat">分类</span>
            <span class="c-time">更新</span>
            <span class="c-ops">操作</span>
          </div>
          <div v-for="p in visiblePosts" :key="p.id" class="ba-row">
            <span class="c-title">
              <Pin v-if="p.pinned" :size="12" class="pin-ic" />
              <b>{{ p.title }}</b>
              <span class="slug">/{{ p.slug }}</span>
            </span>
            <span class="c-status">
              <em class="st" :class="p.status">
                {{ p.status === 'published' ? '已发布' : '草稿' }}
              </em>
            </span>
            <span class="c-cat">{{ blog.categoryName(p.categoryId) || '未分类' }}</span>
            <span class="c-time" :title="formatDateTime(p.updatedAt)">{{ relativeTime(p.updatedAt) }}</span>
            <span class="c-ops">
              <button title="编辑" @click="editPost(p)"><Pencil :size="13" /></button>
              <button v-if="canTransit(p.status, 'publish')" title="发布" @click="transit(p, 'publish')">
                <Send :size="13" />
              </button>
              <button v-if="canTransit(p.status, 'unpublish')" title="撤回为草稿" @click="transit(p, 'unpublish')">
                <Undo2 :size="13" />
              </button>
              <button :title="p.pinned ? '取消置顶' : '置顶'" @click="togglePin(p)">
                <PinOff v-if="p.pinned" :size="13" />
                <Pin v-else :size="13" />
              </button>
              <button title="移入回收站" class="danger" @click="removePost(p)">
                <Trash2 :size="13" />
              </button>
            </span>
          </div>
        </div>
        <div v-else class="ba-empty">
          <FileText :size="38" :stroke-width="1.4" />
          <p>没有文章</p>
          <el-button type="primary" @click="newPost">写第一篇</el-button>
        </div>

        <!-- 回收站 -->
        <div class="ba-trash">
          <button class="ba-trash-head" @click="showRecycled = !showRecycled">
            <Trash2 :size="14" /> 回收站
            <span class="cnt">{{ blog.recycledPosts.length }}</span>
            <span class="arrow">{{ showRecycled ? '▾' : '▸' }}</span>
          </button>
          <div v-if="showRecycled" class="ba-trash-body">
            <div v-if="blog.recycledPosts.length === 0" class="ba-trash-empty">回收站是空的</div>
            <div v-for="p in blog.recycledPosts" :key="p.id" class="ba-trash-row">
              <span class="t-title">{{ p.title }}</span>
              <span class="t-time">删除于 {{ formatDateTime(p.deletedAt) }}</span>
              <span class="t-ops">
                <button title="恢复" @click="blog.restore(p.id)"><RotateCcw :size="13" /> 恢复</button>
                <button title="彻底删除" class="danger" @click="purgePost(p)"><X :size="13" /> 彻底删除</button>
              </span>
            </div>
          </div>
        </div>
      </template>

      <!-- ========== 分类与标签 ========== -->
      <template v-else-if="activeTab === 'taxonomy'">
        <div class="ba-two-col">
          <!-- 分类 -->
          <section class="ba-panel">
            <h3><FolderTree :size="15" /> 分类</h3>
            <div class="ba-add-row">
              <input v-model="newCat" placeholder="新分类名称" @keyup.enter="addCategory" />
              <button class="ba-primary sm" @click="addCategory"><Plus :size="14" /> 添加</button>
            </div>
            <div v-if="blog.categories.length" class="ba-list">
              <div v-for="c in blog.categories" :key="c.id" class="ba-list-item">
                <template v-if="editingCatId === c.id">
                  <input v-model="editingCatName" class="inline-edit" @keyup.enter="saveCatName(c.id)" />
                  <button class="mini ok" @click="saveCatName(c.id)">保存</button>
                  <button class="mini" @click="editingCatId = ''">取消</button>
                </template>
                <template v-else>
                  <span class="li-name">{{ c.name }}</span>
                  <span class="li-cnt">{{ postCountOfCat(c.id) }} 篇</span>
                  <span class="li-ops">
                    <button title="重命名" @click="editingCatId = c.id; editingCatName = c.name">
                      <Pencil :size="12" />
                    </button>
                    <button title="删除" class="danger" @click="removeCategory(c.id, c.name)">
                      <Trash2 :size="12" />
                    </button>
                  </span>
                </template>
              </div>
            </div>
            <div v-else class="ba-panel-empty">暂无分类</div>
          </section>

          <!-- 标签 -->
          <section class="ba-panel">
            <h3><FolderTree :size="15" /> 标签</h3>
            <div class="ba-add-row">
              <input v-model="newTag" placeholder="新标签名称" @keyup.enter="addTag" />
              <button class="ba-primary sm" @click="addTag"><Plus :size="14" /> 添加</button>
            </div>
            <div v-if="blog.tags.length" class="ba-tag-cloud">
              <span v-for="t in blog.tags" :key="t.id" class="ba-tag-chip">
                <template v-if="editingTagId === t.id">
                  <input v-model="editingTagName" class="inline-edit" @keyup.enter="saveTagName(t.id)" />
                  <button class="mini ok" @click="saveTagName(t.id)">✓</button>
                  <button class="mini" @click="editingTagId = ''">✕</button>
                </template>
                <template v-else>
                  #{{ t.name }} <em>{{ postCountOfTag(t.id) }}</em>
                  <button title="重命名" class="chip-op" @click="editingTagId = t.id; editingTagName = t.name">
                    <Pencil :size="11" />
                  </button>
                  <button title="删除" class="chip-op danger" @click="removeTag(t.id, t.name)">
                    <Trash2 :size="11" />
                  </button>
                </template>
              </span>
            </div>
            <div v-else class="ba-panel-empty">暂无标签</div>
          </section>
        </div>
      </template>

      <!-- ========== 设置 ========== -->
      <template v-else>
        <section class="ba-panel settings">
          <h3><Settings :size="15" /> 博客设置</h3>
          <div class="ba-form">
            <label>
              博客名称
              <input v-model="sName" maxlength="40" />
            </label>
            <label>
              博客描述
              <input v-model="sDesc" maxlength="120" />
            </label>
            <label>
              每页文章数
              <input v-model.number="sPageSize" type="number" min="3" max="30" />
            </label>
            <div class="ba-form-actions">
              <button class="ba-primary" @click="saveSettingsForm">保存设置</button>
              <button class="ba-ghost" @click="exportStatic">
                <Download :size="14" /> 导出静态 HTML（单文件分享）
              </button>
            </div>
            <p class="ba-form-hint">
              所有数据仅保存在本机浏览器（SQLite），清除浏览器数据会一并清除——重要文章请定期「导出静态 HTML」或使用顶部备份。
            </p>
          </div>
        </section>
      </template>
    </div>

    <!-- 全屏编辑器 -->
    <BlogEditor v-if="ui.blogEditing" />
  </div>
</template>

<style scoped>
.admin-shell {
  min-height: 100vh;
  background: var(--c-bg);
  color: var(--c-text);
}

/* 顶栏 */
.ba-top {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  background: color-mix(in srgb, var(--c-header-bg) 78%, transparent);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--c-border);
}
.ba-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  color: var(--c-text-dim);
  font-size: 13px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
}
.ba-back:hover {
  background: var(--c-primary-soft);
  color: var(--c-primary);
}
.ba-tabs {
  display: flex;
  gap: 6px;
}
.ba-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--c-text-dim);
  border-radius: 9px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.ba-tab:hover {
  color: var(--c-text);
  background: color-mix(in srgb, var(--c-text) 7%, transparent);
}
.ba-tab.active {
  background: var(--c-primary-soft);
  border-color: color-mix(in srgb, var(--c-primary) 40%, transparent);
  color: var(--c-primary);
  font-weight: 600;
}
.ba-tab .cnt {
  font-size: 11px;
  background: color-mix(in srgb, var(--c-text) 12%, transparent);
  border-radius: 999px;
  padding: 1px 7px;
}
.ba-view-site {
  margin-left: auto;
  border: 1px solid var(--c-border);
  background: var(--c-bg-soft);
  color: var(--c-text-dim);
  border-radius: 9px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
}
.ba-view-site:hover {
  border-color: var(--c-primary);
  color: var(--c-primary);
}

/* 主体 */
.ba-body {
  max-width: 1120px;
  margin: 0 auto;
  padding: 26px 24px 70px;
}

/* 工具条 */
.ba-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}
.ba-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--c-primary);
  border: 1px solid var(--c-primary);
  color: #fff;
  border-radius: 10px;
  padding: 9px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.15s;
}
.ba-primary:hover {
  filter: brightness(1.08);
}
.ba-primary.sm {
  padding: 8px 12px;
  font-size: 13px;
}
.ba-search {
  flex: 1;
  min-width: 200px;
  background: var(--c-bg-soft);
  border: 1px solid var(--c-border);
  border-radius: 10px;
  padding: 9px 14px;
  color: var(--c-text);
  font-size: 14px;
  outline: none;
}
.ba-search:focus {
  border-color: var(--c-primary);
}
.ba-select {
  background: var(--c-bg-soft);
  border: 1px solid var(--c-border);
  color: var(--c-text);
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 13px;
}
.ba-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--c-border);
  background: var(--c-bg-soft);
  color: var(--c-text-dim);
  border-radius: 10px;
  padding: 9px 14px;
  font-size: 13px;
  cursor: pointer;
}
.ba-ghost:hover {
  border-color: var(--c-primary);
  color: var(--c-primary);
}

/* 表格 */
.ba-table {
  border: 1px solid var(--c-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--c-card);
}
.ba-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 12px;
  border-bottom: 1px solid var(--c-border);
}
.ba-row:last-child {
  border-bottom: none;
}
.ba-row.head {
  background: color-mix(in srgb, var(--c-text) 5%, transparent);
  font-size: 12px;
  color: var(--c-text-dim);
  font-weight: 600;
}
.ba-row:not(.head):hover {
  background: color-mix(in srgb, var(--c-text) 5%, transparent);
}
.c-title {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  overflow: hidden;
}
.c-title b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pin-ic {
  color: #f59e0b;
  flex-shrink: 0;
}
.slug {
  font-size: 11px;
  color: var(--c-text-dim);
  flex-shrink: 0;
}
.c-status {
  width: 74px;
  flex-shrink: 0;
}
.st {
  font-style: normal;
  font-size: 12px;
  border-radius: 5px;
  padding: 2px 9px;
}
.st.draft {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.15);
}
.st.published {
  color: var(--c-primary);
  background: var(--c-primary-soft);
}
.c-cat {
  width: 90px;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--c-text-dim);
}
.c-time {
  width: 90px;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--c-text-dim);
}
.c-ops {
  display: flex;
  gap: 5px;
}
.c-ops button {
  width: 27px;
  height: 27px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--c-text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.12s;
}
.c-ops button:hover {
  background: var(--c-primary-soft);
  color: var(--c-primary);
}
.c-ops button.danger:hover {
  background: rgba(245, 108, 108, 0.15);
  color: #f56c6c;
}

/* 空态 */
.ba-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 70px 0;
  color: var(--c-text-dim);
}

/* 回收站 */
.ba-trash {
  margin-top: 26px;
  border: 1px solid var(--c-border);
  border-radius: 12px;
  overflow: hidden;
}
.ba-trash-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: color-mix(in srgb, var(--c-text) 4%, transparent);
  color: var(--c-text-dim);
  padding: 12px 16px;
  font-size: 13px;
  cursor: pointer;
}
.ba-trash-head .cnt {
  background: color-mix(in srgb, var(--c-text) 12%, transparent);
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 11px;
}
.ba-trash-head .arrow {
  margin-left: auto;
}
.ba-trash-body {
  padding: 6px 16px 12px;
}
.ba-trash-empty {
  font-size: 13px;
  color: var(--c-text-dim);
  padding: 10px 0;
}
.ba-trash-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 9px 0;
  border-bottom: 1px dashed var(--c-border);
  font-size: 13px;
}
.ba-trash-row:last-child {
  border-bottom: none;
}
.t-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.t-time {
  color: var(--c-text-dim);
  font-size: 12px;
}
.t-ops {
  display: flex;
  gap: 8px;
}
.t-ops button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--c-border);
  background: var(--c-bg-soft);
  color: var(--c-text-dim);
  border-radius: 7px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}
.t-ops button:hover {
  border-color: var(--c-primary);
  color: var(--c-primary);
}
.t-ops button.danger:hover {
  border-color: #f56c6c;
  color: #f56c6c;
}

/* 分类标签两栏 */
.ba-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.ba-panel {
  background: var(--c-card);
  border: 1px solid var(--c-border);
  border-radius: 14px;
  padding: 20px;
}
.ba-panel h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  font-size: 15px;
  color: var(--c-text);
}
.ba-add-row {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}
.ba-add-row input {
  flex: 1;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: 9px;
  padding: 8px 12px;
  color: var(--c-text);
  font-size: 13px;
  outline: none;
}
.ba-add-row input:focus {
  border-color: var(--c-primary);
}
.ba-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ba-list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 8px;
}
.ba-list-item:hover {
  background: color-mix(in srgb, var(--c-text) 6%, transparent);
}
.li-name {
  font-size: 14px;
  font-weight: 600;
}
.li-cnt {
  font-size: 12px;
  color: var(--c-text-dim);
}
.li-ops {
  margin-left: auto;
  display: flex;
  gap: 5px;
  opacity: 0;
  transition: opacity 0.15s;
}
.ba-list-item:hover .li-ops {
  opacity: 1;
}
.li-ops button {
  width: 25px;
  height: 25px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--c-text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.li-ops button:hover {
  background: var(--c-primary-soft);
  color: var(--c-primary);
}
.li-ops button.danger:hover {
  background: rgba(245, 108, 108, 0.15);
  color: #f56c6c;
}
.ba-tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ba-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--c-border);
  background: var(--c-bg-soft);
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 13px;
  color: var(--c-text);
}
.ba-tag-chip em {
  font-style: normal;
  font-size: 11px;
  color: var(--c-text-dim);
}
.chip-op {
  border: none;
  background: transparent;
  color: var(--c-text-dim);
  cursor: pointer;
  display: flex;
  padding: 2px;
  border-radius: 4px;
}
.chip-op:hover {
  color: var(--c-primary);
}
.chip-op.danger:hover {
  color: #f56c6c;
}
.inline-edit {
  background: var(--c-bg);
  border: 1px solid var(--c-primary);
  border-radius: 6px;
  padding: 4px 8px;
  color: var(--c-text);
  font-size: 13px;
  outline: none;
  width: 130px;
}
.mini {
  border: 1px solid var(--c-border);
  background: var(--c-bg-soft);
  color: var(--c-text-dim);
  border-radius: 6px;
  padding: 3px 9px;
  font-size: 12px;
  cursor: pointer;
}
.mini.ok {
  border-color: var(--c-primary);
  color: var(--c-primary);
}
.ba-panel-empty {
  font-size: 13px;
  color: var(--c-text-dim);
  padding: 16px 0;
}

/* 设置 */
.ba-panel.settings {
  max-width: 560px;
}
.ba-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ba-form label {
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: 13px;
  color: var(--c-text-dim);
}
.ba-form input {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: 9px;
  padding: 9px 12px;
  color: var(--c-text);
  font-size: 14px;
  outline: none;
}
.ba-form input:focus {
  border-color: var(--c-primary);
}
.ba-form-actions {
  display: flex;
  gap: 12px;
}
.ba-form-hint {
  font-size: 12px;
  color: var(--c-text-dim);
  line-height: 1.8;
  border-top: 1px dashed var(--c-border);
  padding-top: 14px;
  margin: 0;
}

@media (max-width: 760px) {
  .ba-two-col {
    grid-template-columns: 1fr;
  }
  .c-cat,
  .c-time,
  .slug {
    display: none;
  }
}
</style>
