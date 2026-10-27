<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useCabinStore } from '@/stores/cabin'
import { ui } from '@/composables/ui'
import { suggestFavicon, normalizeUrl } from '@/core/navCore'

const store = useCabinStore()

const form = ref({ name: '', url: '', description: '', favicon: '', tabId: '' })
const autoIcon = ref(true)

const isEdit = computed(() => !!ui.siteEditing)

watch(
  () => ui.siteDialogOpen,
  (open) => {
    if (!open) return
    if (ui.siteEditing) {
      form.value = {
        name: ui.siteEditing.name,
        url: ui.siteEditing.url,
        description: ui.siteEditing.description,
        favicon: ui.siteEditing.favicon,
        tabId: ui.siteEditing.tabId,
      }
      autoIcon.value = !!ui.siteEditing.favicon
    } else {
      form.value = { name: '', url: '', description: '', favicon: '', tabId: store.activeTabId || store.visibleTabs[0]?.id || '' }
      autoIcon.value = true
    }
  },
)

/** URL 变化时自动补图标（关闭自动图标则跳过） */
watch(
  () => form.value.url,
  (url) => {
    if (!isEdit.value && autoIcon.value) form.value.favicon = suggestFavicon(url)
  },
)

async function submit() {
  if (!form.value.name.trim()) return void ElMessage.warning('请填写名称')
  const url = normalizeUrl(form.value.url)
  if (!url) return void ElMessage.warning('URL 不合法')
  if (!form.value.tabId) return void ElMessage.warning('请选择标签')

  const payload = {
    ...form.value,
    url,
    favicon: autoIcon.value ? suggestFavicon(url) : form.value.favicon,
  }
  if (isEdit.value && ui.siteEditing) {
    const r = await store.updateSite(ui.siteEditing.id, payload)
    if (!r.ok) return void ElMessage.error(r.msg)
    ElMessage.success('已保存')
  } else {
    // 打开的标签页视图跟随当前激活标签
    const r = await store.createSite(payload)
    if (!r.ok) return void ElMessage.error(r.msg)
    ElMessage.success('已添加')
  }
  ui.siteDialogOpen = false
}
</script>

<template>
  <el-dialog v-model="ui.siteDialogOpen" :title="isEdit ? '编辑网站' : '添加网站'" width="480px" append-to-body>
    <el-form label-position="top">
      <el-form-item label="标签分类">
        <el-select v-model="form.tabId" style="width: 100%">
          <el-option v-for="t in store.visibleTabs" :key="t.id" :label="`${t.icon} ${t.name}`" :value="t.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="名称" required>
        <el-input v-model="form.name" placeholder="网站名称" maxlength="100" />
      </el-form-item>
      <el-form-item label="URL" required>
        <el-input v-model="form.url" placeholder="https://example.com" />
      </el-form-item>
      <el-form-item label="描述（可选）">
        <el-input v-model="form.description" type="textarea" :rows="2" maxlength="200" />
      </el-form-item>
      <el-form-item v-if="!isEdit" label="图标">
        <el-switch v-model="autoIcon" active-text="自动获取 favicon" />
        <el-input
          v-if="!autoIcon"
          v-model="form.favicon"
          placeholder="自定义图标 URL（留空显示首字母）"
          style="margin-top: 8px"
        />
      </el-form-item>
      <el-form-item v-else label="图标">
        <el-input v-model="form.favicon" placeholder="自定义图标 URL（留空显示首字母）" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="ui.siteDialogOpen = false">取消</el-button>
      <el-button type="primary" @click="submit">{{ isEdit ? '保存' : '添加' }}</el-button>
    </template>
  </el-dialog>
</template>
