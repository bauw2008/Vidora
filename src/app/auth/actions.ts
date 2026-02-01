'use server';

import { cookies } from 'next/headers';

import { getConfig } from '@/lib/config';
import { clearConfigCache } from '@/lib/config';
import { SimpleCrypto } from '@/lib/crypto';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// 读取存储类型环境变量，默认 localstorage
const STORAGE_TYPE =
  (process.env.NEXT_PUBLIC_STORAGE_TYPE as
    | 'localstorage'
    | 'redis'
    | 'upstash'
    | 'kvrocks'
    | undefined) || 'localstorage';

// 生成签名
async function generateSignature(
  data: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// 定义认证数据类型
interface AuthData {
  role: 'owner' | 'admin' | 'user';
  username?: string;
  password?: string;
  signature?: string;
  timestamp?: number;
}

// 生成认证Cookie（带签名）
async function generateAuthCookie(
  username?: string,
  password?: string,
  role?: 'owner' | 'admin' | 'user',
  includePassword = false,
): Promise<string> {
  const authData: AuthData = { role: role || 'user' };

  if (includePassword && password) {
    authData.password = password;
  }

  if (username && process.env.PASSWORD) {
    authData.username = username;
    const signature = await generateSignature(username, process.env.PASSWORD);
    authData.signature = signature;
    authData.timestamp = Date.now();
  }

  return encodeURIComponent(JSON.stringify(authData));
}

// 登录 Action
export async function loginAction(
  prevState: { error: string | null },
  formData: FormData,
) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!password || (STORAGE_TYPE !== 'localstorage' && !username)) {
    return { error: '请填写完整的登录信息' };
  }

  try {
    // localStorage 模式
    if (STORAGE_TYPE === 'localstorage') {
      const envPassword = process.env.PASSWORD;

      if (!envPassword) {
        const cookieValue = await generateAuthCookie(
          undefined,
          password,
          'user',
          true,
        );
        const cookieStore = await cookies();
        cookieStore.set('auth', cookieValue, {
          path: '/',
          maxAge: 60 * 60 * 24 * 7, // 7天
          sameSite: 'lax',
          httpOnly: false,
          secure: false,
        });
        return { error: null };
      }

      if (password !== envPassword) {
        return { error: '密码错误' };
      }

      const cookieValue = await generateAuthCookie(
        undefined,
        password,
        'user',
        true,
      );
      const cookieStore = await cookies();
      cookieStore.set('auth', cookieValue, {
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        sameSite: 'lax',
        httpOnly: false,
        secure: false,
      });
      return { error: null };
    }

    // 数据库模式
    const config = await getConfig();
    const user = config.UserConfig.Users.find((u) => u.username === username);

    if (user?.banned) {
      return { error: '用户被封禁' };
    }

    // 站长登录
    if (
      username === process.env.USERNAME &&
      password === process.env.PASSWORD
    ) {
      await db.updateUserLoginStats(username, Date.now(), true);
      await db.updateLastActivity(username);

      const cookieValue = await generateAuthCookie(
        username,
        password,
        'owner',
        false,
      );
      const cookieStore = await cookies();
      cookieStore.set('auth', cookieValue, {
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        sameSite: 'lax',
        httpOnly: false,
        secure: false,
      });
      return { error: null };
    }

    if (username === process.env.USERNAME) {
      return { error: '用户名或密码错误' };
    }

    // 普通用户登录
    const isValid = await db.verifyUser(username, password);
    if (!isValid) {
      return { error: '用户名或密码错误' };
    }

    await db.updateUserLoginStats(username, Date.now(), false);
    await db.updateLastActivity(username);

    const cookieValue = await generateAuthCookie(
      username,
      password,
      user?.role || 'user',
      false,
    );
    const cookieStore = await cookies();
    cookieStore.set('auth', cookieValue, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
      httpOnly: false,
      secure: false,
    });

    return { error: null };
  } catch (error) {
    logger.error('登录失败:', error);
    return { error: '登录失败，请稍后重试' };
  }
}

// 注册 Action
export async function registerAction(
  prevState: {
    error: string | null;
    success: string | null;
    pending: boolean;
  },
  formData: FormData,
) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;
  const reason = formData.get('reason') as string;

  // localStorage 模式不支持注册
  if (STORAGE_TYPE === 'localstorage') {
    return { error: '当前模式不支持注册', success: null, pending: false };
  }

  // 验证输入
  if (!username || username.trim() === '') {
    return { error: '用户名不能为空', success: null, pending: false };
  }

  if (!password) {
    return { error: '密码不能为空', success: null, pending: false };
  }

  if (password !== confirmPassword) {
    return { error: '两次输入的密码不一致', success: null, pending: false };
  }

  if (password.length < 6) {
    return { error: '密码长度至少6位', success: null, pending: false };
  }

  if (username === process.env.USERNAME) {
    return { error: '该用户名已被使用', success: null, pending: false };
  }

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return {
      error: '用户名只能包含字母、数字和下划线，长度3-20位',
      success: null,
      pending: false,
    };
  }

  try {
    const config = await getConfig();

    // 检查是否允许注册
    const allowRegister = config.UserConfig?.AllowRegister !== false;
    if (!allowRegister) {
      return {
        error: '管理员已关闭用户注册功能',
        success: null,
        pending: false,
      };
    }

    // 检查用户数限制
    const maxUsers = config.SiteConfig?.MaxUsers || 1000;
    const currentUserCount = config.UserConfig?.Users?.length || 0;
    if (currentUserCount >= maxUsers) {
      return {
        error: '注册人数已达上限，请联系管理员',
        success: null,
        pending: false,
      };
    }

    // 检查用户是否已存在
    const userExists = await db.checkUserExist(username);
    if (userExists) {
      return { error: '该用户名已被注册', success: null, pending: false };
    }

    // 检查是否需要审核
    const requireApproval =
      (config.UserConfig as { RequireApproval?: boolean }).RequireApproval ===
      true;

    if (requireApproval) {
      const secret = process.env.PASSWORD || 'site-secret';
      const encryptedPassword = SimpleCrypto.encrypt(password, secret);

      if (!config.UserConfig.PendingUsers) {
        config.UserConfig.PendingUsers = [];
      }

      const existsInPending = config.UserConfig.PendingUsers.find(
        (u) => u.username === username,
      );
      if (existsInPending) {
        return {
          error: '该用户名已提交审核，请耐心等待审批',
          success: null,
          pending: false,
        };
      }

      config.UserConfig.PendingUsers.push({
        username,
        reason,
        encryptedPassword,
        appliedAt: new Date().toISOString(),
      });
      await db.saveAdminConfig(config);
      clearConfigCache();

      return {
        error: null,
        success: '已提交注册申请，等待管理员审核',
        pending: true,
      };
    }

    // 直接创建账号
    await db.registerUser(username, password);

    const newUser = {
      username: username,
      role: 'user' as const,
      createdAt: Date.now(),
      tags: ['默认'],
    };

    config.UserConfig.Users.push(newUser);
    await db.saveAdminConfig(config);
    clearConfigCache();

    // 自动登录
    const cookieValue = await generateAuthCookie(
      username,
      password,
      'user',
      false,
    );
    const cookieStore = await cookies();
    cookieStore.set('auth', cookieValue, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
      httpOnly: false,
      secure: false,
    });

    return {
      error: null,
      success: '注册成功，正在跳转...',
      pending: false,
    };
  } catch (error) {
    logger.error('注册失败:', error);
    return { error: '注册失败，请稍后重试', success: null, pending: false };
  }
}
