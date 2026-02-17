/* @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { getAvailableApiSites } from '@/lib/config';
import { searchFromApi } from '@/lib/downstream';
import { logger } from '@/lib/logger';
import type { SearchResult } from '@/lib/types';
import { getYellowWords } from '@/lib/yellow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 检查用户认证
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return new Response('缺少搜索关键词', {
        status: 400,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // 获取配置并应用分离逻辑
    const config = await getConfig();

    // 使用高性能索引查询
    const availableSites = await getAvailableApiSites(authInfo.username);

    if (availableSites.length === 0) {
      return new Response('data: {"results": [], "total": 0}\n\n', {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // 共享状态
    let streamClosed = false;

    // 创建可读流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // 辅助函数：安全地向控制器写入数据
        const safeEnqueue = (data: Uint8Array) => {
          try {
            if (
              streamClosed ||
              (!controller.desiredSize && controller.desiredSize !== 0)
            ) {
              // 流已标记为关闭或控制器已关闭
              return false;
            }
            controller.enqueue(data);
            return true;
          } catch (error) {
            // 控制器已关闭或出现其他错误
            logger.warn('Failed to enqueue data:', error);
            streamClosed = true;
            return false;
          }
        };

        // 发送开始事件
        const startEvent = `data: ${JSON.stringify({
          type: 'start',
          query,
          totalSources: availableSites.length,
          timestamp: Date.now(),
        })}\n\n`;

        if (!safeEnqueue(encoder.encode(startEvent))) {
          return; // 连接已关闭，提前退出
        }

        let completedCount = 0;
        let allResults: SearchResult[] = [];

        // 获取黄色词汇（用于过滤）
        const yellowWords = await getYellowWords();

        // 为每个源创建搜索 Promise
        const searchPromises = availableSites.map(async (site) => {
          try {
            // 添加超时控制
            const searchPromise = Promise.race([
              searchFromApi(site, query),
              new Promise((_, reject) =>
                setTimeout(
                  () => reject(new Error(`${site.name} timeout`)),
                  20000,
                ),
              ),
            ]);

            const results = (await searchPromise) as SearchResult[];

            // 类型推断已在 searchFromApi 中完成
            let filteredResults = results;
            if (
              !config.SiteConfig.DisableYellowFilter &&
              yellowWords.length > 0
            ) {
              filteredResults = results.filter((result) => {
                const typeName = result.type_name || '';
                return !yellowWords.some((word: string) =>
                  typeName.includes(word),
                );
              });
            }

            if (yellowWords && yellowWords.length > 0) {
              // 检查用户是否需要过滤
              const userConfig = config.UserConfig.Users?.find(
                (u) => u.username === authInfo.username,
              );
              let shouldFilter = false;

              // 1. 检查全局开关（主开关）
              if (config.SiteConfig.DisableYellowFilter) {
                shouldFilter = false;
              }
              // 2. 全局开关开启，检查具体设置
              else {
                // 站长永远不过滤
                if (userConfig?.role === 'owner') {
                  shouldFilter = false;
                }
                // 检查用户组设置
                else if (
                  userConfig?.tags &&
                  userConfig.tags.length > 0 &&
                  config.UserConfig.Tags
                ) {
                  for (const tagName of userConfig.tags) {
                    const tagConfig = config.UserConfig.Tags?.find(
                      (t) => t.name === tagName,
                    );
                    // disableYellowFilter = true 表示用户组开启过滤
                    if (tagConfig?.disableYellowFilter === true) {
                      shouldFilter = true;
                      break;
                    }
                  }
                  // 如果用户组没有开启过滤，则不过滤
                  if (!shouldFilter) {
                    shouldFilter = false;
                  }
                }
                // 默认情况：没有用户组设置，不过滤
                else {
                  shouldFilter = false;
                }
              }

              // 应用过滤（如果需要过滤）
              if (shouldFilter) {
                filteredResults = results.filter((item) => {
                  // 检查 title 和 type_name 字段
                  const title = (item.title || '').toLowerCase();
                  const typeName = (item.type_name || '').toLowerCase();
                  return !yellowWords.some(
                    (word: string) =>
                      title.includes(word.toLowerCase()) ||
                      typeName.includes(word.toLowerCase()),
                  );
                });
              }
            }

            // 发送该源的搜索结果
            completedCount++;

            if (!streamClosed) {
              const sourceEvent = `data: ${JSON.stringify({
                type: 'source_result',
                source: site.key,
                sourceName: site.name,
                results: filteredResults,
                timestamp: Date.now(),
              })}\n\n`;

              if (!safeEnqueue(encoder.encode(sourceEvent))) {
                streamClosed = true;
                return; // 连接已关闭，停止处理
              }
            }

            if (filteredResults.length > 0) {
              allResults.push(...filteredResults);
            }
          } catch (error) {
            logger.warn(`搜索失败 ${site.name}:`, error);

            // 发送源错误事件
            completedCount++;

            if (!streamClosed) {
              const errorEvent = `data: ${JSON.stringify({
                type: 'source_error',
                source: site.key,
                sourceName: site.name,
                error: error instanceof Error ? error.message : '搜索失败',
                timestamp: Date.now(),
              })}\n\n`;

              if (!safeEnqueue(encoder.encode(errorEvent))) {
                streamClosed = true;
                return; // 连接已关闭，停止处理
              }
            }
          }

          // 检查是否所有源都已完成
          if (completedCount === availableSites.length) {
            if (!streamClosed) {
              // 发送最终完成事件
              const completeEvent = `data: ${JSON.stringify({
                type: 'complete',
                totalResults: allResults.length,
                completedSources: completedCount,
                timestamp: Date.now(),
              })}\n\n`;

              if (safeEnqueue(encoder.encode(completeEvent))) {
                // 只有在成功发送完成事件后才关闭流
                try {
                  controller.close();
                } catch (error) {
                  logger.warn('Failed to close controller:', error);
                }
              }
            }
          }
        });

        // 等待所有搜索完成
        await Promise.allSettled(searchPromises);
      },

      cancel() {
        // 客户端断开连接时，标记流已关闭
        streamClosed = true;
        logger.log('Client disconnected, cancelling search stream');
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    logger.error('WebSocket搜索失败:', error);
    return new Response('data: {"error": "搜索失败"}\n\n', {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }
}
