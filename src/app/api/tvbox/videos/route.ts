import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';
import { getVideosByCategory } from '@/lib/tvbox-analysis';
import {
  getTVBoxCategoryCache,
  getTVBoxVideoCache,
  setTVBoxVideoCache,
} from '@/lib/tvbox-cache';
import { getYellowWords } from '@/lib/yellow';

// 定义用户标签配置类型
interface UserTagConfig {
  name: string;
  videoSources?: string[];
  disableYellowFilter?: boolean;
}

// 定义分类数据类型
interface CategoryData {
  type_id: string;
  type_name: string;
  [key: string]: unknown;
}

// 定义分类类型
interface Category {
  name: string;
  url: string;
  [key: string]: unknown;
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // 检查用户认证
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 检查用户权限
    const config = await getConfig();
    const ownerUsername = process.env.USERNAME;
    const currentUsername = authInfo.username;

    if (currentUsername !== ownerUsername) {
      const user = config.UserConfig.Users.find(
        (u) => u.username === currentUsername,
      );
      if (!user) {
        return NextResponse.json({ error: '用户不存在' }, { status: 401 });
      }
      if (user.banned) {
        return NextResponse.json({ error: '用户已被封禁' }, { status: 401 });
      }
    }

    const url = new URL(request.url);
    const source = url.searchParams.get('source');
    let category: string = url.searchParams.get('category') || '0';
    if (category === '') {
      category = '0';
    }
    const page = parseInt(url.searchParams.get('page') || '1');
    const pagesize = url.searchParams.get('pagesize')
      ? parseInt(url.searchParams.get('pagesize') || '0')
      : undefined;
    const forceRefresh = url.searchParams.get('forceRefresh') === 'true';

    if (!source) {
      return NextResponse.json({ error: '缺少 source 参数' }, { status: 400 });
    }

    let availableSites;
    try {
      availableSites = await getAvailableApiSites(currentUsername);
    } catch (error) {
      logger.error('获取可用站点失败:', error);
      return NextResponse.json({ error: '获取可用站点失败' }, { status: 500 });
    }

    const site = availableSites.find((s) => s.key === source);
    if (!site) {
      return NextResponse.json({ error: '视频源不存在' }, { status: 404 });
    }

    // 尝试从缓存获取数据（除非强制刷新）
    if (!forceRefresh) {
      try {
        const videoCache = await getTVBoxVideoCache(source, category, page);
        const categoryCache = await getTVBoxCategoryCache(source);

        if (
          videoCache &&
          videoCache.list &&
          videoCache.list.length > 0 &&
          categoryCache &&
          categoryCache.primary_categories &&
          categoryCache.primary_categories.length > 0
        ) {
          // 为缓存的视频添加源名称
          let videosWithSourceName = videoCache.list.map((video) => ({
            ...video,
            source_name: site.name,
          }));

          // 应用18+过滤（即使是缓存数据也要过滤）
          const yellowWords = await getYellowWords();
          if (yellowWords && yellowWords.length > 0) {
            // 获取配置以检查是否禁用18+过滤器
            const tvboxConfig = await getConfig();

            // 检查用户是否需要应用18+过滤
            const userConfig = tvboxConfig.UserConfig.Users?.find(
              (u) => u.username === currentUsername,
            );
            let shouldFilter = false;

            // 使用搜索页面的过滤逻辑
            if (!tvboxConfig.SiteConfig.DisableYellowFilter) {
              if (userConfig?.role === 'owner') {
                shouldFilter = false; // 站长豁免
              }
              // 检查用户组设置
              else if (
                userConfig?.tags &&
                userConfig.tags.length > 0 &&
                tvboxConfig.UserConfig.Tags
              ) {
                for (const tagName of userConfig.tags) {
                  const tagConfig = (
                    tvboxConfig.UserConfig.Tags as UserTagConfig[]
                  )?.find((t) => t.name === tagName);
                  // disableYellowFilter = true 表示用户组开启过滤
                  if (tagConfig?.disableYellowFilter === true) {
                    shouldFilter = true;
                    break;
                  }
                }
              }
            }

            // 当应该应用过滤时，进行过滤
            if (shouldFilter) {
              videosWithSourceName = videosWithSourceName.filter(
                (item: { title?: string; type_name?: string }) =>
                  !yellowWords.some((word: string) => {
                    const title = (item.title || '').toLowerCase();
                    const typeName = (item.type_name || '').toLowerCase();
                    return (
                      title.includes(word.toLowerCase()) ||
                      typeName.includes(word.toLowerCase())
                    );
                  }),
              );
            }
          }

          return NextResponse.json({
            list: videosWithSourceName,
            categories: categoryCache,
            pagecount: videoCache.pagecount || 1,
            fromCache: true,
          });
        }
      } catch (cacheError) {
        // 缓存读取失败，继续从API获取
        logger.error('从缓存读取视频失败:', cacheError);
      }
    }

    // 从API获取数据
    try {
      const { results, pageCount } = await getVideosByCategory(
        site,
        category,
        page,
        pagesize,
      );

      // 获取分类信息
      let finalCategoryStructure;
      try {
        const categoryResponse = await fetch(`${site.api}?ac=list`);
        if (categoryResponse.ok) {
          const categoryData: CategoryData = await categoryResponse.json();
          if (categoryData.class && Array.isArray(categoryData.class)) {
            // 检查是否有 type_pid 字段（有层级的分类结构）
            const hasTypePid = categoryData.class.some(
              (cat) => cat.type_pid !== undefined,
            );

            let primaryCategories: CategoryData[];
            let secondaryCategories: CategoryData[];

            if (hasTypePid) {
              // 有层级结构：使用 type_pid 判断
              primaryCategories = categoryData.class.filter(
                (cat) => cat.type_pid === 0,
              );
              secondaryCategories = categoryData.class.filter(
                (cat) => cat.type_pid !== 0,
              );
            } else {
              // 无层级结构：根据分类名称规律判断
              // 一级分类名称（不同API源的命名可能略有不同）
              const primaryCategoryNames = [
                '电影片',
                '连续剧',
                '综艺片',
                '动漫片',
                '电影',
                '电视剧',
                '综艺',
                '动漫',
                '纪录片',
                '体育赛事',
                '短剧',
                '电影解说',
              ];

              primaryCategories = categoryData.class.filter((cat) =>
                primaryCategoryNames.includes(cat.type_name),
              );

              // 一级分类的 type_id 集合
              const primaryTypeIds = new Set(
                primaryCategories.map((cat) => cat.type_id),
              );

              // 其余为二级分类
              secondaryCategories = categoryData.class.filter(
                (cat) => !primaryTypeIds.has(cat.type_id),
              );

              // 创建一级分类名称到 type_id 的映射
              const primaryNameToId: Record<string, string> = {};
              primaryCategories.forEach((cat) => {
                // 同时映射"电影片"和"电影"两种名称
                primaryNameToId[cat.type_name] = cat.type_id;
              });

              // 根据名称规律自动判断二级分类归属
              secondaryCategories = secondaryCategories.map((cat) => {
                let primaryId = '0';
                const name = cat.type_name;

                // 根据名称后缀判断归属
                if (name.endsWith('片') || name === '动漫电影') {
                  // 动作片、喜剧片、恐怖片等 → 电影
                  primaryId =
                    primaryNameToId['电影片'] || primaryNameToId['电影'] || '0';
                } else if (name.endsWith('剧') || name.includes('剧')) {
                  // 国产剧、韩剧、欧美剧、港澳剧等 → 连续剧
                  primaryId =
                    primaryNameToId['连续剧'] ||
                    primaryNameToId['电视剧'] ||
                    '0';
                } else if (name.includes('综艺')) {
                  // 大陆综艺、港台综艺等 → 综艺
                  primaryId =
                    primaryNameToId['综艺片'] || primaryNameToId['综艺'] || '0';
                } else if (name.includes('动漫') || name === '动画片') {
                  // 国产动漫、日本动漫、动画片等 → 动漫
                  primaryId =
                    primaryNameToId['动漫片'] || primaryNameToId['动漫'] || '0';
                } else if (
                  ['足球', '篮球', '台球', '其他赛事'].includes(name)
                ) {
                  // 体育子分类
                  primaryId = primaryNameToId['体育赛事'] || '0';
                } else if (name === '预告片' || name === '短片') {
                  // 预告片、短片归入电影
                  primaryId =
                    primaryNameToId['电影片'] || primaryNameToId['电影'] || '0';
                }

                return {
                  ...cat,
                  type_pid: parseInt(primaryId, 10),
                };
              });
            }

            const primaryCategoriesFormatted = primaryCategories.map((cat) => ({
              type_id: cat.type_id,
              type_pid: typeof cat.type_pid === 'number' ? cat.type_pid : 0,
              type_name: cat.type_name,
            }));

            const secondaryCategoriesFormatted = secondaryCategories.map(
              (cat) => ({
                type_id: cat.type_id,
                type_pid: typeof cat.type_pid === 'number' ? cat.type_pid : 0,
                type_name: cat.type_name,
              }),
            );

            const categoryMap = categoryData.class.reduce(
              (map, cat) => {
                map[cat.type_id] = cat;
                return map;
              },
              {} as Record<number, Category>,
            );

            finalCategoryStructure = {
              primary_categories: primaryCategoriesFormatted,
              secondary_categories: secondaryCategoriesFormatted,
              category_map: categoryMap,
            };

            // 应用18+分类过滤（使用搜索页面的逻辑）
            const yellowWords = await getYellowWords();
            if (yellowWords && yellowWords.length > 0) {
              const tvboxConfig = await getConfig();
              const userConfig = tvboxConfig.UserConfig.Users?.find(
                (u) => u.username === currentUsername,
              );
              let shouldFilter = false;

              if (!tvboxConfig.SiteConfig.DisableYellowFilter) {
                if (userConfig?.role === 'owner') {
                  shouldFilter = false;
                } else if (
                  userConfig?.tags &&
                  userConfig.tags.length > 0 &&
                  tvboxConfig.UserConfig.Tags
                ) {
                  for (const tagName of userConfig.tags) {
                    const tagConfig = (
                      tvboxConfig.UserConfig.Tags as Array<{
                        name: string;
                        videoSources: string[];
                        disableYellowFilter?: boolean;
                      }>
                    )?.find((t) => t.name === tagName);
                    if (tagConfig?.disableYellowFilter === true) {
                      shouldFilter = true;
                      break;
                    }
                  }
                }
              }

              if (shouldFilter) {
                finalCategoryStructure.primary_categories =
                  finalCategoryStructure.primary_categories.filter(
                    (category) => {
                      const categoryName =
                        (category as { type_name?: string }).type_name || '';
                      return !yellowWords.some((word) =>
                        categoryName.includes(word),
                      );
                    },
                  );

                finalCategoryStructure.secondary_categories =
                  finalCategoryStructure.secondary_categories.filter(
                    (category) => {
                      const categoryName =
                        (category as { type_name?: string }).type_name || '';
                      return !yellowWords.some((word) =>
                        categoryName.includes(word),
                      );
                    },
                  );

                // 从category_map中移除被过滤的分类
                const filteredCategoryMap: Record<
                  number,
                  { type_name?: string }
                > = {};
                Object.entries(finalCategoryStructure.category_map).forEach(
                  ([id, category]) => {
                    const categoryName =
                      (category as { type_name?: string }).type_name || '';
                    const shouldFilter = yellowWords.some((word) =>
                      categoryName.includes(word),
                    );
                    if (!shouldFilter) {
                      filteredCategoryMap[parseInt(id)] = category;
                    }
                  },
                );
                finalCategoryStructure.category_map = filteredCategoryMap;
              }
            }
          }
        }
      } catch (error) {
        logger.error(`获取分类信息失败 (源站: ${source}):`, error);
        finalCategoryStructure = {
          primary_categories: [],
          secondary_categories: [],
          category_map: {},
        };
      }

      // 为结果添加源名称
      let resultsWithSourceName = results.map((video) => ({
        ...video,
        source_name: site.name,
      }));
      // 应用18+过滤
      const yellowWords = await getYellowWords();
      if (yellowWords && yellowWords.length > 0) {
        const tvboxConfig = await getConfig();
        const userConfig = tvboxConfig.UserConfig.Users?.find(
          (u) => u.username === currentUsername,
        );
        let shouldFilter = false;

        if (!tvboxConfig.SiteConfig.DisableYellowFilter) {
          if (userConfig?.role === 'owner') {
            shouldFilter = false;
          } else if (
            userConfig?.tags &&
            userConfig.tags.length > 0 &&
            tvboxConfig.UserConfig.Tags
          ) {
            for (const tagName of userConfig.tags) {
              const tagConfig = (
                tvboxConfig.UserConfig.Tags as Array<{
                  name: string;
                  videoSources: string[];
                  disableYellowFilter?: boolean;
                }>
              )?.find((t) => t.name === tagName);
              if (tagConfig?.disableYellowFilter === true) {
                shouldFilter = true;
                break;
              }
            }
          }
        }

        if (shouldFilter) {
          // 应用18+过滤
          resultsWithSourceName = resultsWithSourceName.filter((item) => {
            const title = (
              (item as { vod_name?: string; title?: string }).vod_name ||
              (item as { vod_name?: string; title?: string }).title ||
              ''
            ).toLowerCase();
            const typeName = (
              (item as { type_name?: string }).type_name || ''
            ).toLowerCase();
            return !yellowWords.some(
              (word: string) => title.includes(word) || typeName.includes(word),
            );
          });
        }
      }

      // 缓存结果
      try {
        await setTVBoxVideoCache(
          source,
          {
            list: resultsWithSourceName,
            pagecount: pageCount,
          },
          category,
          page,
        );
      } catch (cacheError) {
        // 缓存写入失败，不影响响应
        logger.error('写入缓存失败:', cacheError);
      }

      return NextResponse.json({
        list: resultsWithSourceName,
        categories: finalCategoryStructure,
        pagecount: pageCount,
        fromCache: false,
      });
    } catch (err) {
      logger.error('加载视频失败:', err);
      return NextResponse.json({ error: '加载视频失败' }, { status: 500 });
    }
  } catch (error) {
    logger.error('TVBox API错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
