/**
 * Cabin 批量导入纯逻辑：浏览器书签 HTML / CSV 解析
 * （不依赖 DOM 与数据库，可直接 node 单测）
 */
import type { CsvSiteRow } from '../types'

/** 解析浏览器导出的书签 HTML（提取 <a href="...">标题</a>） */
export function parseBookmarksHtml(html: string, maxCount = 500): CsvSiteRow[] {
  const results: CsvSiteRow[] = []
  const seen = new Set<string>()
  const anchorRe = /<a\s[^>]*href\s*=\s*("([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = anchorRe.exec(html)) !== null) {
    const href = (m[2] ?? m[3] ?? '').trim()
    const title = stripTags(m[4] ?? '').trim()
    if (!href || !/^https?:\/\//i.test(href)) continue
    if (!title) continue
    const key = href.replace(/\/+$/, '').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    results.push({ name: title.slice(0, 100), url: href })
    if (results.length >= maxCount) break
  }
  return results
}

/** 去掉内层标签（如 <H3> 目录名），仅保留文本 */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/** 简易 CSV 行切分（支持双引号转义，如 "，"内含逗号） */
function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cells.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur)
  return cells.map((c) => c.trim())
}

/** 解析 CSV 文本（表头：name,url[,description]，支持 BOM 与 CRLF） */
export function parseCsv(csvText: string, maxCount = 500): CsvSiteRow[] {
  const clean = csvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = clean.split('\n').filter((l) => l.trim() !== '')
  if (lines.length === 0) return []

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase())
  const hasHeader = header.includes('url') || header.includes('链接')
  const nameIdx = hasHeader ? header.findIndex((h) => h === 'name' || h === '名称' || h === '标题') : 0
  const urlIdx = hasHeader ? header.findIndex((h) => h === 'url' || h === '链接' || h === '网址') : 1
  const descIdx = hasHeader ? header.findIndex((h) => h === 'description' || h === '描述' || h === '备注') : 2

  const bodyStart = hasHeader ? 1 : 0
  const results: CsvSiteRow[] = []
  const seen = new Set<string>()
  for (let i = bodyStart; i < lines.length && results.length < maxCount; i++) {
    const cells = splitCsvLine(lines[i])
    const name = (cells[nameIdx] ?? '').trim()
    const url = (cells[urlIdx] ?? '').trim()
    const description = (cells[descIdx] ?? '').trim()
    if (!url || !/^https?:\/\//i.test(url)) continue
    const key = url.replace(/\/+$/, '').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    results.push({ name: name || url, url, description: description || undefined })
  }
  return results
}

/** 从导入行剔除无效项（返回有效行数量） */
export function countValidRows(rows: CsvSiteRow[]): number {
  return rows.filter((r) => r.url && r.name).length
}
