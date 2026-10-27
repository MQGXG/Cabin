/**
 * Cabin 全局状态：初始化、标签、网站、设置的 Pinia store
 */
import { defineStore } from 'pinia'
import { initDatabase, persistNow, installBeforeUnload, exportBytes } from '@/db/connection'
import {
  loadTabs, insertTab, updateTabRow, clearOtherDefaults, softDeleteTab,
  loadSites, insertSite, updateSiteRow, incrementClick, softDeleteSite,
  loadSettings, saveSetting, seedIfNeeded, replaceAll, migrateLegacyTabIcons,
  updateLinkCheckResults, loadEngines, saveEngines,
  insertBackup, listBackups, getBackup, deleteBackup,
} from '@/db/repositories'
import {
  buildNewTab, applyTabUpdate, exclusiveDefaultTabs, buildNewSite, applySiteUpdate,
  validateSite, isDuplicateSite, suggestFavicon, sortSites,
} from '@/core/navCore'
import { buildBackupEnvelope, backupFileName, validateBackupEnvelope, mergeBackup, CABIN_BACKUP_VERSION } from '@/core/backupCore'
import {
  seedEngines, normalizeEngines, ensureSingleDefault, applySetDefault,
  applyToggleDisabled, applyRemove, availableEngines, isLocalEngine, buildSearchUrl,
} from '@/core/engineCore'
import { checkDeadLinks, type CheckProgress } from '@/core/linkCheckCore'
import { makeBackupId, shouldAutoBackup, isSameDay, AUTO_BACKUP_DEBOUNCE_MS } from '@/core/backupRing'
import type { NavTab, NavSite, AppSettings, BackupRecord, Engine, CreateTabRequest, UpdateTabRequest, CreateSiteRequest, UpdateSiteRequest, BackupEnvelope, ImportResult } from '@/types'
import type { Database } from 'sql.js'
import { useBlogStore } from '@/stores/blog'

/** 自动存档防抖定时器（模块级） */
let autoBackupTimer: ReturnType<typeof setTimeout> | null = null
/** 断链检测取消器 */
let linkCheckAbort: AbortController | null = null

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
    systemDark: true, // 跟随系统的暗色状态（init 时挂 matchMedia 监听）
    /** 搜索引擎列表（core 状态机管理，唯一默认） */
    engines: [] as Engine[],
    /** 断链检测进度 */
    linkCheck: { running: false, total: 0, current: 0, invalidCount: 0 } as CheckProgress & {
      running: boolean
    },
    /** 仅显示失效链接 */
    showOnlyBroken: false,
    /** 自动存档列表（新→旧） */
    backups: [] as BackupRecord[],
  }),

  getters: {
    visibleTabs(state): NavTab[] {
      return state.tabs.filter((t) => !t.isDeleted).sort((a, b) => a.sortOrder - b.sortOrder)
    },
    activeTab(state): NavTab | undefined {
      return this.visibleTabs.find((t) => t.id === state.activeTabId)
    },
    /** 当前筛选 + 搜索 + 失效过滤下的站点列表（分页后） */
    filteredSites(state): NavSite[] {
      let list = state.sites
      if (state.activeFilterTabId) list = list.filter((s) => s.tabId === state.activeFilterTabId)
      if (state.showOnlyBroken) list = list.filter((s) => s.isValid === 0)
      const kw = state.searchKeyword.trim().toLowerCase()
      if (kw) {
        list = list.filter(
          (s) => s.name.toLowerCase().includes(kw) || s.url.toLowerCase().includes(kw),
        )
      }
      return sortSites(list)
    },
    /** 当前生效的搜索引擎 */
    currentEngine(state): Engine {
      const list = availableEngines(state.engines.length ? state.engines : seedEngines())
      return list.find((e) => e.isDefault) ?? list[0]
    },
    /** 可用引擎（下拉展示） */
    availableEngineList(state): Engine[] {
      return availableEngines(state.engines.length ? state.engines : seedEngines())
    },
    totalClicks(state): number {
      return state.sites.reduce((sum, s) => sum + s.clickCount, 0)
    },
    /** 实际生效的暗色状态（跟随系统时取系统值） */
    effectiveDark(state): boolean {
      return state.settings.themeFollowSystem ? state.systemDark : state.settings.theme === 'dark'
    },
  },

  actions: {
    /** 应用启动：初始化数据库 + 加载数据 */
    async init() {
      this.db = await initDatabase()
      seedIfNeeded(this.db)
      migrateLegacyTabIcons(this.db)
      this.tabs = loadTabs(this.db)
      this.sites = loadSites(this.db)
      this.settings = loadSettings(this.db)
      // 搜索引擎：空表则按内置种子初始化
      let engines = loadEngines(this.db)
      if (engines.length === 0) {
        engines = seedEngines()
        saveEngines(this.db, engines)
      }
      this.engines = ensureSingleDefault(normalizeEngines(engines))
      this.backups = listBackups(this.db)
      // 供博客 store 复用同一 SQLite 单例（避免 store 间循环依赖）
      ;(window as unknown as { __cabinDb?: unknown }).__cabinDb = this.db
      // 博客模块初始化
      await useBlogStore().init()
      const defTab = this.visibleTabs.find((t) => t.isDefault)
      this.activeTabId = defTab?.id ?? this.visibleTabs[0]?.id ?? ''
      // 系统主题变化监听（跟随系统时实时切换）
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      this.systemDark = mq.matches
      mq.addEventListener('change', (e) => {
        this.systemDark = e.matches
      })
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
      this.scheduleAutoBackup()
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
      this.scheduleAutoBackup()
    },
    async removeTab(tabId: string): Promise<void> {
      const db = this.getDbOrThrow()
      softDeleteTab(db, tabId, Date.now())
      this.tabs = loadTabs(db)
      if (this.activeTabId === tabId) {
        this.activeTabId = this.visibleTabs[0]?.id ?? ''
      }
      this.sites = loadSites(db)
      this.scheduleAutoBackup()
    },
    /** 级联删除：标签及其下全部网站（墓碑软删除） */
    async removeTabCascade(tabId: string): Promise<void> {
      const db = this.getDbOrThrow()
      this.sites
        .filter((s) => s.tabId === tabId && !s.isDeleted)
        .forEach((s) => softDeleteSite(db, s.id, Date.now()))
      softDeleteTab(db, tabId, Date.now())
      this.tabs = loadTabs(db)
      this.sites = loadSites(db)
      if (this.activeTabId === tabId) {
        this.activeTabId = this.visibleTabs[0]?.id ?? ''
      }
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
      this.scheduleAutoBackup()
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
      this.scheduleAutoBackup()
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
      this.scheduleAutoBackup()
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
    /** 切换主题（基于当前实际生效的暗色状态，保证每次点击立即可见变化；同时关闭“跟随系统”） */
    async toggleTheme(): Promise<void> {
      const next = this.effectiveDark ? 'light' : 'dark'
      await this.patchSetting('themeFollowSystem', false)
      await this.patchSetting('theme', next)
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

    /** ---------- 搜索引擎 ---------- */
    persistEngines(next: Engine[]) {
      const db = this.getDbOrThrow()
      saveEngines(db, next)
      this.engines = next
    },
    setEngineDefault(id: string): boolean {
      const next = applySetDefault(this.engines, id)
      if (next === this.engines) return false
      this.persistEngines(next)
      return true
    },
    /** 禁用/启用；返回转移的默认引擎名（未转移为 null） */
    toggleEngineDisabled(id: string, disabled: boolean): string | null {
      const { engines, transferredTo } = applyToggleDisabled(this.engines, id, disabled)
      this.persistEngines(engines)
      return transferredTo
    },
    addEngine(name: string, url: string): { ok: boolean; msg?: string } {
      if (!name.trim()) return { ok: false, msg: '请填写引擎名称' }
      if (!url.includes('%s') && !/^https?:\/\//.test(url)) return { ok: false, msg: 'URL 需以 http(s):// 开头' }
      const id = `e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      const maxSort = Math.max(0, ...this.engines.map((e) => e.sort))
      const next: Engine[] = [
        ...this.engines,
        { id, name: name.trim(), url: url.trim(), isDefault: false, sort: maxSort + 1, isBuiltIn: false, disabled: false },
      ]
      this.persistEngines(ensureSingleDefault(next))
      return { ok: true }
    },
    updateEngine(id: string, patch: { name?: string; url?: string }): { ok: boolean; msg?: string } {
      const target = this.engines.find((e) => e.id === id)
      if (!target) return { ok: false, msg: '引擎不存在' }
      if (patch.url !== undefined && !patch.url.includes('%s') && !/^https?:\/\//.test(patch.url)) {
        return { ok: false, msg: 'URL 需以 http(s):// 开头' }
      }
      const next = this.engines.map((e) =>
        e.id === id
          ? { ...e, name: patch.name?.trim() || e.name, url: patch.url?.trim() ?? e.url }
          : e,
      )
      this.persistEngines(next)
      return { ok: true }
    },
    /** 删除自定义引擎（内置返回 blocked）；返回转移的默认引擎名 */
    removeEngine(id: string): { transferredTo: string | null; blocked: boolean } {
      const { engines, transferredTo, blocked } = applyRemove(this.engines, id)
      if (!blocked) this.persistEngines(engines)
      return { transferredTo, blocked }
    },
    /** 搜索提交：本地引擎 → 站内过滤；其它 → 新窗口打开搜索引擎 */
    submitSearch(query: string): boolean {
      const q = query.trim()
      if (!q) return false
      const engine = this.currentEngine
      if (isLocalEngine(engine)) {
        this.setSearch(q)
        return true
      }
      const target = buildSearchUrl(engine, q)
      if (target) window.open(target, '_blank', 'noopener')
      return true
    },
    setEngineAsActive(id: string) {
      // 下拉选择即临时切换默认（持久化为默认，符合直觉）
      this.setEngineDefault(id)
    },

    /** ---------- 断链检测 ---------- */
    async startLinkCheck(): Promise<void> {
      if (this.linkCheck.running) return
      const db = this.getDbOrThrow()
      linkCheckAbort = new AbortController()
      this.linkCheck = { running: true, total: 0, current: 0, invalidCount: 0 }
      const urls = [...new Set(this.sites.filter((s) => !s.isDeleted).map((s) => s.url))]
      try {
        const results = await checkDeadLinks(
          urls,
          (p) => {
            this.linkCheck = { running: true, ...p }
          },
          linkCheckAbort.signal,
        )
        if (results.length > 0) {
          updateLinkCheckResults(db, results, Date.now())
          this.sites = loadSites(db)
        }
      } finally {
        this.linkCheck = { running: false, total: 0, current: 0, invalidCount: 0 }
        linkCheckAbort = null
      }
    },
    cancelLinkCheck() {
      linkCheckAbort?.abort()
    },
    toggleShowOnlyBroken() {
      this.showOnlyBroken = !this.showOnlyBroken
    },

    /** ---------- 自动存档（版本历史） ---------- */
    /** 数据变更后调用：5 分钟防抖触发自动存档 */
    scheduleAutoBackup() {
      if (autoBackupTimer) clearTimeout(autoBackupTimer)
      autoBackupTimer = setTimeout(() => {
        void this.captureBackup('auto')
      }, AUTO_BACKUP_DEBOUNCE_MS)
    },
    /** 立即存档；auto 档受「同日去重 + 防抖窗口」限制，返回是否实际存入 */
    async captureBackup(kind: 'auto' | 'manual'): Promise<boolean> {
      const db = this.getDbOrThrow()
      const now = Date.now()
      if (kind === 'auto') {
        const lastAuto = this.backups.find((b) => b.kind === 'auto')
        if (lastAuto && isSameDay(lastAuto.createdAt, now)) return false
        if (!shouldAutoBackup(lastAuto?.createdAt ?? null, now)) return false
      }
      const payload = JSON.stringify({ tabs: this.visibleTabs, sites: sortSites(this.sites) })
      const rec: BackupRecord = { id: makeBackupId(new Date(now)), createdAt: now, kind, payload }
      insertBackup(db, rec)
      this.backups = listBackups(db)
      return true
    },
    /** 恢复存档（先自动存一份保护现场） */
    async restoreBackup(id: string): Promise<boolean> {
      const db = this.getDbOrThrow()
      const rec = getBackup(db, id)
      if (!rec) return false
      let payload: { tabs?: unknown; sites?: unknown }
      try {
        payload = JSON.parse(rec.payload)
      } catch {
        return false
      }
      if (!Array.isArray(payload.tabs) || !Array.isArray(payload.sites)) return false
      // 恢复前保护现场
      await this.captureBackup('manual')
      const envelope = validateBackupEnvelope({
        app: 'Cabin',
        version: CABIN_BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        tabs: payload.tabs,
        sites: payload.sites,
      })
      if (!envelope) return false
      replaceAll(db, envelope.tabs, envelope.sites)
      this.tabs = loadTabs(db)
      this.sites = loadSites(db)
      this.backups = listBackups(db)
      return true
    },
    async removeBackup(id: string): Promise<void> {
      const db = this.getDbOrThrow()
      deleteBackup(db, id)
      this.backups = listBackups(db)
    },

    /** 退出前强制落盘 */
    async flush(): Promise<void> {
      await persistNow()
    },
  },
})
