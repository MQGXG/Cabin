<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Camera, History, Trash2, RotateCcw } from 'lucide-vue-next'
import { useCabinStore } from '@/stores/cabin'
import { ui } from '@/composables/ui'

const store = useCabinStore()
const replaceMode = ref(false)

watch(
  () => ui.backupOpen,
  (open) => {
    if (!open) return
    replaceMode.value = false
  },
)

/** 时间格式化 */
function fmt(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

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

async function onCaptureNow() {
  const ok = await store.captureBackup('manual')
  ElMessage.success(ok ? '已存档' : '存档失败')
}

async function onRestore(id: string, createdAt: number) {
  const sure = await ElMessageBox.confirm(
    `恢复到 ${fmt(createdAt)} 的存档？当前数据会先自动存一份保护现场。`,
    '恢复存档',
    { type: 'warning', confirmButtonText: '恢复', cancelButtonText: '取消' },
  ).catch(() => false)
  if (!sure) return
  const ok = await store.restoreBackup(id)
  ElMessage.success(ok ? '已恢复' : '恢复失败：存档数据损坏')
}

async function onDeleteBackup(id: string) {
  const sure = await ElMessageBox.confirm('删除这份存档？', '删除', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  }).catch(() => false)
  if (sure) await store.removeBackup(id)
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

      <!-- 版本历史（自动存档） -->
      <el-form-item label="版本历史（数据变更后每 5 分钟自动存一份，同日自动档只存一次，保留 10 份）">
        <div class="history-box">
          <div class="history-head">
            <el-button size="small" type="primary" plain @click="onCaptureNow">
              <Camera :size="13" /> 立即存档
            </el-button>
            <span class="history-count">共 {{ store.backups.length }} 份</span>
          </div>
          <div v-if="store.backups.length === 0" class="history-empty">
            <History :size="16" /> 暂无存档——改动几次数据后会自动生成
          </div>
          <div v-for="b in store.backups" :key="b.id" class="history-row">
            <span class="kind-tag" :class="b.kind">{{ b.kind === 'auto' ? '自动' : '手动' }}</span>
            <span class="history-time">{{ fmt(b.createdAt) }}</span>
            <span class="history-actions">
              <button title="恢复到此存档" @click="onRestore(b.id, b.createdAt)"><RotateCcw :size="13" /></button>
              <button title="删除存档" @click="onDeleteBackup(b.id)"><Trash2 :size="13" /></button>
            </span>
          </div>
        </div>
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

/* 版本历史 */
.history-box {
  width: 100%;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.history-count {
  font-size: 12px;
  color: var(--c-text-dim);
}
.history-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--c-text-dim);
  font-size: 12px;
  padding: 6px 0;
}
.history-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 7px;
  transition: background 0.15s;
}
.history-row:hover {
  background: color-mix(in srgb, var(--c-text) 7%, transparent);
}
.kind-tag {
  font-size: 11px;
  border-radius: 4px;
  padding: 1px 7px;
  flex-shrink: 0;
}
.kind-tag.auto {
  background: var(--c-primary-soft);
  color: var(--c-primary);
}
.kind-tag.manual {
  background: color-mix(in srgb, var(--c-text) 12%, transparent);
  color: var(--c-text-dim);
}
.history-time {
  flex: 1;
  font-size: 13px;
  color: var(--c-text);
  font-variant-numeric: tabular-nums;
}
.history-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}
.history-row:hover .history-actions {
  opacity: 1;
}
.history-actions button {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: color-mix(in srgb, var(--c-bg) 75%, transparent);
  color: var(--c-text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.history-actions button:hover {
  background: var(--c-primary);
  color: #fff;
}
</style>
