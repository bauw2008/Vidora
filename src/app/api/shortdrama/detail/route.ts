/* @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getShortDramaDetail } from '@/lib/shortdrama-api';

// 标记为动态路由
export const dynamic = 'force-dynamic';

// 缓存时间配置（秒）
const CACHE_TTL = 4 * 60 * 60; // 4小时

interface VideoDetailResponse {
  id: string;
  title: string;
  poster: string;
  episodes: string[];
  episodes_titles: string[];
  source: string;
  source_name: string;
  year: string;
  desc?: string;
  type_name?: string;
  tags?: string[];
  author?: string;
  vote_average?: number;
  director?: string;
  writer?: string;
  area?: string;
  remarks?: string;
  hits?: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少必要参数: id' }, { status: 400 });
    }

    const videoId = parseInt(id);

    if (isNaN(videoId)) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    // 生成缓存key
    const cacheKey = `shortdrama-detail:${id}`;

    // 尝试从缓存获取
    const cached = await db.getCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // 获取视频详情
    const detail = await getShortDramaDetail(videoId);

    if (!detail) {
      return NextResponse.json(
        { error: '视频不存在或解析失败' },
        { status: 404 },
      );
    }

    const totalEpisodes = Math.max(detail.episode_count || 1, 1);

    // 转换为兼容格式
    const responseData: VideoDetailResponse = {
      id: id, // 使用原始请求ID，保持一致性
      title: detail.name,
      poster: detail.cover,
      episodes: Array.from(
        { length: totalEpisodes },
        (_, i) => `shortdrama:${id}:${i}`, // 使用原始请求ID
      ),
      episodes_titles: Array.from(
        { length: totalEpisodes },
        (_, i) => `第${i + 1}集`,
      ),
      source: 'shortdrama',
      source_name: 'shortdrama',
      year: detail.year || new Date().getFullYear().toString(),
      desc: detail.description,
      type_name: '短剧',
      tags: detail.tags || [], // 标签/分类字段
      author: detail.actor || '',
      vote_average: detail.score || 0, // 评分字段
      director: detail.director || '',
      writer: detail.writer || '',
      area: detail.area || '',
      remarks: detail.remarks || '',
      hits: detail.hits || 0,
    };

    // 只在成功时保存到缓存
    await db.setCache(cacheKey, responseData, CACHE_TTL);

    const result = NextResponse.json(responseData);
    result.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return result;
  } catch (error) {
    logger.error('短剧详情获取失败:', error);

    // 发生错误时删除相关缓存
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    if (id) {
      const cacheKey = `shortdrama-detail:${id}`;
      await db.deleteCache(cacheKey).catch(() => {
        // 忽略缓存删除错误
      });
    }

    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
