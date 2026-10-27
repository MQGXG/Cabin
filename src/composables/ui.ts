/**
 * Cabin 全局 UI 弹窗/交互状态（模块级轻量总线，不进数据库）
 */
import { reactive } from 'vue'
import type { NavSite, NavTab } from '@/types'

interface UiState {
  siteDialogOpen: boolean
  siteEditing: NavSite | null // null = 新增
  tabDialogOpen: boolean
  tabEditing: NavTab | null
  importOpen: boolean
  backupOpen: boolean
  settingsOpen: boolean
  wallpaperOpen: boolean
}

export const ui = reactive<UiState>({
  siteDialogOpen: false,
  siteEditing: null,
  tabDialogOpen: false,
  tabEditing: null,
  importOpen: false,
  backupOpen: false,
  settingsOpen: false,
  wallpaperOpen: false,
})

export function openAddSite() {
  ui.siteEditing = null
  ui.siteDialogOpen = true
}
export function openEditSite(site: NavSite) {
  ui.siteEditing = site
  ui.siteDialogOpen = true
}
export function openCreateTab() {
  ui.tabEditing = null
  ui.tabDialogOpen = true
}
export function openEditTab(tab: NavTab) {
  ui.tabEditing = tab
  ui.tabDialogOpen = true
}
export function openImport() {
  ui.importOpen = true
}
export function openBackup() {
  ui.backupOpen = true
}
export function openSettings() {
  ui.settingsOpen = true
}
