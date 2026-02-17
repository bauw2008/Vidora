import { createClient, RedisClientType } from 'redis';

import { AdminConfig } from './admin.types';
import { logger } from './logger';
import type { OwnerConfig } from './types';
import {
  ContentStat,
  EpisodeSkipConfig,
  Favorite,
  IStorage,
  PlayRecord,
  PlayStatsResult,
  UserPlayStat,
} from './types';

// 搜索历史最大条数
const SEARCH_HISTORY_LIMIT = 20;

// 数据类型转换辅助函数
function ensureString(value: unknown): string {
  return String(value);
}

function ensureStringArray(value: unknown[]): string[] {
  return value.map((item) => String(item));
}

// Redis v5 返回类型可能是 string | null | {}，需要转换为 string | null
function ensureRedisString(value: string | null | {}): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  // 如果是空对象或其他类型，转换为字符串
  return String(value);
}

// 连接配置接口
export interface RedisConnectionConfig {
  url: string;
  clientName: string; // 用于日志显示，如 "Redis" 或 "Pika"
}

// 使用 SCAN 命令替代 KEYS，避免阻塞 Redis
async function scanKeys(
  client: RedisClientType,
  pattern: string,
  count = 100,
): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';

  do {
    const result = await client.scan(cursor, {
      MATCH: pattern,
      COUNT: count,
    });
    cursor = result.cursor;
    keys.push(...result.keys);
  } while (cursor !== '0');

  return keys;
}

// 添加Redis操作重试包装器
function createRetryWrapper(
  clientName: string,
  getClient: () => RedisClientType,
) {
  return async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (err: unknown) {
        const isLastAttempt = i === maxRetries - 1;
        const isConnectionError =
          err instanceof Error &&
          (err.message?.includes('Connection') ||
            err.message?.includes('ECONNREFUSED') ||
            err.message?.includes('ENOTFOUND') ||
            (err as { code?: string }).code === 'ECONNRESET' ||
            (err as { code?: string }).code === 'EPIPE');

        if (isConnectionError && !isLastAttempt) {
          logger.log(
            `${clientName} operation failed, retrying... (${
              i + 1
            }/${maxRetries})`,
          );
          logger.error('Error:', err.message);

          // 等待一段时间后重试
          await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));

          // 尝试重新连接
          try {
            const client = getClient();
            if (!client.isOpen) {
              await client.connect();
            }
          } catch (reconnectErr) {
            logger.error('Failed to reconnect:', reconnectErr);
          }

          continue;
        }

        throw err;
      }
    }

    throw new Error('Max retries exceeded');
  };
}

// 创建客户端的工厂函数
export function createRedisClient(
  config: RedisConnectionConfig,
  globalSymbol: symbol,
): RedisClientType {
  let client: RedisClientType | undefined = (
    global as Record<symbol, RedisClientType>
  )[globalSymbol];

  if (!client) {
    if (!config.url) {
      logger.error(
        `${config.clientName}_URL env variable not set. Please configure ${config.clientName.toUpperCase()}_URL environment variable.`,
      );
      throw new Error(
        `${config.clientName}_URL env variable not set. Please configure ${config.clientName.toUpperCase()}_URL environment variable.`,
      );
    }

    // 创建客户端配置
    const clientConfig: {
      url: string;
      socket: {
        reconnectStrategy: (retries: number) => number | Error;
        noDelay?: boolean;
      };
      pingInterval?: number;
    } = {
      url: config.url,
      socket: {
        // 重连策略：指数退避，最大30秒
        reconnectStrategy: (retries: number): number | Error => {
          logger.log(
            `${config.clientName} reconnection attempt ${retries + 1}`,
          );
          if (retries > 10) {
            logger.error(
              `${config.clientName} max reconnection attempts exceeded`,
            );
            return new Error('Max reconnection attempts exceeded'); // 停止重连
          }
          return Math.min(1000 * Math.pow(2, retries), 30000); // 指数退避，最大30秒
        },
        noDelay: true,
      } as {
        reconnectStrategy: (retries: number) => number | Error;
        noDelay?: boolean;
      },
      pingInterval: 30000, // 30秒ping一次，保持连接活跃
    };

    client = createClient(clientConfig);

    // 添加错误事件监听
    client.on('error', (err) => {
      logger.error(`${config.clientName} client error:`, err);
    });

    client.on('connect', () => {
      logger.log(`${config.clientName} connected`);
    });

    client.on('reconnecting', () => {
      logger.log(`${config.clientName} reconnecting...`);
    });

    client.on('ready', () => {
      logger.log(`${config.clientName} ready`);
    });

    // 初始连接，带重试机制
    const connectWithRetry = async () => {
      try {
        await client.connect();
        logger.log(`${config.clientName} connected successfully`);
      } catch (err) {
        logger.error(`${config.clientName} initial connection failed:`, err);
        logger.log('Will retry in 5 seconds...');
        setTimeout(connectWithRetry, 5000);
      }
    };

    connectWithRetry();

    (global as Record<symbol, RedisClientType>)[globalSymbol] = client;
  }

  return client;
}

// 抽象基类，包含所有通用的Redis操作逻辑
export abstract class BaseRedisStorage implements IStorage {
  public client: RedisClientType;
  protected config: RedisConnectionConfig;
  public withRetry: <T>(
    operation: () => Promise<T>,
    maxRetries?: number,
  ) => Promise<T>;

  constructor(config: RedisConnectionConfig, globalSymbol: symbol) {
    this.config = config; // 保存配置
    this.client = createRedisClient(config, globalSymbol);
    this.withRetry = createRetryWrapper(config.clientName, () => this.client);
  }

  // ---------- 播放记录 ----------
  private prKey(user: string, key: string) {
    return `u:${user}:pr:${key}`; // u:username:pr:source+id
  }

  async getPlayRecord(
    userName: string,
    key: string,
  ): Promise<PlayRecord | null> {
    const val = await this.withRetry(() =>
      this.client.get(this.prKey(userName, key)),
    );
    const strVal = ensureRedisString(val);
    return strVal ? (JSON.parse(strVal) as PlayRecord) : null;
  }

  async setPlayRecord(
    userName: string,
    key: string,
    record: PlayRecord,
  ): Promise<void> {
    await this.withRetry(() =>
      this.client.set(this.prKey(userName, key), JSON.stringify(record)),
    );
  }

  async getAllPlayRecords(
    userName: string,
  ): Promise<Record<string, PlayRecord>> {
    const pattern = `u:${userName}:pr:*`;
    const keys: string[] = await this.withRetry(() =>
      scanKeys(this.client, pattern),
    );
    if (keys.length === 0) {
      return {};
    }
    const values = await this.withRetry(() => this.client.mGet(keys));
    const result: Record<string, PlayRecord> = {};
    keys.forEach((fullKey: string, idx: number) => {
      const raw = values[idx];
      if (raw) {
        const strRaw = ensureRedisString(raw);
        if (strRaw) {
          const rec = JSON.parse(strRaw) as PlayRecord;
          // 截取 source+id 部分
          const keyPart = ensureString(
            fullKey.replace(`u:${userName}:pr:`, ''),
          );
          result[keyPart] = rec;
        }
      }
    });
    return result;
  }

  async deletePlayRecord(userName: string, key: string): Promise<void> {
    await this.withRetry(() => this.client.del(this.prKey(userName, key)));
  }

  // ---------- 收藏 ----------
  private favKey(user: string, key: string) {
    return `u:${user}:fav:${key}`;
  }

  async getFavorite(userName: string, key: string): Promise<Favorite | null> {
    const val = await this.withRetry(() =>
      this.client.get(this.favKey(userName, key)),
    );
    const strVal = ensureRedisString(val);
    return strVal ? (JSON.parse(strVal) as Favorite) : null;
  }

  async setFavorite(
    userName: string,
    key: string,
    favorite: Favorite,
  ): Promise<void> {
    await this.withRetry(() =>
      this.client.set(this.favKey(userName, key), JSON.stringify(favorite)),
    );
  }

  async getAllFavorites(userName: string): Promise<Record<string, Favorite>> {
    const pattern = `u:${userName}:fav:*`;
    const keys: string[] = await this.withRetry(() =>
      scanKeys(this.client, pattern),
    );
    if (keys.length === 0) {
      return {};
    }
    const values = await this.withRetry(() => this.client.mGet(keys));
    const result: Record<string, Favorite> = {};
    keys.forEach((fullKey: string, idx: number) => {
      const raw = values[idx];
      if (raw) {
        const strRaw = ensureRedisString(raw);
        if (strRaw) {
          const fav = JSON.parse(strRaw) as Favorite;
          const keyPart = ensureString(
            fullKey.replace(`u:${userName}:fav:`, ''),
          );
          result[keyPart] = fav;
        }
      }
    });
    return result;
  }

  async deleteFavorite(userName: string, key: string): Promise<void> {
    await this.withRetry(() => this.client.del(this.favKey(userName, key)));
  }

  // ---------- 用户注册 / 登录 ----------
  private userPwdKey(user: string) {
    return `u:${user}:pwd`;
  }

  async registerUser(userName: string, password: string): Promise<void> {
    // 简单存储明文密码，生产环境应加密
    await this.withRetry(() =>
      this.client.set(this.userPwdKey(userName), password),
    );
  }

  async verifyUser(userName: string, password: string): Promise<boolean> {
    const stored = await this.withRetry(() =>
      this.client.get(this.userPwdKey(userName)),
    );
    if (stored === null) {
      return false;
    }
    // 确保比较时都是字符串类型
    return ensureString(stored) === password;
  }

  // 获取用户密码明文（仅管理员功能）
  async getUserPassword(userName: string): Promise<string | null> {
    const stored = await this.withRetry(() =>
      this.client.get(this.userPwdKey(userName)),
    );
    return stored ? ensureString(stored) : null;
  }

  // 更新用户最后登录时间
  async updateUserLastLogin(
    userName: string,
    lastLoginAt: number,
  ): Promise<void> {
    await this.withRetry(() =>
      this.client.set(this.userLastLoginKey(userName), String(lastLoginAt)),
    );
  }

  // 用户最后登录时间键
  private userLastLoginKey(userName: string) {
    return `user:lastLogin:${userName}`;
  }

  // 用户登录IP键
  private userLoginIpKey(userName: string) {
    return `u:${userName}:login_ip`;
  }

  // 获取用户登录IP（仅管理员功能）
  async getUserLoginIp(userName: string): Promise<string | null> {
    const stored = await this.withRetry(() =>
      this.client.get(this.userLoginIpKey(userName)),
    );
    return stored ? ensureString(stored) : null;
  }

  // 设置用户登录IP
  async setUserLoginIp(userName: string, ip: string): Promise<void> {
    await this.withRetry(() =>
      this.client.set(this.userLoginIpKey(userName), ip),
    );
  }

  // 检查用户是否存在
  async checkUserExist(userName: string): Promise<boolean> {
    // 使用 EXISTS 判断 key 是否存在
    const exists = await this.withRetry(() =>
      this.client.exists(this.userPwdKey(userName)),
    );
    return exists === 1;
  }

  // 修改用户密码
  async changePassword(userName: string, newPassword: string): Promise<void> {
    // 简单存储明文密码，生产环境应加密
    await this.withRetry(() =>
      this.client.set(this.userPwdKey(userName), newPassword),
    );
  }

  // 删除用户及其所有数据
  async deleteUser(userName: string): Promise<void> {
    // 删除用户密码
    await this.withRetry(() => this.client.del(this.userPwdKey(userName)));

    // 删除搜索历史
    await this.withRetry(() => this.client.del(this.shKey(userName)));

    // 删除播放记录
    const playRecordPattern = `u:${userName}:pr:*`;
    const playRecordKeys = await this.withRetry(() =>
      scanKeys(this.client, playRecordPattern),
    );
    if (playRecordKeys.length > 0) {
      await this.withRetry(() => this.client.del(playRecordKeys));
    }

    // 删除收藏夹
    const favoritePattern = `u:${userName}:fav:*`;
    const favoriteKeys = await this.withRetry(() =>
      scanKeys(this.client, favoritePattern),
    );
    if (favoriteKeys.length > 0) {
      await this.withRetry(() => this.client.del(favoriteKeys));
    }
  }

  // ---------- 搜索历史 ----------
  private shKey(user: string) {
    return `u:${user}:sh`; // u:username:sh
  }

  async getSearchHistory(userName: string): Promise<string[]> {
    const result = await this.withRetry(() =>
      this.client.lRange(this.shKey(userName), 0, -1),
    );
    // 确保返回的都是字符串类型
    return ensureStringArray(result as unknown[]);
  }

  async addSearchHistory(userName: string, keyword: string): Promise<void> {
    const key = this.shKey(userName);
    // 先去重
    await this.withRetry(() => this.client.lRem(key, 0, ensureString(keyword)));
    // 插入到最前
    await this.withRetry(() => this.client.lPush(key, ensureString(keyword)));
    // 限制最大长度
    await this.withRetry(() =>
      this.client.lTrim(key, 0, SEARCH_HISTORY_LIMIT - 1),
    );
  }

  async deleteSearchHistory(userName: string, keyword?: string): Promise<void> {
    const key = this.shKey(userName);
    if (keyword) {
      await this.withRetry(() =>
        this.client.lRem(key, 0, ensureString(keyword)),
      );
    } else {
      await this.withRetry(() => this.client.del(key));
    }
  }

  // ---------- 获取全部用户 ----------
  async getAllUsers(): Promise<string[]> {
    const keys = await this.withRetry(() => scanKeys(this.client, 'u:*:pwd'));
    return keys
      .map((k) => {
        const match = k.match(/^u:(.+?):pwd$/);
        return match ? ensureString(match[1]) : undefined;
      })
      .filter((u): u is string => typeof u === 'string');
  }

  // ---------- 获取全部用户详细信息 ----------
  async getAllUsersWithDetails(): Promise<AdminConfig['UserConfig']['Users']> {
    const adminConfig = await this.getAdminConfig();
    return adminConfig?.UserConfig?.Users || [];
  }

  // ---------- 管理员配置 ----------
  private adminConfigKey() {
    return 'admin:config';
  }

  async getAdminConfig(): Promise<AdminConfig | null> {
    const val = await this.withRetry(() =>
      this.client.get(this.adminConfigKey()),
    );
    const strVal = ensureRedisString(val);
    return strVal ? (JSON.parse(strVal) as AdminConfig) : null;
  }

  async setAdminConfig(config: AdminConfig): Promise<void> {
    await this.withRetry(() =>
      this.client.set(this.adminConfigKey(), JSON.stringify(config)),
    );
  }

  // ---------- 用户头像 ----------
  private avatarKey(userName: string) {
    return `u:${userName}:avatar`;
  }

  async getUserAvatar(userName: string): Promise<string | null> {
    const val = await this.withRetry(() =>
      this.client.get(this.avatarKey(userName)),
    );
    return val ? ensureString(val) : null;
  }

  async setUserAvatar(userName: string, avatarBase64: string): Promise<void> {
    await this.withRetry(() =>
      this.client.set(this.avatarKey(userName), avatarBase64),
    );
  }

  async deleteUserAvatar(userName: string): Promise<void> {
    await this.withRetry(() => this.client.del(this.avatarKey(userName)));
  }

  // 清空所有数据
  async clearAllData(): Promise<void> {
    try {
      // 获取所有用户
      const allUsers = await this.getAllUsers();

      // 删除所有用户及其数据
      for (const username of allUsers) {
        await this.deleteUser(username);
      }

      // 删除管理员配置
      await this.withRetry(() => this.client.del(this.adminConfigKey()));

      logger.log('所有数据已清空');
    } catch (error) {
      logger.error('清空数据失败:', error);
      throw new Error('清空数据失败');
    }
  }

  // ---------- 通用缓存方法 ----------
  private cacheKey(key: string) {
    return `cache:${key}`;
  }

  async getCache(key: string): Promise<unknown | null> {
    try {
      const val = await this.withRetry(() =>
        this.client.get(this.cacheKey(key)),
      );
      if (!val) {
        return null;
      }

      // 智能处理返回值：兼容不同Redis客户端的行为
      if (typeof val === 'string') {
        // 检查是否是HTML错误页面
        if (
          val.trim().startsWith('<!DOCTYPE') ||
          val.trim().startsWith('<html')
        ) {
          logger.error(
            `${this.config.clientName} returned HTML instead of JSON. Connection issue detected.`,
          );
          return null;
        }

        try {
          return JSON.parse(val);
        } catch (parseError) {
          logger.warn(
            `${this.config.clientName} JSON解析失败，返回原字符串 (key: ${key}):`,
            parseError,
          );
          return val; // 解析失败返回原字符串
        }
      } else {
        // 某些Redis客户端可能直接返回解析后的对象
        return val;
      }
    } catch (error) {
      logger.error(
        `${this.config.clientName} getCache error (key: ${key}):`,
        error,
      );
      return null;
    }
  }

  async setCache(
    key: string,
    data: unknown,
    expireSeconds?: number,
  ): Promise<void> {
    try {
      const cacheKey = this.cacheKey(key);
      const value = JSON.stringify(data);

      if (expireSeconds) {
        await this.withRetry(() =>
          this.client.setEx(cacheKey, expireSeconds, value),
        );
      } else {
        await this.withRetry(() => this.client.set(cacheKey, value));
      }
    } catch (error) {
      logger.error(
        `${this.config.clientName} setCache error (key: ${key}):`,
        error,
      );
      throw error; // 重新抛出错误以便上层处理
    }
  }

  async deleteCache(key: string): Promise<void> {
    await this.withRetry(() => this.client.del(this.cacheKey(key)));
  }

  async clearExpiredCache(prefix?: string): Promise<void> {
    // Redis的TTL机制会自动清理过期数据，这里主要用于手动清理
    // 可以根据需要实现特定前缀的缓存清理
    const pattern = prefix ? `cache:${prefix}*` : 'cache:*';
    const keys = await this.withRetry(() => scanKeys(this.client, pattern));

    if (keys.length > 0) {
      await this.withRetry(() => this.client.del(keys));
      logger.log(
        `Cleared ${keys.length} cache entries with pattern: ${pattern}`,
      );
    }
  }

  // ---------- 播放统计相关 ----------
  private playStatsKey() {
    return 'global:play_stats';
  }

  private userStatsKey(userName: string) {
    return `u:${userName}:stats`;
  }

  private contentStatsKey(source: string, id: string) {
    return `content:stats:${source}+${id}`;
  }

  // 获取全站播放统计
  async getPlayStats(): Promise<PlayStatsResult> {
    try {
      // 尝试从缓存获取
      const cached = await this.getCache('play_stats_summary');
      if (cached) {
        return cached as PlayStatsResult;
      }

      // 重新计算统计数据
      const allUsers = await this.getAllUsers();

      const userStats: Array<{
        username: string;
        totalWatchTime: number;
        totalPlays: number;
        lastPlayTime: number;
        recentRecords: PlayRecord[];
        avgWatchTime: number;
        mostWatchedSource: string;
        registrationDays: number;
        lastLoginTime: number;
        loginCount: number;
        createdAt: number;
      }> = [];
      let totalWatchTime = 0;
      let totalPlays = 0;

      // 用户注册统计
      const now = Date.now();
      const todayStart = new Date(now).setHours(0, 0, 0, 0);
      let todayNewUsers = 0;
      const registrationData: Record<string, number> = {};
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

      // 收集所有用户统计
      for (const username of allUsers) {
        const userStat = await this.getUserPlayStat(username);

        // 设置项目开始时间，2025年9月14日
        const PROJECT_START_DATE = new Date('2025-09-14').getTime();
        // 模拟用户创建时间（Redis模式下通常没有这个信息，使用首次播放时间或项目开始时间）
        const userCreatedAt = userStat.firstWatchDate || PROJECT_START_DATE;
        const registrationDays =
          Math.floor((now - userCreatedAt) / (1000 * 60 * 60 * 24)) + 1;

        // 统计今日新增用户
        if (userCreatedAt >= todayStart) {
          todayNewUsers++;
        }

        // 统计注册时间分布（近7天）
        if (userCreatedAt >= sevenDaysAgo) {
          const regDate = new Date(userCreatedAt).toISOString().split('T')[0];
          registrationData[regDate] = (registrationData[regDate] || 0) + 1;
        }

        // 推断最后登录时间（基于最后播放时间）
        const lastLoginTime = userStat.lastPlayTime || userCreatedAt;

        const enhancedUserStat = {
          username: userStat.username,
          totalWatchTime: userStat.totalWatchTime,
          totalPlays: userStat.totalPlays,
          lastPlayTime: userStat.lastPlayTime,
          recentRecords: userStat.recentRecords,
          avgWatchTime: userStat.avgWatchTime,
          mostWatchedSource: userStat.mostWatchedSource,
          registrationDays,
          lastLoginTime,
          loginCount: userStat.loginCount || 0, // 添加登入次数字段
          createdAt: userCreatedAt,
        };

        userStats.push(enhancedUserStat);
        totalWatchTime += userStat.totalWatchTime;
        totalPlays += userStat.totalPlays;
      }

      // 计算热门来源
      const sourceMap = new Map<string, number>();
      for (const user of userStats) {
        for (const record of user.recentRecords) {
          const count = sourceMap.get(record.source_name) || 0;
          sourceMap.set(record.source_name, count + 1);
        }
      }

      const topSources = Array.from(sourceMap.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // 生成近7天统计（简化版本）
      const dailyStats = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now - i * 24 * 60 * 60 * 1000);
        dailyStats.push({
          date: date.toISOString().split('T')[0],
          watchTime: Math.floor(totalWatchTime / 7), // 简化计算
          plays: Math.floor(totalPlays / 7),
        });
      }

      // 计算注册趋势
      const registrationStats = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now - i * 24 * 60 * 60 * 1000);
        const dateKey = date.toISOString().split('T')[0];
        registrationStats.push({
          date: dateKey,
          newUsers: registrationData[dateKey] || 0,
        });
      }

      // 计算活跃用户统计
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

      const activeUsers = {
        daily: userStats.filter((user) => user.lastLoginTime >= oneDayAgo)
          .length,
        weekly: userStats.filter((user) => user.lastLoginTime >= sevenDaysAgo)
          .length,
        monthly: userStats.filter((user) => user.lastLoginTime >= thirtyDaysAgo)
          .length,
      };

      const result: PlayStatsResult = {
        totalUsers: allUsers.length,
        totalWatchTime,
        totalPlays,
        avgWatchTimePerUser:
          allUsers.length > 0 ? totalWatchTime / allUsers.length : 0,
        avgPlaysPerUser: allUsers.length > 0 ? totalPlays / allUsers.length : 0,
        userStats: userStats.sort(
          (a, b) => b.totalWatchTime - a.totalWatchTime,
        ),
        topSources,
        dailyStats,
        // 新增：用户注册统计
        registrationStats: {
          todayNewUsers,
          totalRegisteredUsers: allUsers.length,
          registrationTrend: registrationStats,
        },
        // 新增：用户活跃度统计
        activeUsers,
      };

      // 缓存结果30分钟
      await this.setCache('play_stats_summary', result, 1800);

      return result;
    } catch (error) {
      logger.error('获取播放统计失败:', error);
      return {
        totalUsers: 0,
        totalWatchTime: 0,
        totalPlays: 0,
        avgWatchTimePerUser: 0,
        avgPlaysPerUser: 0,
        userStats: [],
        topSources: [],
        dailyStats: [],
        // 新增：用户注册统计
        registrationStats: {
          todayNewUsers: 0,
          totalRegisteredUsers: 0,
          registrationTrend: [],
        },
        // 新增：用户活跃度统计
        activeUsers: {
          daily: 0,
          weekly: 0,
          monthly: 0,
        },
      };
    }
  }

  // 获取用户播放统计
  async getUserPlayStat(userName: string): Promise<UserPlayStat> {
    try {
      // 获取用户所有播放记录
      const playRecords = await this.getAllPlayRecords(userName);
      const records = Object.values(playRecords);

      if (records.length === 0) {
        // 即使没有播放记录，也要获取登入统计
        let loginStats = {
          loginCount: 0,
          firstLoginTime: 0,
          lastLoginTime: 0,
          lastLoginDate: 0,
        };

        try {
          const loginStatsKey = `user_login_stats:${userName}`;
          const storedLoginStats = await this.client.get(loginStatsKey);
          const strStats = ensureRedisString(storedLoginStats);
          if (strStats) {
            const parsed = JSON.parse(strStats);
            loginStats = {
              loginCount: parsed.loginCount || 0,
              firstLoginTime: parsed.firstLoginTime || 0,
              lastLoginTime: parsed.lastLoginTime || 0,
              lastLoginDate: parsed.lastLoginDate || parsed.lastLoginTime || 0,
            };
          }
        } catch (error) {
          logger.error(`获取用户 ${userName} 登入统计失败:`, error);
        }

        return {
          username: userName,
          totalWatchTime: 0,
          totalPlays: 0,
          lastPlayTime: 0,
          recentRecords: [],
          avgWatchTime: 0,
          mostWatchedSource: '',
          registrationDays: 0,
          // 新增字段
          totalMovies: 0,
          firstWatchDate: Date.now(),
          lastUpdateTime: Date.now(),
          // 登入统计字段
          loginCount: loginStats.loginCount,
          firstLoginTime: loginStats.firstLoginTime,
          lastLoginTime: loginStats.lastLoginTime,
          lastLoginDate: loginStats.lastLoginDate,
        };
      }

      // 计算统计数据
      const totalWatchTime = records.reduce(
        (sum, record) => sum + (record.play_time || 0),
        0,
      );
      const totalPlays = records.length;
      const lastPlayTime = Math.max(...records.map((r) => r.save_time || 0));

      // 计算观看影片总数（去重）
      const totalMovies = new Set(
        records.map((r) => `${r.title}_${r.source_name}_${r.year}`),
      ).size;

      // 计算首次观看时间
      const firstWatchDate = Math.min(
        ...records.map((r) => r.save_time || Date.now()),
      );

      // 最近10条记录，按时间排序
      const recentRecords = records
        .sort((a, b) => (b.save_time || 0) - (a.save_time || 0))
        .slice(0, 10);

      // 平均观看时长
      const avgWatchTime = totalPlays > 0 ? totalWatchTime / totalPlays : 0;

      // 最常观看的来源
      const sourceMap = new Map<string, number>();
      records.forEach((record) => {
        const sourceName = record.source_name || '未知来源';
        const count = sourceMap.get(sourceName) || 0;
        sourceMap.set(sourceName, count + 1);
      });

      const mostWatchedSource =
        sourceMap.size > 0
          ? Array.from(sourceMap.entries()).reduce((a, b) =>
              a[1] > b[1] ? a : b,
            )[0]
          : '';

      // 获取登入统计数据
      let loginStats = {
        loginCount: 0,
        firstLoginTime: 0,
        lastLoginTime: 0,
        lastLoginDate: 0,
      };

      try {
        const loginStatsKey = `user_login_stats:${userName}`;
        const storedLoginStats = await this.client.get(loginStatsKey);
        const strStats = ensureRedisString(storedLoginStats);
        if (strStats) {
          const parsed = JSON.parse(strStats);
          loginStats = {
            loginCount: parsed.loginCount || 0,
            firstLoginTime: parsed.firstLoginTime || 0,
            lastLoginTime: parsed.lastLoginTime || 0,
            lastLoginDate: parsed.lastLoginDate || parsed.lastLoginTime || 0,
          };
        }
      } catch (error) {
        logger.error(`获取用户 ${userName} 登入统计失败:`, error);
      }

      return {
        username: userName,
        totalWatchTime,
        totalPlays,
        lastPlayTime,
        recentRecords,
        avgWatchTime,
        mostWatchedSource,
        registrationDays: 0, // 添加缺失的 registrationDays 字段
        // 新增字段
        totalMovies,
        firstWatchDate,
        lastUpdateTime: Date.now(),
        // 登入统计字段
        loginCount: loginStats.loginCount,
        firstLoginTime: loginStats.firstLoginTime,
        lastLoginTime: loginStats.lastLoginTime,
        lastLoginDate: loginStats.lastLoginDate,
      };
    } catch (error) {
      logger.error(`获取用户 ${userName} 统计失败:`, error);
      return {
        username: userName,
        totalWatchTime: 0,
        totalPlays: 0,
        lastPlayTime: 0,
        recentRecords: [],
        avgWatchTime: 0,
        mostWatchedSource: '',
        // 新增字段
        totalMovies: 0,
        firstWatchDate: Date.now(),
        lastUpdateTime: Date.now(),
        registrationDays: 0,
        // 登入统计字段
        loginCount: 0,
        firstLoginTime: 0,

        lastLoginTime: 0,
        lastLoginDate: 0,
      };
    }
  }

  // 获取内容热度统计
  async getContentStats(limit = 10): Promise<ContentStat[]> {
    try {
      // 获取所有用户
      const allUsers = await this.getAllUsers();
      const contentMap = new Map<
        string,
        {
          record: PlayRecord;
          playCount: number;
          totalWatchTime: number;
          users: Set<string>;
        }
      >();

      // 收集所有播放记录
      for (const username of allUsers) {
        const playRecords = await this.getAllPlayRecords(username);

        Object.entries(playRecords).forEach(([key, record]) => {
          const contentKey = key; // source+id

          if (!contentMap.has(contentKey)) {
            contentMap.set(contentKey, {
              record,
              playCount: 0,
              totalWatchTime: 0,
              users: new Set(),
            });
          }

          const content = contentMap.get(contentKey);
          if (content) {
            content.playCount++;
            content.totalWatchTime += record.play_time;
            content.users.add(username);
          }
        });
      }

      // 转换为ContentStat数组并排序
      const contentStats: ContentStat[] = Array.from(contentMap.entries())
        .map(([key, data]) => {
          const [source, id] = key.split('+');
          return {
            source,
            id,
            title: data.record.title,
            source_name: data.record.source_name,
            cover: data.record.cover,
            year: data.record.year,
            playCount: data.playCount,
            totalWatchTime: data.totalWatchTime,
            averageWatchTime:
              data.playCount > 0 ? data.totalWatchTime / data.playCount : 0,
            lastPlayed: data.record.save_time,
            uniqueUsers: data.users.size,
          };
        })
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, limit);

      return contentStats;
    } catch (error) {
      logger.error('获取内容统计失败:', error);
      return [];
    }
  }

  // 更新播放统计（当用户播放时调用）
  async updatePlayStatistics(
    _userName: string,
    _source: string,
    _id: string,
    _watchTime: number,
  ): Promise<void> {
    try {
      // 清除全站统计缓存，下次查询时重新计算
      await this.deleteCache('play_stats_summary');

      // 这里可以添加更多实时统计更新逻辑
      // 比如更新用户统计缓存、内容热度等
      // 暂时只是清除缓存，实际统计在查询时重新计算
    } catch (error) {
      logger.error('更新播放统计失败:', error);
    }
  }

  // 更新用户登入统计
  async updateUserLoginStats(
    userName: string,
    loginTime: number,
    isFirstLogin?: boolean,
  ): Promise<void> {
    try {
      const loginStatsKey = `user_login_stats:${userName}`;

      // 获取当前登入统计数据
      const currentStats = await this.client.get(loginStatsKey);
      const strStats = ensureRedisString(currentStats);
      const loginStats = strStats
        ? JSON.parse(strStats)
        : {
            loginCount: 0,
            firstLoginTime: null,
            lastLoginTime: null,
            lastLoginDate: null,
          };

      // 更新统计数据
      loginStats.loginCount = (loginStats.loginCount || 0) + 1;
      loginStats.lastLoginTime = loginTime;
      loginStats.lastLoginDate = loginTime; // 保持兼容性

      // 如果是首次登入，记录首次登入时间
      if (isFirstLogin || !loginStats.firstLoginTime) {
        loginStats.firstLoginTime = loginTime;
      }

      // 保存更新后的统计数据
      await this.client.set(loginStatsKey, JSON.stringify(loginStats));
    } catch (error) {
      logger.error(`更新用户 ${userName} 登入统计失败:`, error);
      throw error;
    }
  }

  // ---------- 剧集跳过配置 ----------
  private escKey(userName: string, source: string, id: string) {
    return `u:${userName}:esc:${source}:${id}`;
  }

  async getEpisodeSkipConfig(
    userName: string,
    source: string,
    id: string,
  ): Promise<EpisodeSkipConfig | null> {
    const val = await this.withRetry(() =>
      this.client.get(this.escKey(userName, source, id)),
    );
    const strVal = ensureRedisString(val);
    return strVal ? (JSON.parse(strVal) as EpisodeSkipConfig) : null;
  }

  async saveEpisodeSkipConfig(
    userName: string,
    source: string,
    id: string,
    config: EpisodeSkipConfig,
  ): Promise<void> {
    await this.withRetry(() =>
      this.client.set(
        this.escKey(userName, source, id),
        JSON.stringify(config),
      ),
    );
  }

  async deleteEpisodeSkipConfig(
    userName: string,
    source: string,
    id: string,
  ): Promise<void> {
    await this.withRetry(() =>
      this.client.del(this.escKey(userName, source, id)),
    );
  }

  async getAllEpisodeSkipConfigs(
    userName: string,
  ): Promise<Record<string, EpisodeSkipConfig>> {
    const pattern = `u:${userName}:esc:*`;
    const keys = await this.withRetry(() => scanKeys(this.client, pattern));
    const configs: Record<string, EpisodeSkipConfig> = {};

    for (const key of keys) {
      try {
        const val = await this.withRetry(() => this.client.get(key));
        const strVal = ensureRedisString(val);
        if (strVal) {
          const config = JSON.parse(strVal) as EpisodeSkipConfig;
          // 提取 source:id 作为键
          const match = key.match(/u:.+:esc:(.+)/);
          if (match) {
            configs[match[1]] = config;
          }
        }
      } catch (error) {
        logger.warn(`获取剧集跳过配置失败: ${key}`, error);
      }
    }

    return configs;
  }

  // 站长配置相关方法
  async getOwnerConfig(): Promise<OwnerConfig> {
    try {
      const key = 'owner_config';
      const data = await this.withRetry(() => this.client.get(key));
      const strData = ensureRedisString(data);
      return strData
        ? JSON.parse(strData)
        : { SiteMaintenance: false, DebugMode: false, MaxUsers: 1000 };
    } catch (error) {
      logger.error('获取站长配置失败:', error);
      return { SiteMaintenance: false, DebugMode: false, MaxUsers: 1000 };
    }
  }

  async setOwnerConfig(config: import('./types').OwnerConfig): Promise<void> {
    try {
      const key = 'owner_config';
      await this.withRetry(() => this.client.set(key, JSON.stringify(config)));
    } catch (error) {
      logger.error('保存站长配置失败:', error);
      throw error;
    }
  }
}
