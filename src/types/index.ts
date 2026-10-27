/**
 * Cabin 数据模型类型定义
 */

/** 导航标签（分类） */
export interface NavTab {
  id: string
  name: string
  slug: string
  icon: string
  sortOrder: number
  isDefault: boolean
  updatedAt: number
  isDeleted: boolean
}

/** 导航网站 */
export interface NavSite {
  id: string
  tabId: string
  name: string
  url: string
  description: string
  favicon: string
  clickCount: number
  sortOrder: number
  createdAt: number
  updatedAt: number
  isDeleted: boolean
}

/** 数据库元信息 */
export interface DbMeta {
  key: string
  value: string
}

/** 导航行（数据库映射） */
export interface NavTabRow extends Omit<NavTab, 'sortOrder' | 'isDefault' | 'isDeleted'> {
  sort_order: number
  is_default: number
  is_deleted: number
}

/** 创建标签请求 */
export interface CreateTabRequest {
  name: string
  icon?: string
  sortOrder?: number
  isDefault?: boolean
}

/** 更新标签请求 */
export interface UpdateTabRequest {
  name?: string
  icon?: string
  isDefault?: boolean
}

/** 创建网站请求 */
export interface CreateSiteRequest {
  tabId: string
  name: string
  url: string
  description?: string
  favicon?: string
  sortOrder?: number
}

/** 更新网站请求 */
export interface UpdateSiteRequest {
  tabId?: string
  name?: string
  url?: string
  description?: string
  favicon?: string
}

/** 应用设置（键值对存储在 settings 表） */
export interface AppSettings {
  theme: 'dark' | 'light'
  themeFollowSystem: boolean
  layout: 'grid' | 'list'
  pageSize: number
  wallpaperType: 'none' | 'preset' | 'custom'
  wallpaperValue: string
  wallpaperOverlay: number
}

/** 备份信封（JSON 备份文件格式） */
export interface BackupEnvelope {
  app: 'Cabin'
  version: number // CABIN_BACKUP_VERSION
  exportedAt: string
  tabs: NavTab[]
  sites: NavSite[]
}

/** 导入结果 */
export interface ImportResult {
  tabsAdded: number
  sitesAdded: number
  sitesSkipped: number
}

/** CSV 导入行 */
export interface CsvSiteRow {
  name: string
  url: string
  description?: string
}
