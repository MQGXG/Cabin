/**
 * Cabin 数据访问层：tabs / navigations / settings 表的读写
 */
import type { Database } from 'sql.js'
import type { NavTab, NavSite, AppSettings } from '../types'
import { generateId, slugify } from '../core/navCore'
import { schedulePersist } from './connection'

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  themeFollowSystem: true,
  layout: 'grid',
  pageSize: 18,
  wallpaperType: 'none',
  wallpaperValue: '',
  wallpaperOverlay: 30,
}

/** ---------- Tabs ---------- */

function rowToTab(r: Record<string, unknown>): NavTab {
  return {
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    icon: r.icon as string,
    sortOrder: r.sort_order as number,
    isDefault: !!r.is_default,
    updatedAt: r.updated_at as number,
    isDeleted: !!r.is_deleted,
  }
}

export function loadTabs(db: Database): NavTab[] {
  const stmt = db.prepare('SELECT * FROM tabs WHERE is_deleted = 0 ORDER BY sort_order ASC')
  const rows: NavTab[] = []
  while (stmt.step()) rows.push(rowToTab(stmt.getAsObject()))
  stmt.free()
  return rows
}

export function insertTab(db: Database, tab: NavTab): void {
  db.run(
    'INSERT INTO tabs (id, name, slug, icon, sort_order, is_default, updated_at, is_deleted) VALUES (?,?,?,?,?,?,?,?)',
    [tab.id, tab.name, tab.slug, tab.icon, tab.sortOrder, tab.isDefault ? 1 : 0, tab.updatedAt, tab.isDeleted ? 1 : 0],
  )
  schedulePersist()
}

export function updateTabRow(db: Database, tab: NavTab): void {
  db.run('UPDATE tabs SET name = ?, icon = ?, is_default = ?, sort_order = ?, updated_at = ? WHERE id = ?', [
    tab.name,
    tab.icon,
    tab.isDefault ? 1 : 0,
    tab.sortOrder,
    tab.updatedAt,
    tab.id,
  ])
  schedulePersist()
}

export function clearOtherDefaults(db: Database, keepId: string): void {
  db.run('UPDATE tabs SET is_default = 0 WHERE id != ?', [keepId])
  schedulePersist()
}

export function softDeleteTab(db: Database, tabId: string, now: number): void {
  db.run('UPDATE tabs SET is_deleted = 1, updated_at = ? WHERE id = ?', [now, tabId])
  schedulePersist()
}

/** ---------- Navigations ---------- */

function rowToSite(r: Record<string, unknown>): NavSite {
  return {
    id: r.id as string,
    tabId: r.tab_id as string,
    name: r.name as string,
    url: r.url as string,
    description: r.description as string,
    favicon: r.favicon as string,
    clickCount: r.click_count as number,
    sortOrder: r.sort_order as number,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
    isDeleted: !!r.is_deleted,
  }
}

export function loadSites(db: Database): NavSite[] {
  const stmt = db.prepare('SELECT * FROM navigations WHERE is_deleted = 0 ORDER BY sort_order ASC, created_at ASC')
  const rows: NavSite[] = []
  while (stmt.step()) rows.push(rowToSite(stmt.getAsObject()))
  stmt.free()
  return rows
}

export function insertSite(db: Database, site: NavSite): void {
  db.run(
    'INSERT INTO navigations (id, tab_id, name, url, description, favicon, click_count, sort_order, created_at, updated_at, is_deleted) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [site.id, site.tabId, site.name, site.url, site.description, site.favicon, site.clickCount, site.sortOrder, site.createdAt, site.updatedAt, site.isDeleted ? 1 : 0],
  )
  schedulePersist()
}

export function updateSiteRow(db: Database, site: NavSite): void {
  db.run(
    'UPDATE navigations SET tab_id = ?, name = ?, url = ?, description = ?, favicon = ?, sort_order = ?, updated_at = ? WHERE id = ?',
    [site.tabId, site.name, site.url, site.description, site.favicon, site.sortOrder, site.updatedAt, site.id],
  )
  schedulePersist()
}

export function incrementClick(db: Database, siteId: string, now: number): void {
  db.run('UPDATE navigations SET click_count = click_count + 1, updated_at = ? WHERE id = ?', [now, siteId])
  schedulePersist()
}

export function softDeleteSite(db: Database, siteId: string, now: number): void {
  db.run('UPDATE navigations SET is_deleted = 1, updated_at = ? WHERE id = ?', [now, siteId])
  schedulePersist()
}

/** ---------- Settings ---------- */

export function loadSettings(db: Database): AppSettings {
  const settings: AppSettings = { ...DEFAULT_SETTINGS }
  const stmt = db.prepare('SELECT key, value FROM settings')
  while (stmt.step()) {
    const row = stmt.getAsObject()
    applySetting(settings, row.key as string, row.value as string)
  }
  stmt.free()
  return settings
}

function applySetting(settings: AppSettings, key: string, value: string): void {
  switch (key) {
    case 'theme':
      if (value === 'dark' || value === 'light') settings.theme = value
      break
    case 'themeFollowSystem':
      settings.themeFollowSystem = value === '1' || value === 'true'
      break
    case 'layout':
      if (value === 'grid' || value === 'section') settings.layout = value
      else if (value === 'list') settings.layout = 'grid' // 旧版"列表"映射回网格
      break
    case 'pageSize':
      settings.pageSize = Number(value) || 18
      break
    case 'wallpaperType':
      if (value === 'none' || value === 'preset' || value === 'custom') settings.wallpaperType = value
      break
    case 'wallpaperValue':
      settings.wallpaperValue = value
      break
    case 'wallpaperOverlay':
      settings.wallpaperOverlay = Number(value) || 30
      break
  }
}

export function saveSetting(db: Database, key: string, value: string): void {
  db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value])
  schedulePersist()
}

/** ---------- 种子数据（首次启动） ---------- */

export function seedIfNeeded(db: Database, now = Date.now()): boolean {
  const stmt = db.prepare('SELECT COUNT(*) AS c FROM tabs')
  stmt.step()
  const count = Number(stmt.getAsObject().c)
  stmt.free()
  if (count > 0) return false

  // 默认标签：常用 / 工具 / 学习 / 娱乐
  const defaults: Array<{ name: string; slug: string; icon: string }> = [
    { name: '常用', slug: 'common', icon: '⭐' },
    { name: '工具', slug: 'tools', icon: '🛠️' },
    { name: '学习', slug: 'learn', icon: '📚' },
    { name: '娱乐', slug: 'fun', icon: '🎮' },
  ]
  defaults.forEach((d, i) => {
    insertTab(db, {
      id: generateId(),
      name: d.name,
      slug: slugify(d.slug, i),
      icon: d.icon,
      sortOrder: i,
      isDefault: i === 0,
      updatedAt: now,
      isDeleted: false,
    })
  })
  return true
}

/** 备份恢复：整库替换 */
export function replaceAll(db: Database, tabs: NavTab[], sites: NavSite[]): void {
  db.run('DELETE FROM tabs')
  db.run('DELETE FROM navigations')
  tabs.forEach((t) => insertTab(db, t))
  sites.forEach((s) => insertSite(db, s))
  schedulePersist()
}
