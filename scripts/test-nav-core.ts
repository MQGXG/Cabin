/**
 * navCore 纯函数单测（node --experimental-strip-types 运行）
 */
import { slugify, sortTabs, buildNewTab, applyTabUpdate, normalizeUrl, domainOf, buildNewSite, applySiteUpdate, isDuplicateSite, suggestFavicon, exclusiveDefaultTabs } from '../src/core/navCore.ts'
import type { NavTab, NavSite } from '../src/types/index.ts'

let failed = 0
function ok(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`)
  } else {
    failed++
    console.error(`  ✗ ${msg}`)
  }
}

console.log('[slugify]')
ok(slugify('My Tools') === 'my-tools', '英文转小写连字符')
ok(slugify('常用') === 'tab-3' || slugify('常用', 3) === 'tab-3', '中文回退 tab-n')
ok(slugify('  --') === 'tab-0', '全符号回退 tab-n')

console.log('[sortTabs]')
const tabs: NavTab[] = [
  { id: '1', name: 'b', slug: 'b', icon: '⭐', sortOrder: 2, isDefault: false, updatedAt: 0, isDeleted: false },
  { id: '2', name: 'a', slug: 'a', icon: '⭐', sortOrder: 1, isDefault: true, updatedAt: 0, isDeleted: false },
  { id: '3', name: 'dead', slug: 'd', icon: '⭐', sortOrder: 0, isDefault: false, updatedAt: 0, isDeleted: true },
]
ok(sortTabs(tabs).map((t) => t.id).join(',') === '2,1', '过滤墓碑 + 按 sortOrder 升序')

console.log('[buildNewTab / applyTabUpdate]')
const t = buildNewTab({ name: '影视' }, 4, 111)
ok(t.name === '影视' && t.sortOrder === 4 && t.updatedAt === 111, '创建标签带默认值')
const t2 = applyTabUpdate(t, { name: '电影', isDefault: true }, 222)
ok(t2.name === '电影' && t2.isDefault && t2.updatedAt === 222, '更新标签字段')
ok(exclusiveDefaultTabs([t, t2], t2.id).every((x) => x.id === t2.id || !x.isDefault), '排他默认')

console.log('[normalizeUrl / domainOf]')
ok(normalizeUrl('example.com') === 'https://example.com', '补 https 协议')
ok(normalizeUrl('http://a.cn') === 'http://a.cn', '已有协议不重复补')
ok(normalizeUrl('javascript:alert(1)') === '', 'javascript: 被拒绝（防 XSS）')
ok(normalizeUrl('') === '', '空串')
ok(domainOf('https://www.example.com/x') === 'example.com', '去 www 前缀')

console.log('[buildNewSite / applySiteUpdate]')
const s = buildNewSite({ tabId: 't1', name: '例站', url: 'example.com' }, 0, 555)
ok(s.url === 'https://example.com' && s.tabId === 't1' && s.createdAt === 555, '创建站点补协议')
const s2 = applySiteUpdate(s, { url: 'other.org/about', description: 'hi' }, 666)
ok(s2.url === 'https://other.org/about' && s2.description === 'hi' && s2.updatedAt === 666, '更新站点')

console.log('[isDuplicateSite]')
const a: NavSite = { id: 'a', tabId: 't1', name: 'A', url: 'https://www.example.com', description: '', favicon: '', clickCount: 0, sortOrder: 0, createdAt: 0, updatedAt: 0, isDeleted: false }
const b: NavSite = { ...a, id: 'b', tabId: 't2', isDeleted: true }
ok(isDuplicateSite([a], 't1', 'https://example.com/'), '同域名判重（跨 www 与尾斜杠）')
ok(!isDuplicateSite([b], 't1', 'https://example.com/'), '已删除站点不参与判重')

console.log('[suggestFavicon]')
ok(suggestFavicon('https://www.cnblogs.com/').includes('favicon.im/cnblogs.com'), '生成 favicon.im 服务地址')
ok(suggestFavicon('http://hello world') === '', '非法 URL 返回空')

if (failed > 0) {
  console.error(`\n共 ${failed} 个断言失败`)
  process.exit(1)
}
console.log('\nnavCore 全部通过')
