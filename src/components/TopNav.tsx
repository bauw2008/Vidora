'use client';

import {
  AlertCircle,
  Bell,
  Box,
  Cat,
  Clover,
  Film,
  Home,
  PlayCircle,
  Radio,
  Search,
  Star,
  Tv,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { logger } from '@/lib/logger';
import { CURRENT_VERSION } from '@/lib/version';
import { checkForUpdates, UpdateStatus } from '@/lib/version_check';
import { useUserSettings } from '@/hooks/useUserSettings';

import { MenuSettings } from '@/types/menu';

// 类型定义
interface MenuItem {
  name?: string;
  label: string;
  path?: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

// 组件定义

import { useSite } from './SiteProvider';

// NotificationModal 组件（提取到组件外部避免在渲染期间创建）
interface NotificationModalProps {
  show: boolean;
  onClose: () => void;
  hasVersionUpdate: boolean;
  onClearVersionUpdate: () => void;
}

function NotificationModal({
  show,
  onClose,
  hasVersionUpdate,
  onClearVersionUpdate,
}: NotificationModalProps) {
  if (!show || !hasVersionUpdate) {
    return null;
  }

  return createPortal(
    <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4'>
      <div className='bg-white dark:bg-gray-900 rounded-xl shadow-lg max-w-lg w-full p-5 relative max-h-[80vh] overflow-y-auto border border-gray-200 dark:border-gray-700'>
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className='absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
        >
          <X className='w-5 h-5' />
        </button>
        {/* 标题 */}
        <div className='flex items-center gap-3 mb-4'>
          <div className='w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center'>
            <Bell className='w-5 h-5 text-white' />
          </div>
          <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
            提醒事项
          </h3>
        </div>
        {/* 内容区域 */}
        <div className='space-y-2'>
          {/* 版本更新提醒 */}
          {hasVersionUpdate && (
            <div className='flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors'>
              <div className='flex items-center gap-2 flex-1'>
                <AlertCircle className='w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0' />
                <span className='text-sm text-gray-900 dark:text-gray-100'>
                  版本更新
                </span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  localStorage.removeItem('last-version-check');
                  onClearVersionUpdate();
                }}
                className='text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 flex-shrink-0'
              >
                查看
              </button>
              <button
                onClick={onClearVersionUpdate}
                className='text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 ml-2'
                title='关闭'
              >
                <X className='w-4 h-4' />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

interface TopNavProps {
  activePath?: string;
}

const TopNav = ({ activePath: _activePath = '/' }: TopNavProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { siteName } = useSite();
  const { settings: userSettings } = useUserSettings();

  // 监听配置更新事件

  // 直接从全局运行时配置读取，避免复杂的 Context 状态管理
  const getMenuSettings = (): MenuSettings => {
    if (typeof window !== 'undefined') {
      // 客户端
      const config = (window as Window).RUNTIME_CONFIG;
      if (config?.MenuSettings) {
        return config.MenuSettings;
      }
    } else {
      // 服务端
    }
    // 服务端渲染时使用默认值，结构与实际配置一致
    return {
      showMovies: true,
      showTVShows: true,
      showAnime: true,
      showVariety: true,
      showLive: false,
      showTvbox: false,
      showShortDrama: false,
    };
  };

  const getCustomCategories = (): unknown[] => {
    if (typeof window !== 'undefined') {
      // 客户端
      const config = (window as Window).RUNTIME_CONFIG;
      if (config?.CUSTOM_CATEGORIES) {
        return config.CUSTOM_CATEGORIES;
      }
    } else {
      // 服务端
    }
    return [];
  };

  const menuSettings = getMenuSettings();
  const customCategories = getCustomCategories();

  // 构建菜单项
  const menuItems = (() => {
    const isMenuEnabled = (menuKey: keyof MenuSettings): boolean => {
      return menuSettings[menuKey];
    };

    const items: MenuItem[] = [];

    // 添加首页
    items.push({ icon: Home, label: '首页', href: '/' });

    // 根据配置添加菜单项
    if (isMenuEnabled('showMovies')) {
      items.push({ icon: Film, label: '电影', href: '/douban?type=movie' });
    }
    if (isMenuEnabled('showTVShows')) {
      items.push({ icon: Tv, label: '剧集', href: '/douban?type=tv' });
    }
    if (isMenuEnabled('showShortDrama')) {
      items.push({
        icon: PlayCircle,
        label: '短剧',
        href: '/shortdrama',
      });
    }
    if (isMenuEnabled('showAnime')) {
      items.push({ icon: Cat, label: '动漫', href: '/douban?type=anime' });
    }
    if (isMenuEnabled('showVariety')) {
      items.push({ icon: Clover, label: '综艺', href: '/douban?type=show' });
    }
    if (isMenuEnabled('showLive')) {
      items.push({ icon: Radio, label: '直播', href: '/live' });
    }
    if (isMenuEnabled('showTvbox')) {
      items.push({ icon: Box, label: '盒子', href: '/tvbox' });
    }

    // 检查自定义分类
    if (customCategories && customCategories.length > 0) {
      items.push({ icon: Star, label: '其他', href: '/douban?type=custom' });
    }

    // 添加收藏菜单
    items.push({ icon: Star, label: '收藏', href: '/favorites' });

    return items;
  })();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notifications, setNotifications] = useState({
    versionUpdate: { hasUpdate: false, version: '', count: 0 },
  });

  // 版本检查
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const updateStatus = await checkForUpdates();

        // 更新通知状态
        setNotifications((prev) => ({
          ...prev,
          versionUpdate: {
            hasUpdate: updateStatus === UpdateStatus.HAS_UPDATE,
            version: CURRENT_VERSION,
            count: updateStatus === UpdateStatus.HAS_UPDATE ? 1 : 0,
          },
        }));

        // 保存检查时间
        localStorage.setItem('lastVersionCheck', Date.now().toString());
      } catch (error) {
        logger.error('版本检查失败:', error);
      }
    };

    // 检查是否需要更新版本
    const shouldCheckVersion = () => {
      const lastCheck = localStorage.getItem('lastVersionCheck');
      if (!lastCheck) {
        return true; // 从未检查过
      }

      const hoursSinceLastCheck =
        (Date.now() - parseInt(lastCheck)) / (1000 * 60 * 60);
      return hoursSinceLastCheck >= 12; // 12小时后再次检查
    };

    // 立即检查（如果需要）
    if (shouldCheckVersion()) {
      checkUpdate();
    }

    // 设置定期检查（每12小时）
    const interval = setInterval(
      () => {
        checkUpdate();
      },
      12 * 60 * 60 * 1000,
    ); // 12小时

    return () => clearInterval(interval);
  }, []);

  // 滚动隐藏导航栏逻辑 - 只有回到顶部才显示
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleScroll = () => {
      const scrollTop = document.body.scrollTop;

      // 只在顶部显示，任何滚动都隐藏
      setIsVisible(scrollTop <= 0);
    };

    // 初始检查
    handleScroll();

    let ticking = false;
    const throttledHandleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    // 监听 BODY 元素的滚动
    document.body.addEventListener('scroll', throttledHandleScroll, {
      passive: true,
    });

    return () => {
      document.body.removeEventListener('scroll', throttledHandleScroll);
    };
  }, []);

  // 页面切换动画效果
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      // 使用 setTimeout 避免在 effect 中同步调用 setState
      const startTimer = setTimeout(() => {
        setIsPageTransitioning(true);
      }, 0);

      // 页面切换动画时长
      const endTimer = setTimeout(() => {
        setIsPageTransitioning(false);
        previousPathname.current = pathname;
      }, 300);

      return () => {
        clearTimeout(startTimer);
        clearTimeout(endTimer);
      };
    }
  }, [pathname]);

  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const fullPath = queryString ? `${pathname}?${queryString}` : pathname;

  const isActive = (href: string) => {
    // 解码URL以进行正确的比较
    const decodedActive = decodeURIComponent(fullPath);
    const decodedItemHref = decodeURIComponent(href);

    // 精确匹配
    if (decodedActive === decodedItemHref) {
      return true;
    }

    // 对于douban页面，检查type参数
    if (
      decodedItemHref.includes('type=') &&
      decodedActive.startsWith('/douban')
    ) {
      const typeMatch = decodedItemHref.split('type=')[1]?.split('&')[0];
      if (typeMatch && decodedActive.includes(`type=${typeMatch}`)) {
        return true;
      }
    }

    return false;
  };

  // 计算提醒状态
  const hasVersionUpdate = notifications.versionUpdate.hasUpdate;
  const hasAnyNotifications =
    userSettings.enableNotifications && hasVersionUpdate;

  // 清除版本更新通知
  const handleClearVersionUpdate = () => {
    setNotifications((prev) => ({
      ...prev,
      versionUpdate: {
        hasUpdate: false,
        version: '',
        count: 0,
      },
    }));
  };

  // 服务端渲染时返回空导航栏骨架，完全避免 hydration 不匹配
  if (typeof window === 'undefined') {
    return (
      <nav
        suppressHydrationWarning={true}
        className='fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out translate-y-0 scale-100 opacity-100'
        style={{ willChange: 'transform, opacity' }}
        aria-hidden='true'
      >
        {/* 透明背景层 */}
        <div className='relative mx-auto max-w-[92%] max-sm:max-w-full backdrop-blur-md shadow-lg shadow-black/10 dark:shadow-black/30 transition-all duration-500 bg-white/90 dark:bg-gray-900/90'>
          {/* 页面切换进度条 - 服务端渲染时宽度为0 */}
          <div className='absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-300 ease-out w-0'></div>
        </div>
        {/* 导航内容骨架 - 保持与客户端相同的DOM结构 */}
        <div className='relative mx-auto max-w-[92%] px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center h-12'>
            {/* Logo骨架 */}
            <div className='flex items-center flex-none'>
              <Link
                href='/'
                className='logo-container flex items-center space-x-3 group'
              >
                <div className='relative'>
                  <span className='text-xl sm:text-2xl font-bold text-gray-900 dark:text-white transition-all duration-300'>
                    {/* 站点名称骨架 - 使用与客户端完全相同的CSS类名 */}
                    <span className='inline-block bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600 bg-clip-text text-transparent transition-transform duration-500 group-hover:rotate-180'>
                      V
                    </span>
                    <span className='inline-block bg-gradient-to-r from-gray-700 via-gray-600 to-blue-500 dark:from-gray-200 dark:via-gray-300 dark:to-blue-400 bg-clip-text text-transparent transition-all duration-300 group-hover:from-gray-600 group-hover:via-blue-500 group-hover:to-blue-600 dark:group-hover:from-gray-100 dark:group-hover:via-blue-300 dark:group-hover:to-blue-500'>
                      i
                    </span>
                    <span className='inline-block bg-gradient-to-r from-gray-700 via-gray-600 to-blue-500 dark:from-gray-200 dark:via-gray-300 dark:to-blue-400 bg-clip-text text-transparent transition-all duration-300 group-hover:from-gray-600 group-hover:via-blue-500 group-hover:to-blue-600 dark:group-hover:from-gray-100 dark:group-hover:via-blue-300 dark:group-hover:to-blue-500'>
                      d
                    </span>
                    <span className='inline-block bg-gradient-to-r from-gray-700 via-gray-600 to-blue-500 dark:from-gray-200 dark:via-gray-300 dark:to-blue-400 bg-clip-text text-transparent transition-all duration-300 group-hover:from-gray-600 group-hover:via-blue-500 group-hover:to-blue-600 dark:group-hover:from-gray-100 dark:group-hover:via-blue-300 dark:group-hover:to-blue-500'>
                      o
                    </span>
                    <span className='inline-block bg-gradient-to-r from-gray-700 via-gray-600 to-blue-500 dark:from-gray-200 dark:via-gray-300 dark:to-blue-400 bg-clip-text text-transparent transition-all duration-300 group-hover:from-gray-600 group-hover:via-blue-500 group-hover:to-blue-600 dark:group-hover:from-gray-100 dark:group-hover:via-blue-300 dark:group-hover:to-blue-500'>
                      r
                    </span>
                    <span className='inline-block bg-gradient-to-r from-gray-700 via-gray-600 to-blue-500 dark:from-gray-200 dark:via-gray-300 dark:to-blue-400 bg-clip-text text-transparent transition-all duration-300 group-hover:from-gray-600 group-hover:via-blue-500 group-hover:to-blue-600 dark:group-hover:from-gray-100 dark:group-hover:via-blue-300 dark:group-hover:to-blue-500'>
                      a
                    </span>
                  </span>
                  {/* 名称下方装饰线 */}
                  <div className='absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-600 group-hover:w-full transition-all duration-300 rounded-full'></div>
                </div>
              </Link>
            </div>
            {/* 桌面导航菜单骨架 */}
            <div className='hidden md:flex items-center justify-center flex-1 gap-0.75'>
              {/* 菜单项骨架 - 完全匹配客户端结构 */}
              <Link
                href='/'
                className='relative flex items-center px-3 py-2 text-sm font-medium transition-all duration-300 group mr-0.75 rounded-lg overflow-hidden h-10 w-20'
              >
                {/* 悬停背景效果 */}
                <div className='absolute inset-0 rounded-lg transition-all duration-300 bg-gray-100 dark:bg-gray-800 opacity-0'></div>
                {/* 图标容器 */}
                <div className='relative mr-2'>
                  <div className='w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded-full'></div>
                </div>
                <span className='relative bg-gray-300 dark:bg-gray-600 text-transparent text-xs'>
                  首页
                </span>
              </Link>
              <a
                href='/douban?type=movie'
                className='relative flex items-center px-3 py-2 text-sm font-medium transition-all duration-300 group mr-0.75 rounded-lg overflow-hidden h-10 w-20'
              >
                {/* 悬停背景效果 */}
                <div className='absolute inset-0 rounded-lg transition-all duration-300 bg-gray-100 dark:bg-gray-800 opacity-0'></div>
                {/* 图标容器 */}
                <div className='relative mr-2'>
                  <div className='w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded-full'></div>
                </div>
                <span className='relative bg-gray-300 dark:bg-gray-600 text-transparent text-xs'>
                  电影
                </span>
              </a>
              <a
                href='/douban?type=tv'
                className='relative flex items-center px-3 py-2 text-sm font-medium transition-all duration-300 group mr-0.75 rounded-lg overflow-hidden h-10 w-20'
              >
                {/* 悬停背景效果 */}
                <div className='absolute inset-0 rounded-lg transition-all duration-300 bg-gray-100 dark:bg-gray-800 opacity-0'></div>
                {/* 图标容器 */}
                <div className='relative mr-2'>
                  <div className='w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded-full'></div>
                </div>
                <span className='relative bg-gray-300 dark:bg-gray-600 text-transparent text-xs'>
                  剧集
                </span>
              </a>
            </div>
            {/* 右侧功能按钮骨架 */}
            <div className='flex items-center space-x-2 flex-none'>
              <button
                type='button'
                className='h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full'
              ></button>
              <button
                type='button'
                className='h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full'
              ></button>
              <button
                type='button'
                className='h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full'
              ></button>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
      @keyframes card-shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .text-shimmer {
        background: linear-gradient(90deg, #374151 0%, #ffffff 50%, #374151 100%);
        background-size: 200% 100%;
        animation: card-shimmer 4s infinite linear;
        background-clip: text;
        -webkit-background-clip: text;
        color: transparent;
      }
      .dark .text-shimmer {
        background: linear-gradient(90deg, #6b7280 0%, #e5e7eb 50%, #6b7280 100%);
        background-size: 200% 100%;
        animation: card-shimmer 4s infinite linear;
        background-clip: text;
        -webkit-background-clip: text;
        color: transparent;
      }
      `,
        }}
      />{' '}
      <nav
        suppressHydrationWarning={true}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        } ${
          isPageTransitioning
            ? 'scale-[0.98] opacity-80'
            : 'scale-100 opacity-100'
        }`}
        style={{ willChange: 'transform, opacity' }}
      >
        {/* 透明背景层 */}
        <div
          className={`relative mx-auto max-w-[92%] max-sm:max-w-full backdrop-blur-md shadow-lg shadow-black/10 dark:shadow-black/30 transition-all duration-500 ${isVisible ? 'bg-white/90 dark:bg-gray-900/90' : ''}`}
        >
          {/* 页面切换进度条 */}
          <div
            className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-300 ease-out ${
              isPageTransitioning ? 'w-full' : 'w-0'
            }`}
          ></div>
        </div>
        <div className='relative mx-auto max-w-[92%] px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center h-12'>
            {/* Logo */}
            <div className='flex items-center flex-none'>
              <Link
                href='/'
                className='logo-container flex items-center space-x-3 group'
              >
                {/* 站点名称 */}
                <div className='relative'>
                  <span className='text-xl sm:text-2xl font-bold text-gray-900 dark:text-white transition-all duration-300'>
                    {(siteName || 'Vidora').split('').map((char, index) => {
                      if (index === 0) {
                        // 第一个字母：应用颜色和旋转效果
                        return (
                          <span
                            key={index}
                            className='inline-block bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600 bg-clip-text text-transparent transition-transform duration-500 group-hover:rotate-180'
                          >
                            {char}
                          </span>
                        );
                      }
                      return null;
                    })}
                    {/* 后续字母整体应用扫光效果 */}
                    <span className='inline-block text-shimmer'>
                      {(siteName || 'Vidora').slice(1)}
                    </span>
                  </span>

                  {/* 名称下方装饰线 */}
                  <div className='absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-600 group-hover:w-full transition-all duration-300 rounded-full'></div>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className='hidden md:flex items-center justify-center flex-1 gap-0.75'>
              {menuItems.map((item, _index) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative flex items-center px-3 py-2 text-sm font-medium transition-all duration-300 group mr-0.75 rounded-lg overflow-hidden ${
                      isActive(item.href)
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-blue-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 hover:shadow-md'
                    }`}
                  >
                    {/* 悬停背景效果 */}
                    <div
                      className={`absolute inset-0 rounded-lg transition-all duration-300 ${
                        isActive(item.href)
                          ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-blue-500/30 dark:border-blue-400/30'
                          : 'bg-gray-100 dark:bg-gray-800 opacity-0 group-hover:opacity-100 group-hover:scale-105'
                      }`}
                    ></div>

                    {/* 图标容器 */}
                    <div className='relative mr-2'>
                      {/* 图标 */}
                      <Icon
                        className={`relative w-4 h-4 transition-all duration-500 z-10 ${
                          isActive(item.href)
                            ? 'text-white drop-shadow-sm'
                            : (() => {
                                // 根据不同的菜单项设置不同的颜色
                                const colorMap: Record<string, string> = {
                                  '/': 'text-purple-500 dark:text-purple-400',
                                  '/douban?type=movie':
                                    'text-red-500 dark:text-red-400',
                                  '/douban?type=tv':
                                    'text-blue-500 dark:text-blue-400',
                                  '/douban?type=short-drama':
                                    'text-pink-500 dark:text-pink-400',
                                  '/douban?type=anime':
                                    'text-indigo-500 dark:text-indigo-400',
                                  '/douban?type=show':
                                    'text-orange-500 dark:text-orange-400',
                                  '/live': 'text-green-500 dark:text-green-400',
                                  '/tvbox': 'text-cyan-500 dark:text-cyan-400',
                                  '/favorites':
                                    'text-yellow-500 dark:text-yellow-400',
                                  '/douban?type=custom':
                                    'text-teal-500 dark:text-teal-400',
                                };
                                return (
                                  colorMap[item.href] ||
                                  'text-gray-500 dark:text-gray-400'
                                );
                              })()
                        } group-hover:rotate-12`}
                      />
                    </div>

                    {/* 文字 */}
                    <span
                      className={`relative transition-all duration-300 z-10 whitespace-nowrap text-sm ${
                        isActive(item.href)
                          ? 'text-blue-600 dark:text-blue-400 font-medium'
                          : 'text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                      }`}
                    >
                      {item.label}
                    </span>

                    {/* 激活状态指示器 */}
                    {isActive(item.href) && (
                      <div className='absolute -bottom-px left-1/2 -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full'></div>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Right side items */}
            <div className='flex items-center justify-end flex-none space-x-3 sm:space-x-4'>
              {/* Search icon */}
              <button
                onClick={() => router.push('/search')}
                className='group relative transition-all duration-200 flex items-center justify-center'
                title='搜索'
              >
                <Search className='w-5 h-5 text-blue-500 dark:text-blue-400 transition-transform duration-300 group-hover:rotate-90' />
              </button>

              {/* 主题切换按钮 */}
              <button
                className='group relative transition-all duration-200 flex items-center justify-center'
                title='切换主题'
              >
                <ThemeToggle className='w-5 h-5 text-blue-500 dark:text-blue-400 transition-transform duration-300 group-hover:rotate-90' />
              </button>

              {/* 提醒图标按钮 - 只在有通知时显示 */}
              {hasAnyNotifications && (
                <button
                  onClick={() => setShowNotificationModal(true)}
                  className='group relative transition-all duration-200 animate-pulse'
                  title='提醒'
                >
                  <Bell className='w-5 h-5 text-orange-500 dark:text-orange-400 transition-transform duration-300 group-hover:rotate-90' />
                  {/* 统一提醒徽章 */}
                  {(() => {
                    const totalCount = notifications.versionUpdate.count;

                    if (totalCount > 0) {
                      return (
                        <span className='absolute -top-0.5 -right-0.5 min-w-[16px] h-4 text-[10px] font-medium text-white bg-red-500 rounded-full flex items-center justify-center px-1 animate-pulse'>
                          {totalCount > 99 ? '99+' : totalCount}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </button>
              )}

              {/* 用户菜单 */}
              <UserMenu />

              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className='md:hidden transition-all duration-300'
              >
                <div className='w-6 h-6 flex flex-col justify-center space-y-1.5'>
                  {isMobileMenuOpen ? (
                    <>
                      <div className='w-6 h-0.5 bg-white dark:bg-white rounded-full'></div>
                      <div className='w-5 h-0.5 bg-white dark:bg-white rounded-full ml-auto'></div>
                      <div className='w-4 h-0.5 bg-white dark:bg-white rounded-full ml-auto'></div>
                    </>
                  ) : (
                    <>
                      <div className='w-6 h-0.5 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 rounded-full'></div>
                      <div className='w-5 h-0.5 bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-400 dark:to-purple-500 rounded-full ml-auto'></div>
                      <div className='w-4 h-0.5 bg-gradient-to-r from-pink-500 to-pink-600 dark:from-pink-400 dark:to-pink-500 rounded-full ml-auto'></div>
                    </>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div
            className={`md:hidden transition-all duration-500 ease-out overflow-hidden ${
              isMobileMenuOpen
                ? 'max-h-[80vh] opacity-100'
                : 'max-h-0 opacity-0'
            }`}
          >
            <div className='relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/20 dark:border-gray-700/20 overflow-hidden select-none'>
              <div className='relative px-3 pt-3 pb-4 space-y-1'>
                {menuItems.map((item, _index) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.href}
                      onClick={() => {
                        router.push(item.href);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`nav-item flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 relative overflow-hidden group ${
                        isActive(item.href)
                          ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-700 dark:from-blue-500/25 dark:to-purple-500/25 dark:text-blue-300 shadow-md shadow-blue-500/20 dark:shadow-blue-500/25 border border-blue-200/25 dark:border-blue-700/25'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800/50 hover:shadow-md hover:shadow-black/10 dark:hover:shadow-black/20'
                      }`}
                      style={{
                        animationDelay: isMobileMenuOpen
                          ? `${_index * 30}ms`
                          : '0ms',
                      }}
                    >
                      {/* 图标容器 */}
                      <div
                        className={`flex items-center justify-center w-7 h-7 rounded-md transition-all duration-300 mr-3 flex-shrink-0 ${
                          isActive(item.href)
                            ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-sm border border-blue-500/30 dark:border-blue-400/30 text-blue-600 dark:text-blue-400'
                            : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-gradient-to-br group-hover:from-indigo-400 group-hover:to-purple-500 group-hover:rotate-6'
                        }`}
                      >
                        {' '}
                        <Icon
                          className={`w-3.5 h-3.5 transition-all duration-300 group-hover:rotate-12 ${(() => {
                            // 根据不同的菜单项设置不同的颜色
                            const colorMap: Record<string, string> = {
                              '/': 'text-purple-500 dark:text-purple-400',
                              '/douban?type=movie':
                                'text-red-500 dark:text-red-400',
                              '/douban?type=tv':
                                'text-blue-500 dark:text-blue-400',
                              '/douban?type=short-drama':
                                'text-pink-500 dark:text-pink-400',
                              '/douban?type=anime':
                                'text-indigo-500 dark:text-indigo-400',
                              '/douban?type=show':
                                'text-orange-500 dark:text-orange-400',
                              '/live': 'text-green-500 dark:text-green-400',
                              '/tvbox': 'text-cyan-500 dark:text-cyan-400',
                              '/favorites':
                                'text-yellow-500 dark:text-yellow-400',
                              '/douban?type=custom':
                                'text-teal-500 dark:text-teal-400',
                            };
                            return (
                              colorMap[item.href] ||
                              'text-gray-500 dark:text-gray-400'
                            );
                          })()}`}
                        />
                      </div>

                      {/* 文字 */}
                      <span className='flex-1 text-left'>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <NotificationModal
          show={showNotificationModal}
          onClose={() => setShowNotificationModal(false)}
          hasVersionUpdate={hasVersionUpdate}
          onClearVersionUpdate={handleClearVersionUpdate}
        />
      </nav>
    </>
  );
};

export default TopNav;
