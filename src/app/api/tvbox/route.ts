import { NextRequest, NextResponse } from 'next/server';

import { clearConfigCache, getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCandidates, getSpiderJar } from '@/lib/spiderJar';
import { getMobileUserAgent, TVBOX_USER_AGENTS } from '@/lib/user-agent';

// 定义用户标签配置类型
interface UserTagConfig {
  name: string;
  videoSources?: string[];
  disableYellowFilter?: boolean;
  aiEnabled?: boolean;
  netDiskSearchEnabled?: boolean;
  tmdbActorSearchEnabled?: boolean;
}

// 定义源站配置类型（与 AdminConfig.SourceConfig 兼容）
interface SourceConfig {
  key: string;
  name: string;
  api: string;
  detail?: string;
  from: 'config' | 'custom';
  disabled?: boolean;
  requiresAuth?: boolean;
  type?: number; // TVBox API 类型 (0=XML, 1=JSON, 3=Spider)
  searchable?: number;
  quickSearch?: number;
  filterable?: number;
  ext?: string;
  jar?: string;
  playerType?: number;
  playerUrl?: string;
  categories?: string[];
  hide?: number;
  timeout?: number;
  retry?: number;
  header?: Record<string, string>;
  changeable?: number;
}

// 根据用户权限过滤源站
function filterSourcesByUserPermissions(
  sources: SourceConfig[],
  user: { username: string; videoSources?: string[]; tags?: string[] },
  tagsConfig: UserTagConfig[],
): SourceConfig[] {
  // 如果用户有直接指定的videoSources，优先使用
  if (user.videoSources && user.videoSources.length > 0) {
    return sources.filter(
      (source) =>
        !source.disabled && (user.videoSources || []).includes(source.key),
    );
  }

  // 如果用户有用户组标签，根据用户组权限过滤
  if (
    user.tags &&
    user.tags.length > 0 &&
    tagsConfig &&
    tagsConfig.length > 0
  ) {
    // 获取用户所有标签的权限并集
    const allowedSources = new Set<string>();

    user.tags.forEach((tagName) => {
      const tag = tagsConfig.find((t) => t.name === tagName);
      if (tag?.videoSources) {
        tag.videoSources.forEach((source: string) =>
          allowedSources.add(source),
        );
      }
    });

    // 如果用户组有权限限制，则过滤源站
    if (allowedSources.size > 0) {
      return sources.filter(
        (source) => !source.disabled && allowedSources.has(source.key),
      );
    }
  }

  // 如果没有权限限制，返回所有未禁用的源站
  return sources.filter((source) => !source.disabled);
}

// Helper function to get base URL with SITE_BASE env support
function getBaseUrl(request: NextRequest): string {
  // 优先使用环境变量 SITE_BASE（如果用户设置了）
  const envBase = (process.env.SITE_BASE || '').trim().replace(/\/$/, '');
  if (envBase) {
    return envBase;
  }

  // Fallback：使用原有逻辑（完全保留）
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  return `${protocol}://${host}`;
}

// 生产环境使用Redis/Upstash/Kvrocks的频率限制
async function checkRateLimit(
  ip: string,
  limit = 60,
  windowMs = 60000,
): Promise<boolean> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs; // 对齐到时间窗口开始
  const key = `tvbox-rate-limit:${ip}:${windowStart}`;

  try {
    // 获取当前计数
    const currentCount = ((await db.getCache(key)) as number) || 0;

    if (currentCount >= limit) {
      return false;
    }

    // 增加计数并设置过期时间
    const newCount = currentCount + 1;
    const expireSeconds = Math.ceil(windowMs / 1000); // 转换为秒
    await db.setCache(key, newCount, expireSeconds);

    return true;
  } catch (error) {
    logger.error('Rate limit check failed:', error);
    // 如果数据库操作失败，允许请求通过（fail-open策略）
    return true;
  }
}

// 清理过期的频率限制缓存（内部使用）
async function _cleanExpiredRateLimitCache(): Promise<void> {
  try {
    await db.clearExpiredCache('tvbox-rate-limit');
  } catch (error) {
    logger.error('Clean expired rate limit cache failed:', error);
  }
}

// 并发控制器 - 限制同时请求数量（优化分类获取性能）
class ConcurrencyLimiter {
  private running = 0;

  constructor(private maxConcurrent: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    while (this.running >= this.maxConcurrent) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
    }
  }
}

const categoriesLimiter = new ConcurrencyLimiter(10); // 最多同时10个请求

// 从请求中获取设备ID
function getDeviceIdFromRequest(request: NextRequest): string {
  // 使用与前端完全一致的设备指纹算法
  const userAgent = request.headers.get('user-agent') || '';
  const platform = request.headers.get('sec-ch-ua-platform') || '';
  const _accept = request.headers.get('accept') || '';
  const acceptLanguage = request.headers.get('accept-language') || '';

  // 模拟前端设备信息结构，与device-fingerprint.ts保持一致
  const deviceInfo = {
    userAgent,
    language: acceptLanguage,
    platform,
    screenResolution: 'unknown', // 在服务器端无法获取屏幕分辨率
    timezone: 'unknown', // 在服务器端无法获取时区
    hardwareConcurrency: 0, // 在服务器端无法获取硬件并发数
    deviceMemory: 0, // 在服务器端无法获取设备内存
  };

  // 使用与前端完全一致的哈希算法
  const fingerprintData = [
    deviceInfo.userAgent,
    deviceInfo.platform,
    deviceInfo.screenResolution,
    deviceInfo.hardwareConcurrency.toString(),
    deviceInfo.deviceMemory.toString(),
  ].join('|');

  let hash = 0;
  for (let i = 0; i < fingerprintData.length; i++) {
    const char = fingerprintData.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 转换为32位整数
  }

  const deviceId = Math.abs(hash).toString(36);

  return deviceId;
}

// 私网地址判断
function isPrivateHost(host: string): boolean {
  if (!host) {
    return true;
  }
  const lower = host.toLowerCase();
  return (
    lower.startsWith('localhost') ||
    lower.startsWith('127.') ||
    lower.startsWith('0.0.0.0') ||
    lower.startsWith('10.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(lower) ||
    lower.startsWith('192.168.') ||
    lower === '::1'
  );
}

// TVBox源格式接口 (基于官方标准)
interface TVBoxSource {
  key: string;
  name: string;
  type: number; // 0=XML接口, 1=JSON接口, 3=Spider/JAR接口
  api: string;
  searchable?: number; // 0=不可搜索, 1=可搜索
  quickSearch?: number; // 0=不支持快速搜索, 1=支持快速搜索
  filterable?: number; // 0=不支持分类筛选, 1=支持分类筛选
  ext?: string; // 扩展数据字段，可包含配置规则或外部文件URL
  jar?: string; // 自定义JAR文件地址
  playerType?: number; // 播放器类型 (0: 系统, 1: ijk, 2: exo, 10: mxplayer, -1: 使用设置页默认)
  playerUrl?: string; // 站点解析URL
  categories?: string[]; // 自定义资源分类和排序
  hide?: number; // 是否隐藏源站 (1: 隐藏, 0: 显示)
  timeout?: number; // 超时时间
  retry?: number; // 重试次数
  header?: Record<string, string>; // 请求头
  changeable?: number; // 是否可切换 (0: 不可切换, 1: 可切换)
}

interface TVBoxConfig {
  spider?: string; // 爬虫jar包地址
  wallpaper?: string; // 壁纸地址
  lives?: Array<{
    name: string;
    type: number;
    url: string;
    epg?: string;
    logo?: string;
  }>; // 直播源
  sites: TVBoxSource[]; // 影视源
  parses?: Array<{
    name: string;
    type: number;
    url: string;
    ext?: Record<string, unknown>;
    header?: Record<string, string>;
  }>; // 解析源
  flags?: string[]; // 播放标识
  ijk?: Array<{
    group: string;
    options: Array<{
      category: number;
      name: string;
      value: string;
    }>;
  }>; // IJK播放器配置
  ads?: string[]; // 广告过滤规则
  doh?: Array<{
    name: string;
    url: string;
    ips: string[];
  }>; // DNS over HTTPS 配置
  rules?: Array<{
    name: string;
    hosts: string[];
    regex: string[];
  }>; // 播放规则（用于影视仓模式）
  maxHomeVideoContent?: string; // 首页最大视频数量
  spider_backup?: string; // 备用本地代理地址
  spider_url?: string; // 实际使用的 spider URL
  spider_md5?: string; // spider jar 的 MD5
  spider_cached?: boolean; // 是否来自缓存
  spider_real_size?: number; // 实际 jar 大小（字节）
  spider_tried?: number; // 尝试次数
  spider_success?: boolean; // 是否成功获取远程 jar
  spider_candidates?: string[]; // 候选地址列表
}

// 配置缓存 - 减少重复计算
type CachedConfig = {
  SiteConfig?: Record<string, unknown>;
  ApiSites?: SourceConfig[];
  SourceConfig?: Array<{
    key: string;
    name: string;
    api: string;
    detail?: string;
    from: 'config' | 'custom';
    disabled?: boolean;
    requiresAuth?: boolean;
  }>;
  UserConfig?: {
    Users?: Array<{
      username: string;
      videoSources?: string[];
      tags?: string[];
      role?: 'owner' | 'admin' | 'user';
    }>;
    Tags?: UserTagConfig[];
  };
  LiveConfig?: Array<{
    name: string;
    url: string;
    epg?: string;
    disabled?: boolean;
  }>;
  SecurityConfig?: {
    enableTokenAuth?: boolean;
    token?: string;
    userTokens?: Array<{
      username: string;
      token: string;
      devices?: Array<{ deviceId: string }>;
    }>;
    enableDeviceBinding?: boolean;
    enableRateLimit?: boolean;
    rateLimit?: {
      windowMs: number;
      maxRequests: number;
    };
    enableUserAgentWhitelist?: boolean;
    userAgentWhitelist?: string[];
  };
  TVBoxSecurityConfig?: {
    enableAuth?: boolean;
    enableDeviceBinding?: boolean;
    token?: string;
    userTokens?: Array<{
      username: string;
      token: string;
      devices?: Array<{ deviceId: string }>;
      enabled?: boolean;
    }>;
    enableRateLimit?: boolean;
    rateLimit?: number;
    maxDevices?: number;
    enableUserAgentWhitelist?: boolean;
    allowedUserAgents?: string[];
  };
  YellowWords?: string[];
};

let cachedConfig: CachedConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30 * 1000; // 30秒缓存

// 分类数据缓存
const categoriesCache = new Map<
  string,
  { data: string[]; timestamp: number }
>();
const CATEGORIES_CACHE_TTL = 60 * 60 * 1000; // 1小时缓存

async function getCachedConfig() {
  const now = Date.now();
  if (!cachedConfig || now - cacheTimestamp > CACHE_TTL) {
    cachedConfig = await getConfig();
    cacheTimestamp = now;
  }
  return cachedConfig;
}

// 获取缓存的分类数据（支持用户组权限控制）
async function getCachedCategories(
  sourceApi: string,
  sourceName: string,
  user?: { username: string; tags?: string[] },
): Promise<string[]> {
  const now = Date.now();
  const cacheKey = `${sourceApi}|${sourceName}`;

  const cached = categoriesCache.get(cacheKey);
  if (cached && now - cached.timestamp < CATEGORIES_CACHE_TTL) {
    return cached.data;
  }

  try {
    // 尝试获取源站的分类数据
    const categoriesUrl = `${sourceApi}?ac=list`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

    const response = await fetch(categoriesUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': TVBOX_USER_AGENTS.TVBOX_OFFICIAL,
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.class && Array.isArray(data.class)) {
        let categories = data.class
          .map(
            (cat: { type_name?: string; name?: string }) =>
              cat.type_name || cat.name,
          )
          .filter((name: string) => name);

        // 应用18+过滤器（使用搜索页面的逻辑）
        const config = await getCachedConfig();

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
                const tagConfig = config.UserConfig.Tags.find(
                  (t) => t.name === tagName,
                );
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
            categories = categories.filter((category: string) => {
              const lowerCategory = category.toLowerCase();
              return !config.YellowWords.some((word: string) =>
                lowerCategory.includes(word.toLowerCase()),
              );
            });
          }
        }

        // 缓存分类数据
        categoriesCache.set(cacheKey, { data: categories, timestamp: now });
        return categories;
      }
    }
  } catch (error) {
    // 优化的错误处理：区分不同类型的错误
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        logger.warn(
          `[TVBox] 获取源站 ${sourceName} 分类超时(5s)，使用默认分类`,
        );
      } else if (
        error.message.includes('JSON') ||
        error.message.includes('parse')
      ) {
        logger.warn(
          `[TVBox] 源站 ${sourceName} 返回的分类数据格式错误，使用默认分类`,
        );
      } else if (
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ECONNREFUSED')
      ) {
        logger.warn(`[TVBox] 无法连接到源站 ${sourceName}，使用默认分类`);
      } else {
        logger.warn(
          `[TVBox] 获取源站 ${sourceName} 分类失败: ${error.message}，使用默认分类`,
        );
      }
    } else {
      logger.warn(
        `[TVBox] 获取源站 ${sourceName} 分类失败（未知错误），使用默认分类`,
      );
    }
  }

  // 返回默认分类（同样应用过滤器），但不缓存默认分类
  // 这样下次请求会重新尝试获取真实分类，避免缓存错误的默认分类
  let defaultCategories = ['电影', '电视剧', '综艺', '动漫', '纪录片', '短剧'];

  const config = await getCachedConfig();
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
          const tagConfig = config.UserConfig.Tags.find(
            (t) => t.name === tagName,
          );
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
      defaultCategories = defaultCategories.filter((category: string) => {
        const lowerCategory = category.toLowerCase();
        return !config.YellowWords.some((word: string) =>
          lowerCategory.includes(word.toLowerCase()),
        );
      });
    }
  }

  // 重要：不缓存默认分类，避免将错误数据缓存1小时
  // 下次请求时重新尝试获取真实分类数据
  return defaultCategories;
}

export async function GET(request: NextRequest) {
  const { pathname } = new URL(request.url);

  // 如果是具体的API端点，不应该由这个通用路由处理
  if (
    pathname.includes('/videos') ||
    pathname.includes('/search') ||
    pathname.includes('/video-sources')
  ) {
    return NextResponse.json(
      { error: '路由配置错误：具体API端点不应由通用路由处理' },
      { status: 500 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json'; // 支持json和base64格式
    const mode = (searchParams.get('mode') || '').toLowerCase(); // 支持safe|min模式
    const token = searchParams.get('token'); // 获取token参数
    const forceSpiderRefresh = searchParams.get('forceSpiderRefresh') === '1'; // 强制刷新spider缓存

    // 读取当前配置（使用缓存）
    const config = await getCachedConfig();

    // 读取当前配置（强制刷新缓存）
    // clearConfigCache(); // 强制清除缓存
    // const config = await getConfig(); // 不使用缓存版本
    const securityConfig = config.TVBoxSecurityConfig;

    // 访问频率限制（从数据库配置读取） - 第一道防线
    if (securityConfig?.enableRateLimit) {
      // 获取客户端真实IP - 正确处理x-forwarded-for中的多个IP
      const getClientIP = () => {
        const forwardedFor = request.headers.get('x-forwarded-for');
        if (forwardedFor) {
          return forwardedFor.split(',')[0].trim();
        }
        return (
          request.headers.get('x-real-ip') ||
          request.headers.get('cf-connecting-ip') ||
          'unknown'
        );
      };

      const clientIP = getClientIP();

      const rateLimit = securityConfig.rateLimit || 60;

      if (!(await checkRateLimit(clientIP, rateLimit))) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            hint: `访问频率超限，每分钟最多${rateLimit}次请求`,
          },
          { status: 429 },
        );
      }
    }

    // User-Agent白名单检查（从数据库配置读取） - 第二道防线
    if (
      securityConfig?.enableUserAgentWhitelist &&
      securityConfig.allowedUserAgents &&
      securityConfig.allowedUserAgents.length > 0
    ) {
      const userAgent = request.headers.get('user-agent') || '';

      const isAllowedUserAgent = securityConfig.allowedUserAgents.some(
        (allowedUA: string) => {
          const trimmedUA = allowedUA.trim();
          if (trimmedUA === '*') {
            return true;
          }

          // 支持通配符匹配
          if (trimmedUA.includes('*')) {
            // 将通配符转换为正则表达式
            const pattern = trimmedUA.replace(/\*/g, '.*').replace(/\?/g, '.');
            const regex = new RegExp(pattern, 'i');
            return regex.test(userAgent);
          }

          // 精确匹配（不区分大小写）
          return userAgent.toLowerCase().includes(trimmedUA.toLowerCase());
        },
      );

      if (!isAllowedUserAgent) {
        logger.warn(`[TVBox] User-Agent不在白名单中: ${userAgent}`);
        return NextResponse.json(
          {
            error: `User-Agent not allowed: ${userAgent}`,
            hint: '该User-Agent不在白名单中',
          },
          { status: 403 },
        );
      }
    }

    // Token验证（从数据库配置读取） - 第三道防线
    // 如果启用了Token验证或设备绑定，都需要进行Token验证
    let tokenUsername: string | null = null; // 保存Token对应的用户名

    if (securityConfig?.enableAuth || securityConfig?.enableDeviceBinding) {
      let isValidToken = false;
      let _matchedUserTokenInfo = null;

      // 首先检查用户级别Token
      if (
        securityConfig.userTokens &&
        Array.isArray(securityConfig.userTokens)
      ) {
        // 用户级别Token验证
        for (const userTokenInfo of securityConfig.userTokens) {
          if (userTokenInfo.enabled && userTokenInfo.token === token) {
            isValidToken = true;
            _matchedUserTokenInfo = userTokenInfo;
            tokenUsername = userTokenInfo.username; // 保存用户名

            // 如果启用了设备绑定，还需要验证设备
            if (
              securityConfig.enableDeviceBinding &&
              userTokenInfo.devices &&
              Array.isArray(userTokenInfo.devices)
            ) {
              const deviceId = getDeviceIdFromRequest(request);

              const device = userTokenInfo.devices.find(
                (d: { deviceId: string }) => d.deviceId === deviceId,
              );

              if (!device) {
                // 如果没有找到设备，尝试自动绑定当前设备
                // 在TVBox API中无法通过Cookie获取用户信息，所以直接使用Token对应的用户
                const currentUsername = userTokenInfo.username;

                // 检查是否超过最大设备数量限制
                const maxDevices = securityConfig.maxDevices || 1;
                if (userTokenInfo.devices.length >= maxDevices) {
                  return NextResponse.json(
                    {
                      error: 'Device not authorized',
                      hint: `设备未授权，已达到最大设备数量限制 (${maxDevices}台)，请联系管理员`,
                    },
                    { status: 403 },
                  );
                }

                // 自动绑定当前设备
                const currentDevice = {
                  deviceId,
                  deviceInfo: `自动绑定 - ${
                    request.headers.get('user-agent') || 'Unknown Device'
                  }`,
                  bindTime: Date.now(),
                  username: currentUsername,
                };

                // 保存自动绑定的设备到数据库
                try {
                  const adminConfig = await getConfig();
                  const tvboxSecurityConfig =
                    adminConfig.TVBoxSecurityConfig || {
                      enableAuth: false,
                      token: '',
                      enableRateLimit: false,
                      rateLimit: 30,
                      enableDeviceBinding: false,
                      maxDevices: 1,
                      enableUserAgentWhitelist: false,
                      allowedUserAgents: [],
                      tokens: [],
                      currentDevices: [],
                      userTokens: [],
                    };

                  // 更新用户Token的设备列表
                  if (
                    tvboxSecurityConfig.userTokens &&
                    Array.isArray(tvboxSecurityConfig.userTokens)
                  ) {
                    const updatedUserTokens =
                      tvboxSecurityConfig.userTokens.map((token) => {
                        if (
                          token.username === currentUsername &&
                          token.token === userTokenInfo.token
                        ) {
                          return {
                            ...token,
                            devices: [...(token.devices || []), currentDevice],
                          };
                        }
                        return token;
                      });

                    tvboxSecurityConfig.userTokens = updatedUserTokens;
                    adminConfig.TVBoxSecurityConfig = tvboxSecurityConfig;

                    await db.saveAdminConfig(adminConfig);
                    clearConfigCache(); // 清除配置缓存
                  }
                } catch (error) {
                  logger.error('[TVBox] 保存自动绑定设备失败:', error);
                  return NextResponse.json(
                    {
                      error: 'Device binding failed',
                      hint: '设备绑定失败，请重试',
                    },
                    { status: 500 },
                  );
                }
              }
            } else {
              logger.log('[TVBox] 设备绑定未启用，跳过设备验证');
            }
            break;
          }
        }
      } else {
        // 全局Token验证（向后兼容）
        const validToken = securityConfig.token;
        if (token === validToken) {
          isValidToken = true;
          logger.log('[TVBox] 全局Token验证通过');
        }
      }

      if (!token || !isValidToken) {
        return NextResponse.json(
          {
            error: 'Invalid token. Please add ?token=YOUR_TOKEN to the URL',
            hint: '请在URL中添加 ?token=你的密钥 参数',
          },
          { status: 401 },
        );
      }

      // Token和设备验证通过，继续处理请求
    }

    const baseUrl = getBaseUrl(request);

    // 从配置中获取源站列表
    const sourceConfigs = config.SourceConfig || [];

    if (sourceConfigs.length === 0) {
      return NextResponse.json(
        { error: '没有配置任何视频源' },
        { status: 500 },
      );
    }

    // 过滤掉被禁用的源站和没有API地址的源站
    let enabledSources = sourceConfigs.filter(
      (source: SourceConfig) =>
        !source.disabled && source.api && source.api.trim() !== '',
    );

    // 第一步：检查用户身份和用户组权限（无论有无Token都执行）
    let currentUser:
      | { username: string; tags?: string[]; videoSources?: string[] }
      | undefined;
    let targetUser:
      | { username: string; tags?: string[]; videoSources?: string[] }
      | undefined;

    // 优先使用Token验证时获取的用户名
    if (tokenUsername) {
      targetUser = config.UserConfig.Users.find(
        (u: { username: string }) => u.username === tokenUsername,
      );
    } else {
      // 如果没有Token，尝试使用默认用户或第一个用户（可根据业务需求调整）
      targetUser =
        config.UserConfig.Users.find((u) => u.role === 'owner') ||
        config.UserConfig.Users.find((u) => u.role === 'admin') ||
        config.UserConfig.Users[0];
    }

    if (targetUser) {
      currentUser = {
        username: targetUser.username,
        tags: targetUser.tags,
        videoSources: targetUser.videoSources,
      };

      // 根据用户权限过滤源站
      enabledSources = filterSourcesByUserPermissions(
        enabledSources,
        targetUser,
        config.UserConfig.Tags || [],
      );
    } else {
      // 如果没有找到用户，返回所有可用源

      logger.log(
        `[TVBox] 未找到用户信息，返回所有可用源站: ${enabledSources.length}个`,
      );
    }

    // 第二步：后续会进行其他安全检查（频率限制、UA白名单、Token验证等）

    // 跟踪全局 spider jar（从 detail 字段中提取）
    let globalSpiderJar = '';

    // 转换为TVBox格式
    let tvboxConfig: TVBoxConfig = {
      // 基础配置
      spider: '', // 将在后面设置为 globalSpiderJar
      wallpaper: `${baseUrl}/logo.png`, // 使用项目Logo作为壁纸

      // 影视源配置
      sites: await Promise.all(
        enabledSources.map(async (source: SourceConfig) => {
          /**
           * 智能 API 类型检测（参考 DecoTV 优化）
           * 0: MacCMS XML格式
           * 1: MacCMS JSON格式
           * 3: CSP源 (Custom Spider Plugin)
           */
          const detectApiType = (api: string): number => {
            const url = api.toLowerCase().trim();

            // CSP 源（插件源，优先判断）
            if (url.startsWith('csp_')) {
              return 3;
            }

            // XML 采集接口 - 更精确匹配
            if (
              url.includes('.xml') ||
              url.includes('xml.php') ||
              url.includes('api.php/provide/vod/at/xml') ||
              url.includes('provide/vod/at/xml') ||
              (url.includes('maccms') && url.includes('xml'))
            ) {
              return 0;
            }

            // JSON 采集接口 - 标准苹果CMS格式
            if (
              url.includes('.json') ||
              url.includes('json.php') ||
              url.includes('api.php/provide/vod') ||
              url.includes('provide/vod') ||
              url.includes('api.php') ||
              url.includes('maccms') ||
              url.includes('/api/') ||
              url.match(/\/provide.*vod/) ||
              url.match(/\/api.*vod/)
            ) {
              return 1;
            }

            // 默认为JSON类型（苹果CMS最常见）
            return 1;
          };

          let type =
            source.api && typeof source.api === 'string'
              ? detectApiType(source.api)
              : 1;

          // 解析 detail 字段：支持 JSON 扩展配置（CSP源、自定义jar等）
          const detail = (source.detail || '').trim();
          const siteExt = ''; // 🔑 强制为空，忽略配置中的 ext
          let siteJar: string | undefined;

          if (detail) {
            try {
              const obj = JSON.parse(detail);
              if (obj) {
                if (obj.type !== undefined) {
                  type = obj.type;
                }
                if (obj.api) {
                  source.api = obj.api;
                }
                // 🔑 关键修复：强制忽略 ext 字段
                // 原因：很多源的 ext 是网站首页 URL（如 http://caiji.dyttzyapi.com）
                // Box-main 会访问这个 URL 并把返回的 HTML 当作 extend 参数传给 API，导致无数据
                // if (obj.ext !== undefined) {
                //   siteExt = typeof obj.ext === 'string' ? obj.ext : JSON.stringify(obj.ext);
                // }
                if (obj.jar) {
                  siteJar = obj.jar;
                  if (!globalSpiderJar) {
                    globalSpiderJar = obj.jar;
                  }
                }
              }
            } catch {
              // 非 JSON 时也不作为 ext 字符串
              // siteExt = detail;
            }
          }

          // CSP 源检测：api 以 csp_ 开头强制为 type 3
          if (
            typeof source.api === 'string' &&
            source.api.toLowerCase().startsWith('csp_')
          ) {
            type = 3;
          }

          // 根据不同API类型设置优化配置（提升稳定性和切换体验）
          let siteHeader: Record<string, string> = {};
          let siteTimeout = 10000; // 默认10秒
          let siteRetry = 2; // 默认重试2次

          if (type === 0 || type === 1) {
            // 苹果CMS接口优化配置
            siteHeader = {
              'User-Agent': getMobileUserAgent(),
              Accept: 'application/json, text/plain, */*',
              'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
              'Cache-Control': 'no-cache',
              Connection: 'close', // 避免连接复用问题
            };
            siteTimeout = 10000; // 10秒超时
            siteRetry = 2; // 重试2次
          } else if (type === 3) {
            // CSP源优化配置
            siteHeader = {
              'User-Agent': TVBOX_USER_AGENTS.OKHTTP_3_15,
              Accept: '*/*',
              Connection: 'close',
            };
            siteTimeout = 15000; // CSP源通常更稳定，设置更长超时
            siteRetry = 1; // 重试1次
          }

          // 使用缓存获取源站分类（提高性能）
          const categories = await categoriesLimiter.run(async () =>
            getCachedCategories(source.api, source.name, currentUser),
          );

          return {
            key: source.key || source.name,
            name: source.name,
            type: type, // 使用智能判断的type
            api: source.api,
            searchable: 1, // 可搜索
            quickSearch: 1, // 支持快速搜索
            filterable: 1, // 支持分类筛选
            changeable: 1, // 允许换源
            ext: siteExt || '', // 确保始终是字符串（即使是空的）
            ...(siteJar && { jar: siteJar }), // 站点级 jar 包
            playerUrl: '', // 站点解析URL
            hide: 0, // 是否隐藏源站 (1: 隐藏, 0: 显示)
            categories: categories, // 使用动态获取的分类
            header: siteHeader, // 优化的请求头
            timeout: siteTimeout, // 超时时间
            retry: siteRetry, // 重试次数
          };
        }),
      ),

      // 解析源配置（添加一些常用的解析源）
      parses: [
        {
          name: 'Json并发',
          type: 2,
          url: 'Parallel',
        },
        {
          name: 'Json轮询',
          type: 2,
          url: 'Sequence',
        },
        {
          name: 'LunaTV内置解析',
          type: 1,
          url: `${baseUrl}/api/parse?url=`,
          ext: {
            flag: [
              'qiyi',
              'qq',
              'letv',
              'sohu',
              'youku',
              'mgtv',
              'bilibili',
              'wasu',
              'xigua',
              '1905',
            ],
          },
        },
      ],

      // 播放标识
      flags: [
        'youku',
        'qq',
        'iqiyi',
        'qiyi',
        'letv',
        'sohu',
        'tudou',
        'pptv',
        'mgtv',
        'wasu',
        'bilibili',
        'le',
        'duoduozy',
        'renrenmi',
        'xigua',
        '优酷',
        '腾讯',
        '爱奇艺',
        '奇艺',
        '乐视',
        '搜狐',
        '土豆',
        'PPTV',
        '芒果',
        '华数',
        '哔哩',
        '1905',
      ],

      // IJK播放器优化配置（软解码 + 硬解码）
      ijk: [
        {
          group: '软解码',
          options: [
            { category: 4, name: 'opensles', value: '0' },
            { category: 4, name: 'overlay-format', value: '842225234' },
            { category: 4, name: 'framedrop', value: '1' },
            { category: 4, name: 'start-on-prepared', value: '1' },
            { category: 1, name: 'http-detect-range-support', value: '0' },
            { category: 1, name: 'fflags', value: 'fastseek' },
            { category: 4, name: 'reconnect', value: '1' },
            { category: 4, name: 'enable-accurate-seek', value: '0' },
            { category: 4, name: 'mediacodec', value: '0' },
            { category: 4, name: 'mediacodec-auto-rotate', value: '0' },
            {
              category: 4,
              name: 'mediacodec-handle-resolution-change',
              value: '0',
            },
            { category: 2, name: 'skip_loop_filter', value: '48' },
            { category: 4, name: 'packet-buffering', value: '0' },
            { category: 1, name: 'analyzeduration', value: '2000000' },
            { category: 1, name: 'probesize', value: '10485760' },
            { category: 1, name: 'flush_packets', value: '1' },
          ],
        },
        {
          group: '硬解码',
          options: [
            { category: 4, name: 'opensles', value: '0' },
            { category: 4, name: 'overlay-format', value: '842225234' },
            { category: 4, name: 'framedrop', value: '1' },
            { category: 4, name: 'start-on-prepared', value: '1' },
            { category: 1, name: 'http-detect-range-support', value: '0' },
            { category: 1, name: 'fflags', value: 'fastseek' },
            { category: 4, name: 'reconnect', value: '1' },
            { category: 4, name: 'enable-accurate-seek', value: '0' },
            { category: 4, name: 'mediacodec', value: '1' },
            { category: 4, name: 'mediacodec-auto-rotate', value: '1' },
            {
              category: 4,
              name: 'mediacodec-handle-resolution-change',
              value: '1',
            },
            { category: 2, name: 'skip_loop_filter', value: '48' },
            { category: 4, name: 'packet-buffering', value: '0' },
            { category: 1, name: 'analyzeduration', value: '2000000' },
            { category: 1, name: 'probesize', value: '10485760' },
          ],
        },
      ],

      // 直播源（合并所有启用的直播源为一个，解决TVBox多源限制）
      lives: (() => {
        const enabledLives = (config.LiveConfig || []).filter(
          (live: { disabled?: boolean }) => !live.disabled,
        );
        if (enabledLives.length === 0) {
          return [];
        }

        // 如果只有一个源，直接返回
        if (enabledLives.length === 1) {
          return enabledLives.map(
            (live: { name: string; url: string; epg?: string }) => ({
              name: live.name,
              type: 0,
              url: live.url,
              epg: live.epg || '',
              logo: '',
            }),
          );
        }

        // 多个源时，创建一个聚合源
        return [
          {
            name: 'LunaTV聚合直播',
            type: 0,
            url: `${baseUrl}/api/live/merged`, // 新的聚合端点
            epg:
              enabledLives.find((live: { epg?: string }) => live.epg)?.epg ||
              '',
            logo: '',
          },
        ];
      })(),

      // 广告过滤规则
      ads: [
        'mimg.0c1q0l.cn',
        'www.googletagmanager.com',
        'www.google-analytics.com',
        'mc.usihnbcq.cn',
        'mg.g1mm3d.cn',
        'mscs.svaeuzh.cn',
        'cnzz.hhurm.com',
        'tp.vinuxhome.com',
        'cnzz.mmstat.com',
        'www.baihuillq.com',
        's23.cnzz.com',
        'z3.cnzz.com',
        'c.cnzz.com',
        'stj.v1vo.top',
        'z12.cnzz.com',
        'img.mosflower.cn',
        'tips.gamevvip.com',
        'ehwe.yhdtns.com',
        'xdn.cqqc3.com',
        'www.jixunkyy.cn',
        'sp.chemacid.cn',
        'hm.baidu.com',
        's9.cnzz.com',
        'z6.cnzz.com',
        'um.cavuc.com',
        'mav.mavuz.com',
        'wofwk.aoidf3.com',
        'z5.cnzz.com',
        'xc.hubeijieshikj.cn',
        'tj.tianwenhu.com',
        'xg.gars57.cn',
        'k.jinxiuzhilv.com',
        'cdn.bootcss.com',
        'ppl.xunzhuo123.com',
        'xomk.jiangjunmh.top',
        'img.xunzhuo123.com',
        'z1.cnzz.com',
        's13.cnzz.com',
        'xg.huataisangao.cn',
        'z7.cnzz.com',
        'z2.cnzz.com',
        's96.cnzz.com',
        'q11.cnzz.com',
        'thy.dacedsfa.cn',
        'xg.whsbpw.cn',
        's19.cnzz.com',
        'z8.cnzz.com',
        's4.cnzz.com',
        'f5w.as12df.top',
        'ae01.alicdn.com',
        'www.92424.cn',
        'k.wudejia.com',
        'vivovip.mmszxc.top',
        'qiu.xixiqiu.com',
        'cdnjs.hnfenxun.com',
        'cms.qdwght.com',
      ],

      // DoH (DNS over HTTPS) 配置 - 解决 DNS 污染问题
      doh: [
        {
          name: '阿里DNS',
          url: 'https://dns.alidns.com/dns-query',
          ips: ['223.5.5.5', '223.6.6.6'],
        },
        {
          name: '腾讯DNS',
          url: 'https://doh.pub/dns-query',
          ips: ['119.29.29.29', '119.28.28.28'],
        },
        {
          name: 'Google DNS',
          url: 'https://dns.google/dns-query',
          ips: ['8.8.8.8', '8.8.4.4'],
        },
      ],
    };

    // 使用新的 Spider Jar 管理逻辑（下载真实 jar + 缓存）
    const jarInfo = await getSpiderJar(forceSpiderRefresh);

    // 🔑 最终策略：优先使用远程公网 jar，失败时使用本地代理
    let finalSpiderUrl: string;

    if (jarInfo.success && jarInfo.source !== 'fallback') {
      // 成功获取远程 jar，直接使用远程 URL（公网地址，减轻服务器负载）
      finalSpiderUrl = `${jarInfo.source};md5;${jarInfo.md5}`;
      logger.log(`[Spider] 使用远程公网 jar: ${jarInfo.source}`);
    } else {
      // 远程失败，使用本地代理端点（确保100%可用）
      finalSpiderUrl = `${baseUrl}/api/proxy/spider.jar;md5;${jarInfo.md5}`;
      logger.warn(
        `[Spider] 远程 jar 获取失败，使用本地代理: ${
          finalSpiderUrl.split(';')[0]
        }`,
      );
    }

    // 如果用户源配置中有自定义jar，优先使用（但必须是公网地址）
    if (globalSpiderJar) {
      try {
        const jarUrl = new URL(globalSpiderJar.split(';')[0]);
        if (!isPrivateHost(jarUrl.hostname)) {
          // 用户自定义的公网 jar，直接使用
          finalSpiderUrl = globalSpiderJar;
          logger.log(`[Spider] 使用用户自定义 jar: ${globalSpiderJar}`);
        } else {
          logger.warn('[Spider] 用户配置的jar是私网地址，使用自动选择结果');
        }
      } catch {
        // URL解析失败，使用自动选择结果
        logger.warn('[Spider] 用户配置的jar URL解析失败，使用自动选择结果');
        logger.warn('[Spider] 用户配置的jar解析失败，使用自动选择结果');
      }
    }

    // 设置 spider 字段和状态透明化字段
    tvboxConfig.spider = finalSpiderUrl;
    tvboxConfig.spider_url = jarInfo.source; // 真实来源（用于诊断）
    tvboxConfig.spider_md5 = jarInfo.md5;
    tvboxConfig.spider_cached = jarInfo.cached;
    tvboxConfig.spider_real_size = jarInfo.size;
    tvboxConfig.spider_tried = jarInfo.tried;
    tvboxConfig.spider_success = jarInfo.success;

    // 安全/最小模式：仅返回必要字段，提高兼容性
    if (mode === 'safe' || mode === 'min') {
      tvboxConfig = {
        spider: tvboxConfig.spider,
        sites: tvboxConfig.sites,
        lives: tvboxConfig.lives,
        parses: [
          { name: '默认解析', type: 0, url: `${baseUrl}/api/parse?url=` },
        ],
      } as TVBoxConfig;
    } else if (mode === 'fast' || mode === 'optimize') {
      // 快速切换优化模式：专门针对资源源切换体验优化
      tvboxConfig = {
        spider: tvboxConfig.spider,
        sites: tvboxConfig.sites.map((site: TVBoxSource) => {
          const fastSite = { ...site };
          // 快速模式：移除可能导致卡顿的配置
          delete fastSite.timeout;
          delete fastSite.retry;

          // 优化请求头，提升响应速度
          if (fastSite.type === 3) {
            fastSite.header = { 'User-Agent': TVBOX_USER_AGENTS.OKHTTP_3_15 };
          } else {
            fastSite.header = {
              'User-Agent': getMobileUserAgent(),
              Connection: 'close',
            };
          }

          // 强制启用快速切换相关功能
          fastSite.searchable = 1;
          fastSite.quickSearch = 1;
          fastSite.filterable = 1;
          fastSite.changeable = 1;

          return fastSite;
        }),
        lives: tvboxConfig.lives,
        parses: [
          {
            name: '极速解析',
            type: 0,
            url: 'https://jx.xmflv.com/?url=',
            ext: { flag: ['all'] },
          },
          { name: 'Json并发', type: 2, url: 'Parallel' },
        ],
        flags: ['youku', 'qq', 'iqiyi', 'qiyi', 'letv', 'sohu', 'mgtv'],
        wallpaper: '', // 移除壁纸加快加载
        maxHomeVideoContent: '15', // 减少首页内容，提升加载速度
      } as TVBoxConfig;
    } else if (mode === 'yingshicang') {
      // 影视仓专用模式：优化兼容性和播放规则
      // 保存诊断字段
      const spiderDiagnostics = {
        spider_url: tvboxConfig.spider_url,
        spider_md5: tvboxConfig.spider_md5,
        spider_cached: tvboxConfig.spider_cached,
        spider_real_size: tvboxConfig.spider_real_size,
        spider_tried: tvboxConfig.spider_tried,
        spider_success: tvboxConfig.spider_success,
      };

      tvboxConfig = {
        spider: finalSpiderUrl, // 使用智能获取的 spider jar
        ...spiderDiagnostics, // 保留诊断字段
        wallpaper: 'https://picsum.photos/1920/1080/?blur=1',
        sites: tvboxConfig.sites,
        lives: tvboxConfig.lives,
        parses: [
          { name: '线路一', type: 0, url: 'https://jx.xmflv.com/?url=' },
          { name: '线路二', type: 0, url: 'https://www.yemu.xyz/?url=' },
          { name: '线路三', type: 0, url: 'https://jx.aidouer.net/?url=' },
          { name: '线路四', type: 0, url: 'https://www.8090g.cn/?url=' },
        ],
        flags: [
          'youku',
          'qq',
          'iqiyi',
          'qiyi',
          'letv',
          'sohu',
          'tudou',
          'pptv',
          'mgtv',
          'wasu',
          'bilibili',
          'renrenmi',
        ],
        // 影视仓专用播放规则
        rules: [
          {
            name: '量子资源',
            hosts: ['vip.lz', 'hd.lz', 'v.cdnlz.com'],
            regex: [
              '#EXT-X-DISCONTINUITY\\r?\\n\\#EXTINF:6.433333,[\\s\\S]*?#EXT-X-DISCONTINUITY',
              '#EXTINF.*?\\s+.*?1o.*?\\.ts\\s+',
            ],
          },
          {
            name: '非凡资源',
            hosts: ['vip.ffzy', 'hd.ffzy', 'v.ffzyapi.com'],
            regex: [
              '#EXT-X-DISCONTINUITY\\r?\\n\\#EXTINF:6.666667,[\\s\\S]*?#EXT-X-DISCONTINUITY',
              '#EXTINF.*?\\s+.*?1o.*?\\.ts\\s+',
            ],
          },
        ],
        maxHomeVideoContent: '20',
      };
    }

    // 添加 Spider 状态透明化字段（帮助诊断）
    tvboxConfig.spider_backup = `${baseUrl}/api/proxy/spider.jar`; // 本地代理地址
    tvboxConfig.spider_candidates = getCandidates();

    // 根据format参数返回不同格式
    if (format === 'base64' || format === 'txt') {
      // 返回base64编码的配置（TVBox常用格式）
      const configStr = JSON.stringify(tvboxConfig, null, 2);
      const base64Config = Buffer.from(configStr).toString('base64');

      return new NextResponse(base64Config, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    } else {
      // 返回JSON格式（使用 text/plain 提高 TVBox 分支兼容性）
      return new NextResponse(JSON.stringify(tvboxConfig), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: 'TVBox配置生成失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// 支持CORS预检请求
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
