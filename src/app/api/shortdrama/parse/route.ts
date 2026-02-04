import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getShortDramaPlayUrl } from '@/lib/shortdrama-api';

// 标记为动态路由
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    const episode = searchParams.get('episode');

    if (!id || !episode) {
      return NextResponse.json(
        { error: '缺少必要参数: id, episode' },
        { status: 400 },
      );
    }

    const videoId = parseInt(id);
    const episodeNum = parseInt(episode);

    if (isNaN(videoId) || isNaN(episodeNum)) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    // 获取播放链接
    const playData = await getShortDramaPlayUrl(videoId, episodeNum);

    if (!playData) {
      return NextResponse.json(
        { error: '解析失败，请检查集数是否正确' },
        { status: 400 },
      );
    }

    // 返回视频URL
    const result = {
      url: playData.url,
      originalUrl: playData.url,
      proxyUrl: '', // 新API不需要代理
      title: playData.name || '',
      episode: episodeNum, // 使用原始输入的集数（从0开始）
      totalEpisodes: playData.totalEpisodes || 1,
    };

    const response = NextResponse.json(result);
    response.headers.set(
      'Cache-Control',
      'no-cache, no-store, must-revalidate',
    );
    return response;
  } catch (error) {
    logger.error('短剧解析失败:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
