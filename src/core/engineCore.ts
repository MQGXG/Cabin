/**
 * 搜索引擎纯逻辑：归一 / 唯一默认 / 禁用删除时默认转移 / URL 构建
 * （零运行时依赖，node --experimental-strip-types 可测）
 */

export interface Engine {
  id: string
  name: string
  url: string // 含 %s 占位的搜索地址模板
  isDefault: boolean
  sort: number
  isBuiltIn: boolean
  disabled: boolean
}

/** 内置引擎种子（isBuiltIn：不可删除，可改 URL/禁用/设默认） */
export const BUILTIN_ENGINES: Array<Pick<Engine, 'id' | 'name' | 'url'>> = [
  { id: 'local', name: '本地搜索', url: '' }, // 站内过滤，无 URL
  { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd=%s' },
  { id: 'bing', name: '必应', url: 'https://www.bing.com/search?q=%s' },
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=%s' },
  { id: 'github', name: 'GitHub', url: 'https://github.com/search?q=%s' },
]

/** 首次种子（按序号 sort） */
export function seedEngines(): Engine[] {
  return BUILTIN_ENGINES.map((e, i) => ({
    ...e,
    isDefault: e.id === 'local',
    sort: i,
    isBuiltIn: true,
    disabled: false,
  }))
}

/** 归一外部数据：坏项剔除、字段补默认、保证恰好一个默认 */
export function normalizeEngines(raw: unknown): Engine[] {
  if (!Array.isArray(raw)) return []
  const list = raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .filter((e) => typeof e.id === 'string' && typeof e.name === 'string' && typeof e.url === 'string')
    .map((e) => ({
      id: e.id as string,
      name: e.name as string,
      url: e.url as string,
      isDefault: !!e.isDefault,
      sort: typeof e.sort === 'number' ? e.sort : 99,
      isBuiltIn: !!e.isBuiltIn,
      disabled: !!e.disabled,
    }))
    .sort((a, b) => a.sort - b.sort)
  return ensureSingleDefault(list)
}

/** 恰好一个默认：无默认→按 fallback 规则补；多默认→只留第一个 */
export function ensureSingleDefault(list: Engine[]): Engine[] {
  const defaults = list.filter((e) => e.isDefault)
  if (defaults.length === 1) return list
  if (defaults.length > 1) {
    const keepId = defaults[0].id
    return list.map((e) => ({ ...e, isDefault: e.id === keepId }))
  }
  const fallback = pickFallbackDefaultId(list)
  if (!fallback) return list
  return list.map((e) => ({ ...e, isDefault: e.id === fallback }))
}

/** 兜底默认：优先百度 → 非 local 首个 → 首个（滤禁用） */
export function pickFallbackDefaultId(list: Engine[]): string | null {
  const candidates = list.filter((e) => !e.disabled)
  if (candidates.length === 0) return null
  if (candidates.some((e) => e.id === 'baidu')) return 'baidu'
  return candidates.find((e) => e.id !== 'local')?.id ?? candidates[0].id
}

/** 可用引擎（滤禁用；全被禁用则回退全部） */
export function availableEngines(list: Engine[]): Engine[] {
  const enabled = list.filter((e) => !e.disabled)
  return enabled.length > 0 ? enabled : list
}

/** 当前默认引擎（保证存在） */
export function currentDefault(list: Engine[]): Engine {
  return availableEngines(list).find((e) => e.isDefault) ?? availableEngines(list)[0]
}

/** 设为唯一默认（引擎不存在则原样返回） */
export function applySetDefault(list: Engine[], id: string): Engine[] {
  if (!list.some((e) => e.id === id)) return list
  return list.map((e) => ({ ...e, isDefault: e.id === id }))
}

/** 禁用/启用；禁用的是默认引擎时自动转移默认（返回转移目标名，未转移为 null） */
export function applyToggleDisabled(
  list: Engine[],
  id: string,
  disabled: boolean,
): { engines: Engine[]; transferredTo: string | null } {
  if (!list.some((e) => e.id === id)) return { engines: list, transferredTo: null }
  let next = list.map((e) => (e.id === id ? { ...e, disabled } : e))
  let transferredTo: string | null = null
  const def = next.find((e) => e.isDefault)
  if (disabled && def?.id === id) {
    const targetId = pickFallbackDefaultId(next.filter((e) => e.id !== id))
    if (targetId) {
      next = next.map((e) => ({ ...e, isDefault: e.id === targetId }))
      transferredTo = next.find((e) => e.id === targetId)?.name ?? null
    }
  }
  return { engines: next, transferredTo }
}

/** 删除引擎（内置不可删）；删的是默认则转移默认 */
export function applyRemove(
  list: Engine[],
  id: string,
): { engines: Engine[]; transferredTo: string | null; blocked: boolean } {
  const target = list.find((e) => e.id === id)
  if (!target) return { engines: list, transferredTo: null, blocked: false }
  if (target.isBuiltIn) return { engines: list, transferredTo: null, blocked: true }
  let next = list.filter((e) => e.id !== id)
  let transferredTo: string | null = null
  if (target.isDefault) {
    const targetId = pickFallbackDefaultId(next)
    if (targetId) {
      next = next.map((e) => ({ ...e, isDefault: e.id === targetId }))
      transferredTo = next.find((e) => e.id === targetId)?.name ?? null
    }
  }
  return { engines: next, transferredTo, blocked: false }
}

/** 是否站内搜索引擎 */
export function isLocalEngine(engine: Engine): boolean {
  return engine.id === 'local' || engine.url === ''
}

/** 构建搜索 URL（%s 占位 → encodeURIComponent 查询词） */
export function buildSearchUrl(engine: Engine, query: string): string {
  const q = query.trim()
  if (!q) return ''
  if (isLocalEngine(engine)) return ''
  return engine.url.includes('%s')
    ? engine.url.replace('%s', encodeURIComponent(q))
    : `${engine.url}${encodeURIComponent(q)}`
}
