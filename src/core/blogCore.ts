/**
 * 博客纯逻辑：slug / 派生内容 / 状态机（草稿↔发布）/ 筛选排序分页 /
 * 发布校验 / Markdown 工具栏变换 / 相对时间
 * （零运行时依赖，node --experimental-strip-types 可测）
 */
import type { BlogPost, BlogCategory, BlogPostStatus, BlogSort } from '../types'

/* ==================== 常量 ==================== */

/** 保留 slug（与导航路径冲突的字） */
export const RESERVED_SLUGS = ['admin', 'article', 'new', 'edit', 'settings', 'api']
/** 阅读时长：字/分钟 */
export const CHARS_PER_MINUTE = 400
/** 默认摘要长度 */
export const DEFAULT_EXCERPT_LENGTH = 120
/** 默认每页条数 */
export const DEFAULT_PAGE_SIZE = 9

/* ==================== 常量标签 ==================== */

export const ARTICLE_STATUS_LABELS: Record<BlogPostStatus, string> = {
  draft: '草稿',
  published: '已发布',
}

/* ==================== ID / Slug ==================== */

/** 带前缀的唯一 ID */
export function newId(prefix = 'bp'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * slug 生成：保留中文、英文小写、符号折叠为 -
 * 中文直接进入 slug（URL 编码友好，Cabin 本地离线无需纯 ASCII）
 */
export function slugify(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[^\w一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
  return s
}

/** 是否保留字 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.trim().toLowerCase())
}

/** slug 唯一化：冲突追加 -2/-3… */
export function makeUniqueSlug(base: string, existing: string[]): string {
  const taken = new Set(existing.map((s) => s.toLowerCase()))
  if (!taken.has(base.toLowerCase())) return base
  let i = 2
  while (taken.has(`${base}-${i}`.toLowerCase())) i++
  return `${base}-${i}`
}

/** 未填 slug 时的默认值：时间戳 + 随机字母 */
export function defaultSlug(now = Date.now()): string {
  const d = new Date(now)
  const pad = (n: number) => String(n).padStart(2, '0')
  const ts =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  const letters = 'abcdefghjkmnpqrstuvwxyz'
  let rand = ''
  for (let i = 0; i < 4; i++) rand += letters[Math.floor(Math.random() * letters.length)]
  return `${ts}-${rand}`
}

/* ==================== 派生内容 ==================== */

/** Markdown → 纯文本（剥代码块/图片/链接标记） */
export function plainTextOfMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ') // 代码块
    .replace(/`[^`]*`/g, ' ') // 行内码
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接保留文字
    .replace(/[#>*_~\-]+/g, ' ') // 标记符号
    .replace(/\s+/g, ' ')
    .trim()
}

/** 阅读时长（向上取整，最少 1 分钟） */
export function estimateReadingMinutes(md: string): number {
  const text = plainTextOfMarkdown(md)
  return Math.max(1, Math.ceil(text.length / CHARS_PER_MINUTE))
}

/** 自动摘要：纯文本截断（超长加 …） */
export function autoExcerpt(md: string, length = DEFAULT_EXCERPT_LENGTH): string {
  const text = plainTextOfMarkdown(md)
  if (text.length <= length) return text
  return text.slice(0, length) + '…'
}

/** 正文字数统计（写作统计用） */
export function countChars(md: string): number {
  return plainTextOfMarkdown(md).replace(/\s/g, '').length
}

/* ==================== 状态机（离线精简版） ==================== */

export type ArticleAction = 'publish' | 'unpublish'

/** 下一状态（非法动作返回 null） */
export function nextStatus(status: BlogPostStatus, action: ArticleAction): BlogPostStatus | null {
  if (action === 'publish' && status === 'draft') return 'published'
  if (action === 'unpublish' && status === 'published') return 'draft'
  return null
}

/** 动作是否可用 */
export function canTransit(status: BlogPostStatus, action: ArticleAction): boolean {
  return nextStatus(status, action) !== null
}

/* ==================== 发布校验 ==================== */

/** 发布前全量校验；返回错误列表（空 = 通过） */
export function collectPublishErrors(
  post: { title: string; slug: string; contentMarkdown: string },
  existingSlugs: string[],
): string[] {
  const errors: string[] = []
  if (!post.title.trim()) errors.push('标题不能为空')
  else if (post.title.trim().length > 100) errors.push('标题不能超过 100 字')
  const slug = post.slug.trim()
  if (!slug) errors.push('slug 不能为空')
  else if (isReservedSlug(slug)) errors.push(`slug「${slug}」是保留字`)
  else if (existingSlugs.some((s) => s.toLowerCase() === slug.toLowerCase())) {
    errors.push(`slug「${slug}」已被占用`)
  }
  if (!post.contentMarkdown.trim()) errors.push('正文不能为空')
  return errors
}

/* ==================== 查询 / 排序 / 分页 ==================== */

/** 关键词 + 状态 + 分类 + 标签过滤（active = 未删除） */
export function filterPosts(
  posts: BlogPost[],
  opts: {
    keyword?: string
    status?: BlogPostStatus | 'all'
    categoryId?: string
    tagId?: string
    includeDeleted?: boolean
  },
): BlogPost[] {
  const kw = opts.keyword?.trim().toLowerCase() ?? ''
  return posts.filter((p) => {
    if (!opts.includeDeleted && p.deletedAt !== null) return false
    if (opts.status && opts.status !== 'all' && p.status !== opts.status) return false
    if (opts.categoryId && p.categoryId !== opts.categoryId) return false
    if (opts.tagId && !p.tagIds.includes(opts.tagId)) return false
    if (kw) {
      const hay = `${p.title}\n${p.subtitle}\n${p.excerpt}\n${p.contentMarkdown}`.toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })
}

/** 排序（置顶恒在最前；同组按所选序） */
export function sortPosts(posts: BlogPost[], sort: BlogSort): BlogPost[] {
  const list = [...posts]
  const cmp: Record<BlogSort, (a: BlogPost, b: BlogPost) => number> = {
    'updated-desc': (a, b) => b.updatedAt - a.updatedAt,
    'updated-asc': (a, b) => a.updatedAt - b.updatedAt,
    'created-desc': (a, b) => b.createdAt - a.createdAt,
    'published-desc': (a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0),
    'views-desc': (a, b) => b.viewCount - a.viewCount,
    'title-asc': (a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'),
  }
  const byPinned = (a: BlogPost, b: BlogPost) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return cmp[sort](a, b)
  }
  return list.sort(byPinned)
}

/** 分页（页码越界兜底第 1 页；pageSize 最小 1） */
export function paginate<T>(
  list: T[],
  page: number,
  pageSize: number,
): { items: T[]; page: number; totalPages: number; total: number } {
  const size = Math.max(1, pageSize)
  const total = list.length
  const totalPages = Math.max(1, Math.ceil(total / size))
  const cur = Math.min(Math.max(1, page), totalPages)
  return {
    items: list.slice((cur - 1) * size, cur * size),
    page: cur,
    totalPages,
    total,
  }
}

/* ==================== Markdown 工具栏 ==================== */

export type MdTool =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'h2'
  | 'quote'
  | 'ul'
  | 'ol'
  | 'link'
  | 'hr'

/**
 * 工具栏文本变换：选区包裹 / 行前缀，返回新文本与恢复后的选区
 * （编辑器 textarea 光标还原用）
 */
export function applyMarkdown(
  text: string,
  start: number,
  end: number,
  tool: MdTool,
): { text: string; start: number; end: number } {
  const sel = text.slice(start, end)

  const wrap = (mark: string, space = '') => {
    const inner = sel || space
    return {
      text: text.slice(0, start) + mark + inner + mark + text.slice(end),
      start: start + mark.length,
      end: start + mark.length + inner.length,
    }
  }

  const linePrefix = (prefix: string) => {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1
    const lineEnd = text.indexOf('\n', end) === -1 ? text.length : text.indexOf('\n', end)
    const lines = text.slice(lineStart, lineEnd).split('\n')
    const allPrefixed = lines.every((l) => l.startsWith(prefix) || l.trim() === '')
    const next = lines
      .map((l) => (allPrefixed ? l.replace(new RegExp(`^${escapeRegExp(prefix)}`), '') : prefix + l))
      .join('\n')
    return {
      text: text.slice(0, lineStart) + next + text.slice(lineEnd),
      start: lineStart,
      end: lineStart + next.length,
    }
  }

  switch (tool) {
    case 'bold':
      return wrap('**', '加粗文字')
    case 'italic':
      return wrap('*', '斜体文字')
    case 'strike':
      return wrap('~~', '删除线')
    case 'code':
      return wrap('`', '代码')
    case 'h2':
      return linePrefix('## ')
    case 'quote':
      return linePrefix('> ')
    case 'ul':
      return linePrefix('- ')
    case 'ol':
      return linePrefix('1. ')
    case 'link': {
      const inner = sel || '链接文字'
      const out = `[${inner}](https://)`
      return {
        text: text.slice(0, start) + out + text.slice(end),
        start: start + inner.length + 3,
        end: start + inner.length + 3 + 'https://'.length,
      }
    }
    case 'hr':
      return {
        text: text.slice(0, end) + '\n\n---\n\n' + text.slice(end),
        start: end + 6,
        end: end + 6,
      }
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/* ==================== 格式化 ==================== */

/** 时间格式化 YYYY-MM-DD HH:mm（非法返回 -） */
export function formatDateTime(ts: number | null): string {
  if (!ts || Number.isNaN(ts)) return '-'
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

/** 相对时间：刚刚/N分钟前/N小时前/N天前 */
export function relativeTime(ts: number, now = Date.now()): string {
  const diff = now - ts
  if (diff < 0) return '刚刚'
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${day} 天前`
  return formatDateTime(ts).slice(0, 10)
}

/* ==================== 静态导出（Cabin 独有） ==================== */

/**
 * 导出单文件静态 HTML（含全部已发布文章，内联暗色样式）
 * 离线博客天然适合「导出可拷贝分享的静态站点」
 */
export function buildStaticExport(
  settings: { blogName: string; blogDescription: string },
  posts: BlogPost[],
  resolveCategory: (id: string) => string,
): string {
  const published = sortPosts(
    posts.filter((p) => p.status === 'published' && p.deletedAt === null),
    'published-desc',
  )
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const items = published
    .map(
      (p) => `
    <article class="post" id="${esc(p.slug)}">
      ${p.pinned ? '<span class="pin">置顶</span>' : ''}
      <h2><a href="#${esc(p.slug)}">${esc(p.title)}</a></h2>
      ${p.subtitle ? `<p class="sub">${esc(p.subtitle)}</p>` : ''}
      <div class="meta">${esc(resolveCategory(p.categoryId) || '未分类')} · ${formatDateTime(p.publishedAt ?? p.createdAt)} · ${p.readingMinutes} 分钟阅读</div>
      ${p.excerpt ? `<p class="excerpt">${esc(p.excerpt)}</p>` : ''}
      <pre class="body">${esc(p.contentMarkdown)}</pre>
    </article>`,
    )
    .join('')

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(settings.blogName)}</title>
<style>
body{margin:0;background:#0d1a3b;color:#e6eaf5;font-family:'PingFang SC','Microsoft YaHei',sans-serif;line-height:1.75}
.shell{max-width:860px;margin:0 auto;padding:40px 20px}
header h1{color:#22c58b;font-size:30px;margin:0 0 6px}header p{color:#8d99b8;margin:0 0 36px}
.post{position:relative;background:rgba(30,44,84,.55);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:24px 26px;margin-bottom:18px}
.post h2{margin:0 0 6px;font-size:21px}.post h2 a{color:#e6eaf5;text-decoration:none}
.sub{color:#8d99b8;margin:0 0 8px;font-size:14px}
.meta{color:#8d99b8;font-size:12px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:10px;margin-bottom:10px}
.excerpt{color:#c3cbe0;font-size:14px}
.body{white-space:pre-wrap;word-break:break-word;background:rgba(0,0,0,.25);border-radius:8px;padding:14px;font-family:inherit;font-size:13.5px;color:#c3cbe0;overflow:auto}
.pin{position:absolute;top:14px;right:16px;background:rgba(34,197,139,.18);color:#22c58b;font-size:11px;border-radius:4px;padding:2px 8px}
footer{color:#8d99b8;text-align:center;font-size:12px;margin-top:36px}
</style></head><body><div class="shell">
<header><h1>${esc(settings.blogName)}</h1><p>${esc(settings.blogDescription)}</p></header>
${items || '<p style="color:#8d99b8">暂无已发布文章</p>'}
<footer>由 Cabin 导出 · 共 ${published.length} 篇</footer>
</div></body></html>`
}

/* ==================== 分类 / 标签 ==================== */

/** 过滤出有文章引用的分类（前台不显示空分类） */
export function categoriesWithPosts(
  categories: BlogCategory[],
  posts: BlogPost[],
): BlogCategory[] {
  const used = new Set(posts.filter((p) => p.deletedAt === null).map((p) => p.categoryId))
  return categories.filter((c) => used.has(c.id))
}

/** 标签使用计数（前台 pill 带计数） */
export function tagUsageCount(posts: BlogPost[], tagId: string): number {
  return posts.filter((p) => p.deletedAt === null && p.tagIds.includes(tagId)).length
}
