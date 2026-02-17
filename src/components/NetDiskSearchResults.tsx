'use client';

import {
  ClipboardIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';

import { logger } from '@/lib/logger';

interface NetDiskLink {
  url: string;
  password: string;
  note: string;
  datetime: string;
  source: string;
  images?: string[];
}

interface NetDiskSearchResultsProps {
  results: { [key: string]: NetDiskLink[] } | null;
  loading: boolean;
  error: string | null;
  total: number;
}

const CLOUD_TYPES = {
  baidu: {
    name: '百度网盘',
    color: 'bg-blue-500',
    icon: '📁',
    domain: 'pan.baidu.com',
  },
  aliyun: {
    name: '阿里云盘',
    color: 'bg-orange-500',
    icon: '☁️',
    domain: 'alipan.com',
  },
  quark: {
    name: '夸克网盘',
    color: 'bg-purple-500',
    icon: '⚡',
    domain: 'pan.quark.cn',
  },
  tianyi: {
    name: '天翼云盘',
    color: 'bg-red-500',
    icon: '📱',
    domain: 'cloud.189.cn',
  },
  uc: {
    name: 'UC网盘',
    color: 'bg-green-500',
    icon: '🌐',
    domain: 'drive.uc.cn',
  },
  mobile: {
    name: '移动云盘',
    color: 'bg-cyan-500',
    icon: '📲',
    domain: 'caiyun.139.com',
  },
  '115': {
    name: '115网盘',
    color: 'bg-gray-500',
    icon: '💾',
    domain: '115.com',
  },
  pikpak: {
    name: 'PikPak',
    color: 'bg-pink-500',
    icon: '📦',
    domain: 'mypikpak.com',
  },
  xunlei: {
    name: '迅雷网盘',
    color: 'bg-yellow-500',
    icon: '⚡',
    domain: 'pan.xunlei.com',
  },
  '123': {
    name: '123网盘',
    color: 'bg-indigo-500',
    icon: '🔢',
    domain: '123pan.com',
  },
  magnet: {
    name: '磁力链接',
    color: 'bg-black',
    icon: '🧲',
    domain: 'magnet:',
  },
  ed2k: {
    name: '电驴链接',
    color: 'bg-teal-500',
    icon: '🐴',
    domain: 'ed2k://',
  },
  others: { name: '其他', color: 'bg-gray-400', icon: '📄', domain: '' },
};

export default function NetDiskSearchResults({
  results,
  loading,
  error,
  total,
}: NetDiskSearchResultsProps) {
  const [visiblePasswords, setVisiblePasswords] = useState<{
    [key: string]: boolean;
  }>({});
  const [copiedItems, setCopiedItems] = useState<{ [key: string]: boolean }>(
    {},
  );
  const [selectedFilter, setSelectedFilter] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'selected'>('all');
  const [expandedTitles, setExpandedTitles] = useState<{
    [key: string]: boolean;
  }>({});
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());

  const togglePasswordVisibility = (key: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleTitleExpansion = (key: string) => {
    setExpandedTitles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItems((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedItems((prev) => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (err) {
      logger.error('复制失败:', err);
    }
  };

  // 筛选结果
  const filteredResults =
    results && filterMode === 'selected' && selectedFilter.length > 0
      ? Object.fromEntries(
          Object.entries(results).filter(([type]) =>
            selectedFilter.includes(type),
          ),
        )
      : results;

  // 快速跳转到指定网盘类型
  const scrollToCloudType = (type: string) => {
    const element = document.getElementById(`cloud-type-${type}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // 切换筛选标签
  const toggleFilterTag = (type: string) => {
    setSelectedFilter((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  // 切换网盘类型折叠状态
  const toggleTypeCollapse = (type: string) => {
    setCollapsedTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  // 获取有结果的网盘类型统计
  const availableTypes = results
    ? Object.entries(results)
        .map(([type, links]) => ({
          type,
          count: links.length,
          info:
            CLOUD_TYPES[type as keyof typeof CLOUD_TYPES] || CLOUD_TYPES.others,
        }))
        .sort((a, b) => b.count - a.count) // 按数量降序排列
    : [];

  if (loading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500'></div>
        <span className='ml-3 text-gray-600 dark:text-gray-300'>
          正在搜索网盘资源...
        </span>
      </div>
    );
  }

  if (error) {
    // 判断是否为功能未启用的错误
    const isFunctionDisabled =
      error.includes('未启用') ||
      error.includes('未配置') ||
      error.includes('配置不完整');

    return (
      <div
        className={`${
          isFunctionDisabled
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        } border rounded-lg p-4 animate-fade-in`}
      >
        <div className='flex items-start'>
          <div className='flex-shrink-0 mt-0.5'>
            {isFunctionDisabled ? (
              <svg
                className='h-5 w-5 text-blue-500'
                fill='currentColor'
                viewBox='0 0 20 20'
              >
                <path
                  fillRule='evenodd'
                  d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
                  clipRule='evenodd'
                />
              </svg>
            ) : (
              <svg
                className='h-5 w-5 text-red-400'
                viewBox='0 0 20 20'
                fill='currentColor'
              >
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM8.707 7.293a1 1 0 0 0-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 1 0 1.414 1.414L10 11.414l1.293 1.293a1 1 0 0 0 1.414-1.414L11.414 10l1.293-1.293a1 1 0 0 0-1.414-1.414L10 8.586 8.707 7.293z'
                  clipRule='evenodd'
                />
              </svg>
            )}
          </div>
          <div className='ml-3 flex-1'>
            <h3
              className={`text-sm font-medium ${
                isFunctionDisabled
                  ? 'text-blue-800 dark:text-blue-200'
                  : 'text-red-800 dark:text-red-200'
              }`}
            >
              {isFunctionDisabled ? '网盘搜索功能未启用' : '网盘搜索失败'}
            </h3>
            <div
              className={`mt-2 text-sm ${
                isFunctionDisabled
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-red-700 dark:text-red-300'
              }`}
            >
              {error}
            </div>

            {/* 用户友好的解决建议 */}
            <div
              className={`mt-3 p-3 ${
                isFunctionDisabled
                  ? 'bg-blue-100 dark:bg-blue-800/30'
                  : 'bg-red-100 dark:bg-red-800/30'
              } rounded-md`}
            >
              <div
                className={`text-xs ${
                  isFunctionDisabled
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                💡 <strong>解决方案：</strong>
                {isFunctionDisabled ? (
                  <div className='mt-1'>
                    • 联系管理员启用网盘搜索功能
                    <br />
                    • 管理员可在后台设置中配置PanSou服务地址
                    <br />• 暂时可以使用影视搜索功能查找内容
                  </div>
                ) : (
                  <div className='mt-1'>
                    • 检查网络连接是否正常
                    <br />
                    • 稍后重试或使用不同关键词搜索
                    <br />• 如问题持续，请联系管理员检查服务状态
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!results || Object.keys(results).length === 0) {
    return (
      <div className='text-center py-12'>
        <div className='mx-auto h-12 w-12 text-gray-400'>
          <svg fill='none' viewBox='0 0 24 24' stroke='currentColor'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0 1 12 15c-2.206 0-4.206.896-5.656 2.344M6.343 6.343A8 8 0 1 1 17.657 17.657 8 8 0 016.343 6.343z'
            />
          </svg>
        </div>
        <h3 className='mt-2 text-sm font-medium text-gray-900 dark:text-gray-100'>
          未找到相关资源
        </h3>
        <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
          尝试使用其他关键词搜索
        </p>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {/* 可折叠的筛选栏 */}
      <div className='rounded-xl border-2 border-purple-200 dark:border-purple-800 overflow-hidden'>
        {/* 筛选栏标题 - 可点击折叠/展开 */}
        <button
          onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          className='w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-700 dark:to-pink-700 text-white flex items-center justify-between hover:opacity-95 transition-opacity'
        >
          <div className='flex items-center space-x-3 flex-1'>
            <span className='text-xl'>🎯</span>
            <span className='font-semibold'>快速筛选</span>
            <span className='text-sm bg-white/20 px-2 py-0.5 rounded-full'>
              {availableTypes.length} 种类型
            </span>
          </div>
          <div className='flex items-center space-x-3'>
            <span
              onClick={(e) => {
                e.stopPropagation();
                setFilterMode(filterMode === 'all' ? 'selected' : 'all');
                if (filterMode === 'selected') {
                  setSelectedFilter([]);
                }
              }}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                filterMode === 'selected'
                  ? 'bg-white text-purple-600 shadow-md'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {filterMode === 'all' ? '显示全部' : '仅显示选中'}
            </span>
            <svg
              className={`w-5 h-5 transition-transform ${
                isFilterExpanded ? 'rotate-180' : ''
              }`}
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M19 9l-7 7-7-7'
              />
            </svg>
          </div>
        </button>

        {/* 可折叠的筛选内容 */}
        {isFilterExpanded && (
          <div className='p-4 bg-purple-50 dark:bg-purple-900/20'>
            {/* 网盘类型标签 - 显示图标+文字 */}
            <div className='flex flex-wrap gap-2'>
              {availableTypes.map(({ type, count, info }) => (
                <button
                  key={type}
                  onClick={() => {
                    if (filterMode === 'all') {
                      scrollToCloudType(type);
                    } else {
                      toggleFilterTag(type);
                    }
                  }}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-md border transition-all hover:scale-105 ${
                    filterMode === 'selected' && selectedFilter.includes(type)
                      ? `${info.color} text-gray-900 dark:text-gray-100 border-transparent shadow-lg`
                      : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500 text-gray-700 dark:text-gray-300'
                  }`}
                  title={filterMode === 'all' ? '点击跳转' : '点击筛选'}
                >
                  <div className='flex items-center space-x-1.5 flex-1 min-w-0'>
                    <span className='text-base flex-shrink-0'>{info.icon}</span>
                    <span className='text-xs font-medium truncate'>
                      {info.name}
                    </span>
                  </div>
                  <span
                    className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-bold ${
                      filterMode === 'selected' && selectedFilter.includes(type)
                        ? 'bg-white/20 text-gray-900 dark:text-gray-100'
                        : 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 搜索结果统计 */}
      <div className='rounded-xl border-2 border-blue-200 dark:border-blue-800 p-4 bg-blue-50 dark:bg-blue-900/20'>
        <div className='flex items-center space-x-2 text-sm text-blue-700 dark:text-blue-300'>
          <span className='text-lg'>📊</span>
          <span>
            {filterMode === 'selected' && selectedFilter.length > 0 ? (
              <>
                显示{' '}
                <strong>{Object.keys(filteredResults || {}).length}</strong>{' '}
                种筛选的网盘类型 (总共 <strong>{total}</strong> 个资源)
              </>
            ) : (
              <>
                共找到 <strong>{total}</strong> 个网盘资源，覆盖{' '}
                <strong>{Object.keys(results).length}</strong> 种网盘类型
              </>
            )}
          </span>
        </div>
      </div>

      {/* 按网盘类型分组展示 */}
      {Object.entries(filteredResults || {}).map(([type, links]) => {
        const cloudType =
          CLOUD_TYPES[type as keyof typeof CLOUD_TYPES] || CLOUD_TYPES.others;
        const isCollapsed = collapsedTypes.has(type);

        return (
          <div
            key={type}
            id={`cloud-type-${type}`}
            className='rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden scroll-mt-24'
          >
            {/* 网盘类型头部 */}
            <button
              onClick={() => toggleTypeCollapse(type)}
              className={`w-full bg-gradient-to-r ${cloudType.color} px-4 py-2 flex items-center justify-between text-white hover:opacity-95 transition-opacity`}
            >
              <div className='flex items-center space-x-2'>
                <span className='text-lg'>{cloudType.icon}</span>
                <h3 className='font-medium text-sm'>{cloudType.name}</h3>
                <span className='text-xs bg-white/20 px-2 py-0.5 rounded-full'>
                  {links.length}
                </span>
              </div>
              <svg
                className={`w-5 h-5 transition-transform ${
                  isCollapsed ? '-rotate-90' : ''
                }`}
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M19 9l-7 7-7-7'
                />
              </svg>
            </button>

            {/* 链接列表 */}
            {!isCollapsed && (
              <div className='divide-y divide-gray-200 dark:divide-gray-700 bg-gray-50 dark:bg-gray-900/50'>
                {links.map((link, index) => {
                  const linkKey = `${type}-${index}`;
                  const isPasswordVisible = visiblePasswords[linkKey];
                  const isTitleExpanded = expandedTitles[linkKey];
                  const title = link.note || '未命名资源';

                  return (
                    <div
                      key={index}
                      className='p-4 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors'
                    >
                      <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-3 sm:space-y-0'>
                        <div className='flex-1 min-w-0'>
                          {/* 资源标题 */}
                          <div className='mb-3'>
                            <h4 className='text-sm font-semibold text-gray-900 dark:text-gray-100 break-words pr-2'>
                              {/* 移动端：点击展开/收起 */}
                              <span
                                className='block sm:hidden cursor-pointer'
                                onClick={() => toggleTitleExpansion(linkKey)}
                              >
                                {title.length > 30
                                  ? isTitleExpanded
                                    ? title
                                    : `${title.substring(0, 30)}...`
                                  : title}
                              </span>
                              {/* PC端：显示完整，限制行数 */}
                              <span
                                className='hidden sm:block line-clamp-2'
                                title={title}
                              >
                                {title}
                              </span>
                            </h4>
                          </div>

                          {/* 链接和密码 */}
                          <div className='space-y-2'>
                            <div className='flex items-start space-x-2'>
                              <svg
                                className='h-4 w-4 text-purple-500 flex-shrink-0 mt-0.5'
                                fill='currentColor'
                                viewBox='0 0 20 20'
                              >
                                <path d='M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z' />
                                <path d='M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z' />
                              </svg>
                              <div className='flex-1 min-w-0'>
                                <code className='text-xs bg-gray-200 dark:bg-gray-800 px-2 py-1.5 rounded font-mono break-all block w-full text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700'>
                                  <span className='block sm:hidden'>
                                    {link.url.length > 40
                                      ? `${link.url.substring(0, 40)}...`
                                      : link.url}
                                  </span>
                                  <span className='hidden sm:block'>
                                    {link.url}
                                  </span>
                                </code>
                              </div>
                              <button
                                onClick={() =>
                                  copyToClipboard(link.url, `url-${linkKey}`)
                                }
                                className={`p-1.5 transition-colors flex-shrink-0 rounded-md hover:bg-purple-200 dark:hover:bg-purple-800 ${
                                  copiedItems[`url-${linkKey}`]
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-purple-500 hover:text-purple-700 dark:hover:text-purple-300'
                                }`}
                                title={
                                  copiedItems[`url-${linkKey}`]
                                    ? '已复制'
                                    : '复制链接'
                                }
                              >
                                {copiedItems[`url-${linkKey}`] ? (
                                  <svg
                                    className='h-4 w-4'
                                    fill='currentColor'
                                    viewBox='0 0 20 20'
                                  >
                                    <path
                                      fillRule='evenodd'
                                      d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                                      clipRule='evenodd'
                                    />
                                  </svg>
                                ) : (
                                  <ClipboardIcon className='h-4 w-4' />
                                )}
                              </button>
                            </div>

                            {link.password && (
                              <div className='flex items-start space-x-2'>
                                <svg
                                  className='h-4 w-4 text-purple-500 flex-shrink-0 mt-0.5'
                                  fill='currentColor'
                                  viewBox='0 0 20 20'
                                >
                                  <path
                                    fillRule='evenodd'
                                    d='M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z'
                                    clipRule='evenodd'
                                  />
                                </svg>
                                <div className='flex-1 min-w-0'>
                                  <code className='text-xs bg-gray-200 dark:bg-gray-800 px-2 py-1.5 rounded font-mono block text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700'>
                                    {isPasswordVisible ? link.password : '****'}
                                  </code>
                                </div>
                                <div className='flex items-center space-x-1 flex-shrink-0'>
                                  <button
                                    onClick={() =>
                                      togglePasswordVisibility(linkKey)
                                    }
                                    className='p-1.5 text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 transition-colors rounded-md hover:bg-purple-200 dark:hover:bg-purple-800'
                                    title={
                                      isPasswordVisible
                                        ? '隐藏密码'
                                        : '显示密码'
                                    }
                                  >
                                    {isPasswordVisible ? (
                                      <EyeSlashIcon className='h-4 w-4' />
                                    ) : (
                                      <EyeIcon className='h-4 w-4' />
                                    )}
                                  </button>
                                  <button
                                    onClick={() =>
                                      copyToClipboard(
                                        link.password,
                                        `pwd-${linkKey}`,
                                      )
                                    }
                                    className={`p-1.5 transition-colors rounded-md hover:bg-purple-200 dark:hover:bg-purple-800 ${
                                      copiedItems[`pwd-${linkKey}`]
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-purple-500 hover:text-purple-700 dark:hover:text-purple-300'
                                    }`}
                                    title={
                                      copiedItems[`pwd-${linkKey}`]
                                        ? '已复制'
                                        : '复制密码'
                                    }
                                  >
                                    {copiedItems[`pwd-${linkKey}`] ? (
                                      <svg
                                        className='h-4 w-4'
                                        fill='currentColor'
                                        viewBox='0 0 20 20'
                                      >
                                        <path
                                          fillRule='evenodd'
                                          d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                                          clipRule='evenodd'
                                        />
                                      </svg>
                                    ) : (
                                      <ClipboardIcon className='h-4 w-4' />
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 元信息 */}
                          <div className='mt-3 flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 text-xs text-gray-600 dark:text-gray-400'>
                            <span className='truncate'>
                              来源: {link.source}
                            </span>
                            <span className='truncate'>
                              时间:{' '}
                              {new Date(link.datetime).toLocaleString('zh-CN')}
                            </span>
                          </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className='sm:ml-4 flex-shrink-0'>
                          <a
                            href={link.url}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='inline-flex items-center px-4 py-2 border-2 border-purple-500 rounded-lg text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors w-full sm:w-auto justify-center hover:scale-105'
                          >
                            <svg
                              className='w-4 h-4 mr-2'
                              fill='none'
                              stroke='currentColor'
                              viewBox='0 0 24 24'
                            >
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
                              />
                            </svg>
                            访问链接
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
