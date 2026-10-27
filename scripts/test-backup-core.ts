/**
 * backupCore 纯函数单测
 */
import { buildBackupEnvelope, backupFileName, validateBackupEnvelope, mergeBackup } from '../src/core/backupCore.ts'
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

const tab: NavTab = { id: 't1', name: '常用', slug: 'common', icon: '⭐', sortOrder: 0, isDefault: true, updatedAt: 0, isDeleted: false }
const site: NavSite = { id: 's1', tabId: 't1', name: 'A', url: 'https://www.a.com', description: '', favicon: '', clickCount: 3, sortOrder: 0, createdAt: 0, updatedAt: 0, isDeleted: false }
const env = buildBackupEnvelope([tab], [site])

console.log('[buildBackupEnvelope]')
ok(env.app === 'Cabin' && env.version === 1 && env.sites.length === 1, '信封结构')

console.log('[backupFileName]')
ok(/^cabin-backup-\d{8}\.json$/.test(backupFileName()), '文件名格式 cabin-backup-YYYYMMDD.json')

console.log('[validateBackupEnvelope]')
ok(validateBackupEnvelope(env) !== null, '合法信封通过')
ok(validateBackupEnvelope({ app: 'Other' }) === null, '非 Cabin 备份拒绝')
ok(validateBackupEnvelope('nope') === null, '非对象拒绝')
const dirty = { app: 'Cabin', version: 1, tabs: [tab, { bad: true }], sites: [site, { id: 's2', tabId: 'x', name: '悬空', url: 'https://z.com' }] }
const v = validateBackupEnvelope(dirty)
ok(v!.tabs.length === 1, '脏标签被过滤')
ok(v!.sites.length === 1, '悬空 tabId 的站点被剔除')

console.log('[mergeBackup]')
const localTab: NavTab = { ...tab, id: 'local_t1' }
const localSite: NavSite = { ...site, id: 'local_s1' }
const m1 = mergeBackup(env, [localTab], [localSite])
ok(m1.tabsToAdd.length === 0, 'slug 相同 → 标签不导入（避免重复分类）')
ok(m1.sitesToAdd.length === 0, '同域名 → 站点不导入')
const m2 = mergeBackup(env, [], [{ url: 'https://other.com', tabId: '', isDeleted: false }])
ok(m2.sitesToAdd.length === 1, '不同域名 → 站点导入')

if (failed > 0) {
  console.error(`\n共 ${failed} 个断言失败`)
  process.exit(1)
}
console.log('\nbackupCore 全部通过')
