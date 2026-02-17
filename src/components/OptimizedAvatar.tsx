'use client';

import { User } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { logger } from '@/lib/logger';

interface OptimizedAvatarProps {
  onClick?: () => void;
  className?: string;
  size?: 'nav' | 'menu' | 'large';
  avatarUrl?: string; // 允许外部传入头像URL
  selectedImage?: string; // 用于修改头像面板的预览
  username?: string; // 用于生成默认头像
}

// 清除服务器中的头像
export const clearAvatarFromLocalStorage = async (): Promise<void> => {
  if (typeof window === 'undefined') return;

  try {
    // 清除服务器头像
    await fetch('/api/avatar', { method: 'DELETE' });
    // 🔥 修复：清除所有用户的头像缓存
    const keys = Object.keys(localStorage).filter((key) =>
      key.startsWith('user-avatar-'),
    );
    keys.forEach((key) => localStorage.removeItem(key));
    // 清除旧的缓存 key（兼容性）
    localStorage.removeItem('user-avatar');
  } catch (error) {
    logger.error('清除头像失败:', error);
  }
};

// 根据用户名生成默认头像的颜色和首字母
const generateDefaultAvatar = (username?: string) => {
  if (!username) {
    return {
      gradient: 'from-blue-400 to-blue-600',
      letter: '',
      bgClass:
        'bg-gradient-to-br from-blue-400/20 to-blue-600/20 dark:from-blue-600/20 dark:to-blue-800/20',
      avatarUrl: '',
    };
  }

  // 预设的颜色组合
  const gradients = [
    {
      from: 'from-pink-400',
      to: 'to-rose-600',
      bg: 'from-pink-400/20 to-rose-600/20 dark:from-pink-600/20 dark:to-rose-800/20',
    },
    {
      from: 'from-purple-400',
      to: 'to-violet-600',
      bg: 'from-purple-400/20 to-violet-600/20 dark:from-purple-600/20 dark:to-violet-800/20',
    },
    {
      from: 'from-blue-400',
      to: 'to-cyan-600',
      bg: 'from-blue-400/20 to-cyan-600/20 dark:from-blue-600/20 dark:to-cyan-800/20',
    },
    {
      from: 'from-green-400',
      to: 'to-emerald-600',
      bg: 'from-green-400/20 to-emerald-600/20 dark:from-green-600/20 dark:to-emerald-800/20',
    },
    {
      from: 'from-yellow-400',
      to: 'to-orange-600',
      bg: 'from-yellow-400/20 to-orange-600/20 dark:from-yellow-600/20 dark:to-orange-800/20',
    },
    {
      from: 'from-red-400',
      to: 'to-pink-600',
      bg: 'from-red-400/20 to-pink-600/20 dark:from-red-600/20 dark:to-pink-800/20',
    },
    {
      from: 'from-indigo-400',
      to: 'to-blue-600',
      bg: 'from-indigo-400/20 to-blue-600/20 dark:from-indigo-600/20 dark:to-blue-800/20',
    },
    {
      from: 'from-teal-400',
      to: 'to-cyan-600',
      bg: 'from-teal-400/20 to-cyan-600/20 dark:from-teal-600/20 dark:to-cyan-800/20',
    },
  ];

  // 根据用户名的哈希值选择颜色
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % gradients.length;
  const selectedGradient = gradients[index];

  // 获取首字母（支持中文）
  const letter = username.charAt(0).toUpperCase();

  // 使用 DiceBear API 生成随机头像（基于用户名作为种子）
  const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

  return {
    gradient: `${selectedGradient.from} ${selectedGradient.to}`,
    letter,
    bgClass: `bg-gradient-to-br ${selectedGradient.bg}`,
    avatarUrl,
  };
};

export const OptimizedAvatar: React.FC<OptimizedAvatarProps> = ({
  onClick,
  className = '',
  size = 'nav',
  avatarUrl: externalAvatarUrl,
  selectedImage,
  username,
}) => {
  // 根据尺寸设置样式
  const getSizeClasses = () => {
    switch (size) {
      case 'menu':
        return {
          container: 'w-14 h-14',
          icon: 'w-8 h-8',
          imageWidth: 56,
          imageHeight: 56,
        };
      case 'large':
        return {
          container: 'w-32 h-32',
          icon: 'w-16 h-16',
          imageWidth: 128,
          imageHeight: 128,
        };
      case 'nav':
      default:
        return {
          container: 'w-9 h-9 sm:w-12 sm:h-12',
          icon: 'w-5 h-5 sm:w-7 sm:h-7',
          imageWidth: 36,
          imageHeight: 36,
        };
    }
  };

  const sizeClasses = getSizeClasses();
  const [internalAvatarUrl, setInternalAvatarUrl] = useState('');
  const [isLoadingCustomAvatar, setIsLoadingCustomAvatar] = useState(true);
  const [, setHasCustomAvatar] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  // 使用外部传入的头像URL或内部获取的
  const avatarUrl = externalAvatarUrl || internalAvatarUrl;

  // 从 API 读取头像（仅在没有外部传入时）
  useEffect(() => {
    if (!externalAvatarUrl) {
      // 🔥 修复：缓存 key 包含用户名，避免切换用户时显示错误头像
      const CACHE_KEY = username ? `user-avatar-${username}` : 'user-avatar';
      const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时缓存

      // 使用 requestAnimationFrame 来延迟 setState 调用
      requestAnimationFrame(() => {
        setIsLoadingCustomAvatar(true);
      });

      // 先尝试从 localStorage 读取缓存
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { avatar, timestamp } = JSON.parse(cached);
          // 检查缓存是否过期
          if (Date.now() - timestamp < CACHE_DURATION) {
            requestAnimationFrame(() => {
              setInternalAvatarUrl(avatar);
              setHasCustomAvatar(true);
              setIsLoadingCustomAvatar(false);
            });
            return; // 使用缓存，直接返回
          }
        }
      } catch {
        // 缓存读取失败，继续请求 API
      }

      // 缓存不存在或过期，请求 API
      fetch('/api/avatar')
        .then((res) => res.json())
        .then((data) => {
          if (data.avatar) {
            const avatarUrl = `data:image/jpeg;base64,${data.avatar}`;
            setInternalAvatarUrl(avatarUrl);
            setHasCustomAvatar(true);
            // 保存到缓存
            localStorage.setItem(
              CACHE_KEY,
              JSON.stringify({ avatar: avatarUrl, timestamp: Date.now() }),
            );
          } else {
            setHasCustomAvatar(false);
          }
        })
        .catch(() => {
          setHasCustomAvatar(false);
        })
        .finally(() => {
          setIsLoadingCustomAvatar(false);
        });
    } else {
      // 使用 requestAnimationFrame 来延迟 setState 调用
      requestAnimationFrame(() => {
        setHasCustomAvatar(true);
        setIsLoadingCustomAvatar(false);
      });
    }
  }, [username, externalAvatarUrl]); // 🔥 添加 username 依赖

  // 判断显示哪个图片
  const displayImage = selectedImage || avatarUrl;

  // 生成默认头像
  const defaultAvatar = generateDefaultAvatar(username);

  return (
    <div className={`relative ${className}`}>
      {/* 占位符头像 - 只在没有自定义头像时显示 */}
      {!displayImage && !isLoadingCustomAvatar && (
        <div
          className={`${sizeClasses.container} p-0.5 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 transition-all duration-300 hover:scale-105 overflow-hidden group ${size === 'menu' ? 'ring-2 ring-white/50 dark:ring-gray-700/50 shadow-lg' : ''} ${size === 'large' ? 'bg-blue-100 dark:bg-blue-900/40' : ''}`}
        >
          {/* 使用网络随机头像或本地生成的头像 */}
          {defaultAvatar.avatarUrl ? (
            <Image
              src={defaultAvatar.avatarUrl}
              alt='默认头像'
              width={sizeClasses.imageWidth}
              height={sizeClasses.imageHeight}
              className='w-full h-full object-cover rounded-full'
              unoptimized
              onError={(e) => {
                // 如果网络头像加载失败，显示本地生成的头像
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget
                  .nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          ) : null}

          {/* 本地生成的头像（作为备用） */}
          <div
            className={`w-full h-full rounded-full flex items-center justify-center ring-2 ring-transparent group-hover:ring-blue-400/50 transition-all duration-300 bg-gradient-to-br ${defaultAvatar.bgClass} ${defaultAvatar.avatarUrl ? 'hidden' : ''}`}
          >
            {defaultAvatar.letter ? (
              <span
                className={`${sizeClasses.icon} font-bold text-white bg-gradient-to-br ${defaultAvatar.gradient} bg-clip-text text-transparent`}
              >
                {defaultAvatar.letter}
              </span>
            ) : (
              <User
                className={`${sizeClasses.icon} text-blue-500 dark:text-blue-400`}
              />
            )}
          </div>
        </div>
      )}

      {/* 加载状态 */}
      {isLoadingCustomAvatar && !displayImage && (
        <div
          className={`${sizeClasses.container} p-0.5 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700`}
        >
          <div className='animate-spin rounded-full h-1/2 w-1/2 border-2 border-gray-400 border-t-transparent'></div>
        </div>
      )}

      {/* 真实头像或预览图片 - 优先级最高 */}
      {displayImage && (
        <div
          className={`${sizeClasses.container} p-0.5 rounded-full overflow-hidden ${
            size === 'menu'
              ? 'ring-2 ring-white/50 dark:ring-gray-700/50 shadow-lg'
              : ''
          }`}
        >
          <Image
            ref={imageRef}
            src={
              displayImage.startsWith('data:')
                ? displayImage
                : `data:image/jpeg;base64,${displayImage}`
            }
            alt='用户头像'
            width={sizeClasses.imageWidth}
            height={sizeClasses.imageHeight}
            className='w-full h-full object-cover rounded-full'
            unoptimized
            style={{
              // 提前加载图片以减少闪动
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
            }}
          />
        </div>
      )}

      {/* 点击区域 */}
      {onClick && (
        <button
          onClick={onClick}
          className='absolute inset-0 w-full h-full rounded-full'
          aria-label='用户菜单'
        />
      )}
    </div>
  );
};
