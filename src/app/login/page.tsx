'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import { RandomBackground } from '@/components/RandomBackground';
import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { siteName } = useSite();

  // 只在客户端生成 URL，避免水合错误
  useEffect(() => {
    const url = `https://edgeone-picture.edgeone.app/api/random?t=${Date.now()}`;
    requestAnimationFrame(() => {
      setBackgroundImageUrl(url);
    });
  }, []);

  // 登录成功后跳转 - 检查实际的认证状态
  useEffect(() => {
    const checkAuthAndRedirect = () => {
      const auth = getAuthInfoFromBrowserCookie();
      if (auth && !error && !loading) {
        const redirect = searchParams.get('redirect') || '/';
        router.replace(redirect);
      }
    };
    checkAuthAndRedirect();
  }, [error, loading, router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '登录失败');
        return;
      }

      // 登录成功后刷新页面触发 middleware 验证
      window.location.reload();
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='relative min-h-screen flex items-center justify-center px-4 overflow-hidden'>
      {/* 🔥 随机背景图片 - 独立层 */}
      {backgroundImageUrl && <RandomBackground imageUrl={backgroundImageUrl} />}

      {/* 🔥 半透明遮罩 - 独立层 */}
      <div className='absolute inset-0 bg-black/20 dark:bg-black/40 pointer-events-none' />

      {/* 🔥 主题切换按钮 */}
      <div className='absolute top-4 right-4 z-20'>
        <ThemeToggle />
      </div>

      {/* 🔥 登录表单 */}
      <div className='relative z-10 w-full max-w-xs rounded-2xl bg-white/10 dark:bg-gray-900/60 backdrop-blur-xl shadow-2xl p-6 border border-white/10 dark:border-gray-700/50 mx-auto'>
        <h1 className='text-white dark:text-gray-100 tracking-tight text-center text-2xl font-extrabold mb-6 bg-clip-text drop-shadow-sm'>
          {siteName}
        </h1>
        <form onSubmit={handleSubmit} className='space-y-6'>
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
              type='password'
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className='mt-1 block w-full rounded-lg border-0 bg-white/10 px-4 py-3 text-white placeholder-white/50 backdrop-blur-sm focus:bg-white/20 focus:ring-2 focus:ring-white/50'
              placeholder='请输入密码'
            />
          </div>

          <button
            type='submit'
            disabled={loading}
            className='w-full rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:from-green-500 hover:to-emerald-500 hover:shadow-xl disabled:opacity-50'
          >
            {loading ? '登录中...' : '登录'}
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
    </div>
  );
}

export default function LoginPage() {
  return <LoginPageClient />;
}
