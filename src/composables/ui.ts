/**
 * Cabin 全局 UI 弹窗/交互状态（模块级轻量总线，不进数据库）
 */
import { reactive } from 'vue'
import type { NavSite, NavTab } from '@/types'

interface UiState {
  siteDialogOpen: boolean
  siteEditing: NavSite | null // null = 新增
  siteDefaultTabId: string // 新增时指定标签（分区布局的“+”入口）
  tabDialogOpen: boolean
  tabEditing: NavTab | null
  importOpen: boolean
  backupOpen: boolean
  settingsOpen: boolean
  wallpaperOpen: boolean
  /** 分区详情右侧面板（null = 关闭） */
  sectionPanelTabId: string
  /** Spotlight 全局搜索浮层 */
  spotlightOpen: boolean
  /** 应用视图：导航站 / 博客前台 / 博客后台 */
  view: 'nav' | 'blog' | 'blogAdmin'
  /** 博客后台编辑器：null=不编辑，'new'=新建，否则编辑指定文章 id */
  blogEditing: string | 'new' | null
}

export const ui = reactive<UiState>({
  siteDialogOpen: false,
  siteEditing: null,
  siteDefaultTabId: '',
  tabDialogOpen: false,
  tabEditing: null,
  importOpen: false,
  backupOpen: false,
  settingsOpen: false,
  wallpaperOpen: false,
  sectionPanelTabId: '',
  spotlightOpen: false,
  view: 'nav',
  blogEditing: null,
})

export function openAddSite(tabId = '') {
  ui.siteEditing = null
  ui.siteDefaultTabId = tabId
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
/** 打开分区详情右侧面板 */
export function openSectionPanel(tabId: string) {
  ui.sectionPanelTabId = tabId
}

/* ==================== 博客视图切换 ==================== */

export function openBlog() {
  ui.view = 'blog'
  ui.spotlightOpen = false
}
export function openBlogAdmin() {
  ui.view = 'blogAdmin'
}
export function backToNav() {
  ui.view = 'nav'
  ui.blogEditing = null
}
