/**
 * ID 生成（SPEC §C.1）。原实现用自增/时间戳，这里统一出口，便于测试与迁移。
 * ⛔ 不引入 `uuid` 之类的依赖：需求只是「同一次会话内不重复」（红线：不为 10 行逻辑装包）。
 */

let counter = 0;

function randomSuffix(): string {
  const globalCrypto = typeof crypto !== 'undefined' ? crypto : undefined;
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

/** 家具 / 测量等运行时对象的 id（不持久化语义，仅需唯一） */
export function uid(prefix = 'f'): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${randomSuffix()}`;
}

/** 用户新建户型的 id（会写进 localStorage，前缀区分内置与自定义） */
export function newPlanId(): string {
  return uid('p');
}
