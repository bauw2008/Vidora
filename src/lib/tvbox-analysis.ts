import { type ApiSite } from '@/lib/config';
import { extractEpisodesFromPlayUrl } from '@/lib/tvbox-episode-utils';
import type { SearchResult } from '@/lib/types';
import { cleanHtmlTags } from '@/lib/utils';

import { logger } from './logger';

interface ApiSearchItem {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_remarks?: string;
  vod_play_url?: string;
  vod_class?: string;
  vod_year?: string;
  vod_content?: string;
  vod_douban_id?: number;
  type_name?: string;
}

/**
 * 按分类获取视频列表（专用于分类筛选）
 */
export async function getVideosByCategory(
  apiSite: ApiSite,
  category?: string,
  page = 1,
  pagesize?: number,
): Promise<{ results: SearchResult[]; pageCount: number }> {
  let timeoutId: NodeJS.Timeout | null = null;
  const controller = new AbortController();

  try {
    let apiUrl = apiSite.api;

    // 根据视频源key调整API端点
    if (apiSite.key === 'dyttzy') {
      // 视频列表端点
      if (apiUrl.includes('/provide/vod')) {
        // 将分类信息端点转换为视频列表端点
        apiUrl = apiUrl.replace('/provide/vod', '/provide/vod/list');
      }

      // 添加查询参数
      const params = new URLSearchParams();
      params.append('ac', 'videolist');
      params.append('pg', page.toString());

      if (pagesize) {
        params.append('pagesize', pagesize.toString());
      }

      if (category) {
        params.append('t', category);
      }

      apiUrl += `?${params.toString()}`;
    } else {
      // 其他视频源的默认逻辑
      const params = new URLSearchParams();
      params.append('ac', 'videolist');
      params.append('pg', page.toString());

      if (pagesize) {
        params.append('pagesize', pagesize.toString());
      }

      if (category) {
        params.append('t', category);
      }

      apiUrl += `?${params.toString()}`;
    }

    // 设置8秒超时
    timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(apiUrl, {
      signal: controller.signal,
    });

    // 清理超时
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data?.list || !Array.isArray(data.list)) {
      return { results: [], pageCount: 1 };
    }

    // 处理结果数据（复用现有的映射逻辑）
    const results = data.list.map((item: ApiSearchItem) => {
      const { episodes, titles } = extractEpisodesFromPlayUrl(
        item.vod_play_url,
      );

      return {
        id: item.vod_id.toString(),
        title: item.vod_name.trim().replace(/\s+/g, ' '),
        poster: item.vod_pic,
        episodes,
        episodes_titles: titles,
        source: apiSite.key,
        source_name: apiSite.name,
        class: item.vod_class,
        year: item.vod_year
          ? item.vod_year.match(/\d{4}/)?.[0] || ''
          : 'unknown',
        desc: cleanHtmlTags(item.vod_content || ''),
        type_name: item.type_name || item.vod_class, // 如果 type_name 为空，使用 vod_class
        douban_id: item.vod_douban_id,
      };
    });

    // 过滤掉集数为 0 的结果
    const filteredResults = results.filter(
      (result: SearchResult) => result.episodes.length > 0,
    );

    // 获取总页数
    const pageCount = data.pagecount || data.totalPages || 1;

    return { results: filteredResults, pageCount };
  } catch (error) {
    // 清理超时
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    logger.error('分类筛选失败:', error);
    return { results: [], pageCount: 1 };
  }
}
