/**
 * 博客数据访问层：blog_posts / blog_categories / blog_tags / blog_settings
 */
import type { Database } from 'sql.js'
import type { BlogPost, BlogCategory, BlogTag, BlogSettings } from '../types'
import { DEFAULT_EXCERPT_LENGTH, DEFAULT_PAGE_SIZE } from '../core/blogCore'
import { schedulePersist } from './connection'

/* ==================== posts ==================== */

function rowToPost(r: Record<string, unknown>): BlogPost {
  let tagIds: string[] = []
  try {
    const parsed = JSON.parse((r.tag_ids as string) ?? '[]')
    if (Array.isArray(parsed)) tagIds = parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    tagIds = []
  }
  return {
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    subtitle: r.subtitle as string,
    excerpt: r.excerpt as string,
    contentMarkdown: r.content_md as string,
    status: r.status === 'published' ? 'published' : 'draft',
    categoryId: r.category_id as string,
    tagIds,
    pinned: !!r.pinned,
    viewCount: r.view_count as number,
    readingMinutes: r.reading_minutes as number,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
    publishedAt: (r.published_at as number | null) ?? null,
    deletedAt: (r.deleted_at as number | null) ?? null,
  }
}

export function loadPosts(db: Database, includeDeleted = true): BlogPost[] {
  const sql = includeDeleted
    ? 'SELECT * FROM blog_posts ORDER BY updated_at DESC'
    : 'SELECT * FROM blog_posts WHERE deleted_at IS NULL ORDER BY updated_at DESC'
  const stmt = db.prepare(sql)
  const rows: BlogPost[] = []
  while (stmt.step()) rows.push(rowToPost(stmt.getAsObject()))
  stmt.free()
  return rows
}

export function insertPost(db: Database, p: BlogPost): void {
  db.run(
    `INSERT INTO blog_posts (id, slug, title, subtitle, excerpt, content_md, status, category_id,
       tag_ids, pinned, view_count, reading_minutes, created_at, updated_at, published_at, deleted_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      p.id, p.slug, p.title, p.subtitle, p.excerpt, p.contentMarkdown, p.status, p.categoryId,
      JSON.stringify(p.tagIds), p.pinned ? 1 : 0, p.viewCount, p.readingMinutes,
      p.createdAt, p.updatedAt, p.publishedAt, p.deletedAt,
    ],
  )
  schedulePersist()
}

export function updatePost(db: Database, p: BlogPost): void {
  db.run(
    `UPDATE blog_posts SET slug=?, title=?, subtitle=?, excerpt=?, content_md=?, status=?,
       category_id=?, tag_ids=?, pinned=?, view_count=?, reading_minutes=?, updated_at=?,
       published_at=?, deleted_at=? WHERE id=?`,
    [
      p.slug, p.title, p.subtitle, p.excerpt, p.contentMarkdown, p.status,
      p.categoryId, JSON.stringify(p.tagIds), p.pinned ? 1 : 0, p.viewCount, p.readingMinutes,
      p.updatedAt, p.publishedAt, p.deletedAt, p.id,
    ],
  )
  schedulePersist()
}

/** 已占用的 slug 列表（排除自身与已删文章） */
export function loadSlugs(db: Database, excludeId?: string): string[] {
  const stmt = db.prepare('SELECT id, slug FROM blog_posts')
  const list: string[] = []
  while (stmt.step()) {
    const r = stmt.getAsObject() as { id: string; slug: string }
    if (r.id !== excludeId) list.push(r.slug)
  }
  stmt.free()
  return list
}

/* ==================== categories / tags ==================== */

function rowToCategory(r: Record<string, unknown>): BlogCategory {
  return { id: r.id as string, name: r.name as string, slug: r.slug as string, createdAt: r.created_at as number }
}
function rowToTag(r: Record<string, unknown>): BlogTag {
  return { id: r.id as string, name: r.name as string, slug: r.slug as string, createdAt: r.created_at as number }
}

export function loadCategories(db: Database): BlogCategory[] {
  const stmt = db.prepare('SELECT * FROM blog_categories ORDER BY created_at ASC')
  const rows: BlogCategory[] = []
  while (stmt.step()) rows.push(rowToCategory(stmt.getAsObject()))
  stmt.free()
  return rows
}

export function insertCategory(db: Database, c: BlogCategory): void {
  db.run('INSERT INTO blog_categories (id, name, slug, created_at) VALUES (?,?,?,?)', [c.id, c.name, c.slug, c.createdAt])
  schedulePersist()
}

export function updateCategory(db: Database, c: BlogCategory): void {
  db.run('UPDATE blog_categories SET name=?, slug=? WHERE id=?', [c.name, c.slug, c.id])
  schedulePersist()
}

export function deleteCategory(db: Database, id: string): void {
  db.run('DELETE FROM blog_categories WHERE id=?', [id])
  // 引用该分类的文章解绑
  db.run("UPDATE blog_posts SET category_id='' WHERE category_id=?", [id])
  schedulePersist()
}

export function loadTags(db: Database): BlogTag[] {
  const stmt = db.prepare('SELECT * FROM blog_tags ORDER BY created_at ASC')
  const rows: BlogTag[] = []
  while (stmt.step()) rows.push(rowToTag(stmt.getAsObject()))
  stmt.free()
  return rows
}

export function insertTag(db: Database, t: BlogTag): void {
  db.run('INSERT INTO blog_tags (id, name, slug, created_at) VALUES (?,?,?,?)', [t.id, t.name, t.slug, t.createdAt])
  schedulePersist()
}

export function updateTag(db: Database, t: BlogTag): void {
  db.run('UPDATE blog_tags SET name=?, slug=? WHERE id=?', [t.name, t.slug, t.id])
  schedulePersist()
}

export function deleteTag(db: Database, id: string): void {
  db.run('DELETE FROM blog_tags WHERE id=?', [id])
  // 从各文章 tag_ids 中移除
  const stmt = db.prepare('SELECT id, tag_ids FROM blog_posts')
  const updates: Array<{ id: string; ids: string[] }> = []
  while (stmt.step()) {
    const r = stmt.getAsObject() as { id: string; tag_ids: string }
    try {
      const ids = JSON.parse(r.tag_ids ?? '[]')
      if (Array.isArray(ids) && ids.includes(id)) {
        updates.push({ id: r.id, ids: (ids as string[]).filter((x) => x !== id) })
      }
    } catch {
      /* ignore */
    }
  }
  stmt.free()
  for (const u of updates) {
    db.run('UPDATE blog_posts SET tag_ids=? WHERE id=?', [JSON.stringify(u.ids), u.id])
  }
  schedulePersist()
}

/* ==================== settings ==================== */

export const DEFAULT_BLOG_SETTINGS: BlogSettings = {
  blogName: '小木屋手记',
  blogDescription: '记录与分享，存在自己的浏览器里',
  pageSize: DEFAULT_PAGE_SIZE,
  excerptLength: DEFAULT_EXCERPT_LENGTH,
}

export function loadBlogSettings(db: Database): BlogSettings {
  const settings: BlogSettings = { ...DEFAULT_BLOG_SETTINGS }
  const stmt = db.prepare('SELECT key, value FROM blog_settings')
  while (stmt.step()) {
    const r = stmt.getAsObject() as { key: string; value: string }
    if (r.key === 'blogName') settings.blogName = r.value
    else if (r.key === 'blogDescription') settings.blogDescription = r.value
    else if (r.key === 'pageSize') settings.pageSize = Number(r.value) || settings.pageSize
    else if (r.key === 'excerptLength') settings.excerptLength = Number(r.value) || settings.excerptLength
  }
  stmt.free()
  return settings
}

export function saveBlogSetting(db: Database, key: string, value: string): void {
  db.run('INSERT INTO blog_settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, value])
  schedulePersist()
}

export function saveBlogSettings(db: Database, s: BlogSettings): void {
  saveBlogSetting(db, 'blogName', s.blogName)
  saveBlogSetting(db, 'blogDescription', s.blogDescription)
  saveBlogSetting(db, 'pageSize', String(s.pageSize))
  saveBlogSetting(db, 'excerptLength', String(s.excerptLength))
}
