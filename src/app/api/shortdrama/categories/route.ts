import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { ShortDramaCategory } from '@/lib/shortdrama-api';
import { getShortDramaCategories } from '@/lib/shortdrama-api';

// 强制动态路由
export const dynamic = 'force-dynamic';

// 缓存时间配置（秒）
const CACHE_TTL = 4 * 60 * 60; // 4小时
const CACHE_KEY = 'shortdrama-categories';
const CACHE_VERSION_KEY = 'shortdrama-categories-version';
const CACHE_TIMESTAMP_KEY = 'shortdrama-categories-timestamp';

// 强制刷新时间（秒），即使 version 未变化，超过此时间也会强制重新获取
const FORCE_REFRESH_TTL = 24 * 60 * 60; // 24小时

// 转换后的分类数据结构（用于缓存和返回给客户端）
interface ShortDramaCategoryWithVersion extends ShortDramaCategory {
  version: string;
  sub_categories?: Array<{ id: number; name: string }>;
}

export async function GET() {
  try {
    const now = Date.now();

    // 尝试从缓存获取
    const cached = (await db.getCache(CACHE_KEY)) as
      | ShortDramaCategoryWithVersion[]
      | null;
    const cachedVersion = (await db.getCache(CACHE_VERSION_KEY)) as
      | string
      | null;
    const cachedTimestamp = (await db.getCache(CACHE_TIMESTAMP_KEY)) as
      | number
      | null;

    // 如果有缓存且未过期
    if (cached && cachedVersion && cachedTimestamp) {
      // 检查是否超过强制刷新时间
      if (cachedTimestamp && now - cachedTimestamp < FORCE_REFRESH_TTL * 1000) {
        logger.log('使用缓存的短剧分类数据，version:', cachedVersion);
        return NextResponse.json(cached);
      } else {
        logger.log('缓存超过强制刷新时间，需要重新获取');
      }
    }

    // 获取最新数据
    const apiResult = await getShortDramaCategories();

    // 检查 API 是否成功返回数据
    if (!apiResult || !apiResult.success || !apiResult.data) {
      logger.error('短剧分类 API 返回失败:', apiResult);
      // 如果有旧缓存，返回旧缓存
      if (cached) {
        logger.log('API 返回失败，使用旧缓存数据');
        return NextResponse.json(cached);
      }
      return NextResponse.json({ error: '获取分类数据失败' }, { status: 500 });
    }

    const categoriesData = apiResult.data as unknown as Array<{
      id: number;
      name: string;
      sort: number;
      is_active: boolean;
      sub_categories: Array<{ id: number; name: string; category_id: number }>;
    }>;
    const apiVersion = (apiResult as { version?: string }).version || '1';

    if (!categoriesData || categoriesData.length === 0) {
      logger.warn('获取到的短剧分类数据为空');
      // 如果有旧缓存，返回旧缓存
      if (cached) {
        logger.log('API 返回空数据，使用旧缓存数据');
        return NextResponse.json(cached);
      }
      return NextResponse.json([]);
    }
    // 转换数据格式，将 version 添加到每个分类中
    const categories: ShortDramaCategoryWithVersion[] = categoriesData.map(
      (cat) => ({
        id: cat.id,
        name: cat.name,
        version: apiVersion,
        sub_categories: cat.sub_categories,
      }),
    );

    // 检查 version 是否变化
    let shouldUpdateCache = true;
    if (cachedVersion && cachedTimestamp) {
      if (
        cachedVersion === apiVersion &&
        now - cachedTimestamp < FORCE_REFRESH_TTL * 1000
      ) {
        // version 未变化且未超过强制刷新时间，不更新缓存
        shouldUpdateCache = false;
        logger.log('分类 version 未变化，保持缓存:', cachedVersion);
      }
    }

    if (shouldUpdateCache) {
      // 保存到缓存
      await db.setCache(CACHE_KEY, categories, CACHE_TTL);
      await db.setCache(CACHE_VERSION_KEY, apiVersion, CACHE_TTL);
      await db.setCache(CACHE_TIMESTAMP_KEY, now, CACHE_TTL);
      logger.log('短剧分类缓存已更新，version:', apiVersion);
    }

    const response = NextResponse.json(categories);
    response.headers.set(
      'Cache-Control',
      'no-cache, no-store, must-revalidate',
    );
    response.headers.set('X-Cache-Version', apiVersion);
    return response;
  } catch (error) {
    logger.error('获取短剧分类失败:', error);

    // 发生错误时删除相关缓存
    await db.deleteCache(CACHE_KEY).catch(() => {
      // 忽略缓存删除错误
    });
    await db.deleteCache(CACHE_VERSION_KEY).catch(() => {});
    await db.deleteCache(CACHE_TIMESTAMP_KEY).catch(() => {});

    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
