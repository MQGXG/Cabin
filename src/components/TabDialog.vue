<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useCabinStore } from '@/stores/cabin'
import { ui } from '@/composables/ui'
import AppIcon from '@/components/AppIcon.vue'
import { ICON_CHOICES } from '@/core/iconSet'

const store = useCabinStore()

const form = ref({ name: '', icon: 'lucide:Folder', isDefault: false })
const isEdit = computed(() => !!ui.tabEditing)

/** 旧数据的 emoji 图标（不在精选集里）单独展示，便于平滑保留 */
const legacyIcon = computed(() =>
  form.value.icon && !form.value.icon.startsWith('lucide:') ? form.value.icon : '',
)

watch(
  () => ui.tabDialogOpen,
  (open) => {
    if (!open) return
    if (ui.tabEditing) {
      form.value = {
        name: ui.tabEditing.name,
        icon: ui.tabEditing.icon,
        isDefault: ui.tabEditing.isDefault,
      }
    } else {
      form.value = { name: '', icon: 'lucide:Folder', isDefault: false }
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
</script>

<template>
  <el-dialog v-model="ui.tabDialogOpen" :title="isEdit ? '编辑标签' : '创建标签'" width="440px" append-to-body>
    <el-form label-position="top">
      <el-form-item label="名称" required>
        <el-input v-model="form.name" placeholder="如：影视 / 社交 / 收藏" maxlength="16" />
      </el-form-item>
      <el-form-item label="图标">
        <div class="icon-grid">
          <!-- 旧 emoji 图标（编辑时保留选项） -->
          <button
            v-if="legacyIcon"
            type="button"
            class="icon-pick"
            :class="{ picked: form.icon === legacyIcon }"
            title="保留原图标"
            @click="form.icon = legacyIcon"
          >
            {{ legacyIcon }}
          </button>
          <button
            v-for="ic in ICON_CHOICES"
            :key="ic"
            type="button"
            class="icon-pick"
            :class="{ picked: form.icon === `lucide:${ic}` }"
            :title="ic"
            @click="form.icon = `lucide:${ic}`"
          >
            <AppIcon :name="`lucide:${ic}`" :size="17" />
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
.icon-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  width: 100%;
}
.icon-pick {
  height: 42px;
  border-radius: 9px;
  border: 1.5px solid var(--c-border);
  background: var(--c-bg);
  color: var(--c-text-dim);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: all 0.15s;
}
.icon-pick:hover {
  border-color: color-mix(in srgb, var(--c-primary) 60%, var(--c-border));
  color: var(--c-text);
}
.icon-pick.picked {
  border-color: var(--c-primary);
  background: var(--c-primary-soft);
  color: var(--c-primary);
}
</style>
