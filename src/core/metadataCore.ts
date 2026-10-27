/**
 * 网站元数据抓取纯逻辑：Jina.ai → allorigins 双降级（零后端，适配纯静态部署）
 * 解析函数纯化（可 node 单测），fetch 可注入便于测试
 */

export interface UrlMetadata {
  title: string
  description: string
  icon: string
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/** Jina.ai 解析：Title 行 + Markdown Content 抽有意义行拼描述 */
export function parseJina(text: string, pageUrl: string): UrlMetadata | null {
  if (!text || text.startsWith('{')) return null // JSON 错误响应
  let title = ''
  for (const line of text.split('\n')) {
    if (line.startsWith('Title:')) {
      title = line.replace('Title:', '').trim()
      break
    }
  }
  if (!title) return null

  let description = ''
  const contentStart = text.indexOf('Markdown Content:')
  if (contentStart !== -1) {
    const content = text.slice(contentStart + 'Markdown Content:'.length)
    const skipPatterns = [
      /^#+\s/,
      /^\*+\s/,
      /^!\[[^\]]*\]\(/,
      /^\[[^\]]*\]\(/,
      /^>\s/,
      /^(登录|注册|首页|下载|更多)$/,
      /^\s*$/,
    ]
    const meaningful: string[] = []
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.length > 10 && !skipPatterns.some((p) => p.test(trimmed))) {
        const clean = trimmed
          .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
          .replace(/[*_`#]/g, '')
          .replace(/[-]{3,}/g, '')
          .trim()
        if (clean.length > 10) meaningful.push(clean)
      }
    }
    description = meaningful.slice(0, 3).join('。').trim()
    if (description.length > 300) description = description.slice(0, 300) + '...'
  }

  let origin = ''
  try {
    origin = new URL(pageUrl).origin
  } catch {
    return null
  }
  return { title, description, icon: `${origin}/favicon.ico` }
}

/** allorigins 返回的 HTML 解析：title / og:description / link rel=icon */
export function parseHtmlMeta(html: string, pageUrl: string): UrlMetadata | null {
  if (!html) return null
  let origin = ''
  try {
    origin = new URL(pageUrl).origin
  } catch {
    return null
  }

  const titleMatch =
    html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
    html.match(/data-next-head="">([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : ''
  if (!title) return null

  let description = ''
  const ogDesc = html.match(
    /property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
  )
  const metaDesc = html.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i)
  description = (ogDesc?.[1] ?? metaDesc?.[1] ?? '').trim()

  let icon = ''
  const iconMatch =
    html.match(/<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i) ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["'](?:icon|shortcut icon)["']/i)
  if (iconMatch) {
    const href = iconMatch[1]
    icon = href.startsWith('http') ? href : `${origin}${href.startsWith('/') ? '' : '/'}${href}`
  } else {
    icon = `${origin}/favicon.ico`
  }

  return { title, description: description.slice(0, 300), icon }
}

/** Jina 抓取（8s 超时） */
async function fetchViaJina(url: string, fetcher: FetchLike): Promise<UrlMetadata | null> {
  try {
    const u = new URL(url)
    const jinaUrl = `https://r.jina.ai/${u.protocol.replace(':', '')}://${u.host}${u.pathname}`
    const resp = await fetcher(jinaUrl, { signal: AbortSignal.timeout(8000) })
    if (!resp.ok) return null
    return parseJina(await resp.text(), url)
  } catch {
    return null
  }
}

/** allorigins 代理抓取（10s 超时） */
async function fetchViaAllorigins(url: string, fetcher: FetchLike): Promise<UrlMetadata | null> {
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
    const resp = await fetcher(proxyUrl, { signal: AbortSignal.timeout(10000) })
    if (!resp.ok) return null
    return parseHtmlMeta(await resp.text(), url)
  } catch {
    return null
  }
}

/** 降级链：Jina → allorigins；全部失败返回 null（调用方静默降级） */
export async function fetchMetadata(
  url: string,
  fetcher: FetchLike = fetch,
): Promise<UrlMetadata | null> {
  if (!url) return null
  try {
    const viaJina = await fetchViaJina(url, fetcher)
    if (viaJina) return viaJina
    return await fetchViaAllorigins(url, fetcher)
  } catch {
    return null
  }
}
