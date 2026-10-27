/**
 * engineCore 纯函数单测
 */
import {
  seedEngines, normalizeEngines, ensureSingleDefault, pickFallbackDefaultId,
  availableEngines, currentDefault, applySetDefault, applyToggleDisabled,
  applyRemove, isLocalEngine, buildSearchUrl, BUILTIN_ENGINES,
} from '../src/core/engineCore.ts'
import type { Engine } from '../src/types/index.ts'

let failed = 0
function ok(cond: boolean, msg: string) {
  if (cond) console.log(`  ✓ ${msg}`)
  else {
    failed++
    console.error(`  ✗ ${msg}`)
  }
}

console.log('[seedEngines]')
const seeded = seedEngines()
ok(seeded.length === BUILTIN_ENGINES.length, `种子 ${BUILTIN_ENGINES.length} 个内置引擎`)
ok(seeded.filter((e) => e.isDefault).length === 1, '恰好一个默认（local）')
ok(seeded.every((e) => e.isBuiltIn), '全部内置')

console.log('[normalizeEngines]')
ok(normalizeEngines(null).length === 0, '非数组返回空')
const dirty = [
  { id: 'a', name: 'A', url: 'https://a.com?q=%s', isDefault: false, sort: 1, isBuiltIn: false, disabled: false },
  { bad: true },
  { id: 'b', name: 'B', url: 'https://b.com', isDefault: true, sort: 0, isBuiltIn: false, disabled: false },
]
const normalized = normalizeEngines(dirty)
ok(normalized.length === 2 && normalized[0].id === 'b', '坏项剔除 + 按 sort 排序')

console.log('[ensureSingleDefault / pickFallback]')
const multiDefault: Engine[] = [
  { id: 'x', name: 'X', url: '', isDefault: true, sort: 0, isBuiltIn: false, disabled: false },
  { id: 'y', name: 'Y', url: '', isDefault: true, sort: 1, isBuiltIn: false, disabled: false },
]
ok(ensureSingleDefault(multiDefault).filter((e) => e.isDefault).length === 1, '多默认收敛为一个')
const noDefault: Engine[] = [
  { id: 'baidu', name: '百度', url: '', isDefault: false, sort: 0, isBuiltIn: true, disabled: false },
  { id: 'google', name: 'G', url: '', isDefault: false, sort: 1, isBuiltIn: true, disabled: false },
]
ok(ensureSingleDefault(noDefault).find((e) => e.isDefault)?.id === 'baidu', '无默认时优先百度兜底')
ok(pickFallbackDefaultId([{ ...noDefault[0], disabled: true }, { ...noDefault[1] }]) === 'google', '百度被禁用则跳过')

console.log('[availableEngines / currentDefault]')
const withDisabled: Engine[] = [
  { id: 'local', name: '本地', url: '', isDefault: true, sort: 0, isBuiltIn: true, disabled: false },
  { id: 'baidu', name: '百度', url: '', isDefault: false, sort: 1, isBuiltIn: true, disabled: true },
]
ok(availableEngines(withDisabled).length === 1, '滤禁用')
ok(availableEngines(withDisabled.map((e) => ({ ...e, disabled: true }))).length === 2, '全禁用回退全部')
ok(currentDefault(withDisabled).id === 'local', '默认引擎存活')

console.log('[applySetDefault]')
const setR = applySetDefault(seeded, 'baidu')
ok(setR.filter((e) => e.isDefault).length === 1 && setR.find((e) => e.isDefault)?.id === 'baidu', '唯一默认切换')
ok(applySetDefault(seeded, 'nope') === seeded, '不存在的引擎原样返回')

console.log('[applyToggleDisabled]')
const disabledDefault = applyToggleDisabled(seeded, 'local', true)
ok(disabledDefault.transferredTo !== null, '禁用默认引擎触发转移')
ok(disabledDefault.engines.find((e) => e.isDefault)?.id === 'local' ? false : true, '转移后默认不再是 local')
const disableNonDefault = applyToggleDisabled(seeded, 'baidu', true)
ok(disableNonDefault.transferredTo === null, '禁用非默认不转移')

console.log('[applyRemove]')
const removed = applyRemove(
  [...seeded, { id: 'custom', name: 'C', url: 'https://c.com', isDefault: false, sort: 9, isBuiltIn: false, disabled: false }],
  'custom',
)
ok(removed.engines.length === seeded.length && !removed.blocked, '自定义引擎可删')
ok(applyRemove(seeded, 'baidu').blocked, '内置引擎删除被阻止')
const customDefRemoved = applyRemove(
  [
    { ...seeded[0], isDefault: false },
    { id: 'custom', name: 'C', url: 'https://c.com', isDefault: true, sort: 9, isBuiltIn: false, disabled: false },
  ],
  'custom',
)
ok(customDefRemoved.transferredTo !== null && !customDefRemoved.blocked, '删除自定义默认引擎触发转移')

console.log('[isLocalEngine / buildSearchUrl]')
ok(isLocalEngine(seeded[0]), 'local 是站内引擎')
ok(buildSearchUrl(seeded[0], 'test') === '', 'local 不生成 URL')
const baidu = seeded.find((e) => e.id === 'baidu')!
ok(
  buildSearchUrl(baidu, 'hello world') === 'https://www.baidu.com/s?wd=hello%20world',
  '百度 URL 构建（空格编码）',
)
ok(buildSearchUrl(baidu, '  ') === '', '空查询返回空')

if (failed > 0) {
  console.error(`\n共 ${failed} 个断言失败`)
  process.exit(1)
}
console.log('\nengineCore 全部通过')
