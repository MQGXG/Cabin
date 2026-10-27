<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useCabinStore } from '@/stores/cabin'
import { ui } from '@/composables/ui'
import { parseBookmarksHtml, parseCsv } from '@/core/importCore'
import type { CsvSiteRow } from '@/types'

const store = useCabinStore()

const targetTabId = ref('')
const mode = ref<'bookmarks' | 'csv'>('bookmarks')
const rawText = ref('')
const selectedRows = ref<Set<number>>(new Set())

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

async function onFilePick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  rawText.value = await file.text()
  input.value = ''
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
  <el-dialog v-model="ui.importOpen" title="批量导入" width="640px" append-to-body>
    <el-form label-position="top">
      <el-form-item label="导入来源">
        <el-radio-group v-model="mode">
          <el-radio value="bookmarks">浏览器书签 HTML</el-radio>
          <el-radio value="csv">CSV 文件</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item :label="mode === 'bookmarks' ? '书签导出文件（Chrome/Edge：书签管理器 → 导出书签）' : 'CSV 文件（表头 name,url[,description]）'">
        <input type="file" accept=".html,.htm,.csv,.txt" class="file-pick" @change="onFilePick" />
      </el-form-item>
      <el-form-item label="导入到标签">
        <el-select v-model="targetTabId" style="width: 100%">
          <el-option v-for="t in store.visibleTabs" :key="t.id" :label="`${t.icon} ${t.name}`" :value="t.id" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="parsedRows.length">
        <div class="preview-box">
          <div class="preview-head">
            <span>识别到 {{ parsedRows.length }} 个网站</span>
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
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="ui.importOpen = false">取消</el-button>
      <el-button type="primary" :disabled="parsedRows.length === 0" @click="submit">导入 {{ selectedRows.size }} 个</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.file-pick {
  color: var(--c-text);
}
.preview-box {
  border: 1px solid var(--c-border);
  border-radius: 10px;
  width: 100%;
  padding: 10px 12px;
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
