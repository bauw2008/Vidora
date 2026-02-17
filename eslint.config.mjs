import js from '@eslint/js';
import nextConfig from 'eslint-config-next';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
    ],
  },
  js.configs.recommended,
  ...nextConfig,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        HTMLElement: 'readonly',
        HTMLVideoElement: 'readonly',
        HTMLInputElement: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        TouchEvent: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        performance: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        crypto: 'readonly',
        self: 'readonly',
        EventSource: 'readonly',
        confirm: 'readonly',
        alert: 'readonly',
        Element: 'readonly',
        Node: 'readonly',
        NodeList: 'readonly',
        getComputedStyle: 'readonly',
        matchMedia: 'readonly',
        history: 'readonly',
        location: 'readonly',
        Image: 'readonly',
        ReadableStream: 'readonly',
        WritableStream: 'readonly',
        TransformStream: 'readonly',
        Uint8Array: 'readonly',
        ArrayBuffer: 'readonly',
        DataView: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        WeakMap: 'readonly',
        Promise: 'readonly',
        Symbol: 'readonly',
        Intl: 'readonly',
        JSON: 'readonly',
        Math: 'readonly',
        Object: 'readonly',
        Array: 'readonly',
        String: 'readonly',
        Number: 'readonly',
        Boolean: 'readonly',
        RegExp: 'readonly',
        Date: 'readonly',
        Error: 'readonly',
        TypeError: 'readonly',
        ReferenceError: 'readonly',
        SyntaxError: 'readonly',
        RangeError: 'readonly',
        // DOM types
        HTMLDivElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLFormElement: 'readonly',
        HTMLImageElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        WheelEvent: 'readonly',
        EventListener: 'readonly',
        DOMException: 'readonly',
        RequestInit: 'readonly',
        ReadableStreamDefaultReader: 'readonly',
        // TypeScript/Node types
        NodeJS: 'readonly',
        // Node.js globals
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        global: 'readonly',
        // React
        React: 'readonly',
        JSX: 'readonly',
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // 基础规则
      'no-unused-vars': 'off',
      'no-console': 'warn',
      'no-undef': 'error',

      // React 规则
      'react/no-unescaped-entities': 'off',
      'react/display-name': 'off',
      'react/jsx-curly-brace-presence': [
        'warn',
        { props: 'never', children: 'never' },
      ],
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // React Hooks 规则
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Import 排序规则
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      'simple-import-sort/exports': 'warn',
      'simple-import-sort/imports': [
        'warn',
        {
          groups: [
            ['^@?\\w', '^\\u0000'],
            ['^.+\\.s?css$'],
            ['^@/lib', '^@/hooks'],
            ['^@/data'],
            ['^@/components', '^@/container'],
            ['^@/store'],
            ['^@/'],
            [
              '^\\./?$',
              '^\\.(?!/?$)',
              '^\\.\\./?$',
              '^\\.\\.(?!/?$)',
              '^\\.\\./\\.\\./?$',
              '^\\.\\./\\.\\.(?!/?$)',
              '^\\.\\./\\.\\./\\.\\./?$',
              '^\\.\\./\\.\\./\\.\\.(?!/?$)',
            ],
            ['^@/types'],
            ['^'],
          ],
        },
      ],
    },
  },
  // 单独的 TypeScript 配置，覆盖 eslint-config-next 的默认规则
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
    },
  },
];
