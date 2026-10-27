/**
 * blogCore 纯函数单测
 */
import {
  slugify, isReservedSlug, makeUniqueSlug, defaultSlug,
  plainTextOfMarkdown, estimateReadingMinutes, autoExcerpt, countChars,
  nextStatus, canTransit, collectPublishErrors,
  filterPosts, sortPosts, paginate,
  applyMarkdown, formatDateTime, relativeTime,
  buildStaticExport, categoriesWithPosts, tagUsageCount,
} from '../src/core/blogCore.ts'
import type { BlogPost, BlogCategory } from '../src/types/index.ts'

let failed = 0
function ok(cond: boolean, msg: string) {
  if (cond) console.log(`  ✓ ${msg}`)
  else {
    failed++
    console.error(`  ✗ ${msg}`)
  }
}

const now = 1700000000000
function mkPost(over: Partial<BlogPost> = {}): BlogPost {
  return {
    id: 'bp_1', slug: 'hello', title: '你好世界', subtitle: '', excerpt: '',
    contentMarkdown: '# 正文\n这是一段足够长的正文内容用于测试各种派生逻辑。',
    status: 'published', categoryId: '', tagIds: [], pinned: false,
    viewCount: 0, readingMinutes: 1, createdAt: now, updatedAt: now,
    publishedAt: now, deletedAt: null, ...over,
  }
}

console.log('[slug / id]')
ok(slugify('My First Post!') === 'my-first-post', '英文符号折叠小写')
ok(slugify('小木屋手记 第一篇') === '小木屋手记-第一篇', '中文保留')
ok(slugify('  ---  ') === '', '全符号返回空')
ok(isReservedSlug('Admin'), '保留字大小写不敏感')
ok(!isReservedSlug('my-post'), '普通 slug 非保留字')
ok(makeUniqueSlug('a', ['A', 'a-2']) === 'a-3', '唯一化追加后缀')
ok(makeUniqueSlug('b', []) === 'b', '无冲突原样返回')
ok(/^\d{14}-[a-z]{4}$/.test(defaultSlug(now)), 'defaultSlug 格式')

console.log('[派生内容]')
const md = '# 标题\n正文**加粗**与 `代码`，[链接](https://x.com) 与 ![图](https://y.com/i.png)\n```js\nconst a = 1\n```'
ok(!plainTextOfMarkdown(md).includes('const a'), '剥代码块')
ok(plainTextOfMarkdown(md).includes('链接'), '链接保留文字')
ok(plainTextOfMarkdown(md).length > 0, '有纯文本')
ok(estimateReadingMinutes('字'.repeat(800)) === 2, '800字→2分钟')
ok(estimateReadingMinutes('短') === 1, '最少1分钟')
ok(autoExcerpt('短摘要', 120) === '短摘要', '不超长原样')
ok(autoExcerpt('长'.repeat(200), 50).endsWith('…') && autoExcerpt('长'.repeat(200), 50).length === 51, '超长截断加省略号')
ok(countChars('abc def') === 6, '字数去空格')

console.log('[状态机（草稿↔发布）]')
ok(nextStatus('draft', 'publish') === 'published', '草稿可发布')
ok(nextStatus('published', 'unpublish') === 'draft', '已发布可撤回')
ok(nextStatus('draft', 'unpublish') === null, '草稿不能撤回')
ok(nextStatus('published', 'publish') === null, '已发布不能重复发布')
ok(canTransit('draft', 'publish') && !canTransit('draft', 'unpublish'), 'canTransit 判定')

console.log('[发布校验]')
ok(collectPublishErrors({ title: '', slug: 'a', contentMarkdown: 'x' }, []).includes('标题不能为空'), '空标题')
ok(collectPublishErrors({ title: 'T', slug: 'admin', contentMarkdown: 'x' }, []).some((e) => e.includes('保留字')), '保留字 slug')
ok(collectPublishErrors({ title: 'T', slug: 'dup', contentMarkdown: 'x' }, ['Dup']).some((e) => e.includes('占用')), 'slug 占用（大小写不敏感）')
ok(collectPublishErrors({ title: 'T', slug: 'ok', contentMarkdown: '' }, []).includes('正文不能为空'), '空正文')
ok(collectPublishErrors({ title: 'T', slug: 'ok', contentMarkdown: '内容' }, []).length === 0, '合法通过')

console.log('[筛选 / 排序 / 分页]')
const p1 = mkPost({ id: '1', title: '苹果', status: 'published', categoryId: 'c1', tagIds: ['t1'], updatedAt: now, viewCount: 5 })
const p2 = mkPost({ id: '2', title: '香蕉', status: 'draft', categoryId: 'c2', tagIds: ['t2'], updatedAt: now + 1, viewCount: 50 })
const p3 = mkPost({ id: '3', title: 'APPLE 搜索', status: 'published', categoryId: 'c1', tagIds: [], updatedAt: now + 2, viewCount: 1, pinned: true })
const all = [p1, p2, p3]
ok(filterPosts(all, { status: 'published' }).length === 2, '状态筛选')
ok(filterPosts(all, { keyword: 'apple' }).length === 1, '关键词命中英文标题')
ok(filterPosts(all, { keyword: '苹果' }).length === 1, '关键词命中中文标题')
ok(filterPosts(all, { categoryId: 'c1' }).length === 2, '分类筛选')
ok(filterPosts(all, { tagId: 't1' }).length === 1, '标签筛选')
ok(filterPosts([...all, mkPost({ id: '9', deletedAt: 1 })], {}).length === 3, '默认排除已删')
const sorted = sortPosts(all, 'views-desc')
ok(sorted[0].id === '3', '置顶恒在最前')
ok(sorted[1].id === '2', '同组按阅读量')
const byTitle = sortPosts([p1, p3], 'title-asc')
ok(byTitle[0].title.startsWith('APPLE'), '标题排序（中文 locale）')
const pg = paginate([1, 2, 3, 4, 5], 2, 2)
ok(pg.items.length === 2 && pg.totalPages === 3 && pg.page === 2, '分页基本')
const pgOver = paginate([1], 99, 2)
ok(pgOver.page === 1 && pgOver.items.length === 1, '越界兜底第1页')
const pgZero = paginate([1, 2], 1, 0)
ok(pgZero.totalPages === 2, 'pageSize=0 兜底为1')

console.log('[applyMarkdown 工具栏]')
const t1 = applyMarkdown('abc', 1, 2, 'bold')
ok(t1.text === 'a**b**c', '加粗包裹选区')
ok(t1.start === 3 && t1.end === 4, '光标还原到选区内的 b')
const t2 = applyMarkdown('第一行', 0, 3, 'h2')
ok(t2.text.startsWith('## 第一行'), 'H2 行前缀')
const t3 = applyMarkdown('列表项', 0, 3, 'ul')
ok(t3.text.startsWith('- 列表项'), '无序列表前缀')
const t4 = applyMarkdown('', 0, 0, 'hr')
ok(t4.text.includes('---'), '分隔线插入')
const t5 = applyMarkdown('点这里', 0, 3, 'link')
ok(t5.text === '[点这里](https://)', '链接包裹')

console.log('[格式化]')
ok(formatDateTime(null) === '-', 'null 返回 -')
ok(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(formatDateTime(now)), '时间格式')
ok(relativeTime(now - 30 * 60 * 1000, now) === '30 分钟前', '30分钟前')
ok(relativeTime(now - 3 * 24 * 60 * 60 * 1000, now) === '3 天前', '3天前')
ok(relativeTime(now - 10 * 1000, now) === '刚刚', '刚刚')

console.log('[前台辅助 / 静态导出]')
const cats: BlogCategory[] = [
  { id: 'c1', name: '技术', slug: 'tech', createdAt: now },
  { id: 'c9', name: '空分类', slug: 'empty', createdAt: now },
]
ok(categoriesWithPosts(cats, [p1, p2]).length === 1, '只保留有文章的分类')
ok(tagUsageCount([p1, p3], 't1') === 1, '标签计数排除已删')
const html = buildStaticExport({ blogName: '测试博客', blogDescription: '描述' }, [p1, p2, p3, mkPost({ id: '8', status: 'draft' })], (id) => cats.find((c) => c.id === id)?.name ?? '')
ok(html.includes('测试博客'), '导出含博客名')
ok(html.includes('苹果') && html.includes('APPLE 搜索'), '含已发布文章')
ok(!html.includes('香蕉'), '草稿不外泄')
ok(html.includes('置顶'), '置顶徽章')
ok(html.startsWith('<!doctype html>'), '完整 HTML 文档')

if (failed > 0) {
  console.error(`\n共 ${failed} 个断言失败`)
  process.exit(1)
}
console.log('\nblogCore 全部通过')
