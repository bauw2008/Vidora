'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';

import { notifyConfigUpdated } from '@/lib/global-config';
import { logger } from '@/lib/logger';
import { useAdminLoading } from '@/hooks/admin/useAdminLoading';
import { useToastNotification } from '@/hooks/admin/useToastNotification';

import { menuLabels, MenuSettings } from '@/types/menu';

interface SiteConfigSettings {
  SiteName: string;
  Announcement: string;
  SearchDownstreamMaxPage: number;
  SiteInterfaceCacheTime: number;
  DoubanProxyType: string;
  DoubanProxy: string;
  DoubanImageProxyType: string;
  DoubanImageProxy: string;
  DisableYellowFilter: boolean;
  FluidSearch: boolean;
  TMDBApiKey?: string;
  TMDBLanguage?: string;
  EnableTMDBActorSearch?: boolean;
  EnableTMDBPosters?: boolean;
  MenuSettings: MenuSettings;
}

// menuLabels 现在从 @/types/menu 导入

const doubanDataSourceOptions = [
  { value: 'direct', label: '直连（服务器直接请求豆瓣）' },
  { value: 'cors-proxy-zwei', label: 'Cors Proxy By Zwei' },
  {
    value: 'cmliussss-cdn-tencent',
    label: '豆瓣 CDN By CMLiussss（腾讯云）',
  },
  { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云）' },
  { value: 'custom', label: '自定义代理' },
];

const doubanImageProxyTypeOptions = [
  { value: 'direct', label: '直连（浏览器直接请求豆瓣）' },
  { value: 'server', label: '服务器代理（由服务器代理请求豆瓣）' },
  { value: 'img3', label: '豆瓣官方精品 CDN（阿里云）' },
  {
    value: 'cmliussss-cdn-tencent',
    label: '豆瓣 CDN By CMLiussss（腾讯云）',
  },
  { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云）' },
  { value: 'baidu-image', label: '百度图片代理' },
  { value: 'custom', label: '自定义代理' },
];

function SiteConfigContent() {
  // 使用统一接口
  const { isLoading } = useAdminLoading();
  const { showError, showSuccess } = useToastNotification();

  // 站点配置状态
  const [siteSettings, setSiteSettings] = useState<SiteConfigSettings>({
    SiteName: process.env.NEXT_PUBLIC_SITE_NAME || '',
    Announcement: process.env.ANNOUNCEMENT || '',
    SearchDownstreamMaxPage: 1,
    SiteInterfaceCacheTime: 7200,
    DoubanProxyType: 'direct',
    DoubanProxy: '',
    DoubanImageProxyType: 'direct',
    DoubanImageProxy: '',
    DisableYellowFilter: false,
    FluidSearch: true,
    TMDBLanguage: 'zh-CN',
    EnableTMDBActorSearch: false,
    EnableTMDBPosters: true,
    MenuSettings: {
      showMovies: true,
      showTVShows: true,
      showAnime: true,
      showVariety: true,
      showLive: false,
      showTvbox: false,
      showShortDrama: false,
    },
  });

  // 下拉框状态
  const [isDoubanDropdownOpen, setIsDoubanDropdownOpen] = useState(false);
  const [isDoubanImageProxyDropdownOpen, setIsDoubanImageProxyDropdownOpen] =
    useState(false);

  // 只在组件挂载时加载一次配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/admin/config', {
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
          cache: 'no-store',
        });
        const data = await response.json();

        if (data.Config?.SiteConfig) {
          const siteConfigData = data.Config.SiteConfig;

          setSiteSettings({
            SiteName: siteConfigData.SiteName || '',
            Announcement: siteConfigData.Announcement ?? '',
            SearchDownstreamMaxPage:
              siteConfigData.SearchDownstreamMaxPage || 1,
            SiteInterfaceCacheTime:
              siteConfigData.SiteInterfaceCacheTime || 7200,
            DoubanProxyType: siteConfigData.DoubanProxyType || 'direct',
            DoubanProxy: siteConfigData.DoubanProxy || '',
            DoubanImageProxyType:
              siteConfigData.DoubanImageProxyType || 'direct',
            DoubanImageProxy: siteConfigData.DoubanImageProxy || '',
            DisableYellowFilter: siteConfigData.DisableYellowFilter || false,
            FluidSearch:
              siteConfigData.FluidSearch !== undefined
                ? siteConfigData.FluidSearch
                : true,
            TMDBApiKey: siteConfigData.TMDBApiKey || '',
            TMDBLanguage: siteConfigData.TMDBLanguage || 'zh-CN',
            EnableTMDBActorSearch:
              siteConfigData.EnableTMDBActorSearch || false,
            EnableTMDBPosters: siteConfigData.EnableTMDBPosters || true,
            MenuSettings: {
              showMovies: siteConfigData.MenuSettings?.showMovies ?? true,
              showTVShows: siteConfigData.MenuSettings?.showTVShows ?? true,
              showAnime: siteConfigData.MenuSettings?.showAnime ?? true,
              showVariety: siteConfigData.MenuSettings?.showVariety ?? true,
              showLive: siteConfigData.MenuSettings?.showLive ?? false,
              showTvbox: siteConfigData.MenuSettings?.showTvbox ?? false,
              showShortDrama:
                siteConfigData.MenuSettings?.showShortDrama ?? false,
            },
          });
        }
      } catch (error) {
        logger.error('加载站点配置失败:', error);
        showError('加载站点配置失败');
      }
    };

    loadConfig();
    // 空依赖数组，只在挂载时执行一次
  }, [showError]);

  const saveConfig = async () => {
    try {
      // 更新菜单设置，只包含导航菜单相关的字段
      const updatedMenuSettings = {
        showMovies: siteSettings.MenuSettings.showMovies,
        showTVShows: siteSettings.MenuSettings.showTVShows,
        showAnime: siteSettings.MenuSettings.showAnime,
        showVariety: siteSettings.MenuSettings.showVariety,
        showLive: siteSettings.MenuSettings.showLive,
        showTvbox: siteSettings.MenuSettings.showTvbox,
        showShortDrama: siteSettings.MenuSettings.showShortDrama,
      };

      // 确保所有必需字段都存在
      const requiredData = {
        SiteName: siteSettings.SiteName || '',
        Announcement: siteSettings.Announcement || '',
        SearchDownstreamMaxPage: siteSettings.SearchDownstreamMaxPage || 1,
        SiteInterfaceCacheTime: siteSettings.SiteInterfaceCacheTime || 7200,
        DoubanProxyType: siteSettings.DoubanProxyType || 'direct',
        DoubanProxy: siteSettings.DoubanProxy || '',
        DoubanImageProxyType: siteSettings.DoubanImageProxyType || 'direct',
        DoubanImageProxy: siteSettings.DoubanImageProxy || '',
        DisableYellowFilter: siteSettings.DisableYellowFilter || false,
        FluidSearch: siteSettings.FluidSearch || false,
        MenuSettings: updatedMenuSettings,
      };

      const response = await fetch('/api/admin/site', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requiredData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('API错误响应:', errorData);
        throw new Error(errorData.error || '保存失败');
      }

      showSuccess('站点配置保存成功');

      // 通知其他窗口重新获取配置（但不自动更新本地 RUNTIME_CONFIG）
      notifyConfigUpdated();
    } catch (error) {
      logger.error('保存站点配置失败:', error);
      showError('保存失败: ' + (error as Error).message);
    }
  };

  // 切换菜单显示状态
  const handleToggleMenu = (menuKey: keyof MenuSettings) => {
    const newMenuSettings = {
      ...siteSettings.MenuSettings,
      [menuKey]: !siteSettings.MenuSettings[menuKey],
    };

    // 只更新本地状态，不触发全局配置更新
    setSiteSettings((prev) => ({
      ...prev,
      MenuSettings: newMenuSettings,
    }));
  };

  // 处理豆瓣数据源变化
  const handleDoubanDataSourceChange = (value: string) => {
    setSiteSettings((prev) => ({
      ...prev,
      DoubanProxyType: value,
    }));
  };

  // 处理豆瓣图片代理变化
  const handleDoubanImageProxyChange = (value: string) => {
    setSiteSettings((prev) => ({
      ...prev,
      DoubanImageProxyType: value,
    }));
  };

  return (
    <div className='p-6'>
      {isLoading('api_/api/admin/config') ? (
        <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
          加载中...
        </div>
      ) : (
        <div className='space-y-6'>
          {/* 站点名称 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              站点名称
            </label>
            <input
              type='text'
              value={siteSettings.SiteName}
              onChange={(e) =>
                setSiteSettings((prev) => ({
                  ...prev,
                  SiteName: e.target.value,
                }))
              }
              className='w-full px-4 py-2.5 border border-cyan-200/60 dark:border-cyan-600/60 rounded-lg bg-cyan-50/80 dark:bg-cyan-900/30 backdrop-blur-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all duration-200'
              placeholder='请输入站点名称'
            />
          </div>

          {/* 站点公告 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              站点公告
            </label>
            <textarea
              value={siteSettings.Announcement}
              onChange={(e) =>
                setSiteSettings((prev) => ({
                  ...prev,
                  Announcement: e.target.value,
                }))
              }
              rows={3}
              className='w-full px-4 py-2.5 border border-cyan-200/60 dark:border-cyan-600/60 rounded-lg bg-cyan-50/80 dark:bg-cyan-900/30 backdrop-blur-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all duration-200 resize-none'
              placeholder='请输入站点公告内容'
            />
          </div>

          {/* 导航菜单显示 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>
              菜单显示
            </label>
            <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'>
              {Object.entries(siteSettings.MenuSettings || {}).map(
                ([key, value]) => (
                  <div
                    key={key}
                    className='flex items-center justify-between p-3 border border-cyan-200/60 dark:border-cyan-600/60 rounded-lg bg-cyan-50/80 dark:bg-cyan-900/30 backdrop-blur-sm cursor-pointer hover:bg-cyan-100/80 dark:hover:bg-cyan-900/50 transition-all duration-200'
                    onClick={() => handleToggleMenu(key as keyof MenuSettings)}
                  >
                    <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                      {menuLabels[key as keyof MenuSettings]}
                    </span>
                    <input
                      type='checkbox'
                      checked={value}
                      onChange={() => {}}
                      className='sr-only'
                    />
                    <div
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${
                        value ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                          value ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* 豆瓣数据源设置 */}
          <div className='space-y-3'>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                豆瓣数据代理
              </label>
              <div className='relative' data-dropdown='douban-datasource'>
                <button
                  type='button'
                  onClick={() => setIsDoubanDropdownOpen(!isDoubanDropdownOpen)}
                  className='w-full px-4 py-2.5 pr-10 border border-cyan-200/60 dark:border-cyan-600/60 rounded-lg text-sm bg-cyan-50/80 dark:bg-cyan-900/30 backdrop-blur-sm text-gray-900 dark:text-gray-100 hover:bg-cyan-100/80 dark:hover:bg-cyan-900/50 transition-all duration-200 text-left'
                >
                  {
                    doubanDataSourceOptions.find(
                      (option) => option.value === siteSettings.DoubanProxyType,
                    )?.label
                  }
                </button>
                <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
                      isDoubanDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>
                {isDoubanDropdownOpen && (
                  <div className='absolute z-50 w-full mt-1 bg-cyan-50/95 dark:bg-cyan-900/50 backdrop-blur-sm border border-cyan-200/60 dark:border-cyan-600/60 rounded-lg shadow-lg max-h-60 overflow-auto'>
                    {doubanDataSourceOptions.map((option) => (
                      <button
                        key={option.value}
                        type='button'
                        onClick={() => {
                          handleDoubanDataSourceChange(option.value);
                          setIsDoubanDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-gray-100/70 dark:hover:bg-gray-700/70 ${
                          siteSettings.DoubanProxyType === option.value
                            ? 'bg-blue-50/70 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        <span className='truncate'>{option.label}</span>
                        {siteSettings.DoubanProxyType === option.value && (
                          <Check className='w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2' />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 豆瓣代理地址设置 */}
            {siteSettings.DoubanProxyType === 'custom' && (
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  豆瓣代理地址
                </label>
                <input
                  type='text'
                  placeholder='例如: https://proxy.example.com/fetch?url='
                  value={siteSettings.DoubanProxy}
                  onChange={(e) =>
                    setSiteSettings((prev) => ({
                      ...prev,
                      DoubanProxy: e.target.value,
                    }))
                  }
                  className='w-full px-4 py-2.5 border border-cyan-200/60 dark:border-cyan-600/60 rounded-lg text-sm bg-cyan-50/80 dark:bg-cyan-900/30 backdrop-blur-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 hover:bg-cyan-100/80 dark:hover:bg-cyan-900/50 transition-all duration-200'
                />{' '}
              </div>
            )}
          </div>

          {/* 豆瓣图片代理设置 */}
          <div className='space-y-3'>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                豆瓣图片代理
              </label>
              <div className='relative' data-dropdown='douban-image-proxy'>
                <button
                  type='button'
                  onClick={() =>
                    setIsDoubanImageProxyDropdownOpen(
                      !isDoubanImageProxyDropdownOpen,
                    )
                  }
                  className='w-full px-4 py-2.5 pr-10 border border-cyan-200/60 dark:border-cyan-600/60 rounded-lg text-sm bg-cyan-50/80 dark:bg-cyan-900/30 backdrop-blur-sm text-gray-900 dark:text-gray-100 hover:bg-cyan-100/80 dark:hover:bg-cyan-900/50 transition-all duration-200 text-left'
                >
                  {
                    doubanImageProxyTypeOptions.find(
                      (option) =>
                        option.value === siteSettings.DoubanImageProxyType,
                    )?.label
                  }
                </button>
                <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
                      isDoubanImageProxyDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>
                {isDoubanImageProxyDropdownOpen && (
                  <div className='absolute z-50 w-full mt-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200/60 dark:border-gray-600/60 rounded-lg shadow-lg max-h-60 overflow-auto'>
                    {doubanImageProxyTypeOptions.map((option) => (
                      <button
                        key={option.value}
                        type='button'
                        onClick={() => {
                          handleDoubanImageProxyChange(option.value);
                          setIsDoubanImageProxyDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-gray-100/70 dark:hover:bg-gray-700/70 ${
                          siteSettings.DoubanImageProxyType === option.value
                            ? 'bg-blue-50/70 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        <span className='truncate'>{option.label}</span>
                        {siteSettings.DoubanImageProxyType === option.value && (
                          <Check className='w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2' />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 豆瓣图片代理地址设置 */}
            {siteSettings.DoubanImageProxyType === 'custom' && (
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  豆瓣图片代理地址
                </label>
                <input
                  type='text'
                  placeholder='例如: https://proxy.example.com/image?url='
                  value={siteSettings.DoubanImageProxy}
                  onChange={(e) =>
                    setSiteSettings((prev) => ({
                      ...prev,
                      DoubanImageProxy: e.target.value,
                    }))
                  }
                  className='w-full px-4 py-2.5 border border-gray-200/60 dark:border-gray-600/60 rounded-lg text-sm bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 hover:bg-white/50 dark:hover:bg-gray-800/50 transition-all duration-200'
                />
              </div>
            )}
          </div>

          {/* 其他设置 */}
          <div className='space-y-4'>
            {/* 搜索接口可拉取最大页数 */}
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                搜索接口可拉取最大页数
              </label>
              <input
                type='number'
                min={1}
                value={siteSettings.SearchDownstreamMaxPage}
                onChange={(e) =>
                  setSiteSettings((prev) => ({
                    ...prev,
                    SearchDownstreamMaxPage: Number(e.target.value),
                  }))
                }
                className='w-full px-4 py-2.5 border border-cyan-200/60 dark:border-cyan-600/60 rounded-lg bg-cyan-50/80 dark:bg-cyan-900/30 backdrop-blur-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all duration-200'
              />
            </div>

            {/* 接口缓存时间 */}
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                接口缓存时间（秒）
              </label>
              <input
                type='number'
                min='300'
                max='86400'
                value={siteSettings.SiteInterfaceCacheTime}
                onChange={(e) =>
                  setSiteSettings((prev) => ({
                    ...prev,
                    SiteInterfaceCacheTime: parseInt(e.target.value) || 7200,
                  }))
                }
                className='w-full px-4 py-2.5 border border-cyan-200/60 dark:border-cyan-600/60 rounded-lg bg-cyan-50/80 dark:bg-cyan-900/30 backdrop-blur-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all duration-200'
              />
            </div>

            {/* 流式搜索 */}
            <div className='flex items-center space-x-3 p-3 border border-cyan-200/60 dark:border-cyan-600/60 rounded-lg bg-cyan-50/70 dark:bg-cyan-900/25 backdrop-blur-sm'>
              <input
                type='checkbox'
                id='fluidSearch'
                checked={siteSettings.FluidSearch}
                onChange={(e) =>
                  setSiteSettings((prev) => ({
                    ...prev,
                    FluidSearch: e.target.checked,
                  }))
                }
                className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700'
              />
              <label
                htmlFor='fluidSearch'
                className='text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer'
              >
                启用流式搜索
              </label>
            </div>
          </div>

          {/* 保存按钮 */}
          <div className='flex justify-end'>
            <button
              onClick={saveConfig}
              disabled={isLoading('api_/api/admin/site')}
              className='px-6 py-2.5 bg-blue-500/80 hover:bg-blue-600/80 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 backdrop-blur-sm border border-white/20'
            >
              {isLoading('api_/api/admin/site') ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 导出组件
function SiteConfig() {
  return <SiteConfigContent />;
}

export default SiteConfig;
