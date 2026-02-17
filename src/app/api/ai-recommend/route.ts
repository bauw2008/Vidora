import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig, hasSpecialFeaturePermission } from '@/lib/config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: OpenAIMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  stream?: boolean; // 🔥 支持流式响应
}

interface ChatRequestBody {
  model: string;
  messages: OpenAIMessage[];
  stream: boolean;
  temperature?: number;
  max_completion_tokens?: number;
  max_tokens?: number;
}

export async function POST(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);

    // 检查用户权限
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = authInfo.username;

    // 获取配置检查AI功能是否启用
    const adminConfig = await getConfig();
    const aiConfig = adminConfig.AIRecommendConfig;

    if (!aiConfig?.enabled) {
      return NextResponse.json(
        {
          error: 'AI推荐功能未启用',
        },
        {
          status: 403,
          headers: {
            'Cache-Control':
              'no-store, no-cache, must-revalidate, proxy-revalidate',
            Expires: '0',
            Pragma: 'no-cache',
            'Surrogate-Control': 'no-store',
          },
        },
      );
    }

    // 🔥 检查配置模式：AI模式 or 纯搜索模式
    // 确保trim后再判断，避免空字符串或纯空格被当成有效配置
    const hasAIModel = !!(
      aiConfig.apiKey?.trim() &&
      aiConfig.apiUrl?.trim() &&
      aiConfig.model?.trim()
    );

    logger.log('🔍 配置模式检测:', {
      hasAIModel,
      apiKeyLength: aiConfig.apiKey?.length || 0,
      apiUrlLength: aiConfig.apiUrl?.length || 0,
      modelLength: aiConfig.model?.length || 0,
    });

    // 需要AI模式可用
    if (!hasAIModel) {
      return NextResponse.json(
        {
          error: 'AI推荐功能配置不完整。请配置AI API或启用Tavily搜索功能。',
        },
        { status: 500 },
      );
    }

    // 检查用户是否有 AI 权限
    const hasPermission = await hasSpecialFeaturePermission(
      username,
      'ai-recommend',
      adminConfig,
    );

    if (!hasPermission) {
      return NextResponse.json(
        {
          error: '您没有权限使用 AI 推荐功能',
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      messages,
      model,
      temperature,
      max_tokens,
      max_completion_tokens,
      stream,
    } = body as ChatRequest;

    logger.log('🔍 请求参数:', { stream, hasAIModel });

    // 验证请求格式
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        {
          error: 'Invalid messages format',
        },
        { status: 400 },
      );
    }

    // 优化缓存策略 - 只对简单的单轮问答进行短时缓存
    let cacheKey: string | null = null;
    let cachedResponse = null;

    // 只有在单轮对话且消息较短时才使用缓存，避免过度缓存复杂对话
    if (
      messages.length === 1 &&
      messages[0].role === 'user' &&
      messages[0].content.length < 50
    ) {
      const questionHash = Buffer.from(messages[0].content.trim().toLowerCase())
        .toString('base64')
        .slice(0, 16);
      cacheKey = `ai-recommend-simple-${questionHash}`;
      cachedResponse = await db.getCache(cacheKey);
    }

    if (cachedResponse) {
      return NextResponse.json(cachedResponse);
    }

    // 结合当前日期的结构化推荐系统提示词
    const currentDate = new Date().toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    const randomElements = [
      '尝试推荐一些不同类型的作品',
      '可以包含一些经典和新作品的混合推荐',
      '考虑推荐一些口碑很好的作品',
      '可以推荐一些最近讨论度比较高的作品',
    ];
    const randomHint =
      randomElements[Math.floor(Math.random() * randomElements.length)];

    // 构建功能列表和详细说明
    const capabilities = ['影视剧推荐'];

    const systemPrompt = `你是LunaTV的智能推荐助手，支持：${capabilities.join(
      '、',
    )}。当前日期：${currentDate}

## 功能状态：
1. **影视剧推荐** ✅ 始终可用

## 判断用户需求：
- 如果用户想要电影、电视剧、动漫等影视内容 → 使用影视推荐功能
- 其他无关内容 → 直接拒绝回答

## 回复格式要求：

### 影视推荐格式：
《片名》 (年份) [类型] - 简短描述

## 推荐要求：
- ${randomHint}
- 重点推荐${currentYear}年的最新作品
- 可以包含${lastYear}年的热门作品
- 避免推荐${currentYear - 2}年以前的老作品，除非是经典必看
- 推荐内容要具体，包含作品名称、年份、类型、推荐理由
- 每次回复尽量提供一些新的角度或不同的推荐
- 避免推荐过于小众或难以找到的内容

## 回复格式要求：
- **使用Markdown格式**：标题用##，列表用-，加粗用**
- **推荐影片格式**：每部影片独占一行，必须以《片名》开始
  - 格式：《片名》 (年份) [类型] - 简短描述
  - 示例：《流浪地球2》 (2023) [科幻] - 讲述人类建造行星发动机的宏大故事
- 片名规则：
  - 必须是真实存在的影视作品官方全名
  - 年份必须是4位数字
  - 每部推荐独占一行，方便点击搜索
- 使用emoji增强可读性 🎬📺🎭

请始终保持专业和有用的态度，使用清晰的Markdown格式让内容易读。`;

    // 准备发送给OpenAI的消息
    const chatMessages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    // 使用配置中的参数或请求参数
    const requestModel = model || aiConfig.model;
    let tokenLimit = max_tokens || max_completion_tokens || aiConfig.maxTokens;

    // 判断是否是需要使用max_completion_tokens的模型
    // o系列推理模型(o1,o3,o4等)和GPT-5系列使用max_completion_tokens
    const useMaxCompletionTokens =
      requestModel.startsWith('o1') ||
      requestModel.startsWith('o3') ||
      requestModel.startsWith('o4') ||
      requestModel.includes('gpt-5');

    // 根据搜索结果优化token限制，避免空回复
    if (useMaxCompletionTokens) {
      // 推理模型需要更高的token限制
      // GPT-5: 最大128,000, o3/o4-mini: 最大100,000
      if (requestModel.includes('gpt-5')) {
        tokenLimit = Math.max(tokenLimit, 2000); // GPT-5最小2000 tokens
        tokenLimit = Math.min(tokenLimit, 128000); // GPT-5最大128k tokens
      } else if (
        requestModel.startsWith('o3') ||
        requestModel.startsWith('o4')
      ) {
        tokenLimit = Math.max(tokenLimit, 1500); // o3/o4最小1500 tokens
        tokenLimit = Math.min(tokenLimit, 100000); // o3/o4最大100k tokens
      } else {
        tokenLimit = Math.max(tokenLimit, 1000); // 其他推理模型最小1000 tokens
      }
    } else {
      // 普通模型确保最小token数避免空回复
      tokenLimit = Math.max(tokenLimit, 500); // 最小500 tokens
      if (requestModel.includes('gpt-4')) {
        tokenLimit = Math.min(tokenLimit, 32768); // GPT-4系列最大32k tokens
      }
    }

    const requestBody: ChatRequestBody = {
      model: requestModel,
      messages: chatMessages,
      stream: stream || false, // 🔥 添加流式参数
    };

    // 推理模型不支持某些参数
    if (!useMaxCompletionTokens) {
      requestBody.temperature = temperature ?? aiConfig.temperature;
    }

    // 根据模型类型使用正确的token限制参数
    if (useMaxCompletionTokens) {
      requestBody.max_completion_tokens = tokenLimit;
      // 推理模型不支持这些参数
      logger.log(
        `使用推理模型 ${requestModel}，max_completion_tokens: ${tokenLimit}，stream: ${stream}`,
      );
    } else {
      requestBody.max_tokens = tokenLimit;
      logger.log(
        `使用标准模型 ${requestModel}，max_tokens: ${tokenLimit}，stream: ${stream}`,
      );
    }

    // 调用AI API
    const openaiResponse = await fetch(
      aiConfig.apiUrl.endsWith('/chat/completions')
        ? aiConfig.apiUrl
        : `${aiConfig.apiUrl.replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aiConfig.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      },
    );

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      logger.error('OpenAI API Error:', errorData);

      // 提供更详细的错误信息
      let errorMessage = 'AI服务暂时不可用，请稍后重试';
      let errorDetails = '';

      try {
        const parsedError = JSON.parse(errorData);
        if (parsedError.error?.message) {
          errorDetails = parsedError.error.message;
        }
      } catch {
        errorDetails = errorData.substring(0, 200); // 限制错误信息长度
      }

      // 根据HTTP状态码提供更具体的错误信息
      if (openaiResponse.status === 401) {
        errorMessage = 'API密钥无效，请联系管理员检查配置';
      } else if (openaiResponse.status === 429) {
        errorMessage = 'API请求频率限制，请稍后重试';
      } else if (openaiResponse.status === 400) {
        errorMessage = '请求参数错误，请检查输入内容';
      } else if (openaiResponse.status >= 500) {
        errorMessage = 'AI服务器错误，请稍后重试';
      }

      return NextResponse.json(
        {
          error: errorMessage,
          details: errorDetails,
          status: openaiResponse.status,
        },
        { status: 500 },
      );
    }

    // 🔥 流式响应处理
    if (stream) {
      logger.log('📡 返回SSE流式响应');

      // 创建转换流处理OpenAI的SSE格式
      const transformStream = new TransformStream({
        async transform(chunk, controller) {
          const text = new TextDecoder().decode(chunk);
          const lines = text.split('\n').filter((line) => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              if (data === '[DONE]') {
                // 流式结束
                logger.log('📡 流式响应完成');

                controller.enqueue(
                  new TextEncoder().encode('data: [DONE]\n\n'),
                );
                continue;
              }

              try {
                const json = JSON.parse(data);
                const content = json.choices?.[0]?.delta?.content || '';

                if (content) {
                  // 转换为统一的SSE格式
                  controller.enqueue(
                    new TextEncoder().encode(
                      `data: ${JSON.stringify({ text: content })}\n\n`,
                    ),
                  );
                }
              } catch (e) {
                logger.error('解析 SSE 数据失败:', e);
                // 忽略解析错误，继续处理下一行
              }
            }
          }
        },
      });

      const readableStream = openaiResponse.body?.pipeThrough(transformStream);

      return new NextResponse(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // 非流式响应（保持原有逻辑）
    const aiResult = await openaiResponse.json();

    // 检查AI响应的完整性
    if (
      !aiResult.choices ||
      aiResult.choices.length === 0 ||
      !aiResult.choices[0].message
    ) {
      logger.error('AI响应格式异常:', aiResult);
      return NextResponse.json(
        {
          error: 'AI服务响应格式异常，请稍后重试',
          details: `响应结构异常: ${JSON.stringify(aiResult).substring(0, 200)}...`,
        },
        { status: 500 },
      );
    }

    const aiContent = aiResult.choices[0].message.content;

    // 检查内容是否为空
    if (!aiContent || aiContent.trim() === '') {
      logger.error('AI返回空内容:', {
        model: requestModel,
        tokenLimit,
        useMaxCompletionTokens,
        choices: aiResult.choices,
        usage: aiResult.usage,
      });

      let errorMessage = 'AI返回了空回复';
      let errorDetails = '';

      if (useMaxCompletionTokens) {
        // 推理模型特殊处理
        if (tokenLimit < 1000) {
          errorMessage = '推理模型token限制过低导致空回复';
          errorDetails = `当前设置：${tokenLimit} tokens。推理模型建议最少设置1500+ tokens，因为需要额外的推理token消耗。请在管理后台调整maxTokens参数。`;
        } else {
          errorMessage = '推理模型返回空内容';
          errorDetails = `模型：${requestModel}，token设置：${tokenLimit}。推理模型可能因为内容过滤或推理复杂度返回空内容。建议：1) 简化问题描述 2) 检查API密钥权限 3) 尝试增加token限制`;
        }
      } else {
        // 普通模型处理
        if (tokenLimit < 200) {
          errorMessage = 'Token限制过低导致空回复';
          errorDetails = `当前设置：${tokenLimit} tokens，建议至少500+ tokens。请在管理后台调整maxTokens参数。`;
        } else {
          errorDetails =
            '建议：请尝试更详细地描述您想要的影视类型或心情，或联系管理员检查AI配置';
        }
      }

      return NextResponse.json(
        {
          error: errorMessage,
          details: errorDetails,
          modelInfo: {
            model: requestModel,
            tokenLimit,
            isReasoningModel: useMaxCompletionTokens,
          },
        },
        { status: 500 },
      );
    }

    // 提取结构化推荐信息
    const recommendations = extractRecommendations(aiContent);

    // 构建返回格式
    const response = {
      id: aiResult.id || `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: aiResult.created || Math.floor(Date.now() / 1000),
      model: aiResult.model || requestBody.model,
      choices: aiResult.choices || [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: aiContent,
          },
          finish_reason: aiResult.choices?.[0]?.finish_reason || 'stop',
        },
      ],
      usage: aiResult.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
      recommendations: recommendations, // 添加结构化推荐数据
    };

    // 缓存结果（只对简单问题进行短时缓存，15分钟）
    if (cacheKey) {
      await db.setCache(cacheKey, response, 900); // 15分钟缓存
    }

    // 记录用户AI推荐历史（可选）
    try {
      const historyKey = `ai-recommend-history-${username}`;
      const existingHistory =
        ((await db.getCache(historyKey)) as Array<{
          timestamp: string;
          messages: OpenAIMessage[];
          response: string;
        }>) || [];
      const newHistory = [
        {
          timestamp: new Date().toISOString(),
          messages: messages.slice(-1), // 只保存用户最后一条消息
          response: response.choices[0].message.content,
        },
        ...existingHistory.slice(0, 9), // 保留最近10条记录
      ];
      await db.setCache(historyKey, newHistory, 7 * 24 * 3600); // 缓存一周
    } catch (error) {
      logger.warn('保存AI推荐历史失败:', error);
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error('AI推荐API错误:', error);

    // 提供更详细的错误信息
    let errorMessage = '服务器内部错误';
    let errorDetails = '';

    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        errorMessage = '无法连接到AI服务，请检查网络连接';
        errorDetails = '网络连接错误，请稍后重试';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'AI服务响应超时，请稍后重试';
        errorDetails = '请求超时，可能是网络问题或服务器负载过高';
      } else if (error.message.includes('JSON')) {
        errorMessage = 'AI服务响应格式错误';
        errorDetails = '服务器返回了无效的数据格式';
      } else {
        errorDetails = error.message;
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
      },
      { status: 500 },
    );
  }
}

// 获取AI推荐历史
export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);

    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = authInfo.username;

    // 检查用户是否有 AI 权限
    const adminConfig = await getConfig();
    const hasPermission = await hasSpecialFeaturePermission(
      username,
      'ai-recommend',
      adminConfig,
    );

    if (!hasPermission) {
      return NextResponse.json(
        {
          error: '您没有权限使用 AI 推荐功能',
        },
        { status: 403 },
      );
    }

    const historyKey = `ai-recommend-history-${username}`;
    const history =
      ((await db.getCache(historyKey)) as Array<{
        timestamp: string;
        messages: OpenAIMessage[];
        response: string;
      }>) || [];

    return NextResponse.json({
      history: history,
      total: history.length,
    });
  } catch (error) {
    logger.error('获取AI推荐历史错误:', error);
    return NextResponse.json(
      {
        error: '获取历史记录失败',
      },
      { status: 500 },
    );
  }
}

// 从AI回复中提取推荐信息的辅助函数
function extractRecommendations(content: string) {
  const recommendations = [];
  const moviePattern = /《([^》]+)》\s*\((\d{4})\)\s*\[([^\]]+)\]\s*-\s*(.*)/;
  const lines = content.split('\n');

  for (const line of lines) {
    if (recommendations.length >= 4) {
      break;
    }
    const match = line.match(moviePattern);
    if (match) {
      const [, title, year, genre, description] = match;
      recommendations.push({
        title: title.trim(),
        year: year.trim(),
        genre: genre.trim(),
        description: description.trim() || 'AI推荐影片',
      });
    }
  }
  return recommendations;
}
