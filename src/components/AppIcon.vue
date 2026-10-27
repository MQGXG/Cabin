<script setup lang="ts">
/**
 * 统一图标组件：
 * - `lucide:Name` → 渲染 lucide 矢量图标（统一风格）
 * - 其它（旧数据 emoji）→ 原样渲染，平滑兼容
 */
import { computed, type Component } from 'vue'
import { ICON_MAP } from '@/core/iconSet'

const LUCIDE_PREFIX = 'lucide:'

const props = defineProps<{
  name: string
  size?: number
}>()

const comp = computed<Component | null>(() => {
  if (!props.name?.startsWith(LUCIDE_PREFIX)) return null
  return ICON_MAP[props.name.slice(LUCIDE_PREFIX.length)] ?? null
})
</script>

<template>
  <component v-if="comp" :is="comp" :size="size ?? 16" :stroke-width="2" />
  <span v-else class="emoji-icon" :style="{ fontSize: `${size ?? 16}px` }">{{ name }}</span>
</template>

<style scoped>
.emoji-icon {
  line-height: 1;
  display: inline-flex;
}
</style>
