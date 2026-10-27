<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ImageIcon, Eraser } from 'lucide-vue-next'
import { useCabinStore } from '@/stores/cabin'
import { ui } from '@/composables/ui'

const store = useCabinStore()

/** 内置壁纸：渐变（CSS 串） */
const PRESETS = [
  { name: '午夜蓝（默认）', css: '' },
  { name: '深海', css: 'linear-gradient(160deg, #07102e, #0d2350 60%, #061631)' },
  { name: '极光', css: 'linear-gradient(160deg, #041f2e, #0a4f52 55%, #123d66)' },
  { name: '暮光', css: 'linear-gradient(160deg, #1b1035, #43226b 55%, #1b2852)' },
  { name: '松林', css: 'linear-gradient(160deg, #0b1d12, #14402a 60%, #0a2318)' },
  { name: '暖阳', css: 'linear-gradient(160deg, #2b1d0e, #6d4417 55%, #23212b)' },
]

const selectedPreset = ref(0)
const overlay = ref(30)
const customName = ref('')

watch(
  () => ui.wallpaperOpen,
  (open) => {
    if (!open) return
    selectedPreset.value = PRESETS.findIndex((p) => p.css === store.settings.wallpaperValue)
    overlay.value = store.settings.wallpaperOverlay
  },
)

const bgStyle = computed(() => {
  if (store.settings.wallpaperType === 'preset' && store.settings.wallpaperValue) {
    return { background: store.settings.wallpaperValue }
  }
  if (store.settings.wallpaperType === 'custom' && store.settings.wallpaperValue) {
    return { backgroundImage: `url(${store.settings.wallpaperValue})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  return {}
})

function pickPreset(i: number) {
  selectedPreset.value = i
  const val = PRESETS[i].css
  store.patchSetting('wallpaperType', val ? 'preset' : 'none')
  store.patchSetting('wallpaperValue', val)
}

function onCustomPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = String(reader.result)
    store.patchSetting('wallpaperType', 'custom')
    store.patchSetting('wallpaperValue', dataUrl)
    customName.value = file.name
    ui.wallpaperOpen = false
  }
  reader.readAsDataURL(file)
  input.value = ''
}

async function onOverlayChange(v: number) {
  await store.patchSetting('wallpaperOverlay', v)
}

function clearWallpaper() {
  selectedPreset.value = 0
  store.patchSetting('wallpaperType', 'none')
  store.patchSetting('wallpaperValue', '')
}
</script>

<template>
  <!-- 悬浮按钮（右下角，对应截图） -->
  <button class="wall-fab" title="壁纸" @click="ui.wallpaperOpen = true"><ImageIcon :size="18" /></button>

  <!-- 壁纸背景层（始终渲染，无壁纸时提供默认底色 var(--c-bg)） -->
  <div class="wall-bg" :style="bgStyle" />
  <div class="wall-overlay" :style="{ opacity: store.settings.wallpaperType === 'none' ? 1 : Math.min(1, store.settings.wallpaperOverlay / 100 + 0.15) }" />

  <el-dialog v-model="ui.wallpaperOpen" title="壁纸设置" width="560px" append-to-body>
    <el-form label-position="top">
      <el-form-item label="渐变壁纸">
        <div class="preset-grid">
          <button
            v-for="(p, i) in PRESETS"
            :key="p.name"
            type="button"
            class="preset-cell"
            :class="{ picked: selectedPreset === i, 'no-pick': !p.css }"
            @click="pickPreset(i)"
          >
            <span v-if="!p.css" class="none-mark">无</span>
            <span v-else class="preset-bg" :style="{ background: p.css }" />
            <span class="preset-name">{{ p.name }}</span>
          </button>
        </div>
      </el-form-item>
      <el-form-item label="自定义图片壁纸（存本地，不上传）">
        <div class="custom-row">
          <input type="file" accept="image/*" @change="onCustomPick" />
          <span v-if="store.settings.wallpaperType === 'custom'" class="custom-name">当前：{{ customName || '已选图片' }}</span>
          <el-button v-if="store.settings.wallpaperType !== 'none'" size="small" @click="clearWallpaper">
            <Eraser :size="12" class="mr-1" /> 清除壁纸
          </el-button>
        </div>
      </el-form-item>
      <el-form-item :label="`遮罩透明度（${overlay}%）`">
        <el-slider v-model="overlay" :min="0" :max="100" style="width: 100%" @change="onOverlayChange" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="ui.wallpaperOpen = false">完成</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.wall-fab {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 60;
  width: 46px;
  height: 46px;
  border-radius: 12px;
  border: 1px solid var(--c-border);
  background: var(--c-bg-soft);
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
  /* 图标在按钮内绝对居中（lucide SVG 为 inline 元素，需 flex 归位） */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.wall-fab:hover {
  border-color: var(--c-primary);
  background: var(--c-primary-soft);
}
.wall-bg {
  position: fixed;
  inset: 0;
  z-index: -2;
  /* 默认底色（无壁纸时）；有壁纸时被 bgStyle 的 background 覆盖 */
  background: var(--c-bg);
}
.wall-overlay {
  position: fixed;
  inset: 0;
  z-index: -1;
  background: linear-gradient(160deg, rgba(10, 18, 44, 0.92), rgba(16, 30, 70, 0.86) 55%, rgba(10, 22, 60, 0.94));
  transition: opacity 0.25s;
}
/* 亮色主题遮罩变浅 */
html.theme-light .wall-overlay {
  background: linear-gradient(160deg, rgba(238, 241, 248, 0.94), rgba(226, 232, 246, 0.9));
}
.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  width: 100%;
}
.preset-cell {
  border: 2px solid transparent;
  border-radius: 10px;
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  background: var(--c-bg);
  position: relative;
  height: 74px;
}
.preset-cell.picked {
  border-color: var(--c-primary);
}
.preset-cell.no-pick .none-mark {
  font-size: 13px;
  color: var(--c-text-dim);
}
.none-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
.preset-bg {
  position: absolute;
  inset: 0;
}
.preset-name {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  font-size: 10px;
  padding: 2px 0;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
}
.custom-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
}
.custom-name {
  font-size: 12px;
  color: var(--c-text-dim);
}
</style>
