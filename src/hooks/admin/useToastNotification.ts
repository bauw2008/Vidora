import { useCallback } from 'react';

export const useToastNotification = () => {
  const showError = useCallback(async (message: string) => {
    if (typeof window !== 'undefined') {
      const { ToastManager } = await import('@/components/Toast');
      ToastManager?.error(message);
    }
  }, []);

  const showSuccess = useCallback(async (message: string) => {
    if (typeof window !== 'undefined') {
      const { ToastManager } = await import('@/components/Toast');
      ToastManager?.success(message);
    }
  }, []);

  const showWarning = useCallback(async (message: string) => {
    if (typeof window !== 'undefined') {
      const { ToastManager } = await import('@/components/Toast');
      ToastManager?.warning(message);
    }
  }, []);

  return { showError, showSuccess, showWarning };
};
