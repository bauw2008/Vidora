import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { clearConfigCache, getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行管理员配置',
      },
      { status: 400 },
    );
  }

  try {
    const body = await request.json();

    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const username = authInfo.username;

    const {
      SiteName,
      Announcement,
      SearchDownstreamMaxPage,
      SiteInterfaceCacheTime,
      DoubanProxyType,
      DoubanProxy,
      DoubanImageProxyType,
      DoubanImageProxy,
      DisableYellowFilter,
      FluidSearch,
      MenuSettings,
    } = body as {
      SiteName: string;
      Announcement: string;
      SearchDownstreamMaxPage: number;
      SiteInterfaceCacheTime: number;
      DoubanProxyType: string;
      DoubanProxy: string;
      DoubanImageProxyType: string;
      DoubanImageProxy: string;
      DisableYellowFilter: boolean;
      FluidSearch: boolean;
      MenuSettings: {
        showMovies: boolean;
        showTVShows: boolean;
        showAnime: boolean;
        showVariety: boolean;
        showLive: boolean;
        showTvbox: boolean;
        showShortDrama: boolean;
      };
    };

    // 参数校验
    logger.log('API收到参数:', body);

    if (
      typeof SiteName !== 'string' ||
      typeof Announcement !== 'string' ||
      typeof SearchDownstreamMaxPage !== 'number' ||
      typeof SiteInterfaceCacheTime !== 'number' ||
      typeof DoubanProxyType !== 'string' ||
      typeof DoubanProxy !== 'string' ||
      typeof DoubanImageProxyType !== 'string' ||
      typeof DoubanImageProxy !== 'string' ||
      typeof DisableYellowFilter !== 'boolean' ||
      typeof FluidSearch !== 'boolean' ||
      !MenuSettings ||
      typeof MenuSettings.showMovies !== 'boolean' ||
      typeof MenuSettings.showTVShows !== 'boolean' ||
      typeof MenuSettings.showAnime !== 'boolean' ||
      typeof MenuSettings.showVariety !== 'boolean' ||
      typeof MenuSettings.showLive !== 'boolean' ||
      typeof MenuSettings.showTvbox !== 'boolean' ||
      typeof MenuSettings.showShortDrama !== 'boolean'
    ) {
      logger.error('参数验证失败:', {
        SiteName: typeof SiteName,
        Announcement: typeof Announcement,
        SearchDownstreamMaxPage: typeof SearchDownstreamMaxPage,
        SiteInterfaceCacheTime: typeof SiteInterfaceCacheTime,
        DoubanProxyType: typeof DoubanProxyType,
        DoubanProxy: typeof DoubanProxy,
        DoubanImageProxyType: typeof DoubanImageProxyType,
        DoubanImageProxy: typeof DoubanImageProxy,
        DisableYellowFilter: typeof DisableYellowFilter,
        FluidSearch: typeof FluidSearch,
        MenuSettings: MenuSettings ? 'object' : 'undefined',
        showMovies: MenuSettings?.showMovies,
        showTVShows: MenuSettings?.showTVShows,
        showAnime: MenuSettings?.showAnime,
        showVariety: MenuSettings?.showVariety,
        showLive: MenuSettings?.showLive,
        showTvbox: MenuSettings?.showTvbox,
        showShortDrama: MenuSettings?.showShortDrama,
      });
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    const adminConfig = await getConfig();

    // 权限校验
    if (username !== process.env.USERNAME) {
      // 管理员
      const user = adminConfig.UserConfig.Users.find(
        (u) => u.username === username,
      );
      if (!user || user.role !== 'admin' || user.banned) {
        return NextResponse.json({ error: '权限不足' }, { status: 401 });
      }
    }

    // 更新缓存中的站点设置
    adminConfig.SiteConfig = {
      SiteName,
      Announcement,
      SearchDownstreamMaxPage,
      SiteInterfaceCacheTime,
      DoubanProxyType,
      DoubanProxy,
      DoubanImageProxyType,
      DoubanImageProxy,
      DisableYellowFilter,
      FluidSearch,
      // 保持原有的 TMDB 配置，不在这里修改
      TMDBApiKey: adminConfig.SiteConfig.TMDBApiKey || '',
      TMDBLanguage: adminConfig.SiteConfig.TMDBLanguage || 'zh-CN',
      EnableTMDBActorSearch:
        adminConfig.SiteConfig.EnableTMDBActorSearch || false,
      EnableTMDBPosters: adminConfig.SiteConfig.EnableTMDBPosters || false,
      MenuSettings: MenuSettings || {
        showMovies: true,
        showTVShows: true,
        showAnime: true,
        showVariety: true,
        showLive: false,
        showTvbox: false,
        showShortDrama: false,
      },
    };

    // 写入数据库
    await db.saveAdminConfig(adminConfig);

    // 清除配置缓存，强制下次重新从数据库读取
    clearConfigCache();

    // 刷新所有页面的缓存，使新配置立即生效
    revalidatePath('/', 'layout');

    return NextResponse.json(
      {
        success: true,
        message: '站点配置更新成功',
        notify: true, // 标记需要通知其他窗口
      },
      {
        headers: {
          'Cache-Control': 'no-store', // 不缓存结果
        },
      },
    );
  } catch (error) {
    logger.error('更新站点配置失败:', error);
    return NextResponse.json(
      {
        error: '更新站点配置失败',
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
