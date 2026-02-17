import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

interface SiteConfig {
  CustomAdFilterCode?: string;
  CustomAdFilterVersion?: number;
}

interface Config {
  SiteConfig?: SiteConfig;
}

export const runtime = 'nodejs';

/**
 * 获取自定义去广告代码
 * GET /api/ad-filter
 */
export async function GET() {
  try {
    const config = (await getConfig()) as Config;
    const customAdFilterCode = config.SiteConfig?.CustomAdFilterCode || '';
    const customAdFilterVersion = config.SiteConfig?.CustomAdFilterVersion || 1;

    return NextResponse.json({
      code: customAdFilterCode,
      version: customAdFilterVersion,
    });
  } catch {
    return NextResponse.json(
      { error: '获取失败', code: '', version: 1 },
      { status: 500 },
    );
  }
}
