/**
 * 类型辅助工具
 * 用于处理常见的类型转换和扩展
 */

// Redis 返回类型
export type RedisValue = string | null | {};

// 扩展的 PlayRecord 类型（包含运行时属性）
export interface PlayRecordWithCacheFlag extends Record<string, unknown> {
  id: string;
  title: string;
  source: string;
  source_name: string;
  cover: string;
  year: string;
  index: number;
  total_episodes: number;
  original_episodes?: number;
  play_time: number;
  total_time: number;
  save_time: number;
  search_title: string;
  remarks?: string;
  type?: string;
  _shouldClearCache?: boolean;
}

// 扩展的全局对象类型
export interface GlobalSymbolStorage<T> {
  [key: symbol]: T;
}

// 通用配置类型扩展
export interface ConfigWithExtras {
  [key: string]: unknown;
}

// 豆瓣缓存数据类型
export interface DoubanCacheData<T> {
  data: T;
  timestamp: number;
  ttl?: number;
}

// TMDB 缓存数据类型
export interface TMDBCacheData<T> {
  data: T;
  timestamp: number;
  ttl?: number;
}

// 短剧缓存数据类型
export interface ShortDramaCacheData<T> {
  data: T;
  timestamp: number;
  ttl?: number;
}

// 通用缓存数据类型
export interface CacheData<T = unknown> {
  data: T;
  timestamp: number;
  ttl?: number;
}

// 类型守卫函数
export function isRedisValue(value: unknown): value is RedisValue {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    (typeof value === 'object' && Object.keys(value).length === 0)
  );
}

export function ensureString(value: unknown): string {
  if (typeof value === 'string') return value;
  return String(value);
}

export function ensureStringArray(value: unknown[]): string[] {
  return value.map((item) => ensureString(item));
}

export function ensureRedisString(value: RedisValue): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  // 如果是空对象或其他类型，转换为字符串
  return String(value);
}
