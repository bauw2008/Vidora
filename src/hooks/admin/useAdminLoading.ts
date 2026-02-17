import { useState } from 'react';

interface LoadingState {
  [key: string]: boolean;
}

export const useAdminLoading = () => {
  const [loadingStates, setLoadingStates] = useState<LoadingState>({});

  const setLoading = (key: string, loading: boolean) => {
    setLoadingStates((prev) => ({ ...prev, [key]: loading }));
  };

  const isLoading = (key: string) => loadingStates[key] || false;

  const withLoading = async <T>(
    key: string,
    operation: () => Promise<T>,
  ): Promise<T> => {
    setLoading(key, true);
    try {
      const result = await operation();
      return result;
    } finally {
      setLoading(key, false);
    }
  };

  const isAnyLoading = () => Object.values(loadingStates).some(Boolean);

  return {
    loadingStates,
    setLoading,
    isLoading,
    withLoading,
    isAnyLoading,
  };
};
