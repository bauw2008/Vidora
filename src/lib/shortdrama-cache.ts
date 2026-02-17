import { logger } from '@/lib/logger';

import { ClientCache } from './client-cache';

// 短剧数据缓存配置（秒）
const SHORTDRAMA_CACHE_EXPIRE = {
  details: 4 * 60 * 60, // 详情4小时（变化较少）
  lists: 2 * 60 * 60, // 列表2小时（更新频繁）
  categories: 4 * 60 * 60, // 分类4小时（很少变化）
  episodes: 24 * 60 * 60, // 集数24小时（基本不变）
  parse: 30 * 60, // 解析结果30分钟（URL会过期）
};

// 缓存工具函数
function getCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sortedParams = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return `shortdrama-${prefix}-${sortedParams}`;
}

// 统一缓存获取方法
async function getCache<T = unknown>(key: string): Promise<T | null> {
  try {
    // 优先从统一存储获取
    const cached = await ClientCache.get<T>(key);
    if (cached) return cached;

    // 兜底：从localStorage获取（兼容性）
    if (typeof localStorage !== 'undefined') {
      const localCached = localStorage.getItem(key);
      if (localCached) {
        try {
          const { data, expire } = JSON.parse(localCached);
          if (Date.now() <= expire) {
            return data as T;
          }
          localStorage.removeItem(key);
        } catch {
          localStorage.removeItem(key);
        }
      }
    }

    return null;
  } catch (e) {
    logger.warn('获取短剧缓存失败:', e);
    return null;
  }
}

// 统一缓存设置方法
async function setCache<T = unknown>(
  key: string,
  data: T,
  expireSeconds: number,
): Promise<void> {
  try {
    // 主要存储：统一存储
    await ClientCache.set(key, data, expireSeconds);

    // 兜底存储：localStorage（兼容性，短期缓存）
    if (typeof localStorage !== 'undefined') {
      try {
        const cacheData = {
          data,
          expire: Date.now() + expireSeconds * 1000,
          created: Date.now(),
        };
        localStorage.setItem(key, JSON.stringify(cacheData));
      } catch {
        // localStorage可能满了，忽略错误
      }
    }
  } catch (e) {
    logger.warn('设置短剧缓存失败:', e);
  }
}

// 清理过期缓存
async function cleanExpiredCache(): Promise<void> {
  try {
    // 清理统一存储中的过期缓存
    await ClientCache.clearExpired('shortdrama-');

    // 清理localStorage中的过期缓存
    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('shortdrama-')) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const { expire } = JSON.parse(cached);
              if (Date.now() > expire) {
                keysToRemove.push(key);
              }
            }
          } catch {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    }
  } catch (e) {
    logger.warn('清理短剧过期缓存失败:', e);
  }
}

// 初始化缓存系统（参考豆瓣实现）
async function initShortdramaCache(): Promise<void> {
  // 立即清理一次过期缓存
  await cleanExpiredCache();

  // 每10分钟清理一次过期缓存
  setInterval(() => cleanExpiredCache(), 10 * 60 * 1000);

  logger.log('短剧缓存系统已初始化');
}

// 清除特定缓存
async function clearCache(pattern: string): Promise<void> {
  try {
    // 清理统一存储中的匹配缓存
    await ClientCache.clearExpired(pattern);

    // 清理localStorage中的匹配缓存
    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(pattern)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
      logger.log(`已清除 ${keysToRemove.length} 个匹配 '${pattern}' 的缓存`);
    }
  } catch (e) {
    logger.warn('清除缓存失败:', e);
  }
}

// 清除分类缓存
export async function clearCategoriesCache(): Promise<void> {
  await clearCache('shortdrama-categories-');
}

// 清除列表缓存
export async function clearListCache(): Promise<void> {
  await clearCache('shortdrama-lists-');
}

// 在模块加载时初始化缓存系统
if (typeof window !== 'undefined') {
  initShortdramaCache().catch(logger.error);
}

export {
  cleanExpiredCache,
  getCache,
  getCacheKey,
  setCache,
  SHORTDRAMA_CACHE_EXPIRE,
};
