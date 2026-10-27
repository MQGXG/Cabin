/**
 * 自动存档纯逻辑：5 分钟防抖窗口、同日去重、环形保留 10 版
 * （零运行时依赖，node --experimental-strip-types 可测）
 */

/** 自动存档上限（环形保留，超出删最旧） */
export const MAX_AUTO_BACKUPS = 10
/** 数据变更后防抖窗口：5 分钟内只存一份 */
export const AUTO_BACKUP_DEBOUNCE_MS = 5 * 60 * 1000

const pad = (n: number) => String(n).padStart(2, '0')

/** 存档 id：YYYYMMDD-HHmmss（同秒幂等） */
export function makeBackupId(now = new Date()): string {
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  )
}

/** 是否该触发自动存档（距上次存档超过防抖窗口） */
export function shouldAutoBackup(lastAt: number | null, now = Date.now()): boolean {
  if (lastAt === null) return true
  return now - lastAt >= AUTO_BACKUP_DEBOUNCE_MS
}

/** 同日去重键：YYYY-MM-DD */
export function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 同日判断（同一天只自动存一份，手动存档不受限） */
export function isSameDay(a: number, b: number): boolean {
  return dayKey(a) === dayKey(b)
}
