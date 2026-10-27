<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCabinStore } from '@/stores/cabin'
import { ui } from '@/composables/ui'

const store = useCabinStore()
const replaceMode = ref(false)
const pageSize = ref(18)

watch(
  () => ui.backupOpen,
  (open) => {
    if (!open) return
    pageSize.value = store.settings.pageSize
    replaceMode.value = false
  },
)

async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const text = await file.text()
  if (replaceMode.value) {
    const sure = await ElMessageBox.confirm(
      '整库替换将覆盖本地全部标签与网站数据，且不可撤销，确定继续？',
      '危险操作',
      { type: 'warning', confirmButtonText: '覆盖', cancelButtonText: '取消' },
    ).catch(() => false)
    if (!sure) return
  }
  const r = await store.importBackup(text, replaceMode.value)
  if (!r.ok) return void ElMessage.error(r.msg)
  const res = r.result!
  ElMessage.success(`恢复完成：新增 ${res.sitesAdded} 个网站，跳过 ${res.sitesSkipped} 个重复`)
  input.value = ''
}

async function onPageSizeChange(v: number) {
  await store.patchSetting('pageSize', Number(v) || 18)
  ElMessage.success('已保存')
}
</script>

<template>
  <el-dialog v-model="ui.backupOpen" title="备份与恢复" width="520px" append-to-body>
    <el-form label-position="top">
      <el-form-item label="导出">
        <div class="btn-row">
          <el-button @click="store.exportBackup()">导出 JSON 备份</el-button>
          <el-button @click="store.exportDbFile()">导出 SQLite 数据库（.db）</el-button>
        </div>
      </el-form-item>
      <el-form-item label="导入 JSON 备份">
        <div class="btn-row">
          <el-checkbox v-model="replaceMode">整库替换（覆盖模式）</el-checkbox>
          <input type="file" accept=".json" @change="onImportFile" />
        </div>
        <div class="hint">默认合并模式：按域名去重后新增；勾选后为整库替换（危险）。</div>
      </el-form-item>
      <el-form-item label="每页显示网站数">
        <el-input-number v-model="pageSize" :min="6" :max="200" :step="6" @change="onPageSizeChange" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="ui.backupOpen = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.btn-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  width: 100%;
}
.hint {
  font-size: 12px;
  color: var(--c-text-dim);
  margin-top: 4px;
}
</style>
