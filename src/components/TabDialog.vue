<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useCabinStore } from '@/stores/cabin'
import { ui } from '@/composables/ui'

const store = useCabinStore()

const ICONS = ['⭐', '🛠️', '📚', '🎮', '📁', '🎬', '💼', '🏠', '💡', '🚀', '🎨', '🧰']
const form = ref({ name: '', icon: '📁', isDefault: false })
const isEdit = computed(() => !!ui.tabEditing)

watch(
  () => ui.tabDialogOpen,
  (open) => {
    if (!open) return
    if (ui.tabEditing) {
      form.value = { name: ui.tabEditing.name, icon: ui.tabEditing.icon, isDefault: ui.tabEditing.isDefault }
    } else {
      form.value = { name: '', icon: '📁', isDefault: false }
    }
  },
)

async function submit() {
  if (!form.value.name.trim()) return void ElMessage.warning('请填写标签名称')
  if (isEdit.value && ui.tabEditing) {
    await store.updateTab(ui.tabEditing.id, { ...form.value })
    ElMessage.success('标签已更新')
  } else {
    await store.createTab({ ...form.value })
    ElMessage.success('标签已创建')
  }
  ui.tabDialogOpen = false
}

/** 输入的图标自动过滤为单字符 */
function onIconInput() {
  form.value.icon = Array.from(form.value.icon.trim())[0] ?? '📁'
}
</script>

<template>
  <el-dialog v-model="ui.tabDialogOpen" :title="isEdit ? '编辑标签' : '创建标签'" width="420px" append-to-body>
    <el-form label-position="top">
      <el-form-item label="名称" required>
        <el-input v-model="form.name" placeholder="如：影视 / 社交 / 收藏" maxlength="16" />
      </el-form-item>
      <el-form-item label="图标">
        <div class="icon-row">
          <el-input
            class="icon-input"
            :model-value="form.icon"
            @update:model-value="onIconInput"
            maxlength="4"
          />
          <button
            v-for="ic in ICONS"
            :key="ic"
            type="button"
            class="icon-pick"
            :class="{ picked: form.icon === ic }"
            @click="form.icon = ic"
          >
            {{ ic }}
          </button>
        </div>
      </el-form-item>
      <el-form-item>
        <el-checkbox v-model="form.isDefault">设为默认标签（启动时打开）</el-checkbox>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="ui.tabDialogOpen = false">取消</el-button>
      <el-button type="primary" @click="submit">{{ isEdit ? '保存' : '创建' }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.icon-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  width: 100%;
}
.icon-input {
  width: 64px;
}
.icon-pick {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--c-border);
  background: var(--c-bg);
  cursor: pointer;
  font-size: 16px;
  transition: all 0.15s;
}
.icon-pick:hover,
.icon-pick.picked {
  border-color: var(--c-primary);
  background: var(--c-primary-soft);
}
</style>
