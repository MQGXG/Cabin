<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Bookmark, FileSpreadsheet, FileUp } from 'lucide-vue-next'
import { useCabinStore } from '@/stores/cabin'
import { ui } from '@/composables/ui'
import { parseBookmarksHtml, parseCsv } from '@/core/importCore'
import AppIcon from '@/components/AppIcon.vue'
import type { CsvSiteRow } from '@/types'

const store = useCabinStore()

const targetTabId = ref('')
const mode = ref<'bookmarks' | 'csv'>('bookmarks')
const rawText = ref('')
const fileName = ref('')
const selectedRows = ref<Set<number>>(new Set())
/** 拖拽悬停高亮（'bookmarks' | 'csv' | null） */
const dragOver = ref<string | null>(null)
const bookmarkFile = ref<HTMLInputElement | null>(null)
const csvFile = ref<HTMLInputElement | null>(null)

const parsedRows = computed<CsvSiteRow[]>(() => {
  if (mode.value === 'bookmarks') return parseBookmarksHtml(rawText.value)
  return parseCsv(rawText.value)
})

watch(
  () => ui.importOpen,
  (open) => {
    if (!open) return
    targetTabId.value = store.activeTabId || store.visibleTabs[0]?.id || ''
    rawText.value = ''
    fileName.value = ''
    mode.value = 'bookmarks'
    selectAll()
  },
)

watch([parsedRows, mode], () => selectAll())

function selectAll() {
  selectedRows.value = new Set(parsedRows.value.map((_, i) => i))
}

function toggleRow(i: number) {
  const s = new Set(selectedRows.value)
  if (s.has(i)) s.delete(i)
  else s.add(i)
  selectedRows.value = s
}

/** 读取文件（点击选择与拖拽共用） */
async function loadFile(file: File, fileMode: 'bookmarks' | 'csv') {
  mode.value = fileMode
  fileName.value = file.name
  rawText.value = await file.text()
  if (parsedRows.value.length === 0) {
    ElMessage.warning('未能从文件中解析出网站，请检查文件格式')
  }
}

async function onFilePick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await loadFile(file, file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'bookmarks')
  input.value = ''
}

/** 拖拽导入：拖入文件时按扩展名识别模式，落到对应卡片上 */
function onDragOver(kind: string) {
  dragOver.value = kind
}
function onDragLeave() {
  dragOver.value = null
}
async function onDrop(kind: 'bookmarks' | 'csv', e: DragEvent) {
  dragOver.value = null
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  const isCsv = file.name.toLowerCase().endsWith('.csv')
  if ((kind === 'csv') !== isCsv) {
    ElMessage.warning(`请拖入 ${kind === 'csv' ? '.csv 文件' : '浏览器书签 HTML 文件'}`)
    return
  }
  await loadFile(file, kind)
}

async function submit() {
  const rows = parsedRows.value.filter((_, i) => selectedRows.value.has(i))
  if (rows.length === 0) return void ElMessage.warning('没有可导入的网站')
  if (!targetTabId.value) return void ElMessage.warning('请选择目标标签')
  const r = await store.bulkAddSites(targetTabId.value, rows)
  ElMessage.success(`导入 ${r.sitesAdded} 个，跳过 ${r.sitesSkipped} 个重复`)
  ui.importOpen = false
}
</script>

<template>
  <el-dialog v-model="ui.importOpen" title="批量导入网站" width="660px" append-to-body>
    <!-- 导入目标标签（原版样式条） -->
    <div class="target-bar">
      <Bookmark :size="15" />
      <span>导入到标签：</span>
      <el-select v-model="targetTabId" size="small" class="target-select">
        <el-option v-for="t in store.visibleTabs" :key="t.id" :label="t.name" :value="t.id">
          <span class="tab-option"><AppIcon :name="t.icon" :size="14" /> {{ t.name }}</span>
        </el-option>
      </el-select>
    </div>

    <div class="import-body">
      <p class="import-hint">选择导入方式（点击选择文件，或将文件拖入卡片）：</p>

      <!-- 两张方式卡片：可点击 + 可拖拽 -->
      <div class="method-grid">
        <button
          type="button"
          class="method-card"
          :class="{ picked: mode === 'bookmarks', over: dragOver === 'bookmarks' }"
          @click="bookmarkFile?.click()"
          @dragover.prevent="onDragOver('bookmarks')"
          @dragleave="onDragLeave"
          @drop.prevent="onDrop('bookmarks', $event)"
        >
          <span class="method-icon"><Bookmark :size="24" :stroke-width="1.7" /></span>
          <span class="method-title">浏览器书签</span>
          <span class="method-sub">导入 HTML 书签文件 / 拖入</span>
        </button>
        <button
          type="button"
          class="method-card"
          :class="{ picked: mode === 'csv', over: dragOver === 'csv' }"
          @click="csvFile?.click()"
          @dragover.prevent="onDragOver('csv')"
          @dragleave="onDragLeave"
          @drop.prevent="onDrop('csv', $event)"
        >
          <span class="method-icon accent"><FileSpreadsheet :size="24" :stroke-width="1.7" /></span>
          <span class="method-title">CSV 文件</span>
          <span class="method-sub">导入 CSV 格式数据 / 拖入</span>
        </button>
      </div>

      <input ref="bookmarkFile" type="file" accept=".html,.htm" class="hidden-input" @change="onFilePick" />
      <input ref="csvFile" type="file" accept=".csv,.txt" class="hidden-input" @change="onFilePick" />

      <!-- 已选文件 -->
      <div v-if="fileName" class="file-chip">
        <FileUp :size="14" />
        <span>{{ fileName }}</span>
        <span class="file-count">识别 {{ parsedRows.length }} 个网站</span>
      </div>

      <!-- 解析预览 -->
      <div v-if="parsedRows.length" class="preview-box">
        <div class="preview-head">
          <span>勾选要导入的网站</span>
          <el-button size="small" text type="primary" @click="selectAll">全选</el-button>
        </div>
        <div class="preview-list">
          <el-checkbox
            v-for="(row, i) in parsedRows"
            :key="i"
            :model-value="selectedRows.has(i)"
            class="preview-item"
            @change="toggleRow(i)"
          >
            {{ row.name }} — <span class="url">{{ row.url }}</span>
          </el-checkbox>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="ui.importOpen = false">取消</el-button>
      <el-button type="primary" :disabled="parsedRows.length === 0" @click="submit">
        导入 {{ selectedRows.size }} 个
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.target-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  margin: -12px -16px 16px;
  background: var(--c-bg);
  border-bottom: 1px solid var(--c-border);
  color: var(--c-text);
  font-size: 14px;
  font-weight: 600;
}
.target-select {
  width: 160px;
}
.import-hint {
  color: var(--c-text-dim);
  font-size: 13px;
  margin-bottom: 12px;
}
/* 方式卡片 */
.method-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.method-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 20px 18px;
  border: 1.5px solid var(--c-border);
  border-radius: 14px;
  background: var(--c-bg);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}
.method-card:hover {
  border-color: color-mix(in srgb, var(--c-primary) 55%, var(--c-border));
  transform: translateY(-2px);
}
.method-card.picked {
  border-color: var(--c-primary);
  background: var(--c-primary-soft);
}
.method-card.over {
  border-color: var(--c-primary);
  background: var(--c-primary-soft);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-primary) 25%, transparent);
}
.method-icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--c-primary) 14%, transparent);
  color: var(--c-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}
.method-icon.accent {
  background: color-mix(in srgb, #22c58b 14%, transparent);
}
.method-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--c-text);
}
.method-sub {
  font-size: 12px;
  color: var(--c-text-dim);
}
.hidden-input {
  display: none;
}
.tab-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
/* 已选文件提示 */
.file-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding: 8px 12px;
  border-radius: 9px;
  background: var(--c-primary-soft);
  color: var(--c-primary);
  font-size: 13px;
}
.file-count {
  margin-left: auto;
  font-weight: 700;
}
/* 预览 */
.preview-box {
  border: 1px solid var(--c-border);
  border-radius: 10px;
  padding: 10px 12px;
  margin-top: 14px;
}
.preview-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--c-text);
  margin-bottom: 6px;
}
.preview-list {
  max-height: 260px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.preview-item {
  margin-right: 0;
}
.url {
  color: var(--c-text-dim);
  font-size: 12px;
}
</style>
