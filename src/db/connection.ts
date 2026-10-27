/**
 * Cabin 浏览器内 SQLite 连接层
 * 使用 sql.js（WASM 版 SQLite），数据库二进制整体持久化到 IndexedDB
 */
import initSqlJs, { type Database } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

export const DB_NAME = 'cabin-sqlite'
export const DB_STORE = 'sqlite'
export const DB_RECORD_ID = 'main'
export const CABIN_SCHEMA_VERSION = 1

let db: Database | null = null
let persistTimer: ReturnType<typeof setTimeout> | null = null

/** 打开（带降级的）IndexedDB */
function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DB_STORE)) {
        req.result.createObjectStore(DB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** 从 IndexedDB 读取数据库二进制 */
async function loadBlob(): Promise<Uint8Array | null> {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(DB_STORE, 'readonly')
    const req = tx.objectStore(DB_STORE).get(DB_RECORD_ID)
    req.onsuccess = () => resolve((req.result as Uint8Array | undefined) ?? null)
    req.onerror = () => reject(req.error)
  })
}

/** 将当前数据库二进制写入 IndexedDB */
async function saveBlob(data: Uint8Array): Promise<void> {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(DB_STORE, 'readwrite')
    const store = tx.objectStore(DB_STORE)
    store.put(data, DB_RECORD_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** 初始化 sql.js 并加载数据（无数据则建库建表） */
export async function initDatabase(): Promise<Database> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  const saved = await loadBlob()
  db = saved && saved.length > 0 ? new SQL.Database(saved) : new SQL.Database()
  migrate(db)
  return db
}

/** 建表 + 元信息（按需迁移，当前 v1） */
function migrate(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS tabs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'lucide:Folder',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS navigations (
      id TEXT PRIMARY KEY,
      tab_id TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      favicon TEXT NOT NULL DEFAULT '',
      click_count INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_nav_tab ON navigations (tab_id, is_deleted, sort_order);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS search_engines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      sort INTEGER NOT NULL DEFAULT 0,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      disabled INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS backups (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS blog_posts (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      excerpt TEXT NOT NULL DEFAULT '',
      content_md TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      category_id TEXT NOT NULL DEFAULT '',
      tag_ids TEXT NOT NULL DEFAULT '[]',
      pinned INTEGER NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0,
      reading_minutes INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      published_at INTEGER,
      deleted_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts (status, deleted_at, pinned, updated_at DESC);
    CREATE TABLE IF NOT EXISTS blog_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS blog_tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS blog_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
  // 旧库补列（断链检测结果）：列已存在时跳过
  addColumnIfMissing(db, 'navigations', 'is_valid', 'INTEGER');
  addColumnIfMissing(db, 'navigations', 'last_checked_at', 'INTEGER');
  const stmt = db.prepare('SELECT value FROM meta WHERE key = ?')
  stmt.bind(['schema_version'])
  let hasVersion = false
  if (stmt.step()) hasVersion = true
  stmt.free()
  if (!hasVersion) {
    db.run('INSERT INTO meta (key, value) VALUES (?, ?)', [
      'schema_version',
      String(CABIN_SCHEMA_VERSION),
    ])
    schedulePersist()
  }
}

/** 列不存在时补列（sql.js ALTER TABLE ADD COLUMN 重复会抛错） */
function addColumnIfMissing(db: Database, table: string, column: string, type: string): void {
  const stmt = db.prepare(`PRAGMA table_info(${table})`)
  let exists = false
  while (stmt.step()) {
    if ((stmt.getAsObject() as { name: string }).name === column) {
      exists = true
      break
    }
  }
  stmt.free()
  if (!exists) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
    schedulePersist()
  }
}

/** 导出当前数据库二进制 */
export function exportBytes(db: Database): Uint8Array {
  return db.export()
}

/** 数据变更后防抖持久化 */
export function schedulePersist(): void {
  if (!db) return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    void persistNow()
  }, 500)
}

/** 立即持久化（跳过防抖） */
export async function persistNow(): Promise<void> {
  if (!db) return
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  await saveBlob(exportBytes(db))
}

/** 页面关闭前兜底保存 */
export function installBeforeUnload(): void {
  window.addEventListener('beforeunload', () => {
    if (db) {
      void persistNow()
    }
  })
}

/** 获取当前数据库实例 */
export function getDb(): Database {
  if (!db) throw new Error('数据库尚未初始化，请先调用 initDatabase()')
  return db
}
