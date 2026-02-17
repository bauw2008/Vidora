import dynamic from 'next/dynamic';

interface PageLayoutProps {
  children: React.ReactNode;
  activePath?: string;
}

// 导航栏骨架屏组件
const NavSkeleton = () => {
  return (
    <nav
      className='fixed top-0 left-0 right-0 z-50 h-12 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-sm transition-all duration-300 translate-y-0'
      aria-hidden='true'
    >
      <div className='h-full px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between items-center h-full'>
          {/* Logo骨架 */}
          <div className='flex items-center flex-none'>
            <div className='h-7 w-28 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-md animate-pulse'></div>
          </div>

          {/* 桌面导航菜单骨架 */}
          <div className='hidden md:flex items-center justify-center flex-1 gap-1'>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className='h-8 w-16 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg animate-pulse'
                style={{ animationDelay: `${i * 100}ms` }}
              ></div>
            ))}
          </div>

          {/* 右侧功能按钮骨架 */}
          <div className='flex items-center space-x-2 flex-none'>
            <div className='h-8 w-8 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-full animate-pulse'></div>
            <div className='h-8 w-8 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-full animate-pulse'></div>
            <div className='h-8 w-8 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-full animate-pulse'></div>
          </div>
        </div>
      </div>
    </nav>
  );
};

// 动态导入TopNav，禁用SSR以避免hydration错误
const TopNav = dynamic(() => import('./TopNav'), {
  ssr: false,
  loading: () => <NavSkeleton />,
});

const PageLayout = ({ children, activePath = '/' }: PageLayoutProps) => {
  return (
    <div className='w-full min-h-screen' style={{ background: 'transparent' }}>
      {/* 顶部导航 - 动态加载，避免hydration错误 */}
      <TopNav activePath={activePath} />

      {/* 主内容区域 */}
      <div
        className='relative min-w-0 flex-1 transition-all duration-300'
        style={{ background: 'transparent' }}
      >
        {/* 主内容 */}
        <main
          className='flex-1 md:min-h-0 mt-25 px-2 md:px-4 lg:px-[3rem] 2xl:px-20'
          style={{
            paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default PageLayout;
