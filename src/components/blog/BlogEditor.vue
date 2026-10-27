<script setup lang="ts">
/**
 * 博客编辑器：全屏沉浸式（区别于原版内嵌双栏）
 * Markdown 三视图 edit/split/preview + 工具栏 + 自动保存 + 右侧元数据栏
 */
import { ref, computed, watch, onUnmounted } from 'vue'
import { ArrowLeft, Save, Send } from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import { useBlogStore } from '@/stores/blog'
import { ui } from '@/composables/ui'
import { applyMarkdown, countChars, type MdTool } from '@/core/blogCore'
import { renderMarkdown } from '@/core/blogRender'

const blog = useBlogStore()

type ViewMode = 'edit' | 'split' | 'preview'
const viewMode = ref<ViewMode>('split')

/** 编辑中的草稿 */
const form = ref({
  id: '' as string,
  title: '',
  subtitle: '',
  slug: '',
  contentMarkdown: '',
  categoryId: '',
  tagIds: [] as string[],
  pinned: false,
  status: 'draft' as 'draft' | 'published',
})

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const autoSaveTip = ref('')
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

/* 载入既有文章或空白新稿 */
watch(
  () => ui.blogEditing,
  (target) => {
    if (!target) return
    if (target === 'new') {
      form.value = {
        id: '', title: '', subtitle: '', slug: '', contentMarkdown: '',
        categoryId: '', tagIds: [], pinned: false, status: 'draft',
      }
    } else {
      const p = blog.posts.find((x) => x.id === target)
      if (!p) return
      form.value = {
        id: p.id, title: p.title, subtitle: p.subtitle, slug: p.slug,
        contentMarkdown: p.contentMarkdown, categoryId: p.categoryId,
        tagIds: [...p.tagIds], pinned: p.pinned, status: p.status,
      }
    }
    autoSaveTip.value = ''
  },
  { immediate: true },
)

const previewHtml = computed(() => renderMarkdown(form.value.contentMarkdown))
const chars = computed(() => countChars(form.value.contentMarkdown))
const minutes = computed(() => Math.max(1, Math.ceil(chars.value / 400)))

/* ---------- 工具栏 ---------- */
function onTool(tool: MdTool) {
  const ta = textareaRef.value
  if (!ta) return
  const { text, start, end } = applyMarkdown(
    form.value.contentMarkdown,
    ta.selectionStart,
    ta.selectionEnd,
    tool,
  )
  form.value.contentMarkdown = text
  // 还原光标
  requestAnimationFrame(() => {
    ta.focus()
    ta.setSelectionRange(start, end)
  })
}

const TOOLS: Array<{ tool: MdTool; label: string; title: string }> = [
  { tool: 'bold', label: 'B', title: '加粗' },
  { tool: 'italic', label: 'I', title: '斜体' },
  { tool: 'strike', label: 'S', title: '删除线' },
  { tool: 'code', label: '</>', title: '行内代码' },
  { tool: 'h2', label: 'H2', title: '二级标题' },
  { tool: 'quote', label: '❝', title: '引用' },
  { tool: 'ul', label: '•', title: '无序列表' },
  { tool: 'ol', label: '1.', title: '有序列表' },
  { tool: 'link', label: '🔗', title: '链接' },
  { tool: 'hr', label: '—', title: '分隔线' },
]

/* ---------- 保存 / 发布 ---------- */
function collectDraft() {
  return {
    id: form.value.id || undefined,
    title: form.value.title,
    subtitle: form.value.subtitle,
    slug: form.value.slug,
    contentMarkdown: form.value.contentMarkdown,
    categoryId: form.value.categoryId,
    tagIds: form.value.tagIds,
  }
}

function doSave(publish: boolean): boolean {
  const r = blog.savePost(collectDraft(), publish)
  if (!r.ok) {
    ElMessage.error(r.errors[0])
    return false
  }
  if (r.post) form.value.id = r.post.id
  ElMessage.success(publish ? '已发布' : '已保存草稿')
  if (publish) close()
  return true
}

function close() {
  ui.blogEditing = null
}

/* ---------- 自动保存（草稿，10s 防抖） ---------- */
watch(
  () => [form.value.title, form.value.contentMarkdown],
  () => {
    if (!form.value.id || form.value.status === 'published') return
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    autoSaveTimer = setTimeout(() => {
      const r = blog.savePost(collectDraft(), false)
      if (r.ok) {
        autoSaveTip.value = `已自动保存 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
      }
    }, 10000)
  },
)

onUnmounted(() => {
  // 切走前把未保存草稿落盘
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  if (form.value.id && form.value.title.trim() && form.value.status === 'draft') {
    blog.savePost(collectDraft(), false)
  }
})

/* 标签多选 */
function toggleTag(id: string) {
  const idx = form.value.tagIds.indexOf(id)
  if (idx >= 0) form.value.tagIds.splice(idx, 1)
  else form.value.tagIds.push(id)
}
</script>

<template>
  <div class="editor-shell">
    <!-- 顶栏 -->
    <header class="be-top">
      <button class="be-back" @click="close">
        <ArrowLeft :size="16" /> 返回
      </button>
      <span class="be-status" :class="form.status">
        {{ form.status === 'published' ? '已发布' : '草稿' }}
      </span>
      <span class="be-autosave">{{ autoSaveTip }}</span>
      <span class="be-stats">{{ chars }} 字 · 约 {{ minutes }} 分钟阅读</span>
      <div class="be-actions">
        <button class="be-btn" @click="doSave(false)">
          <Save :size="14" /> 保存草稿
        </button>
        <button class="be-btn primary" @click="doSave(true)">
          <Send :size="14" /> {{ form.status === 'published' ? '保存并更新' : '发布' }}
        </button>
      </div>
    </header>

    <div class="be-body">
      <!-- 主编辑区 -->
      <div class="be-main">
        <!-- 工具栏 -->
        <div class="be-toolbar">
          <button
            v-for="t in TOOLS"
            :key="t.tool"
            type="button"
            class="be-tool"
            :title="t.title"
            @click="onTool(t.tool)"
          >
            {{ t.label }}
          </button>
          <span class="be-toolbar-gap" />
          <button
            v-for="m in (['edit', 'split', 'preview'] as ViewMode[])"
            :key="m"
            type="button"
            class="be-tool mode"
            :class="{ active: viewMode === m }"
            @click="viewMode = m"
          >
            {{ m === 'edit' ? '编辑' : m === 'split' ? '分栏' : '预览' }}
          </button>
        </div>

        <!-- 双栏 / 单栏 -->
        <div class="be-panes" :class="viewMode">
          <textarea
            v-if="viewMode !== 'preview'"
            ref="textareaRef"
            v-model="form.contentMarkdown"
            class="be-textarea"
            placeholder="从这里开始写…（支持 Markdown）"
            spellcheck="false"
          />
          <div
            v-if="viewMode !== 'edit'"
            class="be-preview md-body"
            v-html="previewHtml"
          />
        </div>
      </div>

      <!-- 右侧元数据栏 -->
      <aside class="be-side">
        <div class="be-field">
          <label>标题</label>
          <input v-model="form.title" class="be-input lg" placeholder="文章标题（必填）" maxlength="100" />
        </div>
        <div class="be-field">
          <label>副标题</label>
          <input v-model="form.subtitle" class="be-input" placeholder="可选" maxlength="120" />
        </div>
        <div class="be-field">
          <label>slug（URL 标识）</label>
          <input v-model="form.slug" class="be-input" placeholder="留自动生成，支持中文" />
        </div>
        <div class="be-field">
          <label>分类</label>
          <select v-model="form.categoryId" class="be-select">
            <option value="">未分类</option>
            <option v-for="c in blog.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="be-field">
          <label>标签</label>
          <div v-if="blog.tags.length" class="be-tags">
            <button
              v-for="t in blog.tags"
              :key="t.id"
              type="button"
              class="be-tag"
              :class="{ on: form.tagIds.includes(t.id) }"
              @click="toggleTag(t.id)"
            >
              #{{ t.name }}
            </button>
          </div>
          <div v-else class="be-side-hint">先到「分类与标签」创建标签</div>
        </div>
        <div class="be-field">
          <label>置顶</label>
          <label class="be-switch">
            <input v-model="form.pinned" type="checkbox" />
            <span>在列表最前显示</span>
          </label>
        </div>
        <div class="be-side-hint">
          正文以 Markdown 书写；发布前会校验标题 / slug / 正文。
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.editor-shell {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: var(--c-bg);
  display: flex;
  flex-direction: column;
}

/* 顶栏 */
.be-top {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 22px;
  background: var(--c-header-bg);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--c-border);
  flex-shrink: 0;
}
.be-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  color: var(--c-text-dim);
  font-size: 14px;
  cursor: pointer;
  padding: 7px 10px;
  border-radius: 8px;
}
.be-back:hover {
  background: var(--c-primary-soft);
  color: var(--c-primary);
}
.be-status {
  font-size: 12px;
  border-radius: 5px;
  padding: 3px 10px;
}
.be-status.draft {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.15);
}
.be-status.published {
  color: var(--c-primary);
  background: var(--c-primary-soft);
}
.be-autosave {
  font-size: 12px;
  color: var(--c-primary);
}
.be-stats {
  font-size: 12px;
  color: var(--c-text-dim);
  margin-left: auto;
}
.be-actions {
  display: flex;
  gap: 10px;
}
.be-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--c-border);
  background: var(--c-bg-soft);
  color: var(--c-text);
  border-radius: 10px;
  padding: 9px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}
.be-btn:hover {
  border-color: var(--c-primary);
  color: var(--c-primary);
}
.be-btn.primary {
  background: var(--c-primary);
  border-color: var(--c-primary);
  color: #fff;
  font-weight: 600;
}
.be-btn.primary:hover {
  filter: brightness(1.08);
}

/* 主体 */
.be-body {
  flex: 1;
  display: flex;
  min-height: 0;
}
.be-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* 工具栏（sticky） */
.be-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--c-border);
  background: color-mix(in srgb, var(--c-bg-soft) 70%, transparent);
  flex-shrink: 0;
  overflow-x: auto;
}
.be-tool {
  min-width: 32px;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--c-text-dim);
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  padding: 0 8px;
  transition: all 0.12s;
}
.be-tool:hover {
  background: var(--c-primary-soft);
  color: var(--c-primary);
}
.be-tool.mode {
  font-size: 12px;
}
.be-tool.mode.active {
  background: var(--c-primary);
  color: #fff;
}
.be-toolbar-gap {
  width: 1px;
  height: 18px;
  background: var(--c-border);
  margin: 0 6px;
}

/* 分栏 */
.be-panes {
  flex: 1;
  display: flex;
  min-height: 0;
}
.be-textarea {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  color: var(--c-text);
  padding: 24px 28px;
  font-family: 'SFMono-Regular', Consolas, 'Microsoft YaHei', monospace;
  font-size: 15px;
  line-height: 1.8;
}
.be-textarea::placeholder {
  color: var(--c-text-dim);
}
.be-panes.split .be-textarea {
  border-right: 1px solid var(--c-border);
}
.be-panes.split .be-preview {
  flex: 1;
  min-width: 0;
}
.be-panes.edit .be-textarea,
.be-panes.preview .be-preview {
  flex: 1;
}
.be-preview {
  padding: 24px 32px;
  overflow-y: auto;
  color: var(--c-text);
}
.be-panes.edit .be-preview,
.be-panes.preview .be-textarea {
  display: none;
}

/* 右侧元数据栏 */
.be-side {
  width: 280px;
  flex-shrink: 0;
  border-left: 1px solid var(--c-border);
  background: color-mix(in srgb, var(--c-bg-soft) 55%, transparent);
  padding: 20px 18px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.be-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.be-field label {
  font-size: 12px;
  font-weight: 600;
  color: var(--c-text-dim);
}
.be-input,
.be-select {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: 9px;
  padding: 9px 12px;
  color: var(--c-text);
  font-size: 14px;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}
.be-input:focus,
.be-select:focus {
  border-color: var(--c-primary);
}
.be-input.lg {
  font-size: 16px;
  font-weight: 700;
}
.be-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.be-tag {
  border: 1px solid var(--c-border);
  background: var(--c-bg);
  color: var(--c-text-dim);
  border-radius: 999px;
  padding: 4px 11px;
  font-size: 12px;
  cursor: pointer;
}
.be-tag.on {
  background: var(--c-primary);
  border-color: var(--c-primary);
  color: #fff;
}
.be-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--c-text);
  cursor: pointer;
}
.be-side-hint {
  font-size: 12px;
  color: var(--c-text-dim);
  line-height: 1.7;
}

@media (max-width: 900px) {
  .be-side {
    display: none;
  }
  .be-stats {
    display: none;
  }
}
</style>
