/* @typescript-eslint/no-explicit-any */

import { logger } from '@/lib/logger';

import {
  clearCategoriesCache,
  getCache,
  getCacheKey,
  setCache,
  SHORTDRAMA_CACHE_EXPIRE,
} from './shortdrama-cache';
import {
  ShortDramaCategory,
  ShortDramaItem,
  ShortDramaParseResult,
} from './types';

// 获取短剧分类列表
export async function getShortDramaCategories(
  forceRefresh = false,
): Promise<ShortDramaCategory[]> {
  const cacheKey = getCacheKey('categories', {});
  const versionKey = `${cacheKey}-version`;
  const timestampKey = `${cacheKey}-timestamp`;

  // 强制刷新时间（秒），即使 version 未变化，超过此时间也会强制重新获取
  const FORCE_REFRESH_TTL = 24 * 60 * 60; // 24小时

  try {
    // 如果强制刷新，先清除缓存
    if (forceRefresh) {
      await clearCategoriesCache();
    }

    // 获取缓存的分类、version和时间戳
    const cached = await getCache<ShortDramaCategory[]>(cacheKey);
    const cachedVersion = await getCache<string>(versionKey);
    const cachedTimestamp = await getCache<number>(timestampKey);
    const now = Date.now();

    // 如果有缓存且未过期
    if (cached && cachedVersion && cachedTimestamp && !forceRefresh) {
      // 检查是否超过强制刷新时间
      if (now - cachedTimestamp < FORCE_REFRESH_TTL * 1000) {
        logger.log('使用缓存的短剧分类数据，version:', cachedVersion);
        return cached;
      }
    }

    // 统一使用内部 API
    const apiUrl = `/api/shortdrama/categories`;
    const response = await fetch(apiUrl, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // 检查是否是错误响应
    if (data.error) {
      logger.error('API 返回错误:', data.error);
      // 如果有旧缓存，返回旧缓存
      if (cached) {
        logger.log('API 返回错误，使用旧缓存数据');
        return cached;
      }
      return [];
    }

    // 内部API直接返回数组
    const categories = Array.isArray(data) ? data : [];

    // 只缓存成功且非空的结果
    if (categories && categories.length > 0) {
      // 从第一个分类获取 version（所有分类的 version 都相同）
      const categoriesVersion = categories[0]?.version || '0';

      logger.log(
        `分类数据: 找到 ${categories.length} 个分类，version: ${categoriesVersion}`,
      );

      // 检查 version 是否变化，或者是否超过强制刷新时间
      let shouldUpdateCache = true;
      if (cachedVersion && cachedTimestamp && !forceRefresh) {
        if (
          cachedVersion === categoriesVersion &&
          now - cachedTimestamp < FORCE_REFRESH_TTL * 1000
        ) {
          // version 未变化且未超过强制刷新时间，不更新缓存
          shouldUpdateCache = false;
          logger.log('分类 version 未变化，保持缓存:', cachedVersion);
        }
      }

      if (shouldUpdateCache) {
        await setCache(
          cacheKey,
          categories,
          SHORTDRAMA_CACHE_EXPIRE.categories,
        );
        await setCache(
          versionKey,
          categoriesVersion,
          SHORTDRAMA_CACHE_EXPIRE.categories,
        );
        await setCache(timestampKey, now, SHORTDRAMA_CACHE_EXPIRE.categories);
        logger.log('分类缓存已更新，version:', categoriesVersion);
      }
    }

    return categories;
  } catch (error) {
    logger.error('获取短剧分类失败:', error);
    return [];
  }
}

// 获取分类短剧列表（分页）
export async function getShortDramaList(
  page = 1,
  size = 20,
  tag?: string,
  forceRefresh = false,
): Promise<{ list: ShortDramaItem[]; hasMore: boolean; totalPages?: number }> {
  const cacheKey = getCacheKey('lists', { page, size, tag });

  try {
    // 如果不是强制刷新，尝试从缓存获取
    if (!forceRefresh) {
      const cached = await getCache<{
        list: ShortDramaItem[];
        hasMore: boolean;
        totalPages?: number;
      }>(cacheKey);
      if (cached) {
        // 如果缓存的旧数据没有 totalPages，根据 hasMore 推断
        if (cached.totalPages === undefined) {
          cached.totalPages = cached.hasMore ? page + 1 : page;
        }
        return cached;
      }
    }

    // 统一使用内部 API
    let apiUrl = `/api/shortdrama/list?page=${page}&size=${size}`;
    if (tag) {
      apiUrl += `&tag=${encodeURIComponent(tag)}`;
    }
    if (forceRefresh) {
      apiUrl += `&forceRefresh=true`;
    }
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // 内部API已经处理过格式
    const result = data as {
      list: ShortDramaItem[];
      hasMore: boolean;
      totalPages?: number;
    };
    const finalResult = {
      list: result.list || [],
      hasMore: result.hasMore ?? false,
      totalPages: result.totalPages,
    };

    // 缓存结果 - 第一页缓存时间更长
    const cacheTime =
      page === 1
        ? SHORTDRAMA_CACHE_EXPIRE.lists * 2
        : SHORTDRAMA_CACHE_EXPIRE.lists;

    await setCache(cacheKey, finalResult, cacheTime);
    return finalResult;
  } catch (error) {
    logger.error('获取短剧列表失败:', error);
    return { list: [], hasMore: false };
  }
}

// 搜索短剧
export async function searchShortDramas(
  query: string,
  page = 1,
  size = 20,
): Promise<{ list: ShortDramaItem[]; hasMore: boolean }> {
  try {
    // 统一使用内部 API
    const apiUrl = `/api/shortdrama/search?query=${encodeURIComponent(query)}&page=${page}&size=${size}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // 内部API已经处理过格式
    const result = (data as
      | { list?: ShortDramaItem[]; hasMore?: boolean }
      | undefined) || { list: [], hasMore: false };
    const finalResult = {
      list: result.list || [],
      hasMore: result.hasMore ?? false,
    };

    return finalResult;
  } catch (error) {
    logger.error('搜索短剧失败:', error);
    return { list: [], hasMore: false };
  }
}

// 批量解析多集视频
export async function parseShortDramaBatch(
  id: number,
  episodes: number[],
  useProxy = true,
): Promise<ShortDramaParseResult[]> {
  try {
    const params = new URLSearchParams({
      id: id.toString(),
      episodes: episodes.join(','),
    });

    if (useProxy) {
      params.append('proxy', 'true');
    }

    const timestamp = Date.now();
    // 统一使用内部 API
    const apiUrl = `/api/shortdrama/parse?${params.toString()}&_t=${timestamp}`;

    const fetchOptions: RequestInit = {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    };

    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    logger.error('批量解析短剧失败:', error);
    return [];
  }
}

// 解析整部短剧所有集数
export async function parseShortDramaAll(
  id: number,
  useProxy = true,
): Promise<ShortDramaParseResult[]> {
  try {
    const params = new URLSearchParams({
      id: id.toString(),
    });

    if (useProxy) {
      params.append('proxy', 'true');
    }

    const timestamp = Date.now();
    // 统一使用内部 API
    const apiUrl = `/api/shortdrama/parse?${params.toString()}&_t=${timestamp}`;

    const fetchOptions: RequestInit = {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    };

    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    logger.error('解析完整短剧失败:', error);
    return [];
  }
}
