import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  logger.log('=== AI Test API Called ===');
  logger.log('URL:', request.url);
  logger.log('Method:', request.method);
  logger.log('Headers:', Object.fromEntries(request.headers.entries()));
  logger.log('Cookies:', request.cookies.getAll());

  // 检查存储类型
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  logger.log('Storage type:', storageType);

  if (storageType === 'localstorage') {
    logger.log('Local storage not supported');
    return NextResponse.json(
      {
        error: '不支持本地存储进行AI推荐测试',
      },
      { status: 400 },
    );
  }

  // 先进行认证检查
  const authInfo = getAuthInfoFromCookie(request);
  logger.log('Auth info from cookie:', authInfo);

  // 检查用户权限
  if (!authInfo || !authInfo.username) {
    logger.error('No auth info in cookie');
    return NextResponse.json(
      {
        error: 'Unauthorized - 请先登录',
        debug: {
          hasAuthInfo: !!authInfo,
          hasUsername: !!authInfo?.username,
          cookieValue: request.cookies.get('auth')?.value,
        },
      },
      { status: 401 },
    );
  }

  const username = authInfo.username;
  logger.log('AI Test: Authenticated user:', username);

  try {
    // 权限校验 - 只有站长和管理员可以测试
    const adminConfig = await getConfig();
    if (username !== process.env.USERNAME) {
      const user = adminConfig.UserConfig.Users.find(
        (u) => u.username === username,
      );
      if (!user || user.role !== 'admin' || user.banned) {
        logger.error('AI Test: User not authorized:', username);
        return NextResponse.json(
          { error: '权限不足 - 需要管理员权限' },
          { status: 401 },
        );
      }
    }

    // 认证通过后再解析请求体
    let body;
    try {
      const text = await request.text();
      logger.log('AI Test: Raw request body:', text);
      if (!text) {
        return NextResponse.json(
          {
            error: '请求体为空',
            debug: '请确保发送了请求体',
          },
          { status: 400 },
        );
      }
      body = JSON.parse(text);
    } catch (e) {
      logger.error('AI Test: Failed to parse request body:', e);
      return NextResponse.json(
        {
          error: '请求体格式错误',
          debug: {
            error: e instanceof Error ? e.message : 'Unknown error',
            hint: '请确保发送有效的 JSON 数据',
          },
        },
        { status: 400 },
      );
    }

    logger.log('AI Test Request Body:', JSON.stringify(body, null, 2));

    const { apiUrl, apiKey, model } = body;

    // 验证参数
    if (!apiUrl || typeof apiUrl !== 'string' || apiUrl.trim() === '') {
      return NextResponse.json(
        {
          error: '请提供有效的API地址',
          debug: {
            received: apiUrl,
            type: typeof apiUrl,
            isEmpty: !apiUrl || apiUrl.trim() === '',
          },
        },
        { status: 400 },
      );
    }

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return NextResponse.json(
        {
          error: '请提供有效的API密钥',
          debug: {
            received: apiKey,
            type: typeof apiKey,
            isEmpty: !apiKey || apiKey.trim() === '',
            length: apiKey ? apiKey.length : 0,
          },
        },
        { status: 400 },
      );
    }

    // 构建测试消息
    const testMessages = [
      {
        role: 'system',
        content: '你是一个AI助手，请简单回复确认你可以正常工作。',
      },
      { role: 'user', content: '你好，请回复"测试成功"来确认连接正常。' },
    ];

    // 调用AI API进行测试
    const testUrl = apiUrl.endsWith('/chat/completions')
      ? apiUrl
      : `${apiUrl.replace(/\/$/, '')}/chat/completions`;

    logger.log('Testing AI API:', testUrl);

    const response = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-3.5-turbo',
        messages: testMessages,
        max_tokens: 50,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'API连接失败';

      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          errorMessage =
            errorData.error.message || errorData.error || errorMessage;
        }
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }

      logger.error('AI API Test Error:', errorText);
      return NextResponse.json(
        {
          error: errorMessage,
        },
        { status: 400 },
      );
    }

    const result = await response.json();

    // 检查返回结果格式 - 兼容非标准格式
    if (!result.choices || result.choices.length === 0) {
      // 检查是否是错误响应（某些 API 返回非标准格式）
      if (result.error) {
        return NextResponse.json(
          {
            error: result.error.message || result.error,
            rawResponse: JSON.stringify(result).substring(0, 500),
          },
          { status: 400 },
        );
      }

      // 检查是否是其他非标准错误格式
      if (result.msg || result.message) {
        return NextResponse.json(
          {
            error: result.msg || result.message,
            rawResponse: JSON.stringify(result).substring(0, 500),
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        {
          error: 'API返回无choices数据',
          rawResponse: JSON.stringify(result).substring(0, 500),
        },
        { status: 400 },
      );
    }

    if (!result.choices[0] || !result.choices[0].message) {
      return NextResponse.json(
        {
          error: 'API返回choices格式异常',
          rawResponse: JSON.stringify(result).substring(0, 500),
        },
        { status: 400 },
      );
    }

    const message = result.choices[0].message;
    logger.log('Message fields:', Object.keys(message));
    logger.log('Full message:', message);

    // 尝试从多个可能的字段获取回复内容
    let testReply =
      message.content || message.reasoning_content || message.text || '';

    // 如果还是为空，打印更多调试信息
    if (!testReply || testReply.trim() === '') {
      logger.log('All message fields:', message);
      // 尝试获取任何字符串字段
      for (const [key, value] of Object.entries(message)) {
        if (typeof value === 'string' && value.trim()) {
          testReply = value;
          logger.log(`Found content in field '${key}':`, value);
          break;
        }
      }
    }

    // 检查内容是否为空
    if (!testReply || testReply.trim() === '') {
      return NextResponse.json(
        {
          error: '⚠️ API返回了空内容！这就是导致空回复的原因',
          details:
            '这表明AI模型返回了空回复，可能原因：\n1. 模型参数配置问题\n2. API密钥权限问题\n3. 模型服务异常\n4. API使用了非标准的响应格式',
          rawResponse: JSON.stringify(result).substring(0, 1000),
          debug: {
            messageFields: Object.keys(message),
            messageContent: message,
          },
          success: false,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: '✅ 测试成功 - AI配置正常',
      testReply: testReply,
      model: result.model || model,
      usage: result.usage,
      diagnosis: {
        responseStructure: '正常',
        contentLength: testReply.length,
        hasContent: testReply.trim().length > 0,
      },
    });
  } catch (error) {
    logger.error('AI API test error:', error);

    let errorMessage = '连接测试失败';
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        errorMessage = '无法连接到API服务器，请检查API地址';
      } else if (error.message.includes('timeout')) {
        errorMessage = '连接超时，请检查网络或API服务状态';
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}
