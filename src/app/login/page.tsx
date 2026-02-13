'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>('');
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { siteName } = useSite();

  // 只在客户端生成 URL，避免水合错误
  useEffect(() => {
    const url = `https://picture.bauw.dpdns.org/api/random?t=${Date.now()}`;
    const img = document.createElement('img');

    img.onload = () => {
      setBackgroundImageUrl(url);
    };

    img.onerror = () => {
      // 加载失败也尝试显示
      setBackgroundImageUrl(url);
    };

    img.src = url;
  }, []);

  // 点击或触摸后显示登录窗口
  useEffect(() => {
    const handleInteraction = () => {
      if (!showLoginForm) {
        setShowLoginForm(true);
        setTimeout(() => setIsAnimating(true), 50);
      }
    };

    // 只监听一次用户交互
    document.addEventListener('click', handleInteraction, { once: true });
    document.addEventListener('touchstart', handleInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, [showLoginForm]);

  // 登录成功后跳转 - 检查实际的认证状态
  useEffect(() => {
    const checkAuthAndRedirect = () => {
      const auth = getAuthInfoFromBrowserCookie();
      // 只有在已登录且没有错误时才跳转
      if (auth && !error && !isLoading) {
        const redirect = searchParams.get('redirect') || '/';
        router.replace(redirect);
      }
    };
    // 延迟检查，确保 cookie 已被浏览器保存
    const timer = setTimeout(checkAuthAndRedirect, 100);
    return () => clearTimeout(timer);
  }, [error, isLoading, router, searchParams]);

  return (
    <div className='relative min-h-screen flex items-center justify-center px-4 overflow-hidden'>
      {/* 🔥 底层：海洋蓝色渐变 - 营造深海氛围 */}
      <div className='absolute inset-0 bg-gradient-to-b from-cyan-100 via-blue-200 to-blue-300 dark:from-slate-800 dark:via-blue-900 dark:to-slate-900' />{' '}
      {/* 🔥 中层：海洋琉璃效果 - 图片加载前显示 */}
      {isBackgroundLoading && (
        <div className='absolute inset-0 backdrop-blur-3xl bg-gradient-to-b from-cyan-300/20 via-blue-400/30 to-blue-500/20 z-[1]' />
      )}
      {/* 🔥 顶层：真实图片 - 渐进显示 */}
      {backgroundImageUrl && (
        <Image
          src={backgroundImageUrl}
          alt='Background'
          fill
          priority
          className={`object-cover transition-all duration-700 z-[2] ${
            isBackgroundLoading
              ? 'opacity-0 scale-105 blur-lg'
              : 'opacity-100 scale-100 blur-0'
          }`}
          style={{
            filter: isBackgroundLoading
              ? 'brightness(0.7) blur(20px)'
              : 'brightness(0.7)',
            willChange: 'opacity, transform, filter',
          }}
          onLoad={() => setIsBackgroundLoading(false)}
          unoptimized
        />
      )}
      {/* 🔥 半透明遮罩 - 独立层 */}
      <div className='absolute inset-0 bg-black/20 dark:bg-black/40 pointer-events-none z-[3]' />
      {/* 🔥 主题切换按钮 */}
      <div className='absolute top-4 right-4 z-20 p-2'>
        <ThemeToggle />
      </div>
      {/* 🔥 加载动画 - 旋转圆圈 */}
      {isBackgroundLoading && (
        <div className='absolute inset-0 z-10 flex flex-col items-center justify-center'>
          {/* 双层旋转动画 */}
          <div className='relative w-20 h-20 flex items-center justify-center'>
            {/* 外圈旋转 */}
            <div
              className='absolute inset-0 border-4 border-white/10 border-t-blue-400 border-r-emerald-400 rounded-full animate-spin'
              style={{ animationDuration: '2s' }}
            />
            {/* 内圈反向旋转 */}
            <div
              className='absolute inset-2 border-3 border-white/10 border-b-cyan-400 border-l-blue-400 rounded-full animate-spin'
              style={{
                animationDirection: 'reverse',
                animationDuration: '1.5s',
              }}
            />
            {/* 中心圆点 */}
            <div
              className='w-4 h-4 bg-gradient-to-br from-blue-400 to-emerald-400 rounded-full animate-pulse'
              style={{ animationDuration: '1.5s' }}
            />
          </div>
          {/* 加载文字 */}
          <p className='mt-6 text-white/60 text-sm tracking-widest uppercase animate-pulse'>
            Loading
          </p>
        </div>
      )}
      {/* 🔥 登录表单 */}
      {!isBackgroundLoading && (
        <div
          className={`relative z-10 w-full max-w-xs rounded-2xl bg-white/10 dark:bg-gray-900/60 backdrop-blur-xl shadow-2xl p-6 border border-white/10 dark:border-gray-700/50 mx-auto transition-all duration-300 transform ${
            showLoginForm
              ? isAnimating
                ? 'scale-100 opacity-100 translate-y-0'
                : 'scale-90 opacity-0 translate-y-4'
              : 'scale-90 opacity-0 translate-y-4'
          }`}
        >
          <h1 className='text-white dark:text-gray-100 tracking-tight text-center text-2xl font-extrabold mb-6 bg-clip-text drop-shadow-sm'>
            {siteName}
          </h1>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setIsLoading(true);

              try {
                const res = await fetch('/api/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    password,
                    ...(username ? { username } : {}),
                  }),
                });

                if (res.ok) {
                  const redirect = searchParams.get('redirect') || '/';
                  // 使用 window.location.href 而不是 router.replace，确保 cookie 被浏览器保存
                  window.location.href = redirect;
                } else if (res.status === 401) {
                  const data = await res.json();
                  setError(data.error || '密码错误');
                } else {
                  setError('登录失败，请稍后重试');
                }
              } catch {
                setError('网络错误，请稍后重试');
              } finally {
                setIsLoading(false);
              }
            }}
            className='space-y-6'
          >
            {error && (
              <div className='rounded-lg bg-red-500/20 p-4 text-sm text-red-200 backdrop-blur-sm'>
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor='username'
                className='block text-sm font-medium text-white'
              >
                用户名
              </label>
              <input
                id='username'
                name='username'
                type='text'
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className='mt-1 block w-full rounded-lg border-0 bg-white/10 px-4 py-3 text-white placeholder-white/50 backdrop-blur-sm focus:bg-white/20 focus:ring-2 focus:ring-white/50'
                placeholder='请输入用户名'
              />
            </div>

            <div>
              <label
                htmlFor='password'
                className='block text-sm font-medium text-white'
              >
                密码
              </label>
              <input
                id='password'
                name='password'
                type='password'
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className='mt-1 block w-full rounded-lg border-0 bg-white/10 px-4 py-3 text-white placeholder-white/50 backdrop-blur-sm focus:bg-white/20 focus:ring-2 focus:ring-white/50'
                placeholder='请输入密码'
              />
            </div>

            {error && (
              <p className='text-sm text-red-300 dark:text-red-400 bg-red-900/30 dark:bg-red-900/50 rounded-lg py-2 px-3 text-center'>
                {error}
              </p>
            )}

            <button
              type='submit'
              disabled={isLoading}
              className='w-full rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:from-green-500 hover:to-emerald-500 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isLoading ? '登录中...' : '登录'}
            </button>

            <div className='text-center'>
              <span className='text-gray-700 dark:text-gray-300 text-sm'>
                还没有账户？
              </span>
              <button
                type='button'
                onClick={() => router.push('/register')}
                className='ml-2 text-green-600 dark:text-green-400 text-sm font-medium hover:underline'
              >
                立即注册
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return <LoginPageClient />;
}
