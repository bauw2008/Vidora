import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

// 获取用户头像
export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo) {
      return NextResponse.json({ error: '未认证' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedUser = searchParams.get('user');

    // 如果是管理员或站长，且提供了user参数，则获取指定用户的头像
    if (
      (authInfo.role === 'admin' || authInfo.role === 'owner') &&
      requestedUser
    ) {
      const avatarData = await db.getUserAvatar(requestedUser);
      return NextResponse.json({ avatar: avatarData });
    }

    // 默认返回当前用户的头像
    const username = authInfo.username;
    const avatarData = await db.getUserAvatar(username);
    return NextResponse.json({ avatar: avatarData });
  } catch (error) {
    logger.error('获取头像失败:', error);
    return NextResponse.json({ error: '获取头像失败' }, { status: 500 });
  }
}

// 上传用户头像
export async function POST(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo) {
      return NextResponse.json({ error: '未认证' }, { status: 401 });
    }

    const username = authInfo.username;
    const body = await request.json();
    const { avatar, targetUser } = body;

    // 如果是管理员或站长，且提供了targetUser参数，则为指定用户设置头像
    const targetUsername =
      (authInfo.role === 'admin' || authInfo.role === 'owner') && targetUser
        ? targetUser
        : username;

    if (!avatar) {
      return NextResponse.json({ error: '没有提供头像数据' }, { status: 400 });
    }

    // 处理base64数据
    let base64Data = avatar;
    if (avatar.startsWith('data:')) {
      // 移除data:image/jpeg;base64,前缀
      base64Data = avatar.split(',')[1];
    }

    // 转换为Buffer以检查文件信息
    const buffer = Buffer.from(base64Data, 'base64');
    const currentSizeKB = Math.round(buffer.length / 1024);

    // 检查文件格式（通过文件头）
    const fileHeader = buffer.toString('ascii', 0, 6);
    const isGif = fileHeader === 'GIF87a' || fileHeader === 'GIF89a';

    // 检查是否是WEBP格式（支持动画WebP）
    let isWebp = false;
    if (buffer.length >= 12) {
      // WEBP文件头：RIFF（4字节）+ 文件大小（4字节）+ WEBP（4字节）
      const riffHeader = buffer.toString('ascii', 0, 4);
      const webpHeader = buffer.toString('ascii', 8, 12);
      isWebp = riffHeader === 'RIFF' && webpHeader === 'WEBP';
    }

    const userRole = authInfo.role;
    const isOwner = userRole === 'owner';

    // 检查限制规则：仅非站长用户有大小限制
    if (!isOwner) {
      // 普通用户和管理员：文件大小限制150KB
      const maxSizeBytes = 150 * 1024; // 150KB
      if (buffer.length > maxSizeBytes) {
        return NextResponse.json(
          {
            error: '文件过大',
            message: `头像大小不能超过150KB（当前：${currentSizeKB}KB）`,
            maxSizeKB: 150,
            currentSizeKB,
          },
          { status: 400 },
        );
      }
    }

    // 注意：GIF和WEBP格式不会经过裁剪，直接上传以保持动画完整性
    // 日志已移除，避免泄露用户身份信息

    // 保存头像
    await db.setUserAvatar(targetUsername, base64Data);
    return NextResponse.json({
      success: true,
      message: '头像上传成功',
      sizeKB: currentSizeKB,
      isGif,
      isWebp,
      userRole,
    });
  } catch (error) {
    logger.error('上传头像失败:', error);
    return NextResponse.json({ error: '上传头像失败' }, { status: 500 });
  }
}

// 删除用户头像
export async function DELETE(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo) {
      return NextResponse.json({ error: '未认证' }, { status: 401 });
    }

    const username = authInfo.username;
    await db.setUserAvatar(username, '');
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('删除头像失败:', error);
    return NextResponse.json({ error: '删除头像失败' }, { status: 500 });
  }
}
