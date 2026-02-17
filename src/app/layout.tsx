import type { Metadata, Viewport } from 'next';

import './globals.css';

import { clearConfigCache, getConfig } from '@/lib/config';

import { GlobalErrorIndicator } from '../components/GlobalErrorIndicator';
import { SiteProvider } from '../components/SiteProvider';
import { ThemeProvider } from '../components/ThemeProvider';
import ToastContainer from '../components/ToastContainer';

export const dynamic = 'force-dynamic';

// 动态生成 metadata，支持配置更新后的标题变化
export async function generateMetadata(): Promise<Metadata> {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  const config = await getConfig();
  let siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Vidora';
  if (storageType !== 'localstorage' && config?.SiteConfig) {
    siteName = config.SiteConfig.SiteName;
  }

  return {
    title: siteName,
    description: '影视聚合',
    manifest: '/manifest.json',
  };
}

export const viewport: Viewport = {
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  let siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Vidora';
  let announcement =
    process.env.ANNOUNCEMENT ||
    '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。';

  let doubanProxyType =
    process.env.NEXT_PUBLIC_DOUBAN_PROXY_TYPE || 'cmliussss-cdn-tencent';
  let doubanProxy = process.env.NEXT_PUBLIC_DOUBAN_PROXY || '';
  let doubanImageProxyType =
    process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE || 'cmliussss-cdn-tencent';
  let doubanImageProxy = process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY || '';
  let disableYellowFilter =
    process.env.NEXT_PUBLIC_DISABLE_YELLOW_FILTER === 'true';
  let fluidSearch = process.env.NEXT_PUBLIC_FLUID_SEARCH !== 'false';
  let customAdFilterVersion = 0;
  let customCategories = [] as {
    name: string;
    type: 'movie' | 'tv';
    query: string;
  }[];
  if (storageType !== 'localstorage') {
    clearConfigCache(); // 清除配置缓存，确保获取最新菜单配置
    const config = await getConfig();

    // 检查配置是否为 null
    if (config?.SiteConfig) {
      siteName = config.SiteConfig.SiteName;
      announcement = config.SiteConfig.Announcement;

      doubanProxyType = config.SiteConfig.DoubanProxyType;
      doubanProxy = config.SiteConfig.DoubanProxy;
      doubanImageProxyType = config.SiteConfig.DoubanImageProxyType;
      doubanImageProxy = config.SiteConfig.DoubanImageProxy;
      disableYellowFilter = config.SiteConfig.DisableYellowFilter;
      customCategories = (config.CustomCategories || [])
        .filter((category) => !category.disabled)
        .map((category) => ({
          name: category.name || '',
          type: category.type,
          query: category.query,
        }));
      fluidSearch = config.SiteConfig.FluidSearch;
      customAdFilterVersion = config.SiteConfig?.CustomAdFilterVersion || 0;
    }
  }

  // 获取完整配置用于 runtimeConfig
  let netDiskConfig = { enabled: false };
  let aiConfig = { enabled: false };
  let tmdbConfig = {
    apiKey: '',
    language: 'zh-CN',
    enableActorSearch: false,
    enablePosters: false, // 默认关闭，需要配置API Key后手动开启
  };

  if (storageType !== 'localstorage') {
    const config = await getConfig();
    if (config?.SiteConfig) {
      netDiskConfig = config.NetDiskConfig || { enabled: false };
      aiConfig = config.AIRecommendConfig || { enabled: false };
      tmdbConfig = {
        apiKey: config.SiteConfig.TMDBApiKey || '',
        language: config.SiteConfig.TMDBLanguage || 'zh-CN',
        enableActorSearch: config.SiteConfig.EnableTMDBActorSearch || false,
        enablePosters: config.SiteConfig.EnableTMDBPosters ?? true,
      };
    }
  }

  // 获取菜单配置
  let menuSettings = {
    showMovies: true,
    showTVShows: true,
    showAnime: true,
    showVariety: true,
    showLive: true,
    showTvbox: true,
    showShortDrama: true,
  };

  if (storageType !== 'localstorage') {
    const config = await getConfig();
    if (config?.SiteConfig?.MenuSettings) {
      menuSettings = config.SiteConfig.MenuSettings;
    }
  }

  // 将运行时配置注入到全局 window 对象，供客户端在运行时读取
  const runtimeConfig = {
    STORAGE_TYPE: process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage',
    USERNAME: process.env.USERNAME || '',
    DOUBAN_PROXY_TYPE: doubanProxyType,
    DOUBAN_PROXY: doubanProxy,
    DOUBAN_IMAGE_PROXY_TYPE: doubanImageProxyType,
    DOUBAN_IMAGE_PROXY: doubanImageProxy,
    DISABLE_YELLOW_FILTER: disableYellowFilter,
    CUSTOM_CATEGORIES: customCategories,
    FLUID_SEARCH: fluidSearch,
    CUSTOM_AD_FILTER_VERSION: customAdFilterVersion,
    NetDiskConfig: netDiskConfig,
    AIConfig: aiConfig,
    TMDBConfig: tmdbConfig,
    MenuSettings: menuSettings,
    SiteName: siteName,
    __DISABLED_MENUS: {
      showLive: menuSettings.showLive === false,
      showTvbox: menuSettings.showTvbox === false,
      showShortDrama: menuSettings.showShortDrama === false,
      showMovies: menuSettings.showMovies === false,
      showTVShows: menuSettings.showTVShows === false,
      showAnime: menuSettings.showAnime === false,
      showVariety: menuSettings.showVariety === false,
    },
  };

  return (
    <html lang='zh-CN'>
      <head>
        <meta
          name='viewport'
          content='width=device-width, initial-scale=1.0, viewport-fit=cover'
        />
        <link rel='apple-touch-icon' href='/icons/icon-192x192.png' />
        {/* 将配置序列化后直接写入脚本，浏览器端可通过 window.RUNTIME_CONFIG 获取 */}
        {}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.RUNTIME_CONFIG = ${JSON.stringify(runtimeConfig)}; window.__DISABLED_MENUS = ${JSON.stringify(runtimeConfig.__DISABLED_MENUS)};`,
          }}
        />
      </head>
      <body className='min-h-screen bg-white text-gray-900 dark:bg-black dark:text-gray-200 font-sans'>
        <ThemeProvider
          attribute='class'
          defaultTheme='system'
          enableSystem
          disableTransitionOnChange
        >
          <SiteProvider siteName={siteName} announcement={announcement}>
            {children}
            <GlobalErrorIndicator />
            <ToastContainer />
          </SiteProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
