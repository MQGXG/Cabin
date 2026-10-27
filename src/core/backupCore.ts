/**
 * Cabin 备份纯逻辑：JSON 信封构建与校验
 */
import type { BackupEnvelope, NavTab, NavSite } from '../types'

export const CABIN_BACKUP_VERSION = 1

/** 构建备份信封 */
export function buildBackupEnvelope(tabs: NavTab[], sites: NavSite[]): BackupEnvelope {
  return {
    app: 'Cabin',
    version: CABIN_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tabs,
    sites,
  }
}

/** 备份文件名（YYYYMMDD） */
export function backupFileName(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `cabin-backup-${y}${m}${d}.json`
}

/** 校验并规范化导入的备份信封 */
export function validateBackupEnvelope(raw: unknown): BackupEnvelope | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (obj.app !== 'Cabin') return null
  if (typeof obj.version !== 'number' || obj.version < 1) return null
  if (!Array.isArray(obj.tabs) || !Array.isArray(obj.sites)) return null

  const tabs: NavTab[] = (obj.tabs as unknown[]).filter(isValidTab)
  const sites: NavSite[] = (obj.sites as unknown[]).filter(isValidSite)

  // 站点的 tabId 悬空时丢弃（防脏数据）
  const tabIds = new Set(tabs.map((t) => t.id))
  const validSites = sites.filter((s) => tabIds.has(s.tabId))

  return {
    app: 'Cabin',
    version: obj.version,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : '',
    tabs,
    sites: validSites,
  }
}

function isValidTab(t: unknown): t is NavTab {
  const o = t as Record<string, unknown>
  return (
    typeof o?.id === 'string' &&
    typeof o?.name === 'string' &&
    typeof o?.slug === 'string' &&
    typeof o?.icon === 'string'
  )
}

function isValidSite(s: unknown): s is NavSite {
  const o = s as Record<string, unknown>
  return (
    typeof o?.id === 'string' &&
    typeof o?.tabId === 'string' &&
    typeof o?.name === 'string' &&
    typeof o?.url === 'string'
  )
}

/** 按域名对备份数据做去重合并（local 优先，返回需新增的部分） */
export function mergeBackup(
  envelope: BackupEnvelope,
  localTabs: NavTab[],
  localSites: NavSite[] | Array<{ url: string; tabId: string; isDeleted: boolean }>,
): { tabsToAdd: NavTab[]; sitesToAdd: NavSite[] } {
  const localDomains = new Set(
    localSites.filter((s) => !s.isDeleted).map((s) => stripWww(s.url).toLowerCase()),
  )
  const tabsToAdd = envelope.tabs.filter(
    (t) => !localTabs.some((lt) => lt.slug === t.slug || lt.name === t.name),
  )
  const sitesToAdd = envelope.sites.filter((s) => !localDomains.has(stripWww(s.url).toLowerCase()))
  return { tabsToAdd, sitesToAdd }
}

function stripWww(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, '')
}
