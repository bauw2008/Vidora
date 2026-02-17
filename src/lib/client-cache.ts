import { logger } from '@/lib/logger';

export class ClientCache {
  static async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const response = await fetch(`/api/cache?key=${encodeURIComponent(key)}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      return result.data as T;
    } catch (error) {
      logger.error('获取缓存失败:', error);
      return null;
    }
  }

  static async set<T = unknown>(
    key: string,
    data: T,
    expireSeconds?: number,
  ): Promise<void> {
    try {
      const response = await fetch('/api/cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, data, expireSeconds }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      logger.error('设置缓存失败:', error);
      throw error;
    }
  }

  static async delete(key: string): Promise<void> {
    try {
      const response = await fetch(
        `/api/cache?key=${encodeURIComponent(key)}`,
        {
          method: 'DELETE',
        },
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      logger.error('删除缓存失败:', error);
      throw error;
    }
  }

  static async clearExpired(prefix?: string): Promise<void> {
    try {
      const url = prefix
        ? `/api/cache?prefix=${encodeURIComponent(prefix)}`
        : '/api/cache';
      const response = await fetch(url, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      logger.error('清理过期缓存失败:', error);
      throw error;
    }
  }
}
