'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { logger } from '@/lib/logger';

import { CapsuleSelector } from '@/components/CapsuleSelector';
import PageLayout from '@/components/PageLayout';

// 动态导入所有组件
const ConfigFileDynamic = dynamic(
  () => import('@/components/admin/tools/ConfigFile'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const SiteConfigDynamic = dynamic(
  () => import('@/components/admin/config/SiteConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const UserConfigDynamic = dynamic(
  () => import('@/components/admin/config/UserConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const VideoConfigDynamic = dynamic(
  () => import('@/components/admin/config/VideoConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const LiveConfigDynamic = dynamic(
  () => import('@/components/admin/config/LiveConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const CategoryConfigDynamic = dynamic(
  () => import('@/components/admin/config/CategoryConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const YellowConfigDynamic = dynamic(
  () => import('@/components/admin/config/YellowConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const TMDBConfigDynamic = dynamic(
  () => import('@/components/admin/config/TMDBConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const AIConfigDynamic = dynamic(
  () => import('@/components/admin/config/AIConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const TVBoxConfigDynamic = dynamic(
  () => import('@/components/admin/config/TVBoxConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const NetdiskConfigDynamic = dynamic(
  () => import('@/components/admin/config/NetdiskConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const AdFilterConfigDynamic = dynamic(
  () => import('@/components/admin/config/AdFilterConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const CacheManagerDynamic = dynamic(
  () => import('@/components/admin/tools/CacheManager'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const DataMigrationDynamic = dynamic(
  () => import('@/components/admin/tools/DataMigration'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const OwnerConfigDynamic = dynamic(
  () => import('@/components/admin/config/OwnerConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const ShortDramaConfigDynamic = dynamic(
  () => import('@/components/admin/config/ShortDramaConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const DanmuApiConfigDynamic = dynamic(
  () => import('@/components/admin/config/DanmuApiConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);

// 配置项数据
const configCategories = {
  basic: {
    name: '基础服务',
    items: [
      { id: 'configFile', name: '订阅配置', component: ConfigFileDynamic },
      { id: 'siteConfig', name: '站点配置', component: SiteConfigDynamic },
      { id: 'userConfig', name: '用户配置', component: UserConfigDynamic },
      { id: 'videoConfig', name: '视频采集', component: VideoConfigDynamic },
      {
        id: 'categoryConfig',
        name: '豆瓣扩展',
        component: CategoryConfigDynamic,
      },
    ],
  },
  content: {
    name: '内容管理',
    items: [
      { id: 'liveConfig', name: '直播配置', component: LiveConfigDynamic },
      {
        id: 'shortDramaConfig',
        name: '短剧API',
        component: ShortDramaConfigDynamic,
      },
      {
        id: 'danmuApiConfig',
        name: '弹幕API',
        component: DanmuApiConfigDynamic,
      },
      { id: 'yellowConfig', name: '18+过滤', component: YellowConfigDynamic },
    ],
  },
  service: {
    name: '服务配置',
    items: [
      { id: 'tmdbConfig', name: 'TMDB配置', component: TMDBConfigDynamic },
      { id: 'aiConfig', name: 'AI配置', component: AIConfigDynamic },
      { id: 'tvboxConfig', name: 'TVBox配置', component: TVBoxConfigDynamic },
      {
        id: 'netdiskConfig',
        name: '网盘搜索',
        component: NetdiskConfigDynamic,
      },
      {
        id: 'adFilterConfig',
        name: 'AD过滤',
        component: AdFilterConfigDynamic,
      },
    ],
  },
  tools: {
    name: '系统工具',
    items: [
      { id: 'cacheManager', name: '缓存管理', component: CacheManagerDynamic },
      {
        id: 'dataMigration',
        name: '数据迁移',
        component: DataMigrationDynamic,
      },
    ],
  },
  owner: {
    name: '站长管理',
    items: [
      { id: 'ownerConfig', name: '站长配置', component: OwnerConfigDynamic },
    ],
  },
};

function AdminContent() {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const isClient = typeof window !== 'undefined';
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [activeCategory, setActiveCategory] =
    useState<keyof typeof configCategories>('basic');
  const [activeItem, setActiveItem] = useState<string>('configFile');

  useEffect(() => {
    // 单次权限验证
    const checkAccess = async () => {
      if (typeof window === 'undefined') return;

      // 先使用客户端cookie判断
      const authInfo = getAuthInfoFromBrowserCookie();
      const hasRole = authInfo?.role === 'admin' || authInfo?.role === 'owner';
      setHasAccess(hasRole || false);

      // 异步验证服务器权限，但不改变页面状态
      fetch('/api/admin/config')
        .then(async (res) => {
          if (!res.ok) {
            if (res.status === 401) {
              logger.warn('无权限访问管理页面');
            } else {
              logger.warn('服务器验证失败:', res.status);
            }
            return;
          }
          const data = await res.json();
          // 只在服务器确认权限时更新，失败时不改变
          if (data.Role) {
            startTransition(() => {
              setHasAccess(true);
            });
          }
        })
        .catch((error) => {
          logger.warn('权限验证网络错误:', error);
        });
    };
    checkAccess();
  }, []);

  // 无权限跳转逻辑
  useEffect(() => {
    if (isClient && hasAccess === false) {
      const timer = setTimeout(() => {
        router.push('/');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isClient, hasAccess, router]);

  // 在客户端渲染之前，显示加载状态
  if (!isClient || hasAccess === null) {
    return (
      <div className='flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-600 dark:text-gray-400'>验证权限中...</span>
      </div>
    );
  }

  // 无权限状态
  if (!hasAccess) {
    return (
      <div className='flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900'>
        <div className='text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg'>
          <div className='text-6xl mb-4'>🔒</div>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2'>
            无权限访问
          </h1>
          <p className='text-gray-600 dark:text-gray-400 mb-4'>
            您没有权限访问管理中心
          </p>
          <p className='text-sm text-gray-500 dark:text-gray-500'>
            3秒后自动跳转到首页...
          </p>
        </div>
      </div>
    );
  }

  // 获取当前选中的组件
  const currentCategory = configCategories[activeCategory];
  const currentItem = currentCategory.items.find(
    (item) => item.id === activeItem,
  );
  const CurrentComponent = currentItem?.component;

  return (
    <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible'>
      {/* 页面标题 */}
      <div className='mb-6 sm:mb-8 space-y-4 sm:space-y-6'>
        <div>
          <h1 className='text-2xl sm:text-3xl font-bold text-gray-800 mb-1 sm:mb-2 dark:text-gray-200'>
            管理中心
          </h1>
          <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400'>
            配置和管理您的站点
          </p>
        </div>
      </div>

      {/* 筛选器区域 */}
      <div className='relative bg-gradient-to-br from-white/80 via-blue-50/30 to-purple-50/30 dark:from-gray-800/60 dark:via-blue-900/20 dark:to-purple-900/20 rounded-2xl p-4 sm:p-6 border border-blue-200/40 dark:border-blue-700/40 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 mb-6'>
        {/* 装饰性光晕 */}
        <div className='absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-blue-300/20 to-purple-300/20 rounded-full blur-3xl pointer-events-none'></div>
        <div className='absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-green-300/20 to-teal-300/20 rounded-full blur-3xl pointer-events-none'></div>

        <div className='relative space-y-4'>
          {/* 分类选择器 */}
          <CapsuleSelector
            label='分类'
            options={Object.entries(configCategories).map(([key, value]) => ({
              label: value.name,
              value: key,
            }))}
            value={activeCategory}
            onChange={(value) => {
              startTransition(() => {
                setActiveCategory(value as keyof typeof configCategories);
                // 自动选择第一个项目
                const firstItem =
                  configCategories[value as keyof typeof configCategories]
                    .items[0];
                if (firstItem) {
                  setActiveItem(firstItem.id);
                }
              });
            }}
            enableVirtualScroll={true}
          />

          {/* 项目选择器 */}
          <CapsuleSelector
            label='类型'
            options={currentCategory.items.map((item) => ({
              label: item.name,
              value: item.id,
            }))}
            value={activeItem}
            onChange={(value) =>
              startTransition(() => setActiveItem(String(value)))
            }
            enableVirtualScroll={true}
          />
        </div>
      </div>

      {/* 内容展示区域 */}
      <div className='max-w-7xl mx-auto rounded-2xl shadow-sm border border-gray-200/30 dark:border-gray-700/30'>
        {CurrentComponent && <CurrentComponent />}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <PageLayout activePath='/admin'>
      <AdminContent />
    </PageLayout>
  );
}
