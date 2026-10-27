/**
 * metadataCore / linkCheckCore / backupRing 单测
 */
import { parseJina, parseHtmlMeta } from '../src/core/metadataCore.ts'
import { checkUrl, checkDeadLinks } from '../src/core/linkCheckCore.ts'
import { makeBackupId, shouldAutoBackup, isSameDay, AUTO_BACKUP_DEBOUNCE_MS, MAX_AUTO_BACKUPS } from '../src/core/backupRing.ts'

let failed = 0
function ok(cond: boolean, msg: string) {
  if (cond) console.log(`  ✓ ${msg}`)
  else {
    failed++
    console.error(`  ✗ ${msg}`)
  }
}

const PAGE = 'https://example.com/page'

console.log('[parseJina]')
const jinaText = `Title: 示例网站 - 首页
URL Source: https://example.com/
Markdown Content:
# 示例网站
这是示例网站的详细介绍内容，超过十个字。
[跳转](https://example.com/x)
短行
`
const jina = parseJina(jinaText, PAGE)
ok(jina?.title === '示例网站 - 首页', '标题解析')
ok((jina?.description ?? '').includes('详细介绍'), '描述抽取有意义行')
ok(jina?.icon === 'https://example.com/favicon.ico', '图标回退 origin/favicon.ico')
ok(parseJina('{"error":"rate limited"}', PAGE) === null, 'JSON 错误响应拒绝')
ok(parseJina('无标题文本', PAGE) === null, '无 Title 行拒绝')

console.log('[parseHtmlMeta]')
const html = `<!doctype html><html><head>
<title>页面标题</title>
<meta property="og:description" content="OG 描述内容">
<link rel="icon" href="/static/logo.png">
</head><body></body></html>`
const meta = parseHtmlMeta(html, PAGE)
ok(meta?.title === '页面标题', 'title 解析')
ok(meta?.description === 'OG 描述内容', 'og:description 优先')
ok(meta?.icon === 'https://example.com/static/logo.png', '相对路径 icon 补 origin')
const metaNoIcon = parseHtmlMeta('<title>仅标题</title>', PAGE)
ok(metaNoIcon?.icon === 'https://example.com/favicon.ico', '无 link icon 回退 favicon.ico')
ok(parseHtmlMeta('', PAGE) === null, '空 HTML 拒绝')

console.log('[checkUrl（注入 mock fetch）]')
const mockFetch = (resp: Partial<Response> | Error) =>
  (async () => {
    if (resp instanceof Error) throw resp
    return resp as Response
  }) as never

ok(
  (await checkUrl('https://ok.com', mockFetch({ status: 200, type: 'basic', ok: true } as Response))).isValid === true,
  '200 有效',
)
ok(
  (await checkUrl('https://gone.com', mockFetch({ status: 404, type: 'basic', ok: false } as Response))).isValid === false,
  '404 失效',
)
ok(
  (await checkUrl('https://opaque.com', mockFetch({ status: 0, type: 'opaque', ok: false } as Response))).isValid === true,
  'no-cors opaque 视为可达',
)
ok(
  (await checkUrl('https://dead.com', mockFetch(new Error('network')))).isValid === false,
  '网络异常判失效',
)

console.log('[checkDeadLinks（串行+进度+可取消）]')
const results = await checkDeadLinks(
  ['https://a.com', 'https://b.com'],
  (p) => {
    ok(p.total === 2 && p.current >= 1, `进度回调 ${p.current}/${p.total}`)
  },
  undefined,
  mockFetch({ status: 200, type: 'basic', ok: true } as Response),
)
ok(results.length === 2, '全部检测')
const ac = new AbortController()
ac.abort()
const cancelled = await checkDeadLinks(['https://c.com'], undefined, ac.signal, mockFetch({ status: 200, type: 'basic', ok: true } as Response))
ok(cancelled.length === 0, '已取消则不检测')

console.log('[backupRing]')
const id = makeBackupId(new Date('2026-01-02T03:04:05'))
ok(id === '20260102-030405', `存档 id 格式：${id}`)
ok(shouldAutoBackup(null) === true, '从未存档→立即可存')
ok(shouldAutoBackup(Date.now() - 1000) === false, '窗口内不重复')
ok(shouldAutoBackup(Date.now() - AUTO_BACKUP_DEBOUNCE_MS - 1) === true, '超窗口可存')
ok(isSameDay(Date.now(), Date.now()) === true, '同日判断')
ok(!isSameDay(new Date('2026-01-01T23:59:00').getTime(), new Date('2026-01-02T00:01:00').getTime()), '跨日不同')
ok(MAX_AUTO_BACKUPS === 10, '保留 10 份')

if (failed > 0) {
  console.error(`\n共 ${failed} 个断言失败`)
  process.exit(1)
}
console.log('\nmetadata/linkCheck/backupRing 全部通过')
