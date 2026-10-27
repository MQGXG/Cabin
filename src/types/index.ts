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
  /** 断链检测：null=未检测，1=有效，0=失效 */
  isValid: number | null
  lastCheckedAt: number | null
}

/** 搜索引擎 */
export interface Engine {
  id: string
  name: string
  url: string
  isDefault: boolean
  sort: number
  isBuiltIn: boolean
  disabled: boolean
}

/** 自动存档记录（列表展示，payload 按需加载） */
export interface BackupRecord {
  id: string
  createdAt: number
  kind: 'auto' | 'manual'
  payload: string
}

/* ==================== 博客模块 ==================== */

/** 文章状态（离线精简版：草稿 ↔ 已发布，无审核流） */
export type BlogPostStatus = 'draft' | 'published'

/** 博客文章 */
export interface BlogPost {
  id: string
  slug: string // URL 友好标识（保留中文）
  title: string
  subtitle: string
  excerpt: string // 摘要（空则自动截断）
  contentMarkdown: string
  status: BlogPostStatus
  categoryId: string // '' = 未分类
  tagIds: string[]
  pinned: boolean
  viewCount: number
  readingMinutes: number
  createdAt: number
  updatedAt: number
  publishedAt: number | null
  deletedAt: number | null // 软删（回收站）
}

/** 博客分类 */
export interface BlogCategory {
  id: string
  name: string
  slug: string
  createdAt: number
}

/** 博客标签 */
export interface BlogTag {
  id: string
  name: string
  slug: string
  createdAt: number
}

/** 博客设置（键值存储） */
export interface BlogSettings {
  blogName: string
  blogDescription: string
  pageSize: number
  excerptLength: number
}

/** 博客排序方式 */
export type BlogSort =
  | 'updated-desc'
  | 'updated-asc'
  | 'created-desc'
  | 'published-desc'
  | 'views-desc'
  | 'title-asc'

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
  /** 布局：grid = 卡片网格；section = 分区（每个标签一个区块，纵向堆叠） */
  layout: 'grid' | 'section'
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
