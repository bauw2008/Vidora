'use client';

import {
  BarChart3,
  Camera,
  Check,
  ChevronDown,
  KeyRound,
  LogOut,
  Palette,
  Settings,
  Shield,
  Upload,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactCrop, { Crop, PercentCrop, PixelCrop } from 'react-image-crop';

import 'react-image-crop/dist/ReactCrop.css';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { CURRENT_VERSION } from '@/lib/version';
import { useMenuSettings } from '@/hooks/useMenuSettings';
import { useUserSettings } from '@/hooks/useUserSettings';

import { OptimizedAvatar } from './OptimizedAvatar';
import { ThemeSettingsPanel } from './ThemeSettingsPanel';
import { useToast } from './Toast';
import { VersionPanel } from './VersionPanel';

export const UserMenu: React.FC = () => {
  const router = useRouter();
  const { error: showError, success: showSuccess } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const user = getAuthInfoFromBrowserCookie();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isVersionPanelOpen, setIsVersionPanelOpen] = useState(false);
  const [isChangeAvatarOpen, setIsChangeAvatarOpen] = useState(false);
  const [isThemeSettingsOpen, setIsThemeSettingsOpen] = useState(false);

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [storageType] = useState<string>(() => {
    // 🔧 优化：直接从 RUNTIME_CONFIG 读取初始值，避免默认值导致的多次渲染
    if (typeof window !== 'undefined') {
      const config = (window as Window).RUNTIME_CONFIG;
      return config?.STORAGE_TYPE || 'localstorage';
    }
    return 'localstorage';
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 裁剪相关状态
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 80,
    height: 80,
    x: 10,
    y: 10,
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imageRef = useRef<HTMLImageElement>(null);
  const [showCropper, setShowCropper] = useState(false);

  // Body 滚动锁定 - 统一管理所有弹出面板的滚动状态
  useEffect(() => {
    if (
      isSettingsOpen ||
      isChangePasswordOpen ||
      isChangeAvatarOpen ||
      isThemeSettingsOpen
    ) {
      const body = document.body;

      // 保存原始样式和滚动位置
      const originalStyle = body.style.cssText;
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;

      // 锁定滚动并保持位置
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = `-${scrollX}px`;
      body.style.width = '100vw';
      body.style.height = '100vh';
      body.style.overflow = 'hidden';

      return () => {
        // 完全恢复原始样式
        body.style.cssText = originalStyle;

        // 使用双重 requestAnimationFrame 确保在浏览器完成所有渲染操作后恢复滚动位置
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo(scrollX, scrollY);
          });
        });
      };
    }
  }, [
    isSettingsOpen,
    isChangePasswordOpen,
    isChangeAvatarOpen,
    isThemeSettingsOpen,
  ]);

  // 使用自定义 hook 管理所有设置
  const { settings, updateSetting, resetSettings } = useUserSettings();

  // 使用 NavigationConfigContext 检查菜单是否启用
  const { isMenuEnabled } = useMenuSettings();

  // 下拉框状态
  const [isDoubanDropdownOpen, setIsDoubanDropdownOpen] = useState(false);
  const [isDoubanImageProxyDropdownOpen, setIsDoubanImageProxyDropdownOpen] =
    useState(false);

  // 豆瓣数据源选项
  const doubanDataSourceOptions = [
    { value: 'direct', label: '直连（服务器直接请求豆瓣）' },
    { value: 'cors-proxy-zwei', label: 'Cors Proxy By Zwei' },
    {
      value: 'cmliussss-cdn-tencent',
      label: '豆瓣 CDN By CMLiussss（腾讯云）',
    },
    { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云）' },
    { value: 'custom', label: '自定义代理' },
  ];

  // 豆瓣图片代理选项
  const doubanImageProxyTypeOptions = [
    { value: 'direct', label: '直连（浏览器直接请求豆瓣）' },
    { value: 'server', label: '服务器代理（由服务器代理请求豆瓣）' },
    { value: 'img3', label: '豆瓣官方精品 CDN（阿里云）' },
    {
      value: 'cmliussss-cdn-tencent',
      label: '豆瓣 CDN By CMLiussss（腾讯云）',
    },
    { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云）' },
    { value: 'baidu-image', label: '百度图片代理' },
    { value: 'custom', label: '自定义代理' },
  ];

  // 修改密码相关状态
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // 确保组件已挂载
  useEffect(() => {
    setMounted(true);
  }, []);

  // 点击外部区域关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDoubanDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('[data-dropdown="douban-datasource"]')) {
          setIsDoubanDropdownOpen(false);
        }
      }
    };

    if (isDoubanDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDoubanDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDoubanImageProxyDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('[data-dropdown="douban-image-proxy"]')) {
          setIsDoubanImageProxyDropdownOpen(false);
        }
      }
    };

    if (isDoubanImageProxyDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDoubanImageProxyDropdownOpen]);

  const handleCloseMenu = () => {
    setIsOpen(false);
  };

  const handleLogout = async () => {
    try {
      // 清除认证cookie
      document.cookie = 'auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

      // 直接跳转到登录页面，避免中间状态
      window.location.href = '/login';
    } catch (error) {
      logger.error('登出失败:', error);
      // 即使出错也要跳转到登录页面
      window.location.href = '/login';
    }
  };

  const handleAdminPanel = () => {
    router.push('/admin');
  };

  const handlePlayStats = () => {
    setIsOpen(false);
    router.push('/play-stats');
  };

  const handleChangePassword = () => {
    setIsOpen(false);
    setIsChangePasswordOpen(true);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const handleCloseChangePassword = () => {
    setIsChangePasswordOpen(false);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const handleChangeAvatar = () => {
    setIsOpen(false);
    setIsChangeAvatarOpen(true);
    setSelectedImage('');
    setShowCropper(false);
  };

  const handleCloseChangeAvatar = () => {
    setIsChangeAvatarOpen(false);
    setSelectedImage('');
    setShowCropper(false);
  };

  const handleOpenFileSelector = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    // 验证文件是图片
    if (!file.type.startsWith('image/')) {
      showError('请选择图片文件，仅支持 JPG、PNG、GIF、WEBP 等图片格式');
      return;
    }

    // 根据用户角色设置不同的文件大小限制
    const userRole = user?.role || 'user';
    const isOwner = userRole === 'owner';

    // 站长无限制，普通用户和管理员限制150KB
    const maxSizeBytes = isOwner ? Number.MAX_SAFE_INTEGER : 150 * 1024; // 150KB

    if (file.size > maxSizeBytes) {
      const sizeKB = Math.round(file.size / 1024);
      const maxSizeKB = Math.round(maxSizeBytes / 1024);
      showError(`头像大小不能超过${maxSizeKB}KB（当前：${sizeKB}KB）`);
      return;
    }

    // GIF和WEBP直接上传，不走裁剪流程（避免破坏动画）
    // 检查 MIME type 和文件扩展名
    const isGif =
      file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
    const isWebp =
      file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp');

    if (isGif || isWebp) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          try {
            setIsUploadingAvatar(true);
            const imageBase64 = event.target.result.toString();

            // 调用 API 上传头像
            const response = await fetch('/api/avatar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ avatar: imageBase64 }),
            });

            if (!response.ok) {
              showError('头像上传失败，请稍后重试');
              return;
            }

            // 🔥 清除缓存，确保显示新头像
            const cacheKey = user?.username
              ? `user-avatar-${user.username}`
              : 'user-avatar';
            localStorage.removeItem(cacheKey);

            showSuccess('头像上传成功，您的头像已更新');
            handleCloseChangeAvatar();
          } catch (error) {
            logger.error('头像上传失败:', error);
            showError('头像上传失败，请稍后重试');
          } finally {
            setIsUploadingAvatar(false);
          }
        }
      };
      reader.readAsDataURL(file);
    } else {
      // 静态图片走裁剪流程
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSelectedImage(event.target.result.toString());
          setShowCropper(true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // 生成裁剪后的图片
  const getCroppedImage = async (
    image: HTMLImageElement,
    crop: PixelCrop,
  ): Promise<string> => {
    const canvas = document.createElement('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas context not available');
    }

    // 获取图片的自然尺寸和显示尺寸的比例
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // 计算裁剪区域在原始图片上的实际坐标和尺寸
    const cropX = crop.x * scaleX;
    const cropY = crop.y * scaleY;
    const cropWidth = crop.width * scaleX;
    const cropHeight = crop.height * scaleY;

    // 设置最终输出尺寸（统一为200x200的头像）
    const outputSize = 200;
    canvas.width = outputSize;
    canvas.height = outputSize;

    // 设置高质量渲染
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 绘制裁剪后的图片，缩放到统一尺寸
    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      outputSize,
      outputSize,
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          }
        },
        'image/jpeg',
        0.9,
      );
    });
  };

  // 确认裁剪并上传
  // 图片加载完成时重置裁剪区域
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;

    // 计算一个居中的正方形裁剪区域
    const minDimension = Math.min(width, height);
    const cropSize = minDimension * 0.8; // 使用80%的最小维度
    const cropX = (width - cropSize) / 2;
    const cropY = (height - cropSize) / 2;

    const newCrop = {
      unit: 'px' as const,
      x: cropX,
      y: cropY,
      width: cropSize,
      height: cropSize,
    };

    setCrop(newCrop);
  };

  const handleConfirmCrop = async () => {
    if (!completedCrop || !imageRef.current) {
      return;
    }

    try {
      setIsUploadingAvatar(true);

      const croppedImageBase64 = await getCroppedImage(
        imageRef.current,
        completedCrop,
      );

      // 调用 API 上传头像
      const response = await fetch('/api/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: croppedImageBase64 }),
      });

      if (!response.ok) {
        showError('头像上传失败，请稍后重试');
        return;
      }

      // 🔥 清除缓存，确保显示新头像
      const cacheKey = user?.username
        ? `user-avatar-${user.username}`
        : 'user-avatar';
      localStorage.removeItem(cacheKey);

      showSuccess('头像上传成功，您的头像已更新');
      handleCloseChangeAvatar();
    } catch (error) {
      logger.error('头像上传失败:', error);
      showError('头像上传失败，请稍后重试');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSubmitChangePassword = async () => {
    setPasswordError('');

    // 验证密码
    if (!newPassword) {
      setPasswordError('新密码不得为空');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的密码不一致');
      return;
    }

    setPasswordLoading(true);

    try {
      const response = await fetch('/api/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPasswordError(data.error || '修改密码失败');
        return;
      }

      // 修改成功，关闭弹窗并登出
      setIsChangePasswordOpen(false);
      await handleLogout();
    } catch (error) {
      logger.error('修改密码失败:', error);
      setPasswordError('网络错误，请稍后重试');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSettings = () => {
    setIsOpen(false);
    setIsSettingsOpen(true);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
  };

  const handleThemeSettings = () => {
    setIsOpen(false);
    setIsThemeSettingsOpen(true);
  };

  const handleCloseThemeSettings = () => {
    setIsThemeSettingsOpen(false);
  };

  // 检查是否显示管理面板按钮
  const showAdminPanel = user?.role === 'owner' || user?.role === 'admin';

  // 检查是否显示修改密码按钮
  const showChangePassword =
    user?.role !== 'owner' && storageType !== 'localstorage';

  // 检查是否显示播放统计按钮（所有登录用户，且非localstorage存储）
  const showPlayStats = user?.username && storageType !== 'localstorage';

  // 角色中文映射
  const getRoleText = (role?: string) => {
    switch (role) {
      case 'owner':
        return '站长';
      case 'admin':
        return '管理员';
      case 'user':
        return '用户';
      default:
        return '';
    }
  };

  // 菜单面板内容
  const menuPanel = (
    <>
      {/* 背景遮罩 - 普通菜单无需模糊 */}
      <div
        className='fixed inset-0 bg-transparent z-[1000]'
        onClick={handleCloseMenu}
      />

      {/* 菜单面板 */}
      <div className='fixed top-14 right-4 w-56 bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl rounded-2xl shadow-xl z-[1001] border border-gray-200/20 dark:border-gray-700/20 overflow-hidden select-none'>
        {/* 用户信息区域 */}
        <div className='px-4 py-4 border-b border-gray-200/30 dark:border-gray-700/30 bg-gradient-to-r from-white/60 to-white/30 dark:from-gray-800/60 dark:to-gray-800/30 shadow-sm'>
          <div className='flex items-center gap-3'>
            {/* 用户头像 - 菜单面板中使用中等尺寸 */}
            <OptimizedAvatar
              onClick={() => setIsOpen(!isOpen)}
              size='menu'
              username={user?.username}
            />

            {/* 用户信息 - 垂直布局 */}
            <div className='flex-1 min-w-0'>
              {/* 第一行：用户名和角色标签 */}
              <div className='flex items-center gap-2 mb-1.5'>
                <div className='flex-1 min-w-0'>
                  <div
                    className={`font-bold bg-clip-text text-transparent text-base truncate flex items-center gap-1.5 ${
                      (user?.role || 'user') === 'owner'
                        ? 'bg-gradient-to-r from-red-600 to-pink-600'
                        : 'bg-gradient-to-r from-blue-600 to-purple-600'
                    }`}
                  >
                    {/* 用户名前的小图标 */}
                    {(user?.role || 'user') === 'owner' && (
                      <svg
                        className='w-4 h-4 text-red-500 flex-shrink-0'
                        fill='currentColor'
                        viewBox='0 0 24 24'
                        xmlns='http://www.w3.org/2000/svg'
                      >
                        <path d='M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 2c0 .55-.45 1-1 1H6c-.55 0-1-.45-1-1v-1h14v1z' />
                      </svg>
                    )}
                    {(user?.role || 'user') === 'admin' && (
                      <svg
                        className='w-4 h-4 text-blue-500 flex-shrink-0'
                        fill='currentColor'
                        viewBox='0 0 20 20'
                        xmlns='http://www.w3.org/2000/svg'
                      >
                        <path
                          fillRule='evenodd'
                          d='M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                          clipRule='evenodd'
                        />
                      </svg>
                    )}
                    {(user?.role || 'user') === 'user' && (
                      <svg
                        className='w-4 h-4 text-green-500 flex-shrink-0'
                        fill='currentColor'
                        viewBox='0 0 20 20'
                        xmlns='http://www.w3.org/2000/svg'
                      >
                        <path d='M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z' />
                      </svg>
                    )}
                    {user?.username || 'default'}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shadow-sm flex-shrink-0 transition-all duration-300 hover:shadow-lg hover:scale-105 animate-pulse ${
                    (user?.role || 'user') === 'owner'
                      ? 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 dark:from-yellow-900/40 dark:to-yellow-900/60 dark:text-yellow-300 hover:from-yellow-200 hover:to-yellow-300 dark:hover:from-yellow-800/60 dark:hover:to-yellow-800/80'
                      : (user?.role || 'user') === 'admin'
                        ? 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 dark:from-blue-900/40 dark:to-blue-900/60 dark:text-blue-300 hover:from-blue-200 hover:to-blue-300 dark:hover:from-blue-800/60 dark:hover:to-blue-800/80'
                        : 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 dark:from-green-900/40 dark:to-green-900/60 dark:text-green-300 hover:from-green-200 hover:to-green-300 dark:hover:from-green-800/60 dark:hover:to-green-800/80'
                  }`}
                >
                  {getRoleText(user?.role || 'user')}
                </span>
              </div>

              {/* 第二行：存储类型信息 */}
              <div className='flex items-center gap-1.5'>
                {storageType === 'localstorage' ? (
                  <>
                    <svg
                      className='w-4 h-4 text-blue-500'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                      xmlns='http://www.w3.org/2000/svg'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4'
                      ></path>
                    </svg>
                    <span className='text-sm text-gray-600 dark:text-gray-400 font-medium'>
                      本地存储
                    </span>
                  </>
                ) : (
                  <>
                    <svg
                      className='w-4 h-4 text-green-500'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                      xmlns='http://www.w3.org/2000/svg'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4'
                      ></path>
                    </svg>
                    <span className='text-sm text-gray-600 dark:text-gray-400 font-medium'>
                      {storageType}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 菜单项 */}
        <div className='py-1'>
          {/* 设置按钮 */}
          <button
            onClick={handleSettings}
            className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 transition-colors text-sm rounded-lg mx-1'
          >
            <Settings className='w-4 h-4 text-gray-500 dark:text-gray-400' />
            <span className='font-medium'>本地设置</span>
          </button>

          {/* 主题设置按钮 */}
          <button
            onClick={handleThemeSettings}
            className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 transition-colors text-sm rounded-lg mx-1'
          >
            <Palette className='w-4 h-4 text-gray-500 dark:text-gray-400' />
            <span className='font-medium'>主题设置</span>
          </button>

          {/* 管理面板按钮 */}
          {showAdminPanel && (
            <button
              onClick={handleAdminPanel}
              className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 transition-colors text-sm rounded-lg mx-1'
            >
              <Shield className='w-4 h-4 text-gray-500 dark:text-gray-400' />
              <span className='font-medium'>管理面板</span>
            </button>
          )}

          {/* 修改头像按钮 */}
          <button
            onClick={handleChangeAvatar}
            className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 transition-colors text-sm rounded-lg mx-1'
          >
            <Camera className='w-4 h-4 text-gray-500 dark:text-gray-400' />
            <span className='font-medium'>修改头像</span>
          </button>

          {/* 播放统计按钮 */}
          {showPlayStats && (
            <button
              onClick={handlePlayStats}
              className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 transition-colors text-sm rounded-lg mx-1'
            >
              <BarChart3 className='w-4 h-4 text-gray-500 dark:text-gray-400' />
              <span className='font-medium'>
                {user?.role === 'owner' || user?.role === 'admin'
                  ? '播放统计'
                  : '个人统计'}
              </span>
            </button>
          )}

          {/* 修改密码按钮 */}
          {showChangePassword && (
            <button
              onClick={handleChangePassword}
              className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 transition-colors text-sm rounded-lg mx-1'
            >
              <KeyRound className='w-4 h-4 text-gray-500 dark:text-gray-400' />
              <span className='font-medium'>修改密码</span>
            </button>
          )}

          {/* 分割线 */}
          <div className='my-1 border-t border-gray-200/30 dark:border-gray-700/30 mx-2'></div>

          {/* 登出按钮 */}
          <button
            onClick={handleLogout}
            className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 transition-colors text-sm rounded-lg mx-1'
          >
            <LogOut className='w-4 h-4' />
            <span className='font-medium'>登出</span>
          </button>

          {/* 分割线 */}
          <div className='my-1 border-t border-gray-200/30 dark:border-gray-700/30 mx-2'></div>

          {/* 版本信息 */}
          <button
            onClick={() => {
              setIsVersionPanelOpen(true);
              handleCloseMenu();
            }}
            className='w-full px-3 py-2 text-center flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors text-xs rounded-lg mx-1'
          >
            <div className='flex items-center gap-1'>
              <span className='font-mono'>v{CURRENT_VERSION}</span>
            </div>
          </button>
        </div>
      </div>
    </>
  );

  // 设置面板内容
  const settingsPanel = (
    <>
      {/* 背景遮罩 */}
      <div
        className='fixed inset-0 bg-black/30 backdrop-blur-sm z-[1000]'
        onClick={handleCloseSettings}
        onTouchMove={(e) => {
          // 只在面板打开时阻止背景滚动
          if (isSettingsOpen) {
            e.preventDefault();
          }
        }}
        onWheel={(e) => {
          // 只在面板打开时阻止背景滚轮滚动
          if (isSettingsOpen) {
            e.preventDefault();
          }
        }}
        style={{
          touchAction: isSettingsOpen ? 'none' : 'auto',
        }}
      />

      {/* 设置面板 */}
      <div className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl max-h-[90vh] bg-white/60 dark:bg-gray-900/60 backdrop-blur-md rounded-2xl shadow-2xl z-[1001] flex flex-col'>
        {/* 内容容器 - 独立的滚动区域 */}
        <div
          className='flex-1 p-6 overflow-y-auto'
          data-panel-content
          style={{
            touchAction: 'pan-y', // 只允许垂直滚动
            overscrollBehavior: 'contain', // 防止滚动冒泡
          }}
        >
          {/* 标题栏 */}
          <div className='flex items-center justify-between mb-6'>
            <div className='flex items-center gap-3'>
              <h3 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                本地设置
              </h3>
              <button
                onClick={resetSettings}
                className='px-2 py-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border border-red-200 hover:border-red-300 dark:border-red-800 dark:hover:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors'
                title='重置为默认设置'
              >
                恢复默认
              </button>
            </div>
            <button
              onClick={handleCloseSettings}
              className='w-8 h-8 p-1 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
              aria-label='Close'
            >
              <X className='w-full h-full' />
            </button>
          </div>

          {/* 设置项 */}
          <div className='space-y-6'>
            {/* 豆瓣数据源选择 */}
            <div className='space-y-3'>
              <div>
                <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  豆瓣数据代理
                </h4>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  选择获取豆瓣数据的方式
                </p>
              </div>
              <div className='relative' data-dropdown='douban-datasource'>
                {/* 自定义下拉选择框 */}
                <button
                  type='button'
                  onClick={() => setIsDoubanDropdownOpen(!isDoubanDropdownOpen)}
                  className='w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm hover:border-gray-400 dark:hover:border-gray-500 text-left'
                >
                  {
                    doubanDataSourceOptions.find(
                      (option) => option.value === settings.doubanDataSource,
                    )?.label
                  }
                </button>

                {/* 下拉箭头 */}
                <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
                      isDoubanDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>

                {/* 下拉选项列表 */}
                {isDoubanDropdownOpen && (
                  <div className='absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto'>
                    {doubanDataSourceOptions.map((option) => (
                      <button
                        key={option.value}
                        type='button'
                        onClick={() => {
                          updateSetting('doubanDataSource', option.value);
                          setIsDoubanDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 ${
                          settings.doubanDataSource === option.value
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        <span className='truncate'>{option.label}</span>
                        {settings.doubanDataSource === option.value && (
                          <Check className='w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 ml-2' />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 豆瓣代理地址设置 - 仅在选择自定义代理时显示 */}
            {settings.doubanDataSource === 'custom' && (
              <div className='space-y-3'>
                <div>
                  <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    豆瓣代理地址
                  </h4>
                  <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                    自定义代理服务器地址
                  </p>
                </div>
                <input
                  type='text'
                  className='w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 shadow-sm hover:border-gray-400 dark:hover:border-gray-500'
                  placeholder='例如: https://proxy.example.com/fetch?url='
                  value={settings.doubanProxyUrl}
                  onChange={(e) =>
                    updateSetting('doubanProxyUrl', e.target.value)
                  }
                />
              </div>
            )}

            {/* 分割线 */}
            <div className='border-t border-gray-200 dark:border-gray-700'></div>

            {/* 豆瓣图片代理设置 */}
            <div className='space-y-3'>
              <div>
                <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  豆瓣图片代理
                </h4>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  选择获取豆瓣图片的方式
                </p>
              </div>
              <div className='relative' data-dropdown='douban-image-proxy'>
                {/* 自定义下拉选择框 */}
                <button
                  type='button'
                  onClick={() =>
                    setIsDoubanImageProxyDropdownOpen(
                      !isDoubanImageProxyDropdownOpen,
                    )
                  }
                  className='w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm hover:border-gray-400 dark:hover:border-gray-500 text-left'
                >
                  {
                    doubanImageProxyTypeOptions.find(
                      (option) =>
                        option.value === settings.doubanImageProxyType,
                    )?.label
                  }
                </button>

                {/* 下拉箭头 */}
                <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
                      isDoubanDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>

                {/* 下拉选项列表 */}
                {isDoubanImageProxyDropdownOpen && (
                  <div className='absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto'>
                    {doubanImageProxyTypeOptions.map((option) => (
                      <button
                        key={option.value}
                        type='button'
                        onClick={() => {
                          updateSetting('doubanImageProxyType', option.value);
                          setIsDoubanImageProxyDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 ${
                          settings.doubanImageProxyType === option.value
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        <span className='truncate'>{option.label}</span>
                        {settings.doubanImageProxyType === option.value && (
                          <Check className='w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 ml-2' />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 豆瓣图片代理地址设置 - 仅在选择自定义代理时显示 */}
            {settings.doubanImageProxyType === 'custom' && (
              <div className='space-y-3'>
                <div>
                  <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    豆瓣图片代理地址
                  </h4>
                  <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                    自定义图片代理服务器地址
                  </p>
                </div>
                <input
                  type='text'
                  className='w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 shadow-sm hover:border-gray-400 dark:hover:border-gray-500'
                  placeholder='例如: https://proxy.example.com/fetch?url='
                  value={settings.doubanImageProxyUrl}
                  onChange={(e) =>
                    updateSetting('doubanImageProxyUrl', e.target.value)
                  }
                />
              </div>
            )}

            {/* 分割线 */}
            <div className='border-t border-gray-200 dark:border-gray-700'></div>

            {/* 默认聚合搜索结果 */}
            <div className='flex items-center justify-between'>
              <div>
                <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  默认聚合搜索结果
                </h4>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  搜索时默认按标题和年份聚合显示结果
                </p>
              </div>
              <label className='flex items-center cursor-pointer'>
                <div className='relative'>
                  <input
                    type='checkbox'
                    className='sr-only peer'
                    checked={settings.defaultAggregateSearch}
                    onChange={(e) =>
                      updateSetting('defaultAggregateSearch', e.target.checked)
                    }
                  />
                  <div className='w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                  <div className='absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5'></div>
                </div>
              </label>
            </div>

            {/* 优选和测速 */}
            <div className='flex items-center justify-between'>
              <div>
                <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  优选和测速
                </h4>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  如出现播放器劫持问题可关闭
                </p>
              </div>
              <label className='flex items-center cursor-pointer'>
                <div className='relative'>
                  <input
                    type='checkbox'
                    className='sr-only peer'
                    checked={settings.enableOptimization}
                    onChange={(e) =>
                      updateSetting('enableOptimization', e.target.checked)
                    }
                  />
                  <div className='w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                  <div className='absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5'></div>
                </div>
              </label>
            </div>

            {/* 流式搜索 */}
            <div className='flex items-center justify-between'>
              <div>
                <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  流式搜索输出
                </h4>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  启用搜索结果实时流式输出，关闭后使用传统一次性搜索
                </p>
              </div>
              <label className='flex items-center cursor-pointer'>
                <div className='relative'>
                  <input
                    type='checkbox'
                    className='sr-only peer'
                    checked={settings.fluidSearch}
                    onChange={(e) =>
                      updateSetting('fluidSearch', e.target.checked)
                    }
                  />
                  <div className='w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                  <div className='absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5'></div>
                </div>
              </label>
            </div>

            {/* 直播视频浏览器直连 */}
            {isMenuEnabled('showLive') && (
              <div className='flex items-center justify-between'>
                <div>
                  <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    IPTV 视频浏览器直连
                  </h4>
                  <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                    开启 IPTV 视频浏览器直连时，需要自备 Allow CORS 插件
                  </p>
                </div>
                <label className='flex items-center cursor-pointer'>
                  <div className='relative'>
                    <input
                      type='checkbox'
                      className='sr-only peer'
                      checked={settings.liveDirectConnect}
                      onChange={(e) =>
                        updateSetting('liveDirectConnect', e.target.checked)
                      }
                    />
                    <div className='w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                    <div className='absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5'></div>
                  </div>
                </label>
              </div>
            )}

            {/* 分割线 */}
            <div className='border-t border-gray-200 dark:border-gray-700'></div>

            {/* 提醒消息免打扰 */}
            <div className='flex items-center justify-between'>
              <div>
                <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  提醒消息免打扰
                </h4>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  关闭后不再显示版本更新等提醒
                </p>
              </div>
              <label className='flex items-center cursor-pointer'>
                <div className='relative'>
                  <input
                    type='checkbox'
                    className='sr-only peer'
                    checked={settings.enableNotifications}
                    onChange={(e) =>
                      updateSetting('enableNotifications', e.target.checked)
                    }
                  />
                  <div className='w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                  <div className='absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5'></div>
                </div>
              </label>
            </div>

            {/* 底部说明 */}
            <div className='mt-6 pt-4 border-t border-gray-200 dark:border-gray-700'>
              <p className='text-xs text-gray-500 dark:text-gray-400 text-center'>
                这些设置保存在本地浏览器中
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // 修改密码面板内容
  const changePasswordPanel = (
    <>
      {/* 背景遮罩 */}
      <div
        className='fixed inset-0 bg-black/30 backdrop-blur-sm z-[1000]'
        onClick={handleCloseChangePassword}
        onTouchMove={(e) => {
          // 只阻止滚动，允许其他触摸事件
          e.preventDefault();
        }}
        onWheel={(e) => {
          // 阻止滚轮滚动
          e.preventDefault();
        }}
        style={{
          touchAction: 'none',
        }}
      />

      {/* 修改密码面板 */}
      <div className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white/60 dark:bg-gray-900/60 backdrop-blur-md rounded-2xl shadow-2xl z-[1001] flex flex-col'>
        {/* 内容容器 - 独立的滚动区域 */}
        <div
          className='h-full p-6'
          data-panel-content
          onTouchMove={(e) => {
            // 阻止事件冒泡到遮罩层，但允许内部滚动
            e.stopPropagation();
          }}
          style={{
            touchAction: 'auto', // 允许所有触摸操作
          }}
        >
          {/* 标题栏 */}
          <div className='flex items-center justify-between mb-6'>
            <h3 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
              修改密码
            </h3>
            <button
              onClick={handleCloseChangePassword}
              className='w-8 h-8 p-1 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
              aria-label='Close'
            >
              <X className='w-full h-full' />
            </button>
          </div>

          {/* 表单 */}
          <div className='space-y-4'>
            {/* 新密码输入 */}
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                新密码
              </label>
              <input
                type='password'
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400'
                placeholder='请输入新密码'
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={passwordLoading}
              />
            </div>

            {/* 确认密码输入 */}
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                确认密码
              </label>
              <input
                type='password'
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400'
                placeholder='请再次输入新密码'
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={passwordLoading}
              />
            </div>

            {/* 错误信息 */}
            {passwordError && (
              <div className='text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-200 dark:border-red-800'>
                {passwordError}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className='flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700'>
            <button
              onClick={handleCloseChangePassword}
              className='flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors'
              disabled={passwordLoading}
            >
              取消
            </button>
            <button
              onClick={handleSubmitChangePassword}
              className='flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
              disabled={passwordLoading || !newPassword || !confirmPassword}
            >
              {passwordLoading ? '修改中...' : '确认修改'}
            </button>
          </div>

          {/* 底部说明 */}
          <div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
            <p className='text-xs text-gray-500 dark:text-gray-400 text-center'>
              修改密码后需要重新登录
            </p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className='group relative'>
        <OptimizedAvatar
          onClick={() => setIsOpen(!isOpen)}
          size='nav'
          username={user?.username}
          className='transition-transform duration-1000 group-hover:rotate-360'
        />
      </div>

      {/* 使用 Portal 将菜单面板渲染到 document.body */}
      {isOpen && mounted && createPortal(menuPanel, document.body)}

      {/* 使用 Portal 将设置面板渲染到 document.body */}
      {isSettingsOpen && mounted && createPortal(settingsPanel, document.body)}

      {/* 使用 Portal 将修改密码面板渲染到 document.body */}
      {isChangePasswordOpen &&
        mounted &&
        createPortal(changePasswordPanel, document.body)}

      {/* 使用 Portal 将修改头像面板渲染到 document.body */}
      {isChangeAvatarOpen &&
        mounted &&
        createPortal(
          <>
            {/* 背景遮罩 */}
            <div
              className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]'
              onClick={handleCloseChangeAvatar}
              onTouchMove={(e) => e.preventDefault()}
              onWheel={(e) => e.preventDefault()}
              style={{ touchAction: 'none' }}
            />

            {/* 修改头像面板 */}
            <div className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white/60 dark:bg-gray-900/60 backdrop-blur-md rounded-2xl shadow-2xl z-[1001] overflow-hidden'>
              <div className='p-6'>
                {/* 标题栏 */}
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                    修改头像
                  </h3>
                  <button
                    onClick={handleCloseChangeAvatar}
                    className='w-8 h-8 p-1 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
                    aria-label='Close'
                  >
                    <X className='w-full h-full' />
                  </button>
                </div>

                {!showCropper ? (
                  <>
                    {/* 头像预览 */}
                    <div className='flex flex-col items-center justify-center gap-6 my-6'>
                      <OptimizedAvatar
                        size='large'
                        selectedImage={selectedImage}
                        username={user?.username}
                      />

                      {/* 上传按钮 */}
                      <div>
                        <input
                          ref={fileInputRef}
                          type='file'
                          accept='image/*'
                          className='hidden'
                          onChange={handleAvatarSelected}
                          disabled={isUploadingAvatar}
                        />
                        <button
                          onClick={handleOpenFileSelector}
                          disabled={isUploadingAvatar}
                          className='flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                        >
                          <Upload className='w-4 h-4' />
                          选择图片
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* 图片裁剪界面 */}
                    <div className='flex flex-col items-center justify-center gap-4 my-6'>
                      <div className='w-full max-w-md'>
                        <ReactCrop
                          crop={crop}
                          onChange={(_: PixelCrop, percentCrop: PercentCrop) =>
                            setCrop(percentCrop)
                          }
                          onComplete={(crop: PixelCrop) =>
                            setCompletedCrop(crop)
                          }
                          aspect={1}
                          circularCrop
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            ref={imageRef}
                            src={selectedImage}
                            alt='Crop me'
                            className='max-w-full max-h-64 object-contain'
                            onLoad={onImageLoad}
                          />
                        </ReactCrop>
                      </div>

                      <div className='flex gap-3'>
                        <button
                          onClick={() => {
                            setShowCropper(false);
                            setSelectedImage('');
                            setCompletedCrop(undefined);
                            setCrop({
                              unit: '%',
                              width: 80,
                              height: 80,
                              x: 10,
                              y: 10,
                            });
                            // 重置文件输入
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                          className='px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors'
                        >
                          重新选择
                        </button>
                        <button
                          onClick={handleConfirmCrop}
                          disabled={isUploadingAvatar || !completedCrop}
                          className='flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                        >
                          <Check className='w-4 h-4' />
                          {isUploadingAvatar ? '上传中...' : '确认上传'}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* 底部提示 */}
                <p className='text-xs text-gray-500 dark:text-gray-400 text-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
                  支持 JPG、PNG、GIF、WEBP 等格式
                </p>
              </div>
            </div>
          </>,
          document.body,
        )}

      {/* 版本面板 */}
      <VersionPanel
        isOpen={isVersionPanelOpen}
        onClose={() => setIsVersionPanelOpen(false)}
      />

      {/* 主题设置面板 */}
      <ThemeSettingsPanel
        isOpen={isThemeSettingsOpen}
        onClose={handleCloseThemeSettings}
      />
    </>
  );
};
