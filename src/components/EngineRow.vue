<script setup lang="ts">
/** 搜索引擎管理行（从 SettingsDialog 拆出，隔离模板作用域） */
import { Trash2 } from 'lucide-vue-next'
import { isLocalEngine, type Engine } from '@/core/engineCore'

const props = defineProps<{
  engine: Engine
  currentId: string
  urlValue: string
}>()

const emit = defineEmits<{
  (e: 'setDefault', id: string): void
  (e: 'toggle', id: string, disabled: boolean): void
  (e: 'urlBlur', id: string): void
  (e: 'updateUrl', id: string, url: string): void
  (e: 'remove', id: string, name: string): void
}>()
</script>

<template>
  <div class="engine-row" :class="{ disabled: engine.disabled }">
    <button
      type="button"
      class="engine-default"
      :class="{ active: currentId === engine.id }"
      :disabled="engine.disabled"
      :title="currentId === engine.id ? '当前默认引擎' : '设为默认引擎'"
      @click="emit('setDefault', engine.id)"
    >
      ★ {{ engine.name }}
    </button>
    <el-input
      :model-value="urlValue"
      class="engine-url"
      :disabled="isLocalEngine(engine)"
      :placeholder="isLocalEngine(engine) ? '站内过滤，无需 URL' : 'https://...?q=%s'"
      @update:model-value="(v: string) => emit('updateUrl', engine.id, v)"
      @blur="emit('urlBlur', engine.id)"
    />
    <button
      type="button"
      class="engine-toggle"
      :class="{ off: engine.disabled }"
      :title="engine.disabled ? '点击启用' : '点击禁用'"
      @click="emit('toggle', engine.id, !engine.disabled)"
    >
      {{ engine.disabled ? '已禁用' : '启用' }}
    </button>
    <button
      v-if="!engine.isBuiltIn"
      type="button"
      class="engine-del"
      title="删除"
      @click="emit('remove', engine.id, engine.name)"
    >
      <Trash2 :size="13" />
    </button>
    <span v-else class="engine-builtin" title="内置引擎不可删除">内置</span>
  </div>
</template>

<style scoped>
.engine-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.engine-row.disabled {
  opacity: 0.55;
}
.engine-default {
  flex-shrink: 0;
  border: 1px solid var(--c-border);
  background: var(--c-bg);
  color: var(--c-text-dim);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.engine-default.active {
  border-color: var(--c-primary);
  background: var(--c-primary-soft);
  color: var(--c-primary);
  font-weight: 600;
}
.engine-default:disabled {
  cursor: not-allowed;
}
.engine-url {
  flex: 1;
}
.engine-toggle {
  flex-shrink: 0;
  border: 1px solid var(--c-border);
  background: var(--c-bg);
  color: var(--c-text-dim);
  border-radius: 7px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.engine-toggle:hover {
  border-color: var(--c-primary);
  color: var(--c-primary);
}
.engine-toggle.off {
  border-color: rgba(245, 108, 108, 0.5);
  color: #f56c6c;
}
.engine-del {
  border: none;
  background: transparent;
  color: var(--c-text-dim);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
}
.engine-del:hover {
  color: #f56c6c;
  background: rgba(245, 108, 108, 0.12);
}
.engine-builtin {
  font-size: 11px;
  color: var(--c-text-dim);
  border: 1px solid var(--c-border);
  border-radius: 4px;
  padding: 1px 6px;
}
</style>
