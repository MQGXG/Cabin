/**
 * Cabin 全局状态：初始化、标签、网站、设置的 Pinia store
 */
import { defineStore } from 'pinia'
import { initDatabase, persistNow, installBeforeUnload, exportBytes } from '@/db/connection'
import {
  loadTabs, insertTab, updateTabRow, clearOtherDefaults, softDeleteTab,
  loadSites, insertSite, updateSiteRow, incrementClick, softDeleteSite,
  loadSettings, saveSetting, seedIfNeeded, replaceAll,
} from '@/db/repositories'
import {
  buildNewTab, applyTabUpdate, exclusiveDefaultTabs, buildNewSite, applySiteUpdate,
  validateSite, isDuplicateSite, suggestFavicon, sortSites,
} from '@/core/navCore'
import { buildBackupEnvelope, backupFileName, validateBackupEnvelope, mergeBackup, CABIN_BACKUP_VERSION } from '@/core/backupCore'
import type { NavTab, NavSite, AppSettings, CreateTabRequest, UpdateTabRequest, CreateSiteRequest, UpdateSiteRequest, BackupEnvelope, ImportResult } from '@/types'
import type { Database } from 'sql.js'

export const useCabinStore = defineStore('cabin', {
  state: () => ({
    ready: false,
    db: null as Database | null,
    tabs: [] as NavTab[],
    sites: [] as NavSite[],
    settings: {
      theme: 'dark',
      themeFollowSystem: true,
      layout: 'grid',
      pageSize: 18,
      wallpaperType: 'none',
      wallpaperValue: '',
      wallpaperOverlay: 30,
    } as AppSettings,
    activeTabId: '',
    searchKeyword: '',
    activeFilterTabId: '', // 空串 = 全部
  }),

  getters: {
    visibleTabs(state): NavTab[] {
      return state.tabs.filter((t) => !t.isDeleted).sort((a, b) => a.sortOrder - b.sortOrder)
    },
    activeTab(state): NavTab | undefined {
      return this.visibleTabs.find((t) => t.id === state.activeTabId)
    },
    /** 当前筛选 + 搜索下的站点列表（分页后） */
    filteredSites(state): NavSite[] {
      let list = state.sites
      if (state.activeFilterTabId) list = list.filter((s) => s.tabId === state.activeFilterTabId)
      const kw = state.searchKeyword.trim().toLowerCase()
      if (kw) {
        list = list.filter(
          (s) => s.name.toLowerCase().includes(kw) || s.url.toLowerCase().includes(kw),
        )
      }
      return sortSites(list)
    },
    totalClicks(state): number {
      return state.sites.reduce((sum, s) => sum + s.clickCount, 0)
    },
  },

  actions: {
    /** 应用启动：初始化数据库 + 加载数据 */
    async init() {
      this.db = await initDatabase()
      seedIfNeeded(this.db)
      this.tabs = loadTabs(this.db)
      this.sites = loadSites(this.db)
      this.settings = loadSettings(this.db)
      const defTab = this.visibleTabs.find((t) => t.isDefault)
      this.activeTabId = defTab?.id ?? this.visibleTabs[0]?.id ?? ''
      installBeforeUnload()
      this.ready = true
    },

    getDbOrThrow(): Database {
      if (!this.db) throw new Error('数据库未初始化')
      return this.db
    },

    /** 激活标签 */
    setActiveTab(tabId: string) {
      this.activeTabId = tabId
    },
    /** 设置区级筛选（空 = 全部） */
    setFilterTab(tabId: string) {
      this.activeFilterTabId = tabId
    },
    setSearch(keyword: string) {
      this.searchKeyword = keyword
    },

    /** 当前激活标签（或筛选）下的站点 */
    sitesOfTab(tabId: string): NavSite[] {
      return sortSites(this.sites.filter((s) => s.tabId === tabId && !s.isDeleted))
    },

    /** ---------- 标签操作 ---------- */
    async createTab(request: CreateTabRequest): Promise<NavTab> {
      const db = this.getDbOrThrow()
      const tab = buildNewTab(request, this.visibleTabs.length)
      insertTab(db, tab)
      if (tab.isDefault) {
        this.tabs = exclusiveDefaultTabs(this.tabs, tab.id)
        clearOtherDefaults(db, tab.id)
      }
      this.tabs = loadTabs(db)
      return tab
    },
    async updateTab(tabId: string, request: UpdateTabRequest): Promise<void> {
      const db = this.getDbOrThrow()
      const tab = this.tabs.find((t) => t.id === tabId)
      if (!tab) return
      const updated = applyTabUpdate(tab, request)
      updateTabRow(db, updated)
      if (request.isDefault) {
        this.tabs = exclusiveDefaultTabs(this.tabs.map((t) => (t.id === tabId ? updated : t)), tabId)
        clearOtherDefaults(db, tabId)
      } else {
        this.tabs = this.tabs.map((t) => (t.id === tabId ? updated : t))
      }
      this.tabs = loadTabs(db)
    },
    async removeTab(tabId: string): Promise<void> {
      const db = this.getDbOrThrow()
      softDeleteTab(db, tabId, Date.now())
      this.tabs = loadTabs(db)
      if (this.activeTabId === tabId) {
        this.activeTabId = this.visibleTabs[0]?.id ?? ''
      }
      this.sites = loadSites(db)
    },
    async reorderTabs(tabIds: string[]): Promise<void> {
      const db = this.getDbOrThrow()
      tabIds.forEach((id, idx) => {
        const tab = this.tabs.find((t) => t.id === id)
        if (tab) {
          tab.sortOrder = idx
          tab.updatedAt = Date.now()
          updateTabRow(db, tab)
        }
      })
      this.tabs = loadTabs(db)
    },

    /** ---------- 网站操作 ---------- */
    async createSite(request: CreateSiteRequest): Promise<{ ok: boolean; msg?: string; site?: NavSite }> {
      const db = this.getDbOrThrow()
      const err = validateSite(request)
      if (err) return { ok: false, msg: err }
      if (isDuplicateSite(this.sites, request.tabId, request.url)) {
        return { ok: false, msg: '该网站已存在' }
      }
      if (!request.favicon) request.favicon = suggestFavicon(request.url)
      const site = buildNewSite(request, this.sitesOfTab(request.tabId).length)
      insertSite(db, site)
      this.sites = loadSites(db)
      return { ok: true, site }
    },
    async updateSite(siteId: string, request: UpdateSiteRequest): Promise<{ ok: boolean; msg?: string }> {
      const db = this.getDbOrThrow()
      const site = this.sites.find((s) => s.id === siteId)
      if (!site) return { ok: false, msg: '网站不存在' }
      const err = validateSite({ ...request, name: request.name ?? site.name, url: request.url ?? site.url })
      if (err) return { ok: false, msg: err }
      const updated = applySiteUpdate(site, request)
      updateSiteRow(db, updated)
      this.sites = this.sites.map((s) => (s.id === siteId ? updated : s))
      return { ok: true }
    },
    async clickSite(siteId: string): Promise<void> {
      const db = this.getDbOrThrow()
      const site = this.sites.find((s) => s.id === siteId)
      if (!site) return
      incrementClick(db, siteId, Date.now())
      site.clickCount += 1
    },
    async removeSite(siteId: string): Promise<void> {
      const db = this.getDbOrThrow()
      softDeleteSite(db, siteId, Date.now())
      this.sites = this.sites.filter((s) => s.id !== siteId)
    },
    async reorderSites(tabId: string, siteIds: string[]): Promise<void> {
      const db = this.getDbOrThrow()
      siteIds.forEach((id, idx) => {
        const site = this.sites.find((s) => s.id === id && s.tabId === tabId)
        if (site) {
          site.sortOrder = idx
          site.updatedAt = Date.now()
          updateSiteRow(db, site)
        }
      })
      this.sites = loadSites(db)
    },

    /** ---------- 设置 ---------- */
    async patchSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
      const db = this.getDbOrThrow()
      ;(this.settings as unknown as Record<string, unknown>)[key as string] = value
      saveSetting(db, key as string, String(value))
    },

    /** ---------- 备份导出 / 导入恢复 ---------- */
    async exportBackup(): Promise<void> {
      const envelope = buildBackupEnvelope(this.visibleTabs, sortSites(this.sites))
      const json = JSON.stringify(envelope, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = backupFileName()
      a.click()
      URL.revokeObjectURL(a.href)
    },
    /** 导出整个 SQLite 数据库文件（.db），用于高级备份/迁移 */
    async exportDbFile(): Promise<void> {
      const bytes = exportBytes(this.getDbOrThrow())
      const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/x-sqlite3' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'cabin-data.db'
      a.click()
      URL.revokeObjectURL(a.href)
    },
    /** 导入 JSON 备份：默认合并（按域名去重），replace = true 时整库替换 */
    async importBackup(jsonText: string, replace = false): Promise<{ ok: boolean; msg?: string; result?: ImportResult }> {
      let raw: unknown
      try {
        raw = JSON.parse(jsonText)
      } catch {
        return { ok: false, msg: 'JSON 解析失败' }
      }
      const envelope: BackupEnvelope | null = validateBackupEnvelope(raw)
      if (!envelope) return { ok: false, msg: '不是有效的 Cabin 备份文件' }
      if (envelope.version > CABIN_BACKUP_VERSION) {
        return { ok: false, msg: `备份版本过新（v${envelope.version}），请升级应用` }
      }
      const db = this.getDbOrThrow()
      if (replace) {
        replaceAll(db, envelope.tabs, envelope.sites)
      } else {
        const { tabsToAdd, sitesToAdd } = mergeBackup(envelope, this.visibleTabs, this.sites)
        tabsToAdd.forEach((t) => insertTab(db, t))
        sitesToAdd.forEach((s) => insertSite(db, s))
        const result: ImportResult = { tabsAdded: tabsToAdd.length, sitesAdded: sitesToAdd.length, sitesSkipped: envelope.sites.length - sitesToAdd.length }
        this.tabs = loadTabs(db)
        this.sites = loadSites(db)
        return { ok: true, result }
      }
      this.tabs = loadTabs(db)
      this.sites = loadSites(db)
      return { ok: true, result: { tabsAdded: envelope.tabs.length, sitesAdded: envelope.sites.length, sitesSkipped: 0 } }
    },
    /** 批量写入导入的站点（书签/CSV 导入到指定标签） */
    async bulkAddSites(tabId: string, rows: Array<{ name: string; url: string; description?: string }>): Promise<ImportResult> {
      const db = this.getDbOrThrow()
      let added = 0
      let skipped = 0
      const order = this.sitesOfTab(tabId).length
      for (const row of rows) {
        const normalized = row.url.trim()
        if (isDuplicateSite(this.sites, tabId, normalized)) {
          skipped++
          continue
        }
        const site = buildNewSite(
          { tabId, name: row.name, url: normalized, description: row.description, favicon: suggestFavicon(normalized) },
          order + added,
        )
        insertSite(db, site)
        this.sites.push(site)
        added++
      }
      this.sites = loadSites(db)
      return { tabsAdded: 0, sitesAdded: added, sitesSkipped: skipped }
    },

    /** 退出前强制落盘 */
    async flush(): Promise<void> {
      await persistNow()
    },
  },
})
