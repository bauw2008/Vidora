'use client';

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  RotateCcw,
  Save,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAdminAuth, useAdminLoading } from '@/hooks/admin';

interface CustomAdFilterSettings {
  CustomAdFilterCode: string;
  CustomAdFilterVersion: number;
}

function CustomAdFilterConfigContent({
  config,
  refreshConfig,
}: {
  config?: {
    SiteConfig?: {
      CustomAdFilterCode?: string;
      CustomAdFilterVersion?: number;
    };
  };
  refreshConfig?: () => void;
}) {
  // 使用统一的 hooks
  const { isAdminOrOwner } = useAdminAuth();
  const { isLoading, withLoading } = useAdminLoading();

  // 去广告配置状态
  const [filterSettings, setFilterSettings] = useState<CustomAdFilterSettings>({
    CustomAdFilterCode: '',
    CustomAdFilterVersion: 1,
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // 初始化配置
  useEffect(() => {
    if (config?.SiteConfig) {
      requestAnimationFrame(() => {
        setFilterSettings({
          CustomAdFilterCode: config.SiteConfig.CustomAdFilterCode || '',
          CustomAdFilterVersion: config.SiteConfig.CustomAdFilterVersion || 1,
        });
      });
    }
  }, [config]);

  // 检测变更
  useEffect(() => {
    const originalCode = config?.SiteConfig?.CustomAdFilterCode || '';
    const originalVersion = config?.SiteConfig?.CustomAdFilterVersion || 1;
    requestAnimationFrame(() => {
      setHasChanges(
        filterSettings.CustomAdFilterCode !== originalCode ||
          filterSettings.CustomAdFilterVersion !== originalVersion,
      );
    });
  }, [filterSettings, config]);

  // 显示消息
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // 非管理员或站长禁止访问
  if (!isAdminOrOwner) {
    return (
      <div className='p-6 text-center text-red-500'>
        <h2 className='text-xl font-semibold mb-2'>访问受限</h2>
        <p>您没有权限访问AD过滤配置功能</p>
      </div>
    );
  }

  // 默认示例代码（从备份项目移植，更详细）
  const defaultExample = `// 自定义去广告函数
// 参数: type (播放源key), m3u8Content (m3u8文件内容)
// 返回: 过滤后的m3u8内容

function filterAdsFromM3U8(type, m3u8Content) {
  if (!m3u8Content) return '';

  // 广告关键字列表
  const adKeywords = [
    'sponsor',
    '/ad/',
    '/ads/',
    'advert',
    'advertisement',
    '/adjump',
    'redtraffic'
  ];

  // 按行分割M3U8内容
  const lines = m3u8Content.split('\\n');
  const filteredLines = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 跳过 #EXT-X-DISCONTINUITY 标识
    if (line.includes('#EXT-X-DISCONTINUITY')) {
      i++;
      continue;
    }

    // 如果是 EXTINF 行，检查下一行 URL 是否包含广告关键字
    if (line.includes('#EXTINF:')) {
      // 检查下一行 URL 是否包含广告关键字
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const containsAdKeyword = adKeywords.some(keyword =>
          nextLine.toLowerCase().includes(keyword.toLowerCase())
        );

        if (containsAdKeyword) {
          // 跳过 EXTINF 行和 URL 行
          i += 2;
          continue;
        }
      }
    }

    // 保留当前行
    filteredLines.push(line);
    i++;
  }

  return filteredLines.join('\\n');
}`;

  // 保存配置
  const saveConfig = async () => {
    try {
      await withLoading('saveAdFilterConfig', async () => {
        // 获取当前配置
        const configResponse = await fetch('/api/admin/config');
        const data = await configResponse.json();

        // 合并现有配置和去广告配置
        const payload = {
          ...data.Config?.SiteConfig,
          CustomAdFilterCode: filterSettings.CustomAdFilterCode,
          CustomAdFilterVersion: filterSettings.CustomAdFilterVersion,
        };

        const saveResponse = await fetch('/api/admin/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            data.Config
              ? { ...data.Config, SiteConfig: payload }
              : { SiteConfig: payload },
          ),
        });

        if (!saveResponse.ok) {
          const errorData = await saveResponse.json().catch(() => ({}));
          throw new Error(errorData.error || '保存失败');
        }

        showMessage('success', '去广告配置保存成功');
        setHasChanges(false);
        if (refreshConfig) {
          refreshConfig();
        }
      });
    } catch (error) {
      showMessage('error', '保存失败: ' + (error as Error).message);
    }
  };

  // 重置配置（仅重置输入框，不保存）
  const handleReset = () => {
    setFilterSettings({
      CustomAdFilterCode: '',
      CustomAdFilterVersion: 1,
    });
  };

  // 恢复默认配置并保存到数据库
  const handleRestoreDefault = async () => {
    try {
      await withLoading('restoreAdFilterConfig', async () => {
        // 获取当前配置
        const configResponse = await fetch('/api/admin/config');
        const data = await configResponse.json();

        // 合并现有配置，重置去广告配置
        const payload = {
          ...data.Config?.SiteConfig,
          CustomAdFilterCode: '',
          CustomAdFilterVersion: 1,
        };

        const saveResponse = await fetch('/api/admin/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            data.Config
              ? { ...data.Config, SiteConfig: payload }
              : { SiteConfig: payload },
          ),
        });

        if (!saveResponse.ok) {
          const errorData = await saveResponse.json().catch(() => ({}));
          throw new Error(errorData.error || '恢复默认失败');
        }

        setFilterSettings({
          CustomAdFilterCode: '',
          CustomAdFilterVersion: 1,
        });

        showMessage('success', '已恢复为默认配置');
        setHasChanges(false);
        if (refreshConfig) {
          refreshConfig();
        }
      });
    } catch (error) {
      showMessage('error', '恢复默认失败: ' + (error as Error).message);
    }
  };

  // 使用示例
  const useExample = () => {
    setFilterSettings({
      ...filterSettings,
      CustomAdFilterCode: defaultExample,
    });
  };

  // 验证代码
  const validateCode = (code: string): string[] => {
    const errors = [];

    // 检查是否包含必需的函数
    if (!code.includes('function filterAdsFromM3U8')) {
      errors.push('必须包含 filterAdsFromM3U8 函数');
    }

    // 检查是否包含危险的代码
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /setTimeout\s*\(/,
      /setInterval\s*\(/,
      /XMLHttpRequest/,
      /fetch\s*\(/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        errors.push('代码包含不安全的操作');
        break;
      }
    }

    return errors;
  };

  const codeErrors = validateCode(filterSettings.CustomAdFilterCode);

  return (
    <div className='p-6'>
      {isLoading('loadAdFilterConfig') ? (
        <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
          加载中...
        </div>
      ) : (
        <div className='space-y-6'>
          {/* 警告信息 */}
          <div className='bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4'>
            <div className='flex items-start space-x-3'>
              <Info className='w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5' />
              <div className='text-sm text-purple-800 dark:text-purple-200'>
                <p className='font-medium mb-1'>使用说明：</p>
                <ul className='list-disc list-inside space-y-1 text-xs'>
                  <li>必须定义 filterAdsFromM3U8(type, m3u8Content) 函数</li>
                  <li>type 参数：当前播放源类型</li>
                  <li>m3u8Content 参数：M3U8 内容字符串</li>
                  <li>返回过滤后的 M3U8 内容</li>
                  <li>代码会在沙箱环境中执行</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 版本号 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              规则版本号
            </label>
            <input
              type='number'
              min='1'
              value={filterSettings.CustomAdFilterVersion}
              onChange={(e) =>
                setFilterSettings({
                  ...filterSettings,
                  CustomAdFilterVersion: parseInt(e.target.value) || 1,
                })
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent'
            />
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
              版本号用于缓存管理，修改代码后请递增版本号
            </p>
          </div>

          {/* 代码编辑器 */}
          <div>
            <div className='flex items-center justify-between mb-2'>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                自定义过滤代码
              </label>
              <button
                onClick={useExample}
                className='text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300'
              >
                使用示例
              </button>
            </div>
            <div className='relative'>
              <textarea
                value={filterSettings.CustomAdFilterCode}
                onChange={(e) =>
                  setFilterSettings({
                    ...filterSettings,
                    CustomAdFilterCode: e.target.value,
                  })
                }
                placeholder='输入自定义去广告代码...'
                className='w-full h-64 px-3 py-2 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent'
                spellCheck={false}
              />
              {codeErrors.length > 0 && (
                <div className='absolute top-2 right-2'>
                  <AlertTriangle className='w-5 h-5 text-red-500' />
                </div>
              )}
            </div>

            {/* 错误提示 */}
            {codeErrors.length > 0 && (
              <div className='mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3'>
                <div className='flex items-start space-x-2'>
                  <AlertTriangle className='w-4 h-4 text-red-600 dark:text-red-400 mt-0.5' />
                  <div className='text-sm text-red-800 dark:text-red-200'>
                    {codeErrors.map((error, index) => (
                      <p key={index} className='mb-1'>
                        {error}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 字符计数 */}
            <div className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
              字符数: {filterSettings.CustomAdFilterCode.length}
            </div>
          </div>

          {/* 消息提示 */}
          {message && (
            <div
              className={`flex items-center gap-2 p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle className='w-5 h-5 shrink-0' />
              ) : (
                <AlertCircle className='w-5 h-5 shrink-0' />
              )}
              <span className='text-sm'>{message.text}</span>
            </div>
          )}

          {/* 操作按钮 */}
          <div className='flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4'>
            <div className='flex items-center space-x-3'>
              <button
                onClick={handleReset}
                disabled={isLoading('saveAdFilterConfig')}
                className='px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2'
              >
                <RotateCcw className='w-4 h-4' />
                <span>重置</span>
              </button>
              <button
                onClick={handleRestoreDefault}
                disabled={isLoading('restoreAdFilterConfig')}
                className='px-4 py-2 text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-700 hover:bg-orange-200 dark:hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
              >
                恢复默认
              </button>
              {hasChanges && (
                <span className='text-sm text-orange-600 dark:text-orange-400'>
                  有未保存的更改
                </span>
              )}
            </div>
            <button
              onClick={saveConfig}
              disabled={
                isLoading('saveAdFilterConfig') ||
                codeErrors.length > 0 ||
                !hasChanges
              }
              className='px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2'
            >
              <Save className='w-4 h-4' />
              <span>
                {isLoading('saveAdFilterConfig') ? '保存中...' : '保存配置'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 导出组件
export default function CustomAdFilterConfig({
  config,
  refreshConfig,
}: {
  config?: {
    SiteConfig?: {
      CustomAdFilterCode?: string;
      CustomAdFilterVersion?: number;
    };
  };
  refreshConfig?: () => void;
}) {
  return (
    <CustomAdFilterConfigContent
      config={config}
      refreshConfig={refreshConfig}
    />
  );
}
