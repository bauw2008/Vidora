'use client';

import { ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { logger } from '@/lib/logger';
import {
  useAdminAuth,
  useAdminLoading,
  useToastNotification,
} from '@/hooks/admin';

interface TMDBSettings {
  TMDBApiKey: string;
  TMDBLanguage: string;
  EnableTMDBActorSearch: boolean;
  EnableTMDBPosters: boolean;
}

const languageOptions = [
  { value: 'zh-CN', label: '中文（简体）' },
  { value: 'zh-TW', label: '中文（繁体）' },
  { value: 'en-US', label: '英语' },
  { value: 'ja-JP', label: '日语' },
  { value: 'ko-KR', label: '韩语' },
];

function TMDBConfigContent() {
  const { loading, error, isAdminOrOwner } = useAdminAuth();
  const { isLoading, withLoading } = useAdminLoading();
  const { showError, showSuccess } = useToastNotification();

  // TMDB配置状态 - 使用合理的默认值
  const [tmdbSettings, setTmdbSettings] = useState<TMDBSettings>({
    TMDBApiKey: '',
    TMDBLanguage: 'zh-CN',
    EnableTMDBActorSearch: false,
    EnableTMDBPosters: false,
  });

  // 使用 ref 来存储最新的 withLoading 和 showError
  const withLoadingRef = useRef(withLoading);
  const showErrorRef = useRef(showError);

  // 更新 ref 的值
  useEffect(() => {
    withLoadingRef.current = withLoading;
    showErrorRef.current = showError;
  });

  // 初始化加载 - 只在组件挂载时执行一次
  useEffect(() => {
    const loadConfig = async () => {
      try {
        await withLoadingRef.current('loadTMDBConfig', async () => {
          const response = await fetch('/api/admin/config');
          const data = await response.json();

          if (data.Config?.SiteConfig) {
            setTmdbSettings({
              TMDBApiKey: data.Config.SiteConfig.TMDBApiKey || '',
              TMDBLanguage: data.Config.SiteConfig.TMDBLanguage || 'zh-CN',
              EnableTMDBActorSearch:
                data.Config.SiteConfig.EnableTMDBActorSearch || false,
              EnableTMDBPosters:
                data.Config.SiteConfig.EnableTMDBPosters || false,
            });
          }
        });
      } catch (error) {
        logger.error('加载TMDB配置失败:', error);
        showErrorRef.current('加载TMDB配置失败');
      }
    };

    loadConfig();
  }, []); // 空依赖数组，只在组件挂载时执行一次

  // 加载状态
  if (loading) {
    return (
      <div className='p-6 text-center text-gray-500'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2'></div>
        <p>验证权限中...</p>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className='p-6 text-center text-red-500'>
        <h2 className='text-xl font-semibold mb-2'>权限验证失败</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!isAdminOrOwner) {
    return (
      <div className='p-6 text-center text-red-500'>
        <h2 className='text-xl font-semibold mb-2'>访问受限</h2>
        <p>您没有权限访问TMDB配置功能</p>
      </div>
    );
  }

  const saveConfig = async () => {
    try {
      await withLoading('saveTMDBConfig', async () => {
        const response = await fetch('/api/admin/tmdb-config', {
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(tmdbSettings),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || '保存失败');
        }
        showSuccess('TMDB配置保存成功');
      });
    } catch (error) {
      showError('保存失败: ' + (error as Error).message);
    }
  };

  return (
    <div className='p-6'>
      {isLoading('loadTMDBConfig') ? (
        <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
          加载中...
        </div>
      ) : (
        <div className='space-y-6'>
          {/* TMDB API Key */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              TMDB API Key
            </label>
            <input
              type='password'
              value={tmdbSettings.TMDBApiKey || ''}
              onChange={(e) =>
                setTmdbSettings((prev) => ({
                  ...prev,
                  TMDBApiKey: e.target.value,
                }))
              }
              placeholder='请输入TMDB API Key'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              请在{' '}
              <a
                href='https://www.themoviedb.org/settings/api'
                target='_blank'
                rel='noopener noreferrer'
                className='text-blue-500 hover:text-blue-600 inline-flex items-center'
              >
                TMDB 官网
                <ExternalLink size={12} className='ml-1' />
              </a>{' '}
              申请免费的 API Key
            </p>
          </div>

          {/* TMDB 语言配置 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              TMDB 语言
            </label>
            <select
              value={tmdbSettings.TMDBLanguage || 'zh-CN'}
              onChange={(e) =>
                setTmdbSettings((prev) => ({
                  ...prev,
                  TMDBLanguage: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              选择TMDB数据返回的语言，影响搜索结果和显示内容
            </p>
          </div>

          {/* 功能开关 */}
          <div className='space-y-4'>
            {/* 启用TMDB演员搜索 */}
            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  启用 TMDB 演员搜索
                </label>
                <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                  启用后用户可以在搜索页面按演员名字搜索相关影视作品
                </p>
              </div>
              <button
                type='button'
                onClick={() =>
                  setTmdbSettings((prev) => ({
                    ...prev,
                    EnableTMDBActorSearch: !prev.EnableTMDBActorSearch,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  tmdbSettings.EnableTMDBActorSearch
                    ? 'bg-green-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    tmdbSettings.EnableTMDBActorSearch
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 启用TMDB横屏海报 */}
            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  启用 TMDB 横屏海报
                </label>
                <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                  启用后首页轮播将使用TMDB横屏海报，提供更佳的视觉效果
                </p>
              </div>
              <button
                type='button'
                onClick={() =>
                  setTmdbSettings((prev) => ({
                    ...prev,
                    EnableTMDBPosters: !prev.EnableTMDBPosters,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  tmdbSettings.EnableTMDBPosters
                    ? 'bg-green-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    tmdbSettings.EnableTMDBPosters
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 保存按钮 */}
          <div className='flex justify-end'>
            <button
              onClick={saveConfig}
              disabled={isLoading('saveTMDBConfig')}
              className='px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50'
            >
              {isLoading('saveTMDBConfig') ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TMDBConfig() {
  return <TMDBConfigContent />;
}

export default TMDBConfig;
