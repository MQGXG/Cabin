<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useCabinStore } from '@/stores/cabin'
import { ui } from '@/composables/ui'

const store = useCabinStore()
const pageSize = ref(18)
const followSystem = ref(true)

watch(
  () => ui.settingsOpen,
  (open) => {
    if (!open) return
    pageSize.value = store.settings.pageSize
    followSystem.value = store.settings.themeFollowSystem
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
</script>

<template>
  <el-dialog v-model="ui.settingsOpen" title="设置" width="480px" append-to-body>
    <el-form label-position="top">
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
    </el-form>
    <template #footer>
      <el-button @click="ui.settingsOpen = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.theme-row {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hint {
  font-size: 12px;
  color: var(--c-text-dim);
}
</style>
