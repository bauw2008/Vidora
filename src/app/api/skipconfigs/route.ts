import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const config = await getConfig();
    if (authInfo.username !== process.env.USERNAME) {
      // 非站长，检查用户存在或被封禁
      const user = config.UserConfig.Users.find(
        (u) => u.username === authInfo.username,
      );
      if (!user) {
        return NextResponse.json({ error: '用户不存在' }, { status: 401 });
      }
      if (user.banned) {
        return NextResponse.json({ error: '用户已被封禁' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const id = searchParams.get('id');

    if (source && id) {
      // 获取单个配置 - 功能未实现
      // const config = await db.getSkipConfig(authInfo.username, source, id);
      return NextResponse.json({});
    } else {
      // 获取所有配置 - 功能未实现
      // const configs = await db.getAllSkipConfigs(authInfo.username);
      return NextResponse.json({});
    }
  } catch (error) {
    logger.error('获取跳过片头片尾配置失败:', error);
    return NextResponse.json(
      { error: '获取跳过片头片尾配置失败' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const adminConfig = await getConfig();
    if (authInfo.username !== process.env.USERNAME) {
      // 非站长，检查用户存在或被封禁
      const user = adminConfig.UserConfig.Users.find(
        (u) => u.username === authInfo.username,
      );
      if (!user) {
        return NextResponse.json({ error: '用户不存在' }, { status: 401 });
      }
      if (user.banned) {
        return NextResponse.json({ error: '用户已被封禁' }, { status: 401 });
      }
    }

    const body = await request.json();
    const { key, config } = body;

    if (!key || !config) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 解析key为source和id
    const [source, id] = key.split('+');
    if (!source || !id) {
      return NextResponse.json({ error: '无效的key格式' }, { status: 400 });
    }

    // 保存配置 - 功能未实现
    // await db.setSkipConfig(authInfo.username, source, id, skipConfig);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('保存跳过片头片尾配置失败:', error);
    return NextResponse.json(
      { error: '保存跳过片头片尾配置失败' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const adminConfig = await getConfig();
    if (authInfo.username !== process.env.USERNAME) {
      // 非站长，检查用户存在或被封禁
      const user = adminConfig.UserConfig.Users.find(
        (u) => u.username === authInfo.username,
      );
      if (!user) {
        return NextResponse.json({ error: '用户不存在' }, { status: 401 });
      }
      if (user.banned) {
        return NextResponse.json({ error: '用户已被封禁' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 解析key为source和id
    const [source, id] = key.split('+');
    if (!source || !id) {
      return NextResponse.json({ error: '无效的key格式' }, { status: 400 });
    }

    // 删除配置 - 功能未实现
    // await db.deleteSkipConfig(authInfo.username, source, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('删除跳过片头片尾配置失败:', error);
    return NextResponse.json(
      { error: '删除跳过片头片尾配置失败' },
      { status: 500 },
    );
  }
}
