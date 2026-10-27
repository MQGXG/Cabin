/**
 * 断链检测纯逻辑：HEAD → GET 降级、no-cors opaque 视为可达、串行 + 500ms 礼貌间隔
 * （fetch 可注入便于 node 单测）
 */

export interface CheckResult {
  url: string
  isValid: boolean
  statusCode?: number
}

export interface CheckProgress {
  total: number
  current: number
  invalidCount: number
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

const REQUEST_TIMEOUT = 8000
const INTERVAL_MS = 500

/** 带超时的请求：opaque（no-cors）视为可达；2xx/3xx 有效；异常返回 null */
async function fetchWithTimeout(
  url: string,
  method: 'HEAD' | 'GET',
  fetcher: FetchLike,
): Promise<{ status: number; ok: boolean } | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
    const resp = await fetcher(url, {
      method,
      signal: controller.signal,
      mode: 'no-cors',
    })
    clearTimeout(timer)
    if (resp.type === 'opaque') return { status: 0, ok: true }
    return { status: resp.status, ok: resp.status >= 200 && resp.status < 400 }
  } catch {
    return null
  }
}

/** 单 URL 检测：HEAD 失败降级 GET，两者皆败判失效 */
export async function checkUrl(
  url: string,
  fetcher: FetchLike = fetch,
): Promise<CheckResult> {
  const head = await fetchWithTimeout(url, 'HEAD', fetcher)
  if (head) return { url, isValid: head.ok, statusCode: head.status }
  const get = await fetchWithTimeout(url, 'GET', fetcher)
  if (get) return { url, isValid: get.ok, statusCode: get.status }
  return { url, isValid: false }
}

/** 批量检测：串行 + 间隔 500ms，支持中途取消 */
export async function checkDeadLinks(
  urls: string[],
  onProgress?: (progress: CheckProgress, result: CheckResult) => void,
  abortSignal?: AbortSignal,
  fetcher: FetchLike = fetch,
): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  let invalidCount = 0
  for (let i = 0; i < urls.length; i++) {
    if (abortSignal?.aborted) break
    const result = await checkUrl(urls[i], fetcher)
    if (!result.isValid) invalidCount++
    results.push(result)
    onProgress?.({ total: urls.length, current: i + 1, invalidCount }, result)
    if (i < urls.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    }
  }
  return results
}
