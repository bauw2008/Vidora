import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { clearConfigCache, getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { removeDeviceBinding } from '@/lib/tvbox-device-fingerprint';

interface TVBoxSecurityConfig {
  enableAuth?: boolean;
  token?: string;

  enableRateLimit?: boolean;
  rateLimit?: number;
  enableDeviceBinding?: boolean;
  maxDevices?: number;
  defaultUserGroup?: string;
  enableUserAgentWhitelist?: boolean;
  allowedUserAgents?: string[];
  currentDevices?: Array<{
    deviceId: string;
    deviceInfo: string;
    bindTime: number;
  }>;
  userTokens?: Array<{
    username: string;
    token: string;
    enabled: boolean;
    devices: Array<{
      deviceId: string;
      deviceInfo: string;
      bindTime: number;
    }>;
  }>;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 获取用户设备列表
export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);

  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = authInfo;
  try {
    const username = user.username;

    // 获取配置
    const adminConfig = await getConfig();
    const securityConfig: TVBoxSecurityConfig =
      adminConfig.TVBoxSecurityConfig || {};

    // 检查是否启用了设备绑定
    if (!securityConfig.enableDeviceBinding) {
      return NextResponse.json({
        enableDeviceBinding: false,
        devices: [],
      });
    }

    // 查找用户的Token信息
    if (
      !securityConfig.userTokens ||
      !Array.isArray(securityConfig.userTokens)
    ) {
      return NextResponse.json({
        enableDeviceBinding: true,
        devices: [],
      });
    }

    const userTokenInfo = securityConfig.userTokens.find(
      (t) => t.username === username && t.enabled,
    );

    if (!userTokenInfo) {
      return NextResponse.json({
        enableDeviceBinding: true,
        devices: [],
      });
    }

    return NextResponse.json({
      enableDeviceBinding: true,
      devices: userTokenInfo.devices || [],
      maxDevices: securityConfig.maxDevices || 1,
    });
  } catch (error) {
    logger.error('获取设备列表失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}

// 用户自解绑设备API
export async function POST(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);

  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = authInfo;
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行设备管理',
      },
      { status: 400 },
    );
  }

  try {
    const username = user.username;
    const { deviceId } = await request.json();

    if (!deviceId) {
      return NextResponse.json({ error: '缺少设备ID' }, { status: 400 });
    }

    // 获取配置
    const adminConfig = await getConfig();
    const securityConfig: TVBoxSecurityConfig =
      adminConfig.TVBoxSecurityConfig || {};

    // 检查是否启用了设备绑定
    if (!securityConfig.enableDeviceBinding) {
      return NextResponse.json(
        { error: '未启用设备绑定功能' },
        { status: 400 },
      );
    }

    // 查找用户的Token信息
    if (
      !securityConfig.userTokens ||
      !Array.isArray(securityConfig.userTokens)
    ) {
      return NextResponse.json({ error: '用户Token配置错误' }, { status: 400 });
    }

    const userTokenInfo = securityConfig.userTokens.find(
      (t) => t.username === username && t.enabled,
    );

    if (!userTokenInfo) {
      return NextResponse.json(
        { error: '用户未启用Token验证' },
        { status: 400 },
      );
    }

    // 检查设备是否存在
    if (!userTokenInfo.devices || !Array.isArray(userTokenInfo.devices)) {
      return NextResponse.json(
        { error: '用户没有绑定任何设备' },
        { status: 400 },
      );
    }

    const deviceExists = userTokenInfo.devices.some(
      (d) => d.deviceId === deviceId,
    );

    if (!deviceExists) {
      return NextResponse.json(
        { error: '设备不存在或无权操作' },
        { status: 404 },
      );
    }

    // 使用removeDeviceBinding函数移除设备
    const updatedDevices = removeDeviceBinding(userTokenInfo.devices, deviceId);

    // 记录解绑操作
    logger.log(`用户 ${username} 解绑设备: ${deviceId}`);

    // 更新用户设备列表
    userTokenInfo.devices = updatedDevices;

    // 保存配置到数据库
    await db.saveAdminConfig(adminConfig);

    // 清除配置缓存
    clearConfigCache();

    return NextResponse.json({
      success: true,
      message: '设备解绑成功',
      remainingDevices: updatedDevices.length,
    });
  } catch (error) {
    logger.error('设备解绑失败:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
