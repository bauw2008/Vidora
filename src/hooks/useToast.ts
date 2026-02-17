'use client';

import { useState } from 'react';

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

/**
 * 统一的 Toast Hook
 * 提供 success, error, warning, info 方法
 */
export function useToast() {
  const [toasts, setToasts] = useState<
    Array<{
      id: string;
      type: ToastProps['type'];
      message: string;
      duration?: number;
      position?: ToastProps['position'];
    }>
  >([]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const addToast = (toast: Omit<ToastProps, 'onClose'>) => {
    const id = `${Date.now()}-${Math.random()}`;
    const newToast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    // 自动移除
    setTimeout(() => {
      removeToast(id);
    }, toast.duration || 3000);

    return id;
  };

  const success = (message: string, duration?: number) => {
    return addToast({ type: 'success', message, duration });
  };

  const error = (message: string, duration?: number) => {
    return addToast({ type: 'error', message, duration });
  };

  const warning = (message: string, duration?: number) => {
    return addToast({ type: 'warning', message, duration });
  };

  const info = (message: string, duration?: number) => {
    return addToast({ type: 'info', message, duration });
  };

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };
}

// Toast 管理器（用于全局 Toast）
class ToastManagerClass {
  private counter = 0;

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

  private addToast(toast: Omit<ToastProps, 'onClose'>) {
    const id = `${Date.now()}-${++this.counter}`;

    // 触发自定义事件
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('showToast', {
          detail: toast,
        }),
      );
    }

    return id;
  }
}

// 导出 ToastManager 单例
export const ToastManager = new ToastManagerClass();
