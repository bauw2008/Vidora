/**
 * 统一的User-Agent管理模块
 *
 * 功能：
 * 1. 提供最新的浏览器User-Agent（Chrome 143, Edge 144, Firefox 146, Safari 26）
 * 2. 随机User-Agent选择，支持防爬虫
 * 3. Sec-CH-UA客户端提示头部生成
 * 4. 特殊应用User-Agent常量（TVBox, AptvPlayer, LunaTV等）
 * 5. 豆瓣API专用随机User-Agent功能
 */

// ============================================================================
// 1. 最新浏览器User-Agent池（2026年1月最新版本）
// ============================================================================

/**
 * 桌面端Chrome User-Agent（Windows, macOS, Linux）
 */
export const CHROME_USER_AGENTS = [
  // Windows Chrome 143
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  // macOS Chrome 143
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  // Linux Chrome 143
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
] as const;

/**
 * 桌面端Firefox User-Agent（Windows, macOS）
 */
export const FIREFOX_USER_AGENTS = [
  // Windows Firefox 146
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0',
  // macOS Firefox 146
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0',
] as const;

/**
 * 桌面端Safari User-Agent（macOS）
 */
export const SAFARI_USER_AGENTS = [
  // macOS Safari 26
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
] as const;

/**
 * 桌面端Edge User-Agent（Windows）
 */
export const EDGE_USER_AGENTS = [
  // Windows Edge 144
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/144.0.0.0',
] as const;

/**
 * 移动端User-Agent（iOS, Android）
 */
export const MOBILE_USER_AGENTS = [
  // iOS Safari 26
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  // Android Chrome 143
  'Mozilla/5.0 (Linux; Android 14; SM-S928U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36',
] as const;

/**
 * 所有桌面端浏览器的User-Agent池
 */
export const DESKTOP_USER_AGENTS = [
  ...CHROME_USER_AGENTS,
  ...FIREFOX_USER_AGENTS,
  ...SAFARI_USER_AGENTS,
  ...EDGE_USER_AGENTS,
] as const;

/**
 * 所有User-Agent池（桌面端 + 移动端）
 */
export const ALL_USER_AGENTS = [
  ...DESKTOP_USER_AGENTS,
  ...MOBILE_USER_AGENTS,
] as const;

// ============================================================================
// 2. 特殊应用User-Agent常量
// ============================================================================

/**
 * TVBox相关User-Agent（用于TVBox API白名单）
 */
export const TVBOX_USER_AGENTS = {
  // TVBox官方客户端
  TVBOX_OFFICIAL: 'TVBox/1.0.0',
  // TVBox okhttp客户端（常用）
  OKHTTP_3_15: 'okhttp/3.15',
  // TVBox Mod客户端
  OKHTTP_MOD_1_4_0_0: 'okHttp/Mod-1.4.0.0',
  // 通用OKHTTP客户端
  OKHTTP_GENERIC: 'OKHTTP',
} as const;

/**
 * 直播播放器User-Agent
 */
export const LIVE_PLAYER_USER_AGENTS = {
  // AptvPlayer直播播放器
  APTV_PLAYER: 'AptvPlayer/1.4.10',
} as const;

/**
 * 其他应用User-Agent
 */
export const OTHER_USER_AGENTS = {
  // LunaTV客户端（用于网盘搜索）
  LUNA_TV: 'LunaTV/1.0',
  // LunaTV健康检查
  LUNA_TV_HEALTH: 'LunaTV-HealthCheck/1.0',
  // LunaTV JAR测试
  LUNA_TV_JAR_TEST: 'LunaTV-JarTest/1.0',
} as const;

/**
 * 所有特殊应用User-Agent的数组（用于TVBox白名单检查等）
 */
export const SPECIAL_USER_AGENTS = Object.values({
  ...TVBOX_USER_AGENTS,
  ...LIVE_PLAYER_USER_AGENTS,
  ...OTHER_USER_AGENTS,
}) as string[];

// ============================================================================
// 3. User-Agent管理函数
// ============================================================================

/**
 * 获取随机User-Agent
 * @param options 配置选项
 * @returns 随机User-Agent字符串
 */
export function getRandomUserAgent(options?: {
  /** 浏览器类型限制：'chrome' | 'firefox' | 'safari' | 'edge' | 'mobile' | 'desktop' | 'all' */
  browserType?:
    | 'chrome'
    | 'firefox'
    | 'safari'
    | 'edge'
    | 'mobile'
    | 'desktop'
    | 'all';
  /** 是否包含移动端（默认：false） */
  includeMobile?: boolean;
  /** 平台限制：'windows' | 'macos' | 'linux' | 'ios' | 'android' */
  platform?: 'windows' | 'macos' | 'linux' | 'ios' | 'android';
}): string {
  const {
    browserType = 'all',
    includeMobile = false,
    platform,
  } = options || {};

  let pool: readonly string[] = [];

  // 根据浏览器类型选择池
  switch (browserType) {
    case 'chrome':
      pool = CHROME_USER_AGENTS;
      break;
    case 'firefox':
      pool = FIREFOX_USER_AGENTS;
      break;
    case 'safari':
      pool = SAFARI_USER_AGENTS;
      break;
    case 'edge':
      pool = EDGE_USER_AGENTS;
      break;
    case 'mobile':
      pool = MOBILE_USER_AGENTS;
      break;
    case 'desktop':
      pool = DESKTOP_USER_AGENTS;
      break;
    case 'all':
    default:
      pool = includeMobile ? ALL_USER_AGENTS : DESKTOP_USER_AGENTS;
      break;
  }

  // 根据平台过滤
  let filteredPool = pool;
  if (platform) {
    filteredPool = pool.filter((ua) => {
      const uaLower = ua.toLowerCase();
      switch (platform) {
        case 'windows':
          return uaLower.includes('windows');
        case 'macos':
          return uaLower.includes('macintosh');
        case 'linux':
          return uaLower.includes('linux') && !uaLower.includes('android');
        case 'ios':
          return uaLower.includes('iphone') || uaLower.includes('ipad');
        case 'android':
          return uaLower.includes('android');
        default:
          return true;
      }
    });
  }

  // 如果过滤后池为空，回退到原始池
  if (filteredPool.length === 0) {
    filteredPool = pool;
  }

  // 随机选择
  const index = Math.floor(Math.random() * filteredPool.length);
  return filteredPool[index];
}

/**
 * 获取随机User-Agent及其详细信息
 * @param options 配置选项
 * @returns 包含UA、浏览器类型、平台信息的对象
 */
export function getRandomUserAgentWithInfo(options?: {
  browserType?:
    | 'chrome'
    | 'firefox'
    | 'safari'
    | 'edge'
    | 'mobile'
    | 'desktop'
    | 'all';
  includeMobile?: boolean;
  platform?: 'windows' | 'macos' | 'linux' | 'ios' | 'android';
}): {
  ua: string;
  browser: 'chrome' | 'firefox' | 'safari' | 'edge' | 'other';
  platform: 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'other';
} {
  const ua = getRandomUserAgent(options);

  // 识别浏览器类型
  let browser: 'chrome' | 'firefox' | 'safari' | 'edge' | 'other' = 'other';
  const uaLower = ua.toLowerCase();

  if (uaLower.includes('firefox') && uaLower.includes('gecko')) {
    browser = 'firefox';
  } else if (uaLower.includes('safari') && !uaLower.includes('chrome')) {
    browser = 'safari';
  } else if (uaLower.includes('edg/')) {
    browser = 'edge';
  } else if (uaLower.includes('chrome')) {
    browser = 'chrome';
  }

  // 识别平台
  let platform: 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'other' =
    'other';

  if (uaLower.includes('windows')) {
    platform = 'windows';
  } else if (uaLower.includes('macintosh')) {
    platform = 'macos';
  } else if (uaLower.includes('linux') && !uaLower.includes('android')) {
    platform = 'linux';
  } else if (uaLower.includes('iphone') || uaLower.includes('ipad')) {
    platform = 'ios';
  } else if (uaLower.includes('android')) {
    platform = 'android';
  }

  return { ua, browser, platform };
}

/**
 * 获取豆瓣API专用随机User-Agent（防爬虫优化）
 * @returns 随机User-Agent字符串
 */
export function getDoubanRandomUserAgent(): string {
  // 豆瓣API需要更频繁地更换User-Agent以避免反爬虫
  // 使用所有桌面端浏览器，不包含移动端（豆瓣对移动端限制更严）
  return getRandomUserAgent({
    browserType: 'desktop',
    includeMobile: false,
  });
}

/**
 * 获取默认桌面User-Agent（用于一般API请求）
 * @returns 默认User-Agent字符串
 */
export function getDefaultUserAgent(): string {
  // 默认使用Windows Chrome 143
  return CHROME_USER_AGENTS[0];
}

/**
 * 获取移动端User-Agent
 * @returns 移动端User-Agent字符串
 */
export function getMobileUserAgent(): string {
  // 默认使用Android Chrome 143
  return MOBILE_USER_AGENTS[1];
}

// ============================================================================
// 4. Sec-CH-UA客户端提示头部生成
// ============================================================================

/**
 * 生成Sec-CH-UA客户端提示头部
 * @param browser 浏览器类型
 * @param platform 平台类型
 * @returns Sec-CH-UA头部对象
 */
export function getSecChUaHeaders(
  browser: 'chrome' | 'firefox' | 'safari' | 'edge' | 'other',
  platform: 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'other',
): Record<string, string> {
  // 只有Chrome和Edge支持Sec-CH-UA
  if (browser === 'chrome') {
    return {
      'Sec-CH-UA':
        '"Google Chrome";v="143", "Chromium";v="143", "Not?A_Brand";v="24"',
      'Sec-CH-UA-Mobile': '?0',
      'Sec-CH-UA-Platform': `"${platform === 'macos' ? 'macOS' : platform === 'ios' ? 'iOS' : platform}"`,
    };
  } else if (browser === 'edge') {
    return {
      'Sec-CH-UA':
        '"Microsoft Edge";v="144", "Chromium";v="143", "Not?A_Brand";v="24"',
      'Sec-CH-UA-Mobile': '?0',
      'Sec-CH-UA-Platform': `"${platform === 'macos' ? 'macOS' : platform === 'ios' ? 'iOS' : platform}"`,
    };
  }

  // Firefox和Safari不发送Sec-CH-UA
  return {};
}

/**
 * 为随机User-Agent生成完整的头部信息
 * @param options User-Agent选项
 * @returns 包含User-Agent和Sec-CH-UA的头部对象
 */
export function getHeadersWithUserAgent(options?: {
  browserType?:
    | 'chrome'
    | 'firefox'
    | 'safari'
    | 'edge'
    | 'mobile'
    | 'desktop'
    | 'all';
  includeMobile?: boolean;
  platform?: 'windows' | 'macos' | 'linux' | 'ios' | 'android';
  includeSecChUa?: boolean;
}): Record<string, string> {
  const { includeSecChUa = true, ...uaOptions } = options || {};

  const { ua, browser, platform } = getRandomUserAgentWithInfo(uaOptions);

  const headers: Record<string, string> = {
    'User-Agent': ua,
  };

  if (includeSecChUa) {
    const secChHeaders = getSecChUaHeaders(browser, platform);
    Object.assign(headers, secChHeaders);
  }

  return headers;
}

/**
 * 为豆瓣API生成完整的头部信息（防爬虫优化）
 * @returns 豆瓣API专用头部对象
 */
export function getDoubanHeaders(): Record<string, string> {
  const ua = getDoubanRandomUserAgent();

  // 豆瓣需要更多的头部以避免反爬虫
  return {
    'User-Agent': ua,
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    DNT: '1',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
    // 随机添加Referer
    ...(Math.random() > 0.5 ? { Referer: 'https://www.douban.com/' } : {}),
    // 随机添加Origin
    ...(Math.random() > 0.8 ? { Origin: 'https://movie.douban.com' } : {}),
  };
}

// ============================================================================
// 5. 工具函数
// ============================================================================

/**
 * 检查User-Agent是否为TVBox客户端
 * @param userAgent User-Agent字符串
 * @returns 是否为TVBox客户端
 */
export function isTVBoxUserAgent(userAgent: string): boolean {
  const uaLower = userAgent.toLowerCase();
  return (
    uaLower.includes('tvbox') ||
    uaLower.includes('okhttp') ||
    SPECIAL_USER_AGENTS.some((specialUA) =>
      uaLower.includes(specialUA.toLowerCase()),
    )
  );
}

/**
 * 检查User-Agent是否为AptvPlayer客户端
 * @param userAgent User-Agent字符串
 * @returns 是否为AptvPlayer客户端
 */
export function isAptvPlayerUserAgent(userAgent: string): boolean {
  const uaLower = userAgent.toLowerCase();
  return uaLower.includes('aptvplayer');
}

/**
 * 获取User-Agent的简短描述
 * @param userAgent User-Agent字符串
 * @returns 简短描述
 */
export function getUserAgentDescription(userAgent: string): string {
  const uaLower = userAgent.toLowerCase();

  if (uaLower.includes('tvbox')) return 'TVBox客户端';
  if (uaLower.includes('okhttp')) return 'OKHTTP客户端';
  if (uaLower.includes('aptvplayer')) return 'AptvPlayer直播播放器';
  if (uaLower.includes('lunatv')) return 'LunaTV客户端';
  if (uaLower.includes('chrome')) return 'Chrome浏览器';
  if (uaLower.includes('firefox')) return 'Firefox浏览器';
  if (uaLower.includes('safari')) return 'Safari浏览器';
  if (uaLower.includes('edge')) return 'Edge浏览器';

  return '其他客户端';
}

const userAgentModule = {
  // 常量导出
  CHROME_USER_AGENTS,
  FIREFOX_USER_AGENTS,
  SAFARI_USER_AGENTS,
  EDGE_USER_AGENTS,
  MOBILE_USER_AGENTS,
  DESKTOP_USER_AGENTS,
  ALL_USER_AGENTS,
  TVBOX_USER_AGENTS,
  LIVE_PLAYER_USER_AGENTS,
  OTHER_USER_AGENTS,
  SPECIAL_USER_AGENTS,

  // 函数导出
  getRandomUserAgent,
  getRandomUserAgentWithInfo,
  getDoubanRandomUserAgent,
  getDefaultUserAgent,
  getMobileUserAgent,
  getSecChUaHeaders,
  getHeadersWithUserAgent,
  getDoubanHeaders,

  // 工具函数
  isTVBoxUserAgent,
  isAptvPlayerUserAgent,
  getUserAgentDescription,
};

export default userAgentModule;
