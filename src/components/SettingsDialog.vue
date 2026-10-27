<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Play, Square, XCircle } from 'lucide-vue-next'
import { useCabinStore } from '@/stores/cabin'
import { ui } from '@/composables/ui'
import EngineRow from '@/components/EngineRow.vue'

const store = useCabinStore()
const pageSize = ref(18)
const followSystem = ref(true)

/** 新增引擎表单 */
const newEngine = ref({ name: '', url: '' })
/** 编辑中的引擎 URL（防抖持久化用） */
const editingUrl = ref<Record<string, string>>({})

watch(
  () => ui.settingsOpen,
  (open) => {
    if (!open) return
    pageSize.value = store.settings.pageSize
    followSystem.value = store.settings.themeFollowSystem
    newEngine.value = { name: '', url: '' }
    editingUrl.value = Object.fromEntries(store.engines.map((e) => [e.id, e.url]))
  },
)

async function onPageSizeChange(v: number) {
  await store.patchSetting('pageSize', Number(v) || 18)
  ElMessage.success('已保存')
}

async function onFollowToggle(v: boolean) {
  await store.patchSetting('themeFollowSystem', v)
  ElMessage.success(v ? '主题将跟随系统' : '已改为手动切换')
}

/* ---------- 引擎管理 ---------- */
function onSetDefault(id: string) {
  store.setEngineDefault(id)
}

function onToggleDisabled(id: string, disabled: boolean) {
  const transferredTo = store.toggleEngineDisabled(id, disabled)
  if (disabled && transferredTo) {
    ElMessage.info(`已禁用，默认引擎转移为「${transferredTo}」`)
  }
}

function onUrlBlur(id: string) {
  const url = editingUrl.value[id]?.trim() ?? ''
  const r = store.updateEngine(id, { url })
  if (!r.ok) ElMessage.warning(r.msg)
}

/** EngineRow 编辑 URL（失焦时才持久化） */
function onUpdateUrl(id: string, url: string) {
  editingUrl.value[id] = url
}

function onAddEngine() {
  const r = store.addEngine(newEngine.value.name, newEngine.value.url)
  if (!r.ok) return void ElMessage.warning(r.msg)
  ElMessage.success(`已添加「${newEngine.value.name.trim()}」`)
  newEngine.value = { name: '', url: '' }
}

async function onRemoveEngine(id: string, name: string) {
  const sure = await ElMessageBox.confirm(`删除搜索引擎「${name}」？`, '删除', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  }).catch(() => false)
  if (!sure) return
  const { transferredTo, blocked } = store.removeEngine(id)
  if (blocked) return void ElMessage.warning('内置引擎不可删除（可禁用）')
  ElMessage.success(transferredTo ? `已删除，默认引擎转移为「${transferredTo}」` : '已删除')
}

/* ---------- 断链检测 ---------- */
function onStartCheck() {
  void store.startLinkCheck().then(() => {
    const { total, invalidCount } = store.linkCheck
    if (total > 0) {
      ElMessage.success(invalidCount === 0 ? `检测完成：${total} 个全部有效` : `检测完成：${invalidCount} 个失效`)
    }
  })
}
function onCancelCheck() {
  store.cancelLinkCheck()
}
</script>

<template>
  <el-dialog v-model="ui.settingsOpen" title="设置" width="620px" append-to-body>
    <el-form label-position="top">
      <!-- 主题与分页 -->
      <div class="settings-grid">
        <el-form-item label="每页显示网站数">
          <el-input-number v-model="pageSize" :min="6" :max="200" :step="6" @change="onPageSizeChange" />
        </el-form-item>
        <el-form-item label="主题">
          <div class="theme-row">
            <el-switch v-model="followSystem" active-text="跟随系统（暗/亮随操作系统）" @change="onFollowToggle" />
            <div class="hint">
              当前生效：<b>{{ store.settings.theme === 'dark' ? '暗色' : '亮色' }}</b>
              —— 顶部 ☀️/🌙 按钮可随时手动切换（会自动关闭“跟随系统”）
            </div>
          </div>
        </el-form-item>
      </div>

      <!-- 搜索引擎 -->
      <el-form-item label="搜索引擎（回车搜索；“本地搜索”为站内过滤）">
        <div class="engine-box">
          <EngineRow
            v-for="e in store.engines"
            :key="e.id"
            :engine="e"
            :current-id="store.currentEngine.id"
            :url-value="editingUrl[e.id] ?? ''"
            @set-default="onSetDefault"
            @toggle="onToggleDisabled"
            @url-blur="onUrlBlur"
            @update-url="onUpdateUrl"
            @remove="onRemoveEngine"
          />
          <!-- 新增 -->
          <div class="engine-row add-row">
            <el-input v-model="newEngine.name" placeholder="引擎名称" class="engine-name" maxlength="12" />
            <el-input v-model="newEngine.url" placeholder="URL（含 %s 占位，如 https://x.com/search?q=%s）" @keyup.enter="onAddEngine" />
            <el-button type="primary" size="small" @click="onAddEngine">
              <Plus :size="13" /> 添加
            </el-button>
          </div>
        </div>
      </el-form-item>

      <!-- 断链检测 -->
      <el-form-item label="断链检测（批量校验书签可访问性，需联网）">
        <div class="check-box">
          <div class="check-actions">
            <el-button v-if="!store.linkCheck.running" type="primary" @click="onStartCheck">
              <Play :size="13" /> 开始检测
            </el-button>
            <el-button v-else @click="onCancelCheck">
              <Square :size="13" /> 取消
            </el-button>
            <span v-if="store.linkCheck.running" class="check-progress">
              {{ store.linkCheck.current }} / {{ store.linkCheck.total }}
              <span class="bad" v-if="store.linkCheck.invalidCount > 0">，失效 {{ store.linkCheck.invalidCount }}</span>
            </span>
          </div>
          <el-progress
            v-if="store.linkCheck.running && store.linkCheck.total > 0"
            :percentage="Math.round((store.linkCheck.current / store.linkCheck.total) * 100)"
            :stroke-width="8"
            class="check-bar"
          />
          <div class="hint" v-if="!store.linkCheck.running">
            检测结果会标记在卡片上（失效红点），可在工具条用
            <XCircle :size="12" class="inline-ic" /> 仅看失效。
            每个地址间隔 500ms 依次请求（HEAD → GET 降级），检测中请勿关闭页面。
          </div>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="ui.settingsOpen = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 0 24px;
}
.theme-row {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hint {
  font-size: 12px;
  color: var(--c-text-dim);
  line-height: 1.7;
}
.inline-ic {
  vertical-align: -2px;
  color: #f56c6c;
}

/* 引擎管理 */
.engine-box {
  width: 100%;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.engine-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.add-row {
  border-top: 1px dashed var(--c-border);
  padding-top: 10px;
}
.engine-name {
  width: 110px;
  flex-shrink: 0;
}

/* 断链检测 */
.check-box {
  width: 100%;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.check-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.check-progress {
  font-size: 13px;
  color: var(--c-text);
}
.check-progress .bad {
  color: #f56c6c;
}
.check-bar {
  width: 100%;
}
</style>
