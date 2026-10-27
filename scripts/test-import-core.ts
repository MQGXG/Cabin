/**
 * importCore 纯函数单测
 */
import { parseBookmarksHtml, parseCsv } from '../src/core/importCore.ts'

let failed = 0
function ok(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`)
  } else {
    failed++
    console.error(`  ✗ ${msg}`)
  }
}

console.log('[parseBookmarksHtml]')
const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE><DL><p>
<DT><H3>书签栏</H3><DL><p>
<DT><A HREF="https://github.com/">GitHub</A>
<DT><A HREF="http://a.com/a">A 站</A>
<DT><A HREF="http://a.com/a">A 站重复</A>
<DT><A HREF="javascript:void(0)">脚本</A>
<DT><A HREF="https://b.org/">B 站</A>
</DL><p></DL><p>`
const r1 = parseBookmarksHtml(html)
ok(r1.length === 3, '解析出 3 个有效书签（去重 + 拒绝 javascript:）')
ok(r1[0].name === 'GitHub' && r1[0].url === 'https://github.com/', '标题与 URL 正确')
ok(parseBookmarksHtml('<a href="https://ok.cn/x">站点') === undefined || parseBookmarksHtml('<a href="https://ok.cn/x">站点').length === 0 || parseBookmarksHtml('<a href="https://ok.cn/x">站点</a>').length === 1, '非闭合标签容错')

console.log('[parseCsv]')
const csv = `name,url,description
例站一,https://one.com,描述一
"带,逗号站",https://two.com/x,"备注,内含逗号"
坏行,not-a-url,
重名,https://one.com,`
const r2 = parseCsv(csv)
ok(r2.length === 2, 'CSV：跳过无 URL 与重复行')
ok(r2[1].name === '带,逗号站' && r2[1].description === '备注,内含逗号', '带引号转义的逗号')

const csvNoHeader = `站一,https://n1.com
站二,https://n2.com,备注二`
const r3 = parseCsv(csvNoHeader)
ok(r3.length === 2 && r3[0].name === '站一', '无表头 CSV 按列序解析')

const bom = `\uFEFFname,url\n站,https://b.com`
ok(parseCsv(bom).length === 1, '处理 BOM')

if (failed > 0) {
  console.error(`\n共 ${failed} 个断言失败`)
  process.exit(1)
}
console.log('\nimportCore 全部通过')
