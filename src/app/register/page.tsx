'use client';

import { AlertCircle, CheckCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { logger } from '@/lib/logger';

import { RandomBackground } from '@/components/RandomBackground';
import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

function RegisterPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [shouldShowRegister, setShouldShowRegister] = useState(false);
  const [registrationDisabled, setRegistrationDisabled] = useState(false);
  const [disabledReason, setDisabledReason] = useState('');
  const [reason, setReason] = useState('');
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // 只在客户端生成 URL，避免水合错误
  useEffect(() => {
    const url = `https://picture.bauw.dpdns.org/api/random?t=${Date.now()}`;
    requestAnimationFrame(() => {
      setBackgroundImageUrl(url);
    });
  }, []);

  const [validationErrors, setValidationErrors] = useState<{
    [key: string]: string;
  }>({});

  const { siteName } = useSite();

  // 注册成功后跳转
  useEffect(() => {
    if (success && !pending) {
      const redirect = searchParams.get('redirect') || '/login';
      window.location.href = redirect;
    }
  }, [success, pending, searchParams]);

  // 在客户端挂载后设置配置
  useEffect(() => {
    const checkRegistrationAvailable = async () => {
      if (typeof window !== 'undefined') {
        const username = (window as unknown as Record<string, unknown>)
          .RUNTIME_CONFIG
          ? ((
              (window as unknown as Record<string, unknown>)
                .RUNTIME_CONFIG as Record<string, unknown>
            ).USERNAME as string)
          : undefined;
        if (!username) {
          router.replace('/login');
          return;
        }

        try {
          const response = await fetch('/api/registration');
          if (response.ok) {
            const data = await response.json();
            if (!data.allowRegister) {
              setRegistrationDisabled(true);
              setDisabledReason('管理员已关闭用户注册功能');
              setShouldShowRegister(true);
              return;
            }
          }

          setShouldShowRegister(true);
        } catch (error) {
          logger.error('检查注册可用性失败:', error);
          setShouldShowRegister(true);
        }
      }
    };

    checkRegistrationAvailable();
  }, [router]);

  // 实时表单验证
  const _validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!username.trim()) {
      errors.username = '请输入用户名';
    } else if (username.trim().length < 3) {
      errors.username = '用户名至少3位';
    } else if (username.trim().length > 20) {
      errors.username = '用户名最多20位';
    } else if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      errors.username = '用户名只能包含字母、数字和下划线';
    }

    if (!password.trim()) {
      errors.password = '请输入密码';
    } else if (password.length < 6) {
      errors.password = '密码至少6位';
    } else if (!/(?=.*[a-zA-Z])/.test(password)) {
      errors.password = '密码需包含至少一个字母';
    }

    if (!confirmPassword.trim()) {
      errors.confirmPassword = '请确认密码';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = '两次输入的密码不一致';
    }

    if (reason.length > 200) {
      errors.reason = '注册理由最多200字';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 实时验证单个字段
  const validateField = (field: string, value: string) => {
    const errors = { ...validationErrors };

    switch (field) {
      case 'username':
        if (!value.trim()) {
          errors.username = '请输入用户名';
        } else if (value.trim().length < 3) {
          errors.username = '用户名至少3位';
        } else if (value.trim().length > 20) {
          errors.username = '用户名最多20位';
        } else if (!/^[a-zA-Z0-9_]+$/.test(value.trim())) {
          errors.username = '用户名只能包含字母、数字和下划线';
        } else {
          delete errors.username;
        }
        break;

      case 'password':
        if (!value.trim()) {
          errors.password = '请输入密码';
        } else if (value.length < 6) {
          errors.password = '密码至少6位';
        } else if (!/(?=.*[a-zA-Z])/.test(value)) {
          errors.password = '密码需包含至少一个字母';
        } else {
          delete errors.password;
          // 如果确认密码已填写，重新验证确认密码
          if (confirmPassword) {
            if (value !== confirmPassword) {
              errors.confirmPassword = '两次输入的密码不一致';
            } else {
              delete errors.confirmPassword;
            }
          }
        }
        break;

      case 'confirmPassword':
        if (!value.trim()) {
          errors.confirmPassword = '请确认密码';
        } else if (value !== password) {
          errors.confirmPassword = '两次输入的密码不一致';
        } else {
          delete errors.confirmPassword;
        }
        break;

      case 'reason':
        if (value.length > 200) {
          errors.reason = '注册理由最多200字';
        } else {
          delete errors.reason;
        }
        break;
    }

    setValidationErrors(errors);
  };

  if (!shouldShowRegister) {
    return <div>Loading...</div>;
  }

  // 如果注册被禁用，显示提示页面
  if (registrationDisabled) {
    return (
      <div className='relative min-h-screen flex items-center justify-center px-4 overflow-hidden'>
        {/* 🔥 随机背景图片 - 独立层 */}
        {backgroundImageUrl && (
          <RandomBackground imageUrl={backgroundImageUrl} />
        )}

        {/* 🔥 半透明遮罩 - 独立层 */}
        <div className='absolute inset-0 bg-black/20 dark:bg-black/40 pointer-events-none' />

        <div className='absolute top-4 right-4 z-20'>
          <ThemeToggle />
        </div>
        <div className='relative z-10 w-full max-w-xs rounded-2xl bg-white/10 dark:bg-gray-900/60 backdrop-blur-xl shadow-2xl p-6 border border-white/10 dark:border-gray-700/50 mx-auto'>
          <h1 className='text-white tracking-tight text-center text-2xl font-extrabold mb-2 bg-clip-text drop-shadow-sm'>
            {siteName}
          </h1>
          <div className='text-center space-y-6'>
            <div className='flex items-center justify-center mb-4'>
              <AlertCircle className='w-16 h-16 text-yellow-300' />
            </div>
            <h2 className='text-xl font-semibold text-white dark:text-gray-100'>
              注册功能暂不可用
            </h2>
            <p className='text-gray-700 dark:text-gray-300 text-sm leading-relaxed font-medium'>
              {disabledReason || '管理员已关闭用户注册功能'}
            </p>
            <p className='text-gray-600 dark:text-gray-400 text-xs mt-2'>
              如需注册账户，请联系网站管理员
            </p>
            <button
              onClick={() => router.push('/login')}
              className='group relative inline-flex w-full justify-center overflow-hidden rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:from-green-500 hover:to-emerald-500 hover:shadow-xl hover:shadow-green-500/25'
            >
              <span className='relative z-10 flex items-center justify-center'>
                返回登录
              </span>
              <div className='absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100' />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='relative min-h-screen flex items-center justify-center px-4 overflow-hidden'>
      {/* 🔥 随机背景图片 - 独立层 */}
      <RandomBackground imageUrl={backgroundImageUrl} />

      {/* 🔥 半透明遮罩 - 独立层 */}
      <div className='absolute inset-0 bg-black/20 dark:bg-black/40 pointer-events-none' />

      <div className='absolute top-4 right-4 z-20'>
        <ThemeToggle />
      </div>
      <div className='relative z-10 w-full max-w-xs rounded-2xl bg-white/10 dark:bg-gray-900/60 backdrop-blur-xl shadow-2xl p-6 border border-white/10 dark:border-gray-700/50 mx-auto'>
        <h1 className='text-white dark:text-gray-100 tracking-tight text-center text-2xl font-extrabold mb-6 bg-clip-text drop-shadow-sm'>
          注册账号
        </h1>

        {pending ? (
          <div className='text-center space-y-4'>
            <CheckCircle className='w-16 h-16 text-green-400 mx-auto' />
            <p className='text-white dark:text-gray-100 font-medium'>
              {success}
            </p>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setSuccess(null);
              setPending(true);

              try {
                const res = await fetch('/api/register', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    username,
                    password,
                    confirmPassword,
                    reason,
                  }),
                });

                const data = await res.json();

                if (res.ok && data.ok) {
                  setSuccess(data.message || '注册成功');
                  setPending(data.pending || false);
                } else {
                  setError(data.error || '注册失败');
                }
              } catch {
                setError('网络错误，请稍后重试');
              } finally {
                if (!success) setPending(false);
              }
            }}
            className='space-y-4'
          >
            <div>
              <label htmlFor='username' className='sr-only'>
                用户名
              </label>
              <input
                id='username'
                name='username'
                type='text'
                autoComplete='username'
                className={`block w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-white/60 dark:ring-gray-600/60 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:outline-none sm:text-sm bg-white/90 dark:bg-gray-800/90 backdrop-blur ${
                  validationErrors.username ? 'ring-red-500' : ''
                }`}
                placeholder='输入用户名 (3-20位字母数字下划线)'
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  validateField('username', e.target.value);
                }}
              />
            </div>

            <div>
              <label htmlFor='password' className='sr-only'>
                密码
              </label>
              <input
                id='password'
                name='password'
                type='password'
                autoComplete='new-password'
                className={`block w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-white/60 dark:ring-gray-600/60 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:outline-none sm:text-sm bg-white/90 dark:bg-gray-800/90 backdrop-blur ${
                  validationErrors.password ? 'ring-red-500' : ''
                }`}
                placeholder='输入密码 (至少6位，包含字母)'
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  validateField('password', e.target.value);
                }}
              />
            </div>

            <div>
              <label htmlFor='confirmPassword' className='sr-only'>
                确认密码
              </label>
              <input
                id='confirmPassword'
                name='confirmPassword'
                type='password'
                autoComplete='new-password'
                className={`block w-full rounded-lg border-0 py-3 px-4 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-white/60 dark:ring-gray-600/60 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:outline-none sm:text-base bg-white/90 dark:bg-gray-800/90 backdrop-blur ${
                  validationErrors.confirmPassword ? 'ring-red-500' : ''
                }`}
                placeholder='再次输入密码'
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  validateField('confirmPassword', e.target.value);
                }}
              />
            </div>

            <div>
              <label htmlFor='reason' className='sr-only'>
                注册申请说明
              </label>
              <textarea
                id='reason'
                name='reason'
                rows={3}
                className='block w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-white/60 dark:ring-gray-600/60 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:outline-none sm:text-sm bg-white/90 dark:bg-gray-800/90 backdrop-blur resize-none'
                placeholder='请简要说明注册理由（填写暗号可以更快通过哟~）'
                maxLength={200}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {error && (
              <p className='text-sm text-red-300 dark:text-red-400 bg-red-900/30 dark:bg-red-900/50 rounded-lg py-2 px-3 text-center border border-red-700/50'>
                {error}
              </p>
            )}

            {validationErrors.username && (
              <p className='text-sm text-red-300 dark:text-red-400 bg-red-900/30 dark:bg-red-900/50 rounded-lg py-1 px-3 text-center border border-red-700/50'>
                {validationErrors.username}
              </p>
            )}

            {validationErrors.password && (
              <p className='text-sm text-red-300 dark:text-red-400 bg-red-900/30 dark:bg-red-900/50 rounded-lg py-1 px-3 text-center border border-red-700/50'>
                {validationErrors.password}
              </p>
            )}

            {validationErrors.confirmPassword && (
              <p className='text-sm text-red-300 dark:text-red-400 bg-red-900/30 dark:bg-red-900/50 rounded-lg py-1 px-3 text-center border border-red-700/50'>
                {validationErrors.confirmPassword}
              </p>
            )}

            {validationErrors.reason && (
              <p className='text-sm text-red-300 dark:text-red-400 bg-red-900/30 dark:bg-red-900/50 rounded-lg py-1 px-3 text-center border border-red-700/50'>
                {validationErrors.reason}
              </p>
            )}

            <button
              type='submit'
              className='w-full rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:from-green-500 hover:to-emerald-500 hover:shadow-xl'
            >
              注册
            </button>

            <div className='text-center'>
              <button
                type='button'
                onClick={() => router.push('/login')}
                className='text-xs text-gray-300 dark:text-gray-400 hover:text-white dark:hover:text-gray-100 transition-colors'
              >
                已有账号？返回登录
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return <RegisterPageClient />;
}
