import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getDoubanRandomUserAgent } from '@/lib/user-agent';

// 周榜缓存时长：7天（周榜每周更新）
const WEEKLY_HOT_CACHE_DURATION = 7 * 24 * 60 * 60; // 7天

/**
 * 获取豆瓣每周热门（电影或剧集）
 * GET /api/douban/weekly-hot?type=movie|tv|tv-global&limit=10
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'movie'; // movie | tv | tv-global
    const limit = parseInt(searchParams.get('limit') || '10');
    const start = parseInt(searchParams.get('start') || '0');

    // 构建缓存键
    const cacheKey = `weekly-hot:${type}-${start}-${limit}`;

    // 检查缓存
    const cached = await db.getCache(cacheKey);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    // 根据类型选择不同的collection
    const collectionMap: Record<string, string> = {
      movie: 'movie_weekly_best',
      tv: 'tv_chinese_best_weekly',
      'tv-global': 'tv_global_best_weekly',
    };

    const collection = collectionMap[type] || 'movie_weekly_best';

    // 豆瓣每周热门API
    const apiURL = `https://m.douban.com/rexxar/api/v2/subject_collection/${collection}/items?start=${start}&count=${limit}`;

    const response = await fetch(apiURL, {
      headers: {
        'User-Agent': getDoubanRandomUserAgent(),
        Referer: 'https://m.douban.com/',
        Accept: 'application/json, text/plain, */*',
      },
    });

    if (!response.ok) {
      throw new Error(`豆瓣API请求失败: ${response.status}`);
    }

    const data = await response.json();

    // 缓存结果
    await db.setCache(cacheKey, data, WEEKLY_HOT_CACHE_DURATION);

    return NextResponse.json({
      success: true,
      data: data,
      cached: false,
    });
  } catch (error) {
    logger.error('获取豆瓣每周热门失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
