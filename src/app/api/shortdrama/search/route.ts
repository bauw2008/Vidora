import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { searchShortDramas, type ShortDramaItem } from '@/lib/shortdrama-api';

// 强制动态路由
export const dynamic = 'force-dynamic';

// 缓存时间配置（秒）
const CACHE_TTL = 2 * 60 * 60; // 2小时

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const query = searchParams.get('query');
    const page = searchParams.get('page');
    const size = searchParams.get('size');

    if (!query) {
      return NextResponse.json(
        { error: '缺少必要参数: query' },
        { status: 400 },
      );
    }

    const pageNum = page ? parseInt(page) : 1;
    const pageSize = size ? parseInt(size) : 20;

    if (isNaN(pageNum) || isNaN(pageSize)) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    // 生成缓存key
    const cacheKey = `shortdrama-search:${query}:${pageNum}:${pageSize}`;

    // 尝试从缓存获取
    const cached = await db.getCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const result = await searchShortDramas(query, pageNum, pageSize);

    // 转换为新旧格式兼容
    const formattedList = result.list.map((item: ShortDramaItem) => ({
      id: item.vod_id,
      name: item.name,
      cover: item.cover,
      update_time: item.updated_at || new Date().toISOString(),
      score: item.score || 0,
      episode_count: item.episode_count || 1,
      description: item.description || '',
      author: item.actor || '',
      backdrop: item.cover,
      vote_average: item.score || 0,
      tmdb_id: undefined,
    }));

    const formattedResult = {
      list: formattedList,
      hasMore: result.hasMore,
    };

    // 只在成功时保存到缓存
    await db.setCache(cacheKey, formattedResult, CACHE_TTL);

    const response = NextResponse.json(formattedResult);
    response.headers.set(
      'Cache-Control',
      'no-cache, no-store, must-revalidate',
    );
    return response;
  } catch (error) {
    logger.error('搜索短剧失败:', error);

    // 发生错误时删除相关缓存
    const { searchParams } = request.nextUrl;
    const query = searchParams.get('query');
    const page = searchParams.get('page');
    const size = searchParams.get('size');
    const pageNum = page ? parseInt(page) : 1;
    const pageSize = size ? parseInt(size) : 20;
    if (query) {
      const cacheKey = `shortdrama-search:${query}:${pageNum}:${pageSize}`;
      await db.deleteCache(cacheKey).catch(() => {
        // 忽略缓存删除错误
      });
    }

    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
