'use client';

import { Moon, Sun } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme, resolvedTheme } = useTheme();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  const setThemeColor = (theme?: string) => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = theme === 'dark' ? '#0c111c' : '#f9fbfe';
      document.head.appendChild(meta);
    } else {
      meta.setAttribute('content', theme === 'dark' ? '#0c111c' : '#f9fbfe');
    }
  };

  // 只在客户端挂载时设置 mounted
  useEffect(() => {
    requestAnimationFrame(() => {
      setMounted(true);
    });
    setThemeColor(resolvedTheme);
  }, [resolvedTheme]);

  // 监听路由变化，确保主题色始终同步
  useEffect(() => {
    if (mounted) {
      setThemeColor(resolvedTheme);
    }
  }, [resolvedTheme, pathname, mounted]);

  const toggleTheme = () => {
    // 检查浏览器是否支持 View Transitions API
    const targetTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setThemeColor(targetTheme);
    const doc = document as unknown as {
      startViewTransition?: (callback: () => void) => void;
    };
    if (!doc.startViewTransition) {
      setTheme(targetTheme);
      return;
    }

    doc.startViewTransition(() => {
      setTheme(targetTheme);
    });
  };

  // 避免服务端渲染时不匹配
  if (!mounted) {
    return (
      <div
        className={`w-5 h-5 flex items-center justify-center cursor-pointer hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded transition-colors ${className || 'text-gray-600 dark:text-gray-300'}`}
        aria-label='Toggle theme'
      />
    );
  }

  return (
    <div
      onClick={toggleTheme}
      className={`w-5 h-5 flex items-center justify-center cursor-pointer hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded transition-colors ${className || 'text-gray-600 dark:text-gray-300'}`}
      aria-label='Toggle theme'
    >
      {resolvedTheme === 'dark' ? (
        <Sun className='w-5 h-5' />
      ) : (
        <Moon className='w-5 h-5' />
      )}
    </div>
  );
}
