'use client';

import { useEffect, useState } from 'react';

import Toast, { ToastManager } from './Toast';

export default function ToastContainer() {
  const [toasts, setToasts] = useState<
    Array<{
      id: string;
      type: 'success' | 'error' | 'warning' | 'info';
      message: string;
      duration?: number;
      position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
    }>
  >([]);

  useEffect(() => {
    const unsubscribe = ToastManager.subscribe((newToasts) => {
      setToasts(newToasts);
    });
    return unsubscribe;
  }, []);

  return (
    <>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          type={toast.type}
          message={toast.message}
          duration={toast.duration}
          position={toast.position}
          onClose={() => ToastManager.removeToast(toast.id)}
        />
      ))}
    </>
  );
}
