/**
 * Cabin 数据访问层：tabs / navigations / settings 表的读写
 */
import type { Database } from 'sql.js'
import type { NavTab, NavSite, AppSettings, Engine, BackupRecord } from '../types'
import { generateId, slugify } from '../core/navCore'
import { MAX_AUTO_BACKUPS } from '../core/backupRing'
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
    isValid: r.is_valid === null || r.is_valid === undefined ? null : (r.is_valid as number),
    lastCheckedAt:
      r.last_checked_at === null || r.last_checked_at === undefined
        ? null
        : (r.last_checked_at as number),
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

  // 默认标签：常用 / 工具 / 学习 / 娱乐（统一 lucide 矢量图标）
  const defaults: Array<{ name: string; slug: string; icon: string }> = [
    { name: '常用', slug: 'common', icon: 'lucide:Star' },
    { name: '工具', slug: 'tools', icon: 'lucide:Wrench' },
    { name: '学习', slug: 'learn', icon: 'lucide:BookOpen' },
    { name: '娱乐', slug: 'fun', icon: 'lucide:Gamepad2' },
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

/** 历史默认标签的旧 emoji 图标 → lucide（仅 name+emoji 双匹配才迁移，尊重用户自选图标） */
const LEGACY_DEFAULT_TAB_ICONS = [
  { name: '常用', legacy: '⭐', icon: 'lucide:Star' },
  { name: '工具', legacy: '🛠️', icon: 'lucide:Wrench' },
  { name: '学习', legacy: '📚', icon: 'lucide:BookOpen' },
  { name: '娱乐', legacy: '🎮', icon: 'lucide:Gamepad2' },
]

/** 一次性迁移：老库里 emoji 种子标签升级为 lucide 图标 */
export function migrateLegacyTabIcons(db: Database): boolean {
  let changed = false
  for (const m of LEGACY_DEFAULT_TAB_ICONS) {
    db.run('UPDATE tabs SET icon = ? WHERE name = ? AND icon = ? AND is_deleted = 0', [
      m.icon,
      m.name,
      m.legacy,
    ])
    if (db.getRowsModified() > 0) changed = true
  }
  if (changed) schedulePersist()
  return changed
}

/** 断链检测结果回写（按 URL 批量更新，同一 URL 多标签共享结果） */
export function updateLinkCheckResults(
  db: Database,
  results: Array<{ url: string; isValid: boolean }>,
  at: number,
): void {
  for (const r of results) {
    db.run('UPDATE navigations SET is_valid = ?, last_checked_at = ? WHERE url = ?', [
      r.isValid ? 1 : 0,
      at,
      r.url,
    ])
  }
  schedulePersist()
}

/** ---------- 搜索引擎 ---------- */

function rowToEngine(r: Record<string, unknown>): Engine {
  return {
    id: r.id as string,
    name: r.name as string,
    url: r.url as string,
    isDefault: !!r.is_default,
    sort: r.sort as number,
    isBuiltIn: !!r.is_builtin,
    disabled: !!r.disabled,
  }
}

export function loadEngines(db: Database): Engine[] {
  const stmt = db.prepare('SELECT * FROM search_engines ORDER BY sort ASC')
  const rows: Engine[] = []
  while (stmt.step()) rows.push(rowToEngine(stmt.getAsObject()))
  stmt.free()
  return rows
}

/** 全量写回（引擎数量小，状态机在 core 算好后整体替换最简单可靠） */
export function saveEngines(db: Database, engines: Engine[]): void {
  db.run('DELETE FROM search_engines')
  for (const e of engines) {
    db.run(
      'INSERT INTO search_engines (id, name, url, is_default, sort, is_builtin, disabled) VALUES (?,?,?,?,?,?,?)',
      [e.id, e.name, e.url, e.isDefault ? 1 : 0, e.sort, e.isBuiltIn ? 1 : 0, e.disabled ? 1 : 0],
    )
  }
  schedulePersist()
}

/** ---------- 自动存档（backups 表） ---------- */

function rowToBackup(r: Record<string, unknown>): BackupRecord {
  return {
    id: r.id as string,
    createdAt: r.created_at as number,
    kind: r.kind as 'auto' | 'manual',
    payload: r.payload as string,
  }
}

/** 插入存档并环形裁剪到上限（删最旧） */
export function insertBackup(db: Database, rec: BackupRecord, max = MAX_AUTO_BACKUPS): void {
  db.run('INSERT OR REPLACE INTO backups (id, created_at, kind, payload) VALUES (?,?,?,?)', [
    rec.id,
    rec.createdAt,
    rec.kind,
    rec.payload,
  ])
  db.run(
    `DELETE FROM backups WHERE id NOT IN (
       SELECT id FROM backups ORDER BY created_at DESC LIMIT ?
     )`,
    [max],
  )
  schedulePersist()
}

/** 存档列表（新→旧） */
export function listBackups(db: Database): BackupRecord[] {
  const stmt = db.prepare('SELECT * FROM backups ORDER BY created_at DESC')
  const rows: BackupRecord[] = []
  while (stmt.step()) rows.push(rowToBackup(stmt.getAsObject()))
  stmt.free()
  return rows
}

export function getBackup(db: Database, id: string): BackupRecord | null {
  const stmt = db.prepare('SELECT * FROM backups WHERE id = ?')
  stmt.bind([id])
  let rec: BackupRecord | null = null
  if (stmt.step()) rec = rowToBackup(stmt.getAsObject())
  stmt.free()
  return rec
}

export function deleteBackup(db: Database, id: string): void {
  db.run('DELETE FROM backups WHERE id = ?', [id])
  schedulePersist()
}

/** 备份恢复：整库替换 */
export function replaceAll(db: Database, tabs: NavTab[], sites: NavSite[]): void {
  db.run('DELETE FROM tabs')
  db.run('DELETE FROM navigations')
  tabs.forEach((t) => insertTab(db, t))
  sites.forEach((s) => insertSite(db, s))
  schedulePersist()
}
