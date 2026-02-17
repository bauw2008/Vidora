import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { getAvailableApiSites } from '@/lib/config';
import { logger } from '@/lib/logger';
import { TVBOX_USER_AGENTS } from '@/lib/user-agent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 检查是否包含敏感词
function containsYellowWords(title: string, yellowWords: string[]): boolean {
  if (!yellowWords || yellowWords.length === 0) return false;

  return yellowWords.some((word) =>
    title.toLowerCase().includes(word.toLowerCase()),
  );
}

// 定义 TVBox 搜索结果项类型
interface TVBoxSearchItem {
  vod_id?: string | number;
  vod_name?: string;
  vod_pic?: string;
  vod_year?: string;
  type_name?: string;
  vod_play_url?: string;
}

// 定义用户标签配置类型
interface UserTagConfig {
  name: string;
  videoSources?: string[];
  disableYellowFilter?: boolean;
}

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);

  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = authInfo;
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const keyword = searchParams.get('keyword');
    const page = searchParams.get('page') || '1';
    const pagesize = searchParams.get('pagesize')
      ? parseInt(searchParams.get('pagesize') || '0')
      : undefined;

    if (!source || !keyword) {
      return NextResponse.json(
        { error: '缺少视频源或搜索关键词' },
        { status: 400 },
      );
    }

    // 获取用户有权限访问的源配置
    const availableSources = await getAvailableApiSites(user?.username || '');
    const sourceConfig = availableSources.find((s) => s.key === source);

    if (!sourceConfig) {
      return NextResponse.json(
        { error: '找不到视频源配置或无权限访问' },
        { status: 404 },
      );
    }

    try {
      // 构建搜索API URL
      let searchUrl = sourceConfig.api;
      const params = new URLSearchParams();
      params.append('ac', 'list');
      params.append('wd', keyword);
      params.append('pg', page);

      if (pagesize) {
        params.append('pagesize', pagesize.toString());
      }

      // 根据不同的API类型调整URL
      if (sourceConfig.api.includes('/provide/vod')) {
        searchUrl = sourceConfig.api.includes('?')
          ? `${sourceConfig.api}&${params.toString()}`
          : `${sourceConfig.api}?${params.toString()}`;
      } else {
        searchUrl = `${sourceConfig.api}?${params.toString()}`;
      }

      logger.log('TVBox搜索URL:', searchUrl);

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': TVBOX_USER_AGENTS.TVBOX_OFFICIAL,
          Accept: 'application/json, text/plain, */*',
        },
        signal: AbortSignal.timeout(10000), // 10秒超时
      });

      if (!response.ok) {
        throw new Error(`搜索请求失败: ${response.status}`);
      }

      const data = await response.json();

      if (!data?.list || !Array.isArray(data.list)) {
        return NextResponse.json({ list: [], total: 0 });
      }

      // 处理搜索结果
      const results = data.list.map((item: TVBoxSearchItem) => ({
        id: item.vod_id?.toString() || '',
        title: item.vod_name?.trim() || '',
        poster: item.vod_pic || '',
        source: sourceConfig.key,
        source_name: sourceConfig.name,
        year: item.vod_year?.match(/\d{4}/)?.[0] || 'unknown',
        type_name: item.type_name || '',
        episodes: item.vod_play_url ? item.vod_play_url.split('#').length : 0,
      }));

      // 应用敏感词过滤（使用搜索页面的逻辑）
      const config = await getConfig();
      let filteredResults = results;

      // 正确的18禁过滤逻辑
      let shouldFilter = false;

      if (config.YellowWords && config.YellowWords.length > 0) {
        // 检查用户是否需要过滤
        const userConfig = config.UserConfig.Users?.find(
          (u) => u.username === user?.username,
        );

        // 1. 检查全局开关（主开关）
        if (config.SiteConfig.DisableYellowFilter) {
          shouldFilter = false;
        }
        // 2. 全局开关开启，检查具体设置
        else {
          // 站长永远不过滤
          if (userConfig?.role === 'owner') {
            shouldFilter = false;
          }
          // 检查用户组设置
          else if (
            userConfig?.tags &&
            userConfig.tags.length > 0 &&
            config.UserConfig.Tags
          ) {
            for (const tagName of userConfig.tags) {
              const tagConfig = (
                config.UserConfig.Tags as UserTagConfig[]
              )?.find((t) => t.name === tagName);
              // disableYellowFilter = true 表示用户组开启过滤
              if (tagConfig?.disableYellowFilter === true) {
                shouldFilter = true;
                break;
              }
            }
            // 如果用户组没有开启过滤，则不过滤
            if (!shouldFilter) {
              shouldFilter = false;
            }
          }
          // 默认情况：没有用户组设置，不过滤
          else {
            shouldFilter = false;
          }
        }

        // 应用过滤（如果需要过滤）
        if (shouldFilter) {
          filteredResults = results.filter(
            (item) =>
              !containsYellowWords(item.title || '', config.YellowWords),
          );
        }
      }

      return NextResponse.json({
        list: filteredResults,
        total: filteredResults.length,
        page: parseInt(page),
      });
    } catch (searchError) {
      logger.error('TVBox搜索失败:', searchError);
      return NextResponse.json({
        list: [],
        total: 0,
        error: '搜索失败',
      });
    }
  } catch (error) {
    logger.error('TVBox搜索失败:', error);
    return NextResponse.json({ error: 'TVBox搜索失败' }, { status: 500 });
  }
}
