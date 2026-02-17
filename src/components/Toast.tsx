'use client';

import { useCallback, useEffect, useState } from 'react';

export interface ToastProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  onClose?: () => void;
}

// 统一的 Toast 样式配置
export const ToastStyles = {
  success: {
    bg: 'bg-green-500',
    text: 'text-white',
    icon: '✓',
    gradient: 'from-green-500 to-emerald-600',
  },
  error: {
    bg: 'bg-red-500',
    text: 'text-white',
    icon: '✕',
    gradient: 'from-red-500 to-rose-600',
  },
  warning: {
    bg: 'bg-yellow-500',
    text: 'text-black',
    icon: '⚠',
    gradient: 'from-yellow-500 to-orange-500',
  },
  info: {
    bg: 'bg-blue-500',
    text: 'text-white',
    icon: 'ℹ',
    gradient: 'from-blue-500 to-indigo-600',
  },
} as const;

export const ToastPositions = {
  'top-right': 'top-20 right-4',
  'top-left': 'top-20 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
} as const;

export default function Toast({
  type,
  message,
  duration = 3000,
  position = 'top-right',
  onClose,
}: ToastProps) {
  const [isVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleLeave = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose?.();
    }, 300); // 300ms 退场动画
  }, [onClose]);

  useEffect(() => {
    // 自动关闭
    const timer = setTimeout(() => {
      handleLeave();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, handleLeave]);

  const style = ToastStyles[type];
  const positionStyle = ToastPositions[position];

  return (
    <div
      className={`
        fixed z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg
        transform transition-all duration-300 ease-in-out
        bg-gradient-to-r ${style.gradient} ${style.text}
        ${positionStyle}
        ${
          isVisible && !isLeaving
            ? 'translate-x-0 opacity-100 scale-100'
            : isLeaving
              ? 'translate-x-full opacity-0 scale-95'
              : 'translate-x-full opacity-0 scale-95'
        }
      `}
    >
      <span className='text-lg font-semibold'>{style.icon}</span>
      <span className='text-sm font-medium'>{message}</span>
    </div>
  );
}

// Toast钩子
export function useToast() {
  if (!ToastManager) {
    // 如果在服务端或ToastManager未初始化，返回空函数
    return {
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    };
  }

  return {
    success: (message: string, duration?: number) =>
      ToastManager.success(message, duration),
    error: (message: string, duration?: number) =>
      ToastManager.error(message, duration),
    warning: (message: string, duration?: number) =>
      ToastManager.warning(message, duration),
    info: (message: string, duration?: number) =>
      ToastManager.info(message, duration),
  };
}

// Toast管理器
class ToastManagerClass {
  private toasts: Array<{
    id: string;
    type: ToastProps['type'];
    message: string;
    duration?: number;
    position?: ToastProps['position'];
  }> = [];

  private listeners: Array<(toasts: ToastManagerClass['toasts']) => void> = [];
  private counter = 0;

  addToast(toast: Omit<ToastProps, 'onClose'>) {
    // 使用时间戳和计数器生成唯一 ID
    const id = `${Date.now()}-${++this.counter}`;
    const newToast = { ...toast, id };

    this.toasts.push(newToast);
    this.notifyListeners();

    // 自动移除
    setTimeout(() => {
      this.removeToast(id);
    }, toast.duration || 3000);

    return id;
  }

  removeToast(id: string) {
    this.toasts = this.toasts.filter((toast) => toast.id !== id);
    this.notifyListeners();
  }

  subscribe(listener: (toasts: ToastManagerClass['toasts']) => void) {
    this.listeners.push(listener);
    listener([...this.toasts]);

    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  success(message: string, duration?: number) {
    return this.addToast({ type: 'success', message, duration });
  }

  error(message: string, duration?: number) {
    return this.addToast({ type: 'error', message, duration });
  }

  warning(message: string, duration?: number) {
    return this.addToast({ type: 'warning', message, duration });
  }

  info(message: string, duration?: number) {
    return this.addToast({ type: 'info', message, duration });
  }
}

// 确保ToastManager在客户端环境中正确初始化
export const ToastManager =
  typeof window !== 'undefined' ? new ToastManagerClass() : null;

// 监听全局Toast事件
if (typeof window !== 'undefined' && ToastManager) {
  window.addEventListener('showToast', (event: Event) => {
    const customEvent = event as CustomEvent;
    const { type, message, duration } = customEvent.detail;
    ToastManager[type](message, duration);
  });
}

// Toast Provider组件
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
