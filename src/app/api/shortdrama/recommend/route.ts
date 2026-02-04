import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import {
  getRecommendedShortDramas,
  type ShortDramaItem,
} from '@/lib/shortdrama-api';

// 强制动态路由
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const category = searchParams.get('category');
    const size = searchParams.get('size');

    const categoryNum = category ? parseInt(category) : undefined;
    const pageSize = size ? parseInt(size) : 10;

    if (
      (category && (categoryNum === undefined || isNaN(categoryNum))) ||
      isNaN(pageSize)
    ) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    const result = await getRecommendedShortDramas(categoryNum, pageSize);

    // 转换为新旧格式兼容
    const formattedList = result.map((item: ShortDramaItem) => ({
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

    const response = NextResponse.json(formattedList);
    response.headers.set(
      'Cache-Control',
      'no-cache, no-store, must-revalidate',
    );
    return response;
  } catch (error) {
    logger.error('获取推荐短剧失败:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
