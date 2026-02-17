'use client';

import type { ThemeProviderProps } from 'next-themes';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import * as React from 'react';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <>{children}</>;
  }

  return (
    <NextThemesProvider
      attribute='class'
      defaultTheme='system'
      enableSystem
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
