import { db } from './db';
import { logger } from './logger';
import { IRedisClient } from './types';

// 格式化字节大小
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 获取存储类型
function getStorageType(): string {
  return process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
}

// 获取Redis兼容存储实例（支持KVRocks、Upstash、Redis）
function getRedisStorage(): {
  client: IRedisClient;
  withRetry: <T>(fn: () => Promise<T>) => Promise<T>;
} | null {
  try {
    // 安全地访问存储实例
    const storage = db.storage;

    // 检查是否有Redis相关的方法
    if (storage && storage.client && storage.withRetry) {
      return {
        client: storage.client as IRedisClient,
        withRetry: storage.withRetry,
      };
    }

    logger.warn('当前存储类型不支持缓存统计功能');
    return null;
  } catch (error) {
    logger.warn('无法访问存储实例:', error);
    return null;
  }
}

// 数据库缓存统计和管理模块
export class DatabaseCacheManager {
  // 获取Redis兼容数据库中的缓存统计（支持KVRocks、Upstash、Redis）
  static async getKVRocksCacheStats() {
    const storageType = getStorageType();
    logger.log('🔍 开始获取Redis存储实例...');
    logger.log('🔍 存储类型:', storageType);

    const storage = getRedisStorage();
    if (!storage) {
      logger.warn('❌ Redis存储不可用，跳过数据库缓存统计');
      return null;
    }

    logger.log('✅ Redis存储实例获取成功');
    logger.log('🔍 存储方法检查: withRetry =', typeof storage.withRetry);
    logger.log('🔍 存储方法检查: client =', !!storage.client);
    logger.log('🔍 存储方法检查: client.keys =', typeof storage.client?.keys);

    const stats = {
      douban: { count: 0, size: 0, types: {} as Record<string, number> },
      shortdrama: { count: 0, size: 0, types: {} as Record<string, number> },
      tmdb: { count: 0, size: 0, types: {} as Record<string, number> },
      danmu: { count: 0, size: 0 },
      netdisk: { count: 0, size: 0 },
      search: { count: 0, size: 0 },
      tvbox: { count: 0, size: 0 },
      other: { count: 0, size: 0 },
      total: { count: 0, size: 0 },
    };

    try {
      logger.log('📊 开始从Redis兼容数据库读取缓存统计...');

      // 获取所有缓存键 - 支持不同的Redis客户端
      let allCacheKeys: string[] = [];

      logger.log(`🔍 当前存储类型: ${storageType}`);

      if (storageType === 'upstash') {
        // Upstash Redis - 尝试不同的调用方式
        logger.log('🔍 使用Upstash Redis方式获取键...');

        try {
          if (typeof storage.withRetry === 'function' && storage.client?.keys) {
            // 方式1：使用 withRetry
            allCacheKeys = await storage.withRetry(() =>
              storage.client.keys('cache:*'),
            );
          } else if (storage.client?.keys) {
            // 方式2：直接调用 client.keys
            logger.log('🔍 withRetry不可用，直接调用client.keys');
            allCacheKeys = await storage.client.keys('cache:*');
          } else {
            logger.warn('❌ Upstash存储没有可用的keys方法');
            return null;
          }
        } catch (error) {
          logger.error('❌ Upstash键获取失败:', error);
          return null;
        }
      } else if (storageType === 'kvrocks' || storageType === 'redis') {
        // KVRocks/标准Redis (带重试机制) - 保持不变
        logger.log('🔍 使用KVRocks/标准Redis方式获取键...');
        if (typeof storage.withRetry === 'function' && storage.client?.keys) {
          allCacheKeys = await storage.withRetry(() =>
            storage.client.keys('cache:*'),
          );
        } else {
          logger.warn('❌ KVRocks/Redis存储没有withRetry或client.keys方法');
          return null;
        }
      } else {
        logger.warn('❌ 不支持的存储类型或无法找到合适的keys方法');
        logger.log('🔍 存储类型:', storageType);
        return null;
      }

      logger.log(
        `📊 数据库中找到 ${allCacheKeys.length} 个缓存键:`,
        allCacheKeys.slice(0, 5),
      );

      if (allCacheKeys.length === 0) {
        return stats;
      }

      // 批量获取所有缓存数据 - 支持不同的Redis客户端
      let values: unknown[] = [];

      if (storageType === 'upstash') {
        // Upstash Redis - 尝试不同的调用方式
        try {
          if (typeof storage.withRetry === 'function' && storage.client?.mget) {
            // 方式1：使用 withRetry
            values = (await storage.withRetry(() =>
              storage.client.mget(allCacheKeys),
            )) as Array<string | null | {}>;
          } else if (storage.client?.mget) {
            // 方式2：直接调用 client.mget
            logger.log('🔍 withRetry不可用，直接调用client.mget');
            values = (await storage.client.mget(allCacheKeys)) as Array<
              string | null | {}
            >;
          } else {
            logger.warn('Upstash没有client.mget方法，使用逐个获取');
            // 回退：逐个获取
            for (const key of allCacheKeys) {
              try {
                let value = null;
                if (
                  typeof storage.withRetry === 'function' &&
                  storage.client?.get
                ) {
                  value = await storage.withRetry(() =>
                    storage.client.get(key),
                  );
                } else if (storage.client?.get) {
                  value = await storage.client.get(key);
                }
                values.push(value);
              } catch (error) {
                logger.warn(`获取缓存键 ${key} 失败:`, error);
                values.push(null);
              }
            }
          }
        } catch (error) {
          logger.error('❌ Upstash批量获取失败:', error);
          return null;
        }
      } else if (storageType === 'kvrocks' || storageType === 'redis') {
        // KVRocks/标准Redis (带重试机制) - 保持不变
        if (typeof storage.withRetry === 'function' && storage.client?.mGet) {
          values = await storage.withRetry(() =>
            storage.client.mGet(allCacheKeys),
          );
        } else {
          logger.warn('KVRocks/Redis没有mGet方法，使用逐个获取');
          // 回退：逐个获取
          for (const key of allCacheKeys) {
            try {
              let value: string | null = null;
              if (
                typeof storage.withRetry === 'function' &&
                storage.client?.get
              ) {
                const result = await storage.withRetry(() =>
                  storage.client.get(key),
                );
                value = typeof result === 'string' ? result : null;
              }
              values.push(value);
            } catch (error) {
              logger.warn(`获取缓存键 ${key} 失败:`, error);
              values.push(null);
            }
          }
        }
      } else {
        // 通用回退：逐个获取
        logger.warn('使用通用回退方法逐个获取缓存数据');
        for (const key of allCacheKeys) {
          try {
            let value: string | null | {} = null;
            if (storage.client?.get) {
              value = await storage.client.get(key);
            } else if (typeof storage.withRetry === 'function') {
              value = await storage.withRetry(() => storage.client?.get(key));
            }
            values.push(value);
          } catch (error) {
            logger.warn(`获取缓存键 ${key} 失败:`, error);
            values.push(null);
          }
        }
      }

      allCacheKeys.forEach((fullKey: string, idx: number) => {
        const key = fullKey.replace('cache:', ''); // 移除前缀
        const data = values[idx];
        if (!data) return;

        // 计算数据大小 - 智能处理不同数据类型
        let size = 0;
        if (typeof data === 'string') {
          size = data.length;
        } else if (typeof data === 'object' && data !== null) {
          // 如果是对象，序列化后计算大小
          size = JSON.stringify(data).length;
        } else {
          size = String(data).length;
        }

        if (key.startsWith('douban-')) {
          stats.douban.count++;
          stats.douban.size += size;

          const type = key.split('-')[1];
          stats.douban.types[type] = (stats.douban.types[type] || 0) + 1;
        } else if (key.startsWith('shortdrama-')) {
          stats.shortdrama.count++;
          stats.shortdrama.size += size;

          const type = key.split('-')[1];
          stats.shortdrama.types[type] =
            (stats.shortdrama.types[type] || 0) + 1;
        } else if (key.startsWith('tmdb-poster:')) {
          // 统一的海报搜索缓存（新版格式）
          stats.tmdb.count++;
          stats.tmdb.size += size;

          const subKey = key.replace('tmdb-poster:', '');
          const type = subKey.startsWith('trending-')
            ? 'poster-trending'
            : 'poster-search';
          stats.tmdb.types[type] = (stats.tmdb.types[type] || 0) + 1;
        } else if (key.startsWith('tmdb-')) {
          stats.tmdb.count++;
          stats.tmdb.size += size;

          const type = key.split('-')[1];
          stats.tmdb.types[type] = (stats.tmdb.types[type] || 0) + 1;
        } else if (key.startsWith('trending:')) {
          // 兼容旧格式
          stats.tmdb.count++;
          stats.tmdb.size += size;

          const type = `trending-${key.split(':')[1]}`;
          stats.tmdb.types[type] = (stats.tmdb.types[type] || 0) + 1;
        } else if (
          key.startsWith('search:') &&
          (key.includes('-movie-') || key.includes('-tv-'))
        ) {
          // 兼容旧格式
          stats.tmdb.count++;
          stats.tmdb.size += size;

          const type = `search-${key.split(':')[1].split('-')[1]}`;
          stats.tmdb.types[type] = (stats.tmdb.types[type] || 0) + 1;
        } else if (
          key.startsWith('danmu-cache') ||
          key === 'lunatv_danmu_cache'
        ) {
          stats.danmu.count++;
          stats.danmu.size += size;
        } else if (key.startsWith('netdisk-search')) {
          stats.netdisk.count++;
          stats.netdisk.size += size;
        } else if (key.startsWith('search-') || key.startsWith('cache-')) {
          stats.search.count++;
          stats.search.size += size;
        } else if (key.startsWith('tvbox-')) {
          stats.tvbox.count++;
          stats.tvbox.size += size;
        } else {
          stats.other.count++;
          stats.other.size += size;
        }

        stats.total.count++;
        stats.total.size += size;
      });

      logger.log(
        `✅ Redis缓存统计完成: 总计 ${stats.total.count} 项, ${formatBytes(stats.total.size)}`,
      );
      return stats;
    } catch (error) {
      logger.error('Redis缓存统计失败:', error);
      return null;
    }
  }

  // 获取缓存统计信息（支持KVRocks/Upstash/Redis，localStorage作为备用）
  static async getSimpleCacheStats() {
    logger.log('📊 开始获取缓存统计信息...');

    // 从 Redis兼容数据库 获取统计（支持KVRocks、Upstash、Redis）
    const redisStats = await DatabaseCacheManager.getKVRocksCacheStats();
    if (redisStats) {
      return {
        ...redisStats,
        timestamp: new Date().toISOString(),
        source: 'redis-database',
        note: '数据来源：Redis兼容数据库（KVRocks/Upstash/Redis）',
        formattedSizes: {
          douban: formatBytes(redisStats.douban.size),
          shortdrama: formatBytes(redisStats.shortdrama.size),
          tmdb: formatBytes(redisStats.tmdb.size),
          danmu: formatBytes(redisStats.danmu.size),
          netdisk: formatBytes(redisStats.netdisk.size),
          search: formatBytes(redisStats.search?.size || 0),
          tvbox: formatBytes(redisStats.tvbox?.size || 0),
          other: formatBytes(redisStats.other?.size || 0),
          total: formatBytes(redisStats.total.size),
        },
      };
    }

    // 如果 Redis数据库 不可用，使用 localStorage 作为备用
    const stats = {
      douban: { count: 0, size: 0, types: {} as Record<string, number> },
      shortdrama: { count: 0, size: 0, types: {} as Record<string, number> },
      tmdb: { count: 0, size: 0, types: {} as Record<string, number> },
      danmu: { count: 0, size: 0 },
      netdisk: { count: 0, size: 0 },
      search: { count: 0, size: 0 },
      tvbox: { count: 0, size: 0 },
      other: { count: 0, size: 0 },
      total: { count: 0, size: 0 },
    };

    // 从localStorage统计（备用数据源）
    if (typeof localStorage !== 'undefined') {
      const keys = Object.keys(localStorage).filter(
        (key) =>
          key.startsWith('douban-') ||
          key.startsWith('shortdrama-') ||
          key.startsWith('tmdb-') ||
          key.startsWith('danmu-cache') ||
          key.startsWith('netdisk-search') ||
          key.startsWith('search-') ||
          key.startsWith('cache-') ||
          key.startsWith('tvbox-') ||
          key === 'lunatv_danmu_cache',
      );

      logger.log(`📊 localStorage中找到 ${keys.length} 个相关缓存键`);

      keys.forEach((key) => {
        const data = localStorage.getItem(key);
        if (!data) return;

        const size = data.length;

        if (key.startsWith('douban-')) {
          stats.douban.count++;
          stats.douban.size += size;

          const type = key.split('-')[1];
          stats.douban.types[type] = (stats.douban.types[type] || 0) + 1;
        } else if (key.startsWith('shortdrama-')) {
          stats.shortdrama.count++;
          stats.shortdrama.size += size;

          const type = key.split('-')[1];
          stats.shortdrama.types[type] =
            (stats.shortdrama.types[type] || 0) + 1;
        } else if (key.startsWith('tmdb-poster:')) {
          // 统一的海报搜索缓存（新版格式）
          stats.tmdb.count++;
          stats.tmdb.size += size;

          const subKey = key.replace('tmdb-poster:', '');
          const type = subKey.startsWith('trending-')
            ? 'poster-trending'
            : 'poster-search';
          stats.tmdb.types[type] = (stats.tmdb.types[type] || 0) + 1;
        } else if (key.startsWith('tmdb-')) {
          stats.tmdb.count++;
          stats.tmdb.size += size;

          const type = key.split('-')[1];
          stats.tmdb.types[type] = (stats.tmdb.types[type] || 0) + 1;
        } else if (key.startsWith('trending:')) {
          // 兼容旧格式
          stats.tmdb.count++;
          stats.tmdb.size += size;

          const type = `trending-${key.split(':')[1]}`;
          stats.tmdb.types[type] = (stats.tmdb.types[type] || 0) + 1;
        } else if (
          key.startsWith('search:') &&
          (key.includes('-movie-') || key.includes('-tv-'))
        ) {
          // 兼容旧格式
          stats.tmdb.count++;
          stats.tmdb.size += size;

          const type = `search-${key.split(':')[1].split('-')[1]}`;
          stats.tmdb.types[type] = (stats.tmdb.types[type] || 0) + 1;
        } else if (
          key.startsWith('danmu-cache') ||
          key === 'lunatv_danmu_cache'
        ) {
          stats.danmu.count++;
          stats.danmu.size += size;
        } else if (key.startsWith('netdisk-search')) {
          stats.netdisk.count++;
          stats.netdisk.size += size;
        } else if (key.startsWith('search-') || key.startsWith('cache-')) {
          stats.search.count++;
          stats.search.size += size;
        } else if (key.startsWith('tvbox-')) {
          stats.tvbox.count++;
          stats.tvbox.size += size;
        } else {
          stats.other.count++;
          stats.other.size += size;
        }

        stats.total.count++;
        stats.total.size += size;
      });
    }

    return {
      ...stats,
      timestamp: new Date().toISOString(),
      source: 'localStorage-fallback',
      note: 'Redis数据库不可用，使用localStorage作为备用数据源',
      formattedSizes: {
        douban: formatBytes(stats.douban.size),
        shortdrama: formatBytes(stats.shortdrama.size),
        tmdb: formatBytes(stats.tmdb.size),
        danmu: formatBytes(stats.danmu.size),
        netdisk: formatBytes(stats.netdisk.size),
        search: formatBytes(stats.search?.size || 0),
        tvbox: formatBytes(stats.tvbox?.size || 0),
        other: formatBytes(stats.other?.size || 0),
        total: formatBytes(stats.total.size),
      },
    };
  }

  // 清理指定类型的缓存
  static async clearCacheByType(
    type: 'douban' | 'shortdrama' | 'tmdb' | 'danmu' | 'netdisk' | 'weekly',
  ): Promise<number> {
    let clearedCount = 0;

    try {
      switch (type) {
        case 'douban':
          await db.clearExpiredCache('douban-');
          logger.log('🗑️ 豆瓣缓存清理完成');
          break;
        case 'weekly':
          await db.clearExpiredCache('weekly-hot:');
          logger.log('🗑️ 周榜缓存清理完成');
          break;
        case 'shortdrama':
          await db.clearExpiredCache('shortdrama-');
          // 清理localStorage中的短剧缓存（兜底）
          if (typeof localStorage !== 'undefined') {
            const keys = Object.keys(localStorage).filter((key) =>
              key.startsWith('shortdrama-'),
            );
            keys.forEach((key) => {
              localStorage.removeItem(key);
              clearedCount++;
            });
            logger.log(`🗑️ localStorage中清理了 ${keys.length} 个短剧缓存项`);
          }
          logger.log('🗑️ 短剧缓存清理完成');
          break;
        case 'tmdb':
          await db.clearExpiredCache('tmdb-');
          await db.clearExpiredCache('tmdb-poster:');
          await db.clearExpiredCache('trending:');
          // 搜索缓存不按前缀清理，避免误删其他搜索
          logger.log('🗑️ TMDB缓存清理完成');
          break;
        case 'danmu':
          await db.clearExpiredCache('danmu-cache');
          logger.log('🗑️ 弹幕缓存清理完成');
          break;
        case 'netdisk':
          await db.clearExpiredCache('netdisk-search');
          // 清理localStorage中的网盘缓存（兜底）
          if (typeof localStorage !== 'undefined') {
            const keys = Object.keys(localStorage).filter((key) =>
              key.startsWith('netdisk-search'),
            );
            keys.forEach((key) => {
              localStorage.removeItem(key);
              clearedCount++;
            });
            logger.log(
              `🗑️ localStorage中清理了 ${keys.length} 个网盘搜索缓存项`,
            );
          }
          logger.log('🗑️ 网盘搜索缓存清理完成');
          break;
      }

      // 由于clearExpiredCache不返回数量，我们无法精确统计
      clearedCount = 1; // 标记操作已执行
    } catch (error) {
      logger.error(`清理${type}缓存失败:`, error);
    }

    return clearedCount;
  }

  // 清理所有过期缓存
  static async clearExpiredCache(): Promise<number> {
    try {
      await db.clearExpiredCache();
      logger.log('🗑️ 所有过期缓存清理完成');
      return 1; // 标记操作已执行
    } catch (error) {
      logger.error('清理过期缓存失败:', error);
      return 0;
    }
  }
}
