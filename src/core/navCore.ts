/**
 * Cabin 纯逻辑层：标签与网站的排序、slug、校验等
 * （不依赖数据库，可直接 node 单测）
 */
import type { NavTab, NavSite, CreateTabRequest, UpdateTabRequest, CreateSiteRequest, UpdateSiteRequest } from '../types'

/** 默认标签定义（首次启动种子数据） */
export const DEFAULT_TABS: Array<Pick<NavTab, 'name' | 'slug' | 'icon'>> = [
  { name: '常用', slug: 'common', icon: '⭐' },
  { name: '工具', slug: 'tools', icon: '🛠️' },
  { name: '学习', slug: 'learn', icon: '📚' },
  { name: '娱乐', slug: 'fun', icon: '🎮' },
]

/** 生成唯一 ID */
export function generateId(): string {
  return 'cabin_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11)
}

/** 生成 slug（英文取小写连字符，中文则映射为 tab-n 形式） */
export function slugify(name: string, index = 0): string {
  const trimmed = name.trim().toLowerCase()
  const ascii = trimmed.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return ascii || `tab-${index}`
}

/** 过滤墓碑并按 sortOrder 排序 */
export function sortTabs(tabs: NavTab[]): NavTab[] {
  return tabs
    .filter((t) => !t.isDeleted)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/** 创建标签对象（纯函数，不落库） */
export function buildNewTab(request: CreateTabRequest, existingCount: number, now = Date.now()): NavTab {
  const slug = slugify(request.name, existingCount)
  return {
    id: generateId(),
    name: request.name,
    slug,
    icon: request.icon || '📁',
    sortOrder: request.sortOrder ?? existingCount,
    isDefault: request.isDefault || false,
    updatedAt: now,
    isDeleted: false,
  }
}

/** 应用标签更新（纯函数，返回新对象） */
export function applyTabUpdate(tab: NavTab, request: UpdateTabRequest, now = Date.now()): NavTab {
  return {
    ...tab,
    name: request.name ?? tab.name,
    icon: request.icon ?? tab.icon,
    isDefault: request.isDefault ?? tab.isDefault,
    updatedAt: now,
  }
}

/** 排他默认标签：把 isDefault = true 之外的全部清掉 */
export function exclusiveDefaultTabs(tabs: NavTab[], defaultId: string): NavTab[] {
  return tabs.map((t) => (t.id === defaultId ? t : { ...t, isDefault: false }))
}

/** 过滤墓碑并按 sortOrder 排序 */
export function sortSites(sites: NavSite[]): NavSite[] {
  return sites
    .filter((s) => !s.isDeleted)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
}

/** 补全 URL 协议（缺 http/https 时补 https） */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^javascript:/i.test(trimmed)) return ''
  return 'https://' + trimmed
}

/** 站点有效性校验 */
export function validateSite(request: CreateSiteRequest | UpdateSiteRequest): string | null {
  // 名称必填（更新请求允许不传名称，仅在传入时校验）
  if (request.name !== undefined && !request.name.trim()) return '名称不能为空'
  // URL 仅在传入时校验（更新请求可省略）
  if (request.url !== undefined) {
    const url = normalizeUrl(request.url)
    if (!url) return 'URL 不合法'
    if (url.length > 2048) return 'URL 过长'
  }
  return null
}

/** 从 URL 提取域名（用于卡片副标题） */
export function domainOf(url: string): string {
  try {
    const u = new URL(normalizeUrl(url))
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** 创建站点对象（纯函数） */
export function buildNewSite(request: CreateSiteRequest, existingCount: number, now = Date.now()): NavSite {
  return {
    id: generateId(),
    tabId: request.tabId,
    name: request.name,
    url: normalizeUrl(request.url),
    description: request.description ?? '',
    favicon: request.favicon ?? '',
    clickCount: 0,
    sortOrder: request.sortOrder ?? existingCount,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  }
}

/** 应用站点更新（纯函数） */
export function applySiteUpdate(site: NavSite, request: UpdateSiteRequest, now = Date.now()): NavSite {
  return {
    ...site,
    tabId: request.tabId ?? site.tabId,
    name: request.name ?? site.name,
    url: request.url !== undefined ? normalizeUrl(request.url) : site.url,
    description: request.description ?? site.description,
    favicon: request.favicon ?? site.favicon,
    updatedAt: now,
  }
}

/** 域名去重判断：同一标签下是否已存在相同域名/完整 URL */
export function isDuplicateSite(existing: NavSite[], tabId: string, url: string): boolean {
  const target = normalizeUrl(url).replace(/\/+$/, '')
  const targetDomain = domainOf(target)
  return existing.some((s) => {
    if (s.isDeleted) return false
    const ext = normalizeUrl(s.url).replace(/\/+$/, '')
    if (ext.toLowerCase() === target.toLowerCase()) return true
    return tabId === s.tabId && domainOf(ext).toLowerCase() === targetDomain.toLowerCase()
  })
}

/** 判断主机名是否为 IP 字面量 / localhost（内网地址不请求 favicon 服务） */
export function isLocalHost(host: string): boolean {
  if (!host) return true
  if (host === 'localhost') return true
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true // IPv4
  if (host.includes(':')) return true // IPv6
  return false
}

/** 推荐 favicon 地址（在线服务，离线时优雅降级到占位图标） */
export function suggestFavicon(url: string): string {
  let host: string
  try {
    host = new URL(normalizeUrl(url)).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
  if (isLocalHost(host)) return ''
  return `https://favicon.im/${host}?larger=true`
}
