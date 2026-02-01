/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';

// 信任网络配置缓存
let trustedNetworkCache: { enabled: boolean; trustedIPs: string[] } | null =
  null;
let trustedNetworkCacheTime = 0;
const CACHE_TTL = 86400000; // 24小时缓存

// 获取客户端IP
function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

// IP/CIDR匹配
function isIPInCIDR(clientIP: string, cidr: string): boolean {
  if (cidr === '*') return true;

  const isClientIPv6 = clientIP.includes(':');
  const isCIDRIPv6 = cidr.includes(':');
  if (isClientIPv6 !== isCIDRIPv6) return false;

  if (isCIDRIPv6) {
    if (cidr.includes('/')) {
      const [network] = cidr.split('/');
      return clientIP
        .toLowerCase()
        .startsWith(network.toLowerCase().replace(/:+$/, ''));
    }
    return clientIP.toLowerCase() === cidr.toLowerCase();
  }

  if (cidr.includes('/')) {
    const [network, maskStr] = cidr.split('/');
    const mask = parseInt(maskStr, 10);
    const networkParts = network.split('.').map(Number);
    const clientParts = clientIP.split('.').map(Number);

    if (clientParts.length !== 4 || networkParts.length !== 4) return false;

    const networkInt =
      (networkParts[0] << 24) |
      (networkParts[1] << 16) |
      (networkParts[2] << 8) |
      networkParts[3];
    const clientInt =
      (clientParts[0] << 24) |
      (clientParts[1] << 16) |
      (clientParts[2] << 8) |
      clientParts[3];
    const maskInt = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0;

    return (networkInt & maskInt) === (clientInt & maskInt);
  }

  return clientIP === cidr;
}

// 检查IP是否在信任网络
function isIPTrusted(clientIP: string, trustedIPs: string[]): boolean {
  return trustedIPs.some((ip) => isIPInCIDR(clientIP, ip.trim()));
}

// 生成信任网络自动登录cookie
function generateTrustedAuthCookie(): NextResponse {
  const response = NextResponse.next();
  const username = process.env.USERNAME || 'admin';

  const authInfo = {
    username,
    trustedNetwork: true,
    timestamp: Date.now(),
    loginTime: Date.now(),
    role: 'owner' as const,
  };

  response.cookies.set('auth', JSON.stringify(authInfo), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
  });

  return response;
}

// 获取信任网络配置
async function getTrustedNetworkConfig(
): Promise<{ enabled: boolean; trustedIPs: string[] } | null> {
  const now = Date.now();

  if (trustedNetworkCache && now - trustedNetworkCacheTime < CACHE_TTL) {
    return trustedNetworkCache.enabled ? trustedNetworkCache : null;
  }

  // 环境变量优先
  const envIPs = process.env.TRUSTED_NETWORK_IPS;
  if (envIPs) {
    trustedNetworkCache = {
      enabled: true,
      trustedIPs: envIPs
        .split(',')
        .map((ip) => ip.trim())
        .filter(Boolean),
    };
    trustedNetworkCacheTime = now;
    return trustedNetworkCache;
  }

  return null;
}

// 在线状态配置
const ONLINE_TIMEOUT = 30 * 60 * 1000; // 30分钟超时（毫秒）

// 不更新在线状态的 API 路径（自动调用的系统接口）
const EXCLUDE_ONLINE_UPDATE_PATHS = [
  '/api/cron', // 定时任务
  '/api/tvbox', // TVBox 设备自动调用
  '/api/live/merged', // 聚合直播源
];

// 判断是否应该排除在线状态更新
function shouldExcludeOnlineUpdate(pathname: string): boolean {
  return EXCLUDE_ONLINE_UPDATE_PATHS.some((path) => pathname.startsWith(path));
}

// 更新用户最后活动时间
async function updateLastActivity(username: string): Promise<void> {
  try {
    const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

    // 只有非 localstorage 模式才更新在线状态
    if (storageType === 'localstorage') {
      return;
    }

    // 使用统一的存储接口
    const { db } = await import('./lib/db');
    await db.updateLastActivity(username);
  } catch (error) {
    console.error('更新用户活动时间失败:', error);
    // 不影响主流程，静默失败
  }
}

// 检查用户是否在线
async function isUserOnline(username: string): Promise<boolean> {
  try {
    const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

    // localstorage 模式默认在线
    if (storageType === 'localstorage') {
      return true;
    }

    // 使用统一的存储接口
    const { db } = await import('./lib/db');
    const lastActivityTime = await db.getUserLastActivity(username);

    // 如果没有最后活动时间，视为在线（刚登录的用户）
    if (lastActivityTime === 0) {
      return true;
    }

    // 检查是否超时
    return Date.now() - lastActivityTime < ONLINE_TIMEOUT;
  } catch (error) {
    console.error('检查用户在线状态失败:', error);
    // 出错时默认在线，避免误判
    return true;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 跳过不需要认证的路径
  if (shouldSkipAuth(pathname)) {
    return NextResponse.next();
  }

  // 信任网络模式：检查IP是否在信任网络
  const trustedNetworkConfig = await getTrustedNetworkConfig();
  if (
    trustedNetworkConfig?.enabled &&
    trustedNetworkConfig.trustedIPs.length > 0
  ) {
    const clientIP = getClientIP(request);
    if (isIPTrusted(clientIP, trustedNetworkConfig.trustedIPs)) {
      console.log(`[TrustNetwork] Auto-login for IP: ${clientIP}`);
      const existingAuth = getAuthInfoFromCookie(request);
      if (
        existingAuth &&
        (existingAuth.trustedNetwork ||
          existingAuth.password ||
          existingAuth.signature)
      ) {
        return NextResponse.next();
      }
      return generateTrustedAuthCookie();
    }
  }

  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  if (!process.env.PASSWORD) {
  // 如果没有设置密码，重定向到警告页面
  const warningUrl = new URL('/warning', request.url);
  return NextResponse.redirect(warningUrl);
  }

  // 从cookie获取认证信息
  const authInfo = getAuthInfoFromCookie(request);

  if (!authInfo) {
    return handleAuthFailure(request, pathname);
  }

  // localstorage模式：在middleware中完成验证
  if (storageType === 'localstorage') {
    if (!authInfo.password || authInfo.password !== process.env.PASSWORD) {
      return handleAuthFailure(request, pathname);
    }
    return NextResponse.next();
  }

  // 其他模式：只验证签名
  // 检查是否有用户名（非localStorage模式下密码不存储在cookie中）
  if (!authInfo.username || !authInfo.signature) {
    return handleAuthFailure(request, pathname);
  }

  // 验证签名（如果存在）
  if (authInfo.signature) {
    const isValidSignature = await verifySignature(
      authInfo.username,
      authInfo.signature,
      process.env.PASSWORD || '',
    );

    if (isValidSignature) {
      // 检查用户是否在线
      const isOnline = await isUserOnline(authInfo.username);

      if (!isOnline) {
        console.log(`用户 ${authInfo.username} 已离线，需要重新登录`);
        return handleAuthFailure(request, pathname);
      }

      // 更新最后活动时间（排除自动调用的 API）
      if (!shouldExcludeOnlineUpdate(pathname)) {
        await updateLastActivity(authInfo.username);
      }

      return NextResponse.next();
    }
  }

  // 签名验证失败或不存在签名
  return handleAuthFailure(request, pathname);
}

// 验证签名
async function verifySignature(
  data: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(data);

    // 导入密钥
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    // 将十六进制字符串转换为Uint8Array
    const signatureBuffer = new Uint8Array(
      signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [],
    );

    // 验证签名
    return await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBuffer,
      messageData,
    );
  } catch {
    return false;
  }
}

// 处理认证失败的情况
function handleAuthFailure(
  request: NextRequest,
  pathname: string,
): NextResponse {
  // 如果是 API 路由，返回 401 状态码
  if (pathname.startsWith('/api')) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 否则重定向到登录页面
  const loginUrl = new URL('/login', request.url);
  // 保留完整的URL，包括查询参数
  const fullUrl = `${pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set('redirect', fullUrl);
  return NextResponse.redirect(loginUrl);
}

// 判断是否需要跳过认证的路径
function shouldSkipAuth(pathname: string): boolean {
  const skipPaths = [
    '/_next',
    '/favicon.ico',
    '/robots.txt',
    '/manifest.json',
    '/icons/',
    '/logo.png',
    '/screenshot.png',
  ];

  return skipPaths.some((path) => pathname.startsWith(path));
}

// 配置proxy匹配规则
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|register|warning|api/login|api/register|api/registration|api/logout|api/cron|api/server-config|api/tvbox|api/live/merged|api/parse).*)',
  ],
};
