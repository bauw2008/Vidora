import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // 强制动态渲染

// 普通用户也可以访问的 TVBox 配置接口
// 只返回 TVBox 安全配置，不返回完整的管理配置

export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);

  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = authInfo;
  try {
    const config = await getConfig();
    const defaultSecurityConfig = {
      enableAuth: false,
      token: '',
      enableRateLimit: false,
      rateLimit: 60,
      enableDeviceBinding: false,
      maxDevices: 1,
      currentDevices: [],
      userTokens: [],
    };

    // 合并默认配置和实际配置
    const securityConfig = {
      ...defaultSecurityConfig,
      ...(config.TVBoxSecurityConfig || {}),
    };

    // 构建用户特定的安全配置
    const userSecurityConfig = {
      enableAuth: securityConfig.enableAuth,
      token: '', // 初始化为空，下面会根据用户设置

      enableRateLimit: securityConfig.enableRateLimit,
      rateLimit: securityConfig.rateLimit || 60,
      enableDeviceBinding: securityConfig.enableDeviceBinding || false,
      maxDevices: securityConfig.maxDevices || 1,
      enableUserAgentWhitelist:
        securityConfig.enableUserAgentWhitelist || false,
      allowedUserAgents: securityConfig.allowedUserAgents || [],
      userTokens: securityConfig.userTokens || [], // 添加userTokens数据
    };

    // 如果启用了设备绑定，返回当前用户的Token
    if (
      securityConfig.enableDeviceBinding &&
      securityConfig.userTokens &&
      Array.isArray(securityConfig.userTokens)
    ) {
      const userTokenInfo = securityConfig.userTokens.find(
        (t) => t.username === user.username,
      );
      logger.log('[TVBoxConfig] 查找用户Token:', {
        username: user.username,
        userTokens: securityConfig.userTokens.map((t) => ({
          username: t.username,
          enabled: t.enabled,
          hasToken: !!t.token,
        })),
        foundUser: userTokenInfo ? userTokenInfo.username : '未找到',
        tokenEnabled: userTokenInfo?.enabled,
        hasToken: !!userTokenInfo?.token,
      });
      if (userTokenInfo && userTokenInfo.enabled) {
        // 如果有token字段，使用它；否则生成一个默认token
        if (!userTokenInfo.token) {
          // 生成一个默认token
          userTokenInfo.token = 'BYXBX6Ysyb9WMgw92vDLnntv0WGYbJav';
          logger.log('[TVBoxConfig] 为用户生成默认Token');
        }
        userSecurityConfig.token = userTokenInfo.token;
        // 为了向后兼容，同时设置enableAuth为true
        userSecurityConfig.enableAuth = true;
      } else {
        // 如果用户没有对应的Token，返回空（禁止访问）
        userSecurityConfig.token = '';
        userSecurityConfig.enableAuth = false;
      }

      // 确保userTokens中包含完整的数据
      userSecurityConfig.userTokens = securityConfig.userTokens.map(
        (token) => ({
          ...token,
          token: token.token || 'BYXBX6Ysyb9WMgw92vDLnntv0WGYbJav',
          id: token.id || `token-${Math.random().toString(36).substr(2, 9)}`,
          name: token.name || token.username || 'Default Token',
          url: token.url || '',
          createdAt: token.createdAt || Date.now(),
          lastUsed: token.lastUsed || 0,
          usageCount: token.usageCount || 0,
        }),
      );
    } else {
      // 未启用设备绑定，不使用Token验证
      userSecurityConfig.token = '';
      userSecurityConfig.enableAuth = false;
      userSecurityConfig.userTokens = [];
    }

    // 只返回用户特定的 TVBox 安全配置和站点名称
    logger.log('[TVBoxConfig] 返回的数据:', {
      securityConfig: userSecurityConfig,
      siteName: config.SiteConfig?.SiteName || 'Vidora',
    });
    return NextResponse.json({
      securityConfig: userSecurityConfig,
      siteName: config.SiteConfig?.SiteName || 'Vidora',
    });
  } catch (error) {
    logger.error('获取TVBox配置失败:', error);
    return NextResponse.json({ error: '获取TVBox配置失败' }, { status: 500 });
  }
}

// POST 请求：保存 TMDB 配置
export async function POST(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);

  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 检查权限：只有管理员或站长可以修改 TMDB 配置
  if (authInfo.role !== 'admin' && authInfo.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const tmdbSettings = await request.json();

    // 获取完整配置
    const config = await getConfig();

    // 更新 SiteConfig 中的 TMDB 相关字段
    if (config.SiteConfig) {
      config.SiteConfig.TMDBApiKey = tmdbSettings.TMDBApiKey;
      config.SiteConfig.TMDBLanguage = tmdbSettings.TMDBLanguage;
      config.SiteConfig.EnableTMDBActorSearch =
        tmdbSettings.EnableTMDBActorSearch;
      config.SiteConfig.EnableTMDBPosters = tmdbSettings.EnableTMDBPosters;
    }

    // 保存完整配置
    await db.saveAdminConfig(config);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('保存TMDB配置失败:', error);
    return NextResponse.json({ error: '保存TMDB配置失败' }, { status: 500 });
  }
}
