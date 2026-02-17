/* @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getRandomUserAgent } from '@/lib/user-agent';

import { GET as getTVBoxConfig } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ConfigDiagnosisResult {
  ok: boolean;
  status: number;
  contentType: string;
  size: number;
  baseUrl: string;
  configUrl: string;
  receivedToken: string;
  hasJson: boolean;
  issues: string[];
  json?: unknown;
  parseError?: string;
  spider_url?: string;
  spider_md5?: string;
  spider_cached?: boolean;
  spider_real_size?: number;
  spider_tried?: boolean;
  spider_success?: boolean;
  spiderReachable?: boolean;
  spiderStatus?: number | string;
  spiderContentLength?: string;
  spiderLastModified?: string;
  spiderSizeKB?: number;
  sitesCount?: number;
  livesCount?: number;
  spider?: string;
  spiderPrivate?: boolean;
  privateApis?: number;
  issuesCount?: number;
  parsesCount?: number;
  spider_backup?: string;
  spider_candidates?: string[];
  pass?: boolean;
}

function getBaseUrl(req: NextRequest): string {
  const envBase = (process.env.SITE_BASE || '').trim().replace(/\/$/, '');
  if (envBase) {
    return envBase;
  }
  const proto = (req.headers.get('x-forwarded-proto') || 'https')
    .split(',')[0]
    .trim();
  const host = (
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    ''
  )
    .split(',')[0]
    .trim();
  if (!host) {
    return '';
  }
  return `${proto}://${host}`;
}

function isPrivateHost(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const h = u.hostname;
    return (
      h === 'localhost' ||
      h === '0.0.0.0' ||
      h === '127.0.0.1' ||
      h.startsWith('10.') ||
      h.startsWith('172.16.') ||
      h.startsWith('172.17.') ||
      h.startsWith('172.18.') ||
      h.startsWith('172.19.') ||
      h.startsWith('172.2') || // 172.20-172.31 简化判断
      h.startsWith('192.168.')
    );
  } catch {
    return false;
  }
}

// 调用 health 端点检查 spider jar 健康状态
async function checkSpiderHealth(spider: string): Promise<{
  accessible: boolean;
  status?: number;
  contentLength?: string;
  lastModified?: string;
  error?: string;
}> {
  try {
    const cleanUrl = spider.split(';')[0];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(cleanUrl, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': getRandomUserAgent(),
      },
    });

    clearTimeout(timeoutId);

    return {
      accessible: response.ok,
      status: response.status,
      contentLength: response.headers.get('content-length') || undefined,
      lastModified: response.headers.get('last-modified') || undefined,
    };
  } catch (error) {
    return {
      accessible: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function GET(req: NextRequest) {
  try {
    const baseUrl = getBaseUrl(req);
    if (!baseUrl) {
      return NextResponse.json(
        { ok: false, error: 'cannot determine base url' },
        { status: 500 },
      );
    }

    // 从请求中获取 token 参数并传递给 tvbox API
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    logger.log(
      '[Diagnose] Backend - Received token:',
      token ? '***' + token.slice(-4) : 'none',
    );
    logger.log('[Diagnose] Backend - Request URL:', req.url);

    // 直接调用 tvbox API 函数，而不是通过 HTTP fetch
    // 构建模拟请求对象
    let configUrl = `${baseUrl}/api/tvbox?format=json`;
    if (token) {
      configUrl += `&token=${encodeURIComponent(token)}`;
    }

    logger.log(
      '[Diagnose] Backend - Direct calling tvbox GET with URL:',
      configUrl,
    );

    // 创建模拟请求
    const mockRequest = new NextRequest(configUrl, {
      headers: req.headers,
    });

    const cfgRes = await getTVBoxConfig(mockRequest);
    const contentType = cfgRes.headers.get('content-type') || '';
    const text = await cfgRes.text();
    let parsed: Record<string, unknown> | null = null;
    let parseError: string | undefined;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch (e: unknown) {
      parseError = (e as Error)?.message || 'json parse error';
    }

    const result: ConfigDiagnosisResult = {
      ok: cfgRes.ok,
      status: cfgRes.status,
      contentType,
      size: text.length,
      baseUrl,
      configUrl,
      receivedToken: token ? '***' + token.slice(-4) : 'none', // 显示 token 的后4位用于调试
      hasJson: !!parsed,
      issues: [] as string[],
    };

    if (!cfgRes.ok) {
      result.issues.push(`config request failed: ${cfgRes.status}`);
    }
    if (!contentType.includes('text/plain')) {
      result.issues.push('content-type is not text/plain');
    }
    if (!parsed) {
      result.issues.push(`json parse failed: ${parseError}`);
    }

    if (parsed) {
      const sites = Array.isArray(parsed.sites) ? parsed.sites : [];
      const lives = Array.isArray(parsed.lives) ? parsed.lives : [];
      const spider = parsed.spider || '';
      result.sitesCount = sites.length;
      result.livesCount = lives.length;
      result.parsesCount = Array.isArray(parsed.parses)
        ? parsed.parses.length
        : 0;

      // 传递 Spider 状态透明化字段
      if (parsed.spider_url) {
        result.spider_url = parsed.spider_url as string;
      }
      if (parsed.spider_md5) {
        result.spider_md5 = parsed.spider_md5 as string;
      }
      if (parsed.spider_cached !== undefined) {
        result.spider_cached = parsed.spider_cached as boolean;
      }
      if (parsed.spider_real_size !== undefined) {
        result.spider_real_size = parsed.spider_real_size as number;
      }
      if (parsed.spider_tried !== undefined) {
        result.spider_tried = parsed.spider_tried as boolean;
      }
      if (parsed.spider_success !== undefined) {
        result.spider_success = parsed.spider_success as boolean;
      }
      if (parsed.spider_backup) {
        result.spider_backup = parsed.spider_backup as string;
      }
      if (parsed.spider_candidates) {
        result.spider_candidates = parsed.spider_candidates as string[];
      }

      // 检查私网地址
      const privateApis = sites.filter(
        (s: { api?: string }) =>
          typeof s?.api === 'string' && isPrivateHost(s.api),
      ).length;
      result.privateApis = privateApis;
      if (privateApis > 0) {
        result.issues.push(`found ${privateApis} private api urls`);
      }
      if (typeof spider === 'string' && spider) {
        result.spider = spider;
        result.spiderPrivate = isPrivateHost(spider);
        if (result.spiderPrivate) {
          result.issues.push('spider url is private/not public');
        } else if (
          spider.startsWith('http://') ||
          spider.startsWith('https://')
        ) {
          // 使用增强的健康检查
          const healthCheck = await checkSpiderHealth(spider);
          result.spiderReachable = healthCheck.accessible;
          result.spiderStatus = healthCheck.status;
          result.spiderContentLength = healthCheck.contentLength;
          result.spiderLastModified = healthCheck.lastModified;
          result.spiderSizeKB = healthCheck.contentLength
            ? Math.round(parseInt(healthCheck.contentLength) / 1024)
            : undefined;

          if (!healthCheck.accessible) {
            result.issues.push(
              `spider unreachable: ${healthCheck.status || healthCheck.error}`,
            );
          } else {
            // 验证文件大小（spider jar 通常大于 100KB）
            if (healthCheck.contentLength) {
              const sizeKB = parseInt(healthCheck.contentLength) / 1024;
              result.spiderSizeKB = Math.round(sizeKB);
              if (sizeKB < 50) {
                result.issues.push(
                  `spider jar size suspicious: ${result.spiderSizeKB}KB (expected >100KB)`,
                );
              }
            }
          }
        }
      }
    }

    result.issuesCount = result.issues.length;

    // 最终状态
    result.pass =
      result.ok &&
      result.hasJson &&
      (!result.issues || result.issues.length === 0);
    return NextResponse.json(result, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (e: unknown) {
    logger.error('Diagnose failed', e);
    return NextResponse.json(
      { ok: false, error: (e as Error)?.message || 'unknown error' },
      { status: 500 },
    );
  }
}
