'use client';

import {
  Check,
  ChevronDown,
  Image,
  Monitor,
  Moon,
  Palette,
  Sliders,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import NextImage from 'next/image';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { logger } from '@/lib/logger';

interface ThemeSettings {
  themeOpacity: number; // 主题背景透明度
  globalUIOpacity: number; // 全局UI组件透明度
  lightGradient: string;
  darkGradient: string;
  hue: number;
  saturation: number;
  lightness: number;
  isCustom: boolean;
  backgroundImage?: string;
  backgroundMode: 'gradient' | 'image';
  enableDynamicBackground: boolean; // 启用动态背景
  dynamicIntensity: number; // 动态效果强度
}

interface GradientOption {
  name: string;
  light: string;
  dark: string;
  hue: number;
  saturation: number;
  lightness: number;
}

const gradientOptions: GradientOption[] = [
  {
    name: '纯净简约（默认）',
    light: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
    dark: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
    hue: 0,
    saturation: 0,
    lightness: 100,
  },
  {
    name: '琉璃通透（测试）',
    light:
      'linear-gradient(135deg, rgba(230, 240, 255, 0.15) 0%, rgba(200, 220, 255, 0.05) 100%)',
    dark: 'linear-gradient(135deg, rgba(100, 150, 255, 0.08) 0%, rgba(50, 100, 200, 0.02) 100%)',
    hue: 220,
    saturation: 80,
    lightness: 85,
  },
  {
    name: '梦幻彩虹',
    light:
      'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 25%, #fad0c4 50%, #a1c4fd 75%, #c2e9fb 100%)',
    dark: 'linear-gradient(135deg, #4a0080 0%, #6a0dad 25%, #8a2be2 50%, #9370db 75%, #7b68ee 100%)',
    hue: 280,
    saturation: 85,
    lightness: 85,
  },
  {
    name: '海洋夕阳',
    light:
      'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #fda085 100%)',
    dark: 'linear-gradient(135deg, #1a237e 0%, #283593 25%, #3949ab 50%, #3f51b5 75%, #5c6bc0 100%)',
    hue: 230,
    saturation: 85,
    lightness: 75,
  },
  {
    name: '热带风情',
    light:
      'linear-gradient(135deg, #ff609a 0%, #ffe140 25%, #ff609a 50%, #20dfd0 75%, #430867 100%)',
    dark: 'linear-gradient(135deg, #0a0023 0%, #430867 25%, #20dfd0 50%, #ffe140 75%, #ff609a 100%)',
    hue: 320,
    saturation: 90,
    lightness: 75,
  },
  {
    name: '森林晨雾',
    light:
      'linear-gradient(135deg, #0ba360 0%, #3cba92 25%, #30dd8a 50%, #2bb673 75%, #0ba360 100%)',
    dark: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 25%, #40916c 50%, #52b788 75%, #74c69d 100%)',
    hue: 150,
    saturation: 70,
    lightness: 60,
  },
  {
    name: '紫色梦幻',
    light:
      'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 25%, #a18cd1 50%, #fad0c4 75%, #ffecd2 100%)',
    dark: 'linear-gradient(135deg, #4a148c 0%, #6a1b9a 25%, #7b1fa2 50%, #8e24aa 75%, #9c27b0 100%)',
    hue: 280,
    saturation: 70,
    lightness: 75,
  },
  {
    name: '火焰橙红',
    light:
      'linear-gradient(135deg, #ff6b6b 0%, #feca57 25%, #ff9ff3 50%, #54a0ff 75%, #5f27cd 100%)',
    dark: 'linear-gradient(135deg, #c0392b 0%, #e74c3c 25%, #f39c12 50%, #f1c40f 75%, #e67e22 100%)',
    hue: 15,
    saturation: 85,
    lightness: 65,
  },
  {
    name: '冰雪蓝调',
    light:
      'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 25%, #a8edea 50%, #fed6e3 75%, #d299c2 100%)',
    dark: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 25%, #3a7bd5 50%, #00d2ff 75%, #3a7bd5 100%)',
    hue: 210,
    saturation: 75,
    lightness: 70,
  },
  {
    name: '翡翠绿意',
    light:
      'linear-gradient(135deg, #134e5e 0%, #71b280 25%, #a8e6cf 50%, #7fcdcd 75%, #556b8d 100%)',
    dark: 'linear-gradient(135deg, #0f2027 0%, #203a43 25%, #2c5364 50%, #1a535c 75%, #0f2027 100%)',
    hue: 180,
    saturation: 60,
    lightness: 50,
  },
  {
    name: '金色夕阳',
    light:
      'linear-gradient(135deg, #f7971e 0%, #ffd200 25%, #f7971e 50%, #ff6a00 75%, #ee0979 100%)',
    dark: 'linear-gradient(135deg, #8b4513 0%, #a0522d 25%, #cd853f 50%, #daa520 75%, #b8860b 100%)',
    hue: 35,
    saturation: 80,
    lightness: 60,
  },
  {
    name: '清新薄荷',
    light:
      'linear-gradient(135deg, #00b4db 0%, #0083b0 25%, #00b4db 50%, #5eb3fd 75%, #00d2ff 100%)',
    dark: 'linear-gradient(135deg, #1a535c 0%, #2c5f7c 25%, #4a7c7e 50%, #5eb3fd 75%, #00d2ff 100%)',
    hue: 190,
    saturation: 75,
    lightness: 60,
  },
  {
    name: '玫瑰花园',
    light:
      'linear-gradient(135deg, #ff0844 0%, #ffb199 25%, #ff0844 50%, #90e0ef 75%, #a8dadc 100%)',
    dark: 'linear-gradient(135deg, #590d22 0%, #800f2f 25%, #a4133c 50%, #c9184a 75%, #ff4d6d 100%)',
    hue: 340,
    saturation: 80,
    lightness: 55,
  },
  {
    name: '霓虹夜晚',
    light:
      'linear-gradient(135deg, #0f0c29 0%, #302b63 25%, #24243e 50%, #2d1b69 75%, #0f0c29 100%)',
    dark: 'linear-gradient(135deg, #000000 0%, #0f0c29 25%, #302b63 50%, #24243e 75%, #2d1b69 100%)',
    hue: 250,
    saturation: 60,
    lightness: 15,
  },
  {
    name: '夏日海滩',
    light:
      'linear-gradient(135deg, #ffeaa7 0%, #fab1a0 25%, #ff7675 50%, #74b9ff 75%, #a29bfe 100%)',
    dark: 'linear-gradient(135deg, #2d3436 0%, #636e72 25%, #74b9ff 50%, #0984e3 75%, #2d3436 100%)',
    hue: 200,
    saturation: 70,
    lightness: 65,
  },
  {
    name: '秋叶飘落',
    light:
      'linear-gradient(135deg, #f2994a 0%, #f2c94c 25%, #f2994a 50%, #eb5757 75%, #f2994a 100%)',
    dark: 'linear-gradient(135deg, #2c3e50 0%, #34495e 25%, #e67e22 50%, #d35400 75%, #2c3e50 100%)',
    hue: 30,
    saturation: 75,
    lightness: 55,
  },
  // 小清新系列 - 春天阳光暖意风格
  {
    name: '晨曦微光',
    light:
      'linear-gradient(135deg, #fff0d7 0%, #ffe18f 15%, #fdc25e 30%, #ffe9b5 45%, #ffe18f 60%, #fff0d7 80%, #ffe18f 100%)',
    dark: 'linear-gradient(135deg, #2c3e50 0%, #34495e 25%, #2c3e50 50%, #34495e 75%, #2c3e50 100%)',
    hue: 45,
    saturation: 50,
    lightness: 80,
  },
  {
    name: '薄荷奶绿',
    light:
      'linear-gradient(135deg, #e8f8f5 0%, #d1f2eb 15%, #a3e4d7 30%, #d5f4e6 45%, #a9dfbf 60%, #d5f4e6 80%, #a3e4d7 100%)',
    dark: 'linear-gradient(135deg, #1a535c 0%, #2c7a7b 25%, #1a535c 50%, #2c7a7b 75%, #1a535c 100%)',
    hue: 180,
    saturation: 30,
    lightness: 88,
  },
  {
    name: '樱花粉梦',
    light:
      'linear-gradient(135deg, #ffccd5 0%, #ffb3c1 15%, #ff8fa3 30%, #ffccd5 45%, #ffb3c1 60%, #ffccd5 80%, #ff8fa3 100%)',
    dark: 'linear-gradient(135deg, #590d22 0%, #800f2f 25%, #a4133c 50%, #c9184a 75%, #ff4d6d 100%)',
    hue: 340,
    saturation: 70,
    lightness: 75,
  },
  {
    name: '天空之境',
    light:
      'linear-gradient(135deg, #ebf5fb 0%, #d6eaf8 15%, #aed6f1 30%, #eaf2f8 45%, #d6eaf8 60%, #ebf5fb 80%, #aed6f1 100%)',
    dark: 'linear-gradient(135deg, #2c3e50 0%, #34495e 25%, #2c3e50 50%, #34495e 75%, #2c3e50 100%)',
    hue: 200,
    saturation: 35,
    lightness: 90,
  },
  {
    name: '青柠苏打',
    light:
      'linear-gradient(135deg, #eafaf1 0%, #d5f4e6 15%, #a9dfbf 30%, #e8f8f5 45%, #d5f4e6 60%, #eafaf1 80%, #a9dfbf 100%)',
    dark: 'linear-gradient(135deg, #1a535c 0%, #2c7a7b 25%, #1a535c 50%, #2c7a7b 75%, #1a535c 100%)',
    hue: 160,
    saturation: 30,
    lightness: 88,
  },
  {
    name: '蜜桃乌龙',
    light:
      'linear-gradient(135deg, #fef5e7 0%, #fdebd0 15%, #fad7a0 30%, #fcf3cf 45%, #fad7a0 60%, #fef5e7 80%, #fad7a0 100%)',
    dark: 'linear-gradient(135deg, #4a4a4a 0%, #6d6875 25%, #4a4a4a 50%, #6d6875 75%, #4a4a4a 100%)',
    hue: 35,
    saturation: 45,
    lightness: 90,
  },
  // 时尚现代系列
  {
    name: '北欧极简',
    light:
      'linear-gradient(135deg, #fafafa 0%, #f5f5f5 25%, #eeeeee 50%, #e0e0e0 75%, #fafafa 100%)',
    dark: 'linear-gradient(135deg, #212121 0%, #424242 25%, #616161 50%, #757575 75%, #212121 100%)',
    hue: 0,
    saturation: 0,
    lightness: 96,
  },
  {
    name: '莫兰迪灰',
    light:
      'linear-gradient(135deg, #e8e3df 0%, #d4cec7 25%, #c9c0b6 50%, #b8b0a8 75%, #e8e3df 100%)',
    dark: 'linear-gradient(135deg, #3d3d3d 0%, #4a4a4a 25%, #575757 50%, #636363 75%, #3d3d3d 100%)',
    hue: 30,
    saturation: 15,
    lightness: 85,
  },
  {
    name: '奶油慕斯',
    light:
      'linear-gradient(135deg, #fff8e7 0%, #ffecd2 25%, #fcb69f 50%, #ffecd2 75%, #fff8e7 100%)',
    dark: 'linear-gradient(135deg, #3e2723 0%, #5d4037 25%, #795548 50%, #8d6e63 75%, #3e2723 100%)',
    hue: 30,
    saturation: 50,
    lightness: 92,
  },
  {
    name: '午夜巴黎',
    light:
      'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 25%, #90caf9 50%, #64b5f6 75%, #e3f2fd 100%)',
    dark: 'linear-gradient(135deg, #0d1b2a 0%, #1b263b 25%, #415a77 50%, #778da9 75%, #0d1b2a 100%)',
    hue: 215,
    saturation: 60,
    lightness: 75,
  },
  {
    name: '石墨雅黑',
    light:
      'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 25%, #bdbdbd 50%, #9e9e9e 75%, #f5f5f5 100%)',
    dark: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 25%, #404040 50%, #525252 75%, #1a1a1a 100%)',
    hue: 0,
    saturation: 0,
    lightness: 20,
  },
  {
    name: '珊瑚海岸',
    light:
      'linear-gradient(135deg, #ffebee 0%, #ffcdd2 25%, #ef9a9a 50%, #e57373 75%, #ffebee 100%)',
    dark: 'linear-gradient(135deg, #3e2723 0%, #5d4037 25%, #795548 50%, #8d6e63 75%, #3e2723 100%)',
    hue: 0,
    saturation: 60,
    lightness: 80,
  },
  {
    name: '极光幻境',
    light:
      'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 25%, #a5d6a7 50%, #81c784 75%, #e8f5e9 100%)',
    dark: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 25%, #388e3c 50%, #43a047 75%, #1b5e20 100%)',
    hue: 122,
    saturation: 45,
    lightness: 85,
  },
  {
    name: '香槟玫瑰',
    light:
      'linear-gradient(135deg, #fce4ec 0%, #f8bbd9 25%, #f48fb1 50%, #f06292 75%, #fce4ec 100%)',
    dark: 'linear-gradient(135deg, #4a148c 0%, #6a1b9a 25%, #7b1fa2 50%, #8e24aa 75%, #4a148c 100%)',
    hue: 340,
    saturation: 55,
    lightness: 88,
  },
];

export const ThemeSettingsPanel: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<ThemeSettings>({
    themeOpacity: 100,
    globalUIOpacity: 95,
    lightGradient: gradientOptions[0].light,
    darkGradient: gradientOptions[0].dark,
    hue: gradientOptions[0].hue,
    saturation: gradientOptions[0].saturation,
    lightness: gradientOptions[0].lightness,
    isCustom: false,
    backgroundMode: 'gradient',
    enableDynamicBackground: false,
    dynamicIntensity: 50,
  });
  const [isGradientDropdownOpen, setIsGradientDropdownOpen] = useState(false);
  const [isAdvancedMenuOpen, setIsAdvancedMenuOpen] = useState(false);
  const [isBackgroundModeMenuOpen, setIsBackgroundModeMenuOpen] =
    useState(false);

  // 获取预览动画类
  const getPreviewAnimationClass = (intensity: number) => {
    if (intensity <= 20) {
      return 'subtle-gradient-animation';
    }
    if (intensity <= 40) {
      return 'subtle-gradient-animation breathing-animation';
    }
    if (intensity <= 60) {
      return 'strong-gradient-animation breathing-animation';
    }
    if (intensity <= 80) {
      return 'strong-gradient-animation strong-breathing-animation';
    }
    return 'ultra-strong-animation strong-breathing-animation';
  };

  // 移除滚动锁定逻辑，现在由 UserMenu 统一管理

  useEffect(() => {
    const loadSettings = async () => {
      if (typeof window !== 'undefined') {
        try {
          const savedSettings = localStorage.getItem('themeSettings');
          if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            // 验证解析后的数据结构
            if (parsed && typeof parsed === 'object') {
              setSettings({
                themeOpacity: parsed.themeOpacity || parsed.opacity || 100,
                globalUIOpacity: parsed.globalUIOpacity || 95,
                lightGradient: parsed.lightGradient || gradientOptions[0].light,
                darkGradient: parsed.darkGradient || gradientOptions[0].dark,
                hue: parsed.hue || gradientOptions[0].hue,
                saturation: parsed.saturation || gradientOptions[0].saturation,
                lightness: parsed.lightness || gradientOptions[0].lightness,
                isCustom: parsed.isCustom || false,
                backgroundImage: parsed.backgroundImage || undefined,
                backgroundMode: parsed.backgroundMode || 'gradient',
                enableDynamicBackground:
                  parsed.enableDynamicBackground || false,
                dynamicIntensity: parsed.dynamicIntensity || 50,
              });
            }
          }
        } catch (error) {
          logger.error('加载主题设置失败:', error);
        }
      }
    };

    const applyGlassWhiteBackground = () => {
      if (typeof document !== 'undefined') {
        const root = document.documentElement;
        const isDark =
          document.documentElement.classList.contains('dark') ||
          (window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: dark)').matches);

        const glassGradient = isDark
          ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)'
          : 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)';

        // 强制移除任何可能干扰的背景色
        document.body.className = document.body.className
          .replace(/bg-\w+/g, '')
          .trim();

        // 移除所有可能的背景色样式
        const allElements = document.querySelectorAll('*');
        allElements.forEach((element) => {
          const htmlElement = element as HTMLElement;
          if (htmlElement.style.backgroundColor) {
            // 只移除白色和黑色的背景色，保留其他功能性背景色
            const bgColor = htmlElement.style.backgroundColor;
            if (
              bgColor.includes('white') ||
              bgColor.includes('black') ||
              bgColor.includes('rgb(255, 255, 255)') ||
              bgColor.includes('rgb(0, 0, 0)')
            ) {
              htmlElement.style.backgroundColor = 'transparent';
            }
          }
        });

        // 立即应用到CSS变量、body和html元素
        root.style.setProperty('--bg-gradient', glassGradient);
        root.style.setProperty('--bg-opacity', '60%');

        // 使用requestAnimationFrame确保在下一帧应用主题，避免与其他渲染冲突
        requestAnimationFrame(() => {
          // 同时应用到body和html元素，确保全局生效
          document.body.style.background = glassGradient;
          document.body.style.backgroundSize = 'cover';
          document.body.style.backgroundAttachment = 'scroll';
          document.body.style.backgroundColor = 'transparent';
          document.body.style.opacity = '1';

          document.documentElement.style.background = glassGradient;
          document.documentElement.style.backgroundSize = 'cover';
          document.documentElement.style.backgroundAttachment = 'scroll';
          document.documentElement.style.backgroundColor = 'transparent';
          document.documentElement.style.opacity = '1';

          // 强制触发重绘，确保主题应用生效
          document.body.style.display = 'none';
          void document.body.offsetHeight; // 触发重排
          document.body.style.display = '';
        });
      }
    };

    const initializeSettings = async () => {
      // 只在面板不打开时应用纯净简约背景，避免影响滚动
      if (!isOpen) {
        applyGlassWhiteBackground();
      }

      setMounted(true);
      await loadSettings();
    };
    initializeSettings();
  }, [isOpen]);

  const saveSettings = (newSettings: ThemeSettings) => {
    if (typeof window !== 'undefined') {
      try {
        // 保存所有设置，包括背景图片
        const settingsString = JSON.stringify(newSettings);
        localStorage.setItem('themeSettings', settingsString);
      } catch (error) {
        logger.error('保存背景图片失败:', error);
        // 如果 localStorage 空间不足，只保存其他设置（不包括背景图片）
        const { backgroundImage: _, ...settingsWithoutImage } = newSettings;
        localStorage.setItem(
          'themeSettings',
          JSON.stringify(settingsWithoutImage),
        );
        alert('背景图片太大，无法保存。请选择更小的图片（建议小于 1MB）。');
      }
    }
  };

  const generateGradients = (
    hue: number,
    saturation: number,
    lightness: number,
  ) => {
    // 特殊处理纯净简约（默认）- 真正的透明琉璃效果
    if (hue === 0 && saturation === 0 && lightness === 100) {
      return {
        lightGradient: 'transparent',
        darkGradient: 'transparent',
      };
    }

    // 生成多色彩渐变 - 创建真正的五色渐变效果
    // 浅色模式渐变 - 使用互补色和类似色创建丰富效果
    const complementaryHue = (hue + 180) % 360;
    const analogousHue1 = (hue + 30) % 360;
    const analogousHue2 = (hue - 30 + 360) % 360;
    const triadicHue1 = (hue + 120) % 360;
    const triadicHue2 = (hue + 240) % 360;

    // 浅色模式使用更亮的颜色和更高的饱和度
    const lightColor1 = `hsl(${hue}, ${Math.min(
      saturation + 20,
      100,
    )}%, ${Math.min(lightness + 15, 95)}%)`;
    const lightColor2 = `hsl(${analogousHue1}, ${Math.min(
      saturation + 15,
      100,
    )}%, ${Math.min(lightness + 10, 95)}%)`;
    const lightColor3 = `hsl(${complementaryHue}, ${Math.min(
      saturation + 10,
      100,
    )}%, ${Math.min(lightness + 5, 95)}%)`;
    const lightColor4 = `hsl(${analogousHue2}, ${Math.min(
      saturation + 15,
      100,
    )}%, ${Math.min(lightness + 10, 95)}%)`;
    const lightColor5 = `hsl(${triadicHue1}, ${Math.min(
      saturation + 20,
      100,
    )}%, ${Math.min(lightness + 15, 95)}%)`;

    const lightGradient = `linear-gradient(135deg, ${lightColor1} 0%, ${lightColor2} 25%, ${lightColor3} 50%, ${lightColor4} 75%, ${lightColor5} 100%)`;

    // 深色模式使用更深的颜色和更高的饱和度
    const darkColor1 = `hsl(${hue}, ${Math.min(
      saturation + 25,
      100,
    )}%, ${Math.max(lightness - 30, 10)}%)`;
    const darkColor2 = `hsl(${triadicHue2}, ${Math.min(
      saturation + 20,
      100,
    )}%, ${Math.max(lightness - 20, 15)}%)`;
    const darkColor3 = `hsl(${complementaryHue}, ${Math.min(
      saturation + 15,
      100,
    )}%, ${Math.max(lightness - 25, 10)}%)`;
    const darkColor4 = `hsl(${analogousHue1}, ${Math.min(
      saturation + 20,
      100,
    )}%, ${Math.max(lightness - 15, 15)}%)`;
    const darkColor5 = `hsl(${triadicHue1}, ${Math.min(
      saturation + 25,
      100,
    )}%, ${Math.max(lightness - 35, 10)}%)`;

    const darkGradient = `linear-gradient(135deg, ${darkColor1} 0%, ${darkColor2} 25%, ${darkColor3} 50%, ${darkColor4} 75%, ${darkColor5} 100%)`;

    return { lightGradient, darkGradient };
  };

  // 为渐变添加透明度的辅助函数
  const addOpacityToGradient = (gradient: string, opacity: number): string => {
    // 解析渐变字符串，为每个颜色添加透明度
    if (gradient.includes('rgba')) {
      // 如果已经包含rgba，则调整现有的alpha值
      return gradient.replace(
        /rgba\((\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*)([\d.]+)\s*\)/g,
        (match, prefix, currentAlpha) => {
          const newAlpha = parseFloat(currentAlpha) * opacity;
          return `rgba(${prefix}${newAlpha})`;
        },
      );
    } else if (gradient.includes('rgb')) {
      // 如果是rgb，则转换为rgba并添加透明度
      return gradient.replace(
        /rgb\((\s*\d+\s*,\s*\d+\s*,\s*\d+\s*)\)/g,
        (match, colorValues) => {
          return `rgba(${colorValues} ${opacity})`;
        },
      );
    } else if (gradient.includes('#')) {
      // 如果是十六进制颜色，则转换为rgba并添加透明度
      return gradient.replace(/#[0-9a-fA-F]{3,6}/g, (hexColor) => {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
      });
    }

    // 如果无法解析，则返回原渐变
    return gradient;
  };

  const applyThemeSettings = useCallback(() => {
    if (!mounted) {
      return;
    }

    const root = document.documentElement;

    // 计算透明度值
    const themeOpacityValue = settings.themeOpacity / 100;
    // const globalUIOpacityValue = settings.globalUIOpacity / 100; // 目前未使用

    // 检测当前主题
    const isDarkMode =
      resolvedTheme === 'dark' ||
      document.documentElement.classList.contains('dark') ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    // 设置CSS变量
    root.style.setProperty('--bg-opacity', `${settings.themeOpacity}%`);
    root.style.setProperty('--ui-opacity', `${settings.globalUIOpacity}%`);

    // 应用主题设置
    if (typeof document !== 'undefined') {
      // 清理任何现有的背景设置
      document.body.style.background = 'none';
      document.body.style.backgroundColor = 'transparent';
      document.body.style.opacity = '1';
      document.documentElement.style.background = 'none';
      document.documentElement.style.backgroundColor = 'transparent';
      document.documentElement.style.opacity = '1';

      // 确保移除任何可能干扰的背景色类
      document.body.className = document.body.className
        .replace(/bg-\w+/g, '')
        .trim();

      // 移除可能存在的旧背景层
      const oldLayer = document.getElementById('theme-background-layer');
      if (oldLayer) {
        oldLayer.remove();
      }

      // 移除动态效果类
      document.body.classList.remove(
        'subtle-gradient-animation',
        'breathing-animation',
      );
      document.documentElement.classList.remove(
        'subtle-gradient-animation',
        'breathing-animation',
      );

      // 优先级处理：图片背景 > 预设渐变 > 自定义背景色
      if (settings.backgroundMode === 'image' && settings.backgroundImage) {
        // 图片背景模式 - 优先级最高
        document.body.style.backgroundImage = `url(${settings.backgroundImage})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundColor = 'transparent';
        document.body.style.opacity = themeOpacityValue.toString();

        document.documentElement.style.backgroundImage = `url(${settings.backgroundImage})`;
        document.documentElement.style.backgroundSize = 'cover';
        document.documentElement.style.backgroundPosition = 'center';
        document.documentElement.style.backgroundRepeat = 'no-repeat';
        document.documentElement.style.backgroundAttachment = 'fixed';
        document.documentElement.style.backgroundColor = 'transparent';
        document.documentElement.style.opacity = themeOpacityValue.toString();

        root.style.setProperty(
          '--bg-gradient',
          `url(${settings.backgroundImage})`,
        );

        // 移除琉璃通透模式的类
        document.body.classList.remove('glass-transparent-mode');
        document.documentElement.classList.remove('glass-transparent-mode');
      } else if (!settings.isCustom) {
        // 预设渐变模式 - 使用固定的预设渐变
        const currentGradient = isDarkMode
          ? settings.darkGradient
          : settings.lightGradient;

        // 特殊处理琉璃通透 - 浅蓝色琉璃效果
        const isGlassBlue =
          (settings.lightGradient.includes('rgba(230, 240, 255, 0.15)') &&
            settings.darkGradient.includes('rgba(100, 150, 255, 0.08)')) ||
          (!settings.isCustom &&
            settings.lightGradient === gradientOptions[1].light &&
            settings.darkGradient === gradientOptions[1].dark);

        if (isGlassBlue) {
          // 琉璃通透模式：浅蓝色玻璃效果

          // 创建真正的琉璃通透效果
          const createGlassEffect = () => {
            // 步骤1：移除所有现有的背景层
            const existingLayers = document.querySelectorAll('[id^="glass-"]');
            existingLayers.forEach((layer) => layer.remove());

            // 步骤2：设置透明背景，让页面内容显示
            document.documentElement.style.background = 'transparent';
            document.documentElement.style.backgroundColor = 'transparent';
            document.body.style.background = 'transparent';
            document.body.style.backgroundColor = 'transparent';

            // 步骤3：创建琉璃通透层 - 使用更深的蓝色半透明层
            // 步骤3：创建琉璃通透层 - 使用更深的蓝色半透明层
            const glassLayer = document.createElement('div');
            glassLayer.id = 'glass-effect-layer';

            glassLayer.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: linear-gradient(135deg, 
                rgba(180, 200, 240, 0.25) 0%, 
                rgba(150, 180, 230, 0.15) 100%);
              backdrop-filter: blur(12px) saturate(150%);
              -webkit-backdrop-filter: blur(12px) saturate(150%);
              z-index: -1;
              pointer-events: none;
            `;

            // 步骤4：添加光泽层，增强琉璃质感
            const shineLayer = document.createElement('div');
            shineLayer.id = 'glass-shine-layer';

            shineLayer.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: linear-gradient(135deg, 
                rgba(255, 255, 255, 0.1) 0%, 
                rgba(255, 255, 255, 0.05) 25%, 
                rgba(255, 255, 255, 0.02) 50%, 
                rgba(255, 255, 255, 0.05) 75%, 
                rgba(255, 255, 255, 0.1) 100%);
              backdrop-filter: blur(4px);
              -webkit-backdrop-filter: blur(4px);
              z-index: -1;
              pointer-events: none;
              mix-blend-mode: overlay;
              opacity: 0.4;
            `;

            // 步骤5：添加层到页面
            document.body.appendChild(glassLayer);
            document.body.appendChild(shineLayer);

            // 步骤6：设置CSS变量
            const root = document.documentElement;
            root.style.setProperty('--bg-gradient', 'transparent');
          };

          // 强制移除所有背景设置
          document.body.style.background = 'none';
          document.body.style.backgroundColor = 'transparent';
          document.body.style.backgroundImage = 'none';
          document.documentElement.style.background = 'none';
          document.documentElement.style.backgroundColor = 'transparent';
          document.documentElement.style.backgroundImage = 'none';

          // 设置CSS变量为透明
          root.style.setProperty('--bg-gradient', 'transparent');

          // 强制移除body上的任何背景类
          document.body.className = document.body.className
            .replace(/bg-\w+/g, '')
            .trim();

          // 添加一个特殊的类来标识琉璃通透模式
          document.body.classList.add('glass-transparent-mode');
          document.documentElement.classList.add('glass-transparent-mode');

          // 创建玻璃效果
          createGlassEffect();
        } else {
          // 其他预设渐变
          const gradientWithOpacity = addOpacityToGradient(
            currentGradient,
            themeOpacityValue,
          );

          // 如果启用了动态背景且强度大于0，添加动画效果
          if (
            settings.enableDynamicBackground &&
            settings.backgroundMode === 'gradient' &&
            settings.dynamicIntensity > 0
          ) {
            // 移除之前的动画类
            document.body.classList.remove(
              'dynamic-background-enabled',
              'subtle-gradient-animation',
              'strong-gradient-animation',
              'breathing-animation',
              'strong-breathing-animation',
              'ultra-strong-animation',
            );

            // 添加动态背景启用类
            document.body.classList.add('dynamic-background-enabled');

            // 根据动态强度选择动画效果
            // 强度分级：0% 关闭，1-20% 低强度，21-40% 中强度，41-60% 中高强度，61-80% 高强度，81-100% 超强度
            let animationClass = '';
            let breathingClass = '';

            if (settings.dynamicIntensity === 0) {
              // 0% 完全关闭动态效果
              animationClass = '';
              breathingClass = '';
            } else if (settings.dynamicIntensity <= 20) {
              // 低强度 - 微妙变化
              animationClass = 'subtle-gradient-animation';
            } else if (settings.dynamicIntensity <= 40) {
              // 中强度 - 中等变化 + 呼吸效果
              animationClass = 'subtle-gradient-animation';
              breathingClass = 'breathing-animation';
            } else if (settings.dynamicIntensity <= 60) {
              // 中高强度 - 强烈变化 + 呼吸效果
              animationClass = 'strong-gradient-animation';
              breathingClass = 'breathing-animation';
            } else if (settings.dynamicIntensity <= 80) {
              // 高强度 - 强烈变化 + 强呼吸效果
              animationClass = 'strong-gradient-animation';
              breathingClass = 'strong-breathing-animation';
            } else {
              // 超强度 - 极致变化
              animationClass = 'ultra-strong-animation';
              breathingClass = 'strong-breathing-animation';
            }

            // 添加动画类到body
            document.body.classList.add(animationClass);
            if (breathingClass) {
              document.body.classList.add(breathingClass);
            }
          } else {
            // 如果没有启用动态背景，移除所有动态背景类
            document.body.classList.remove(
              'dynamic-background-enabled',
              'subtle-gradient-animation',
              'strong-gradient-animation',
              'breathing-animation',
              'strong-breathing-animation',
              'ultra-strong-animation',
            );
          }

          // 设置body背景
          document.body.style.background = gradientWithOpacity;
          document.body.style.backgroundAttachment = 'fixed';
          document.body.style.backgroundColor = 'transparent';
          document.body.style.opacity = '1';

          document.documentElement.style.background = 'none';
          document.documentElement.style.backgroundColor = 'transparent';
          document.documentElement.style.opacity = '1';

          root.style.setProperty('--bg-gradient', gradientWithOpacity);

          // 移除琉璃通透模式的类
          document.body.classList.remove('glass-transparent-mode');
          document.documentElement.classList.remove('glass-transparent-mode');
        }
      } else {
        // 自定义背景色模式 - 使用generateGradients函数生成
        const generatedGradients = generateGradients(
          settings.hue,
          settings.saturation,
          settings.lightness,
        );
        const currentGradient = isDarkMode
          ? generatedGradients.darkGradient
          : generatedGradients.lightGradient;
        const gradientWithOpacity = addOpacityToGradient(
          currentGradient,
          themeOpacityValue,
        );

        // 如果启用了动态背景且强度大于0，添加动画效果
        if (
          settings.enableDynamicBackground &&
          settings.backgroundMode === 'gradient' &&
          settings.dynamicIntensity > 0
        ) {
          // 移除之前的动画类
          document.body.classList.remove(
            'dynamic-background-enabled',
            'subtle-gradient-animation',
            'strong-gradient-animation',
            'breathing-animation',
            'strong-breathing-animation',
            'ultra-strong-animation',
          );

          // 添加动态背景启用类
          document.body.classList.add('dynamic-background-enabled');

          // 根据动态强度选择动画效果 - 自定义渐变部分
          // 强度分级：0% 关闭，1-20% 低强度，21-40% 中强度，41-60% 中高强度，61-80% 高强度，81-100% 超强度
          let animationClass = '';
          let breathingClass = '';

          if (settings.dynamicIntensity === 0) {
            // 0% 完全关闭动态效果
            animationClass = '';
            breathingClass = '';
          } else if (settings.dynamicIntensity <= 20) {
            // 低强度 - 微妙变化
            animationClass = 'subtle-gradient-animation';
          } else if (settings.dynamicIntensity <= 40) {
            // 中强度 - 中等变化 + 呼吸效果
            animationClass = 'subtle-gradient-animation';
            breathingClass = 'breathing-animation';
          } else if (settings.dynamicIntensity <= 60) {
            // 中高强度 - 强烈变化 + 呼吸效果
            animationClass = 'strong-gradient-animation';
            breathingClass = 'breathing-animation';
          } else if (settings.dynamicIntensity <= 80) {
            // 高强度 - 强烈变化 + 强呼吸效果
            animationClass = 'strong-gradient-animation';
            breathingClass = 'strong-breathing-animation';
          } else {
            // 超强度 - 极致变化
            animationClass = 'ultra-strong-animation';
            breathingClass = 'strong-breathing-animation';
          }

          // 添加动画类到body
          document.body.classList.add(animationClass);
          if (breathingClass) {
            document.body.classList.add(breathingClass);
          }

          logger.log(
            `Applied custom dynamic effects: intensity=${settings.dynamicIntensity}%, animation=${animationClass}`,
          );
        } else {
          // 如果没有启用动态背景，移除所有动态背景类
          document.body.classList.remove(
            'dynamic-background-enabled',
            'subtle-gradient-animation',
            'strong-gradient-animation',
            'breathing-animation',
            'strong-breathing-animation',
            'ultra-strong-animation',
          );
        }

        // 设置body背景
        document.body.style.background = gradientWithOpacity;
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundColor = 'transparent';
        document.body.style.opacity = '1';

        document.documentElement.style.background = 'none';
        document.documentElement.style.backgroundColor = 'transparent';
        document.documentElement.style.opacity = '1';

        root.style.setProperty('--bg-gradient', gradientWithOpacity);
        logger.log(
          'Applied custom gradient with dynamic effects:',
          gradientWithOpacity,
        );

        // 移除琉璃通透模式的类
        document.body.classList.remove('glass-transparent-mode');
        document.documentElement.classList.remove('glass-transparent-mode');
      }

      // 应用全局UI透明度到所有UI元素
      root.style.setProperty('--ui-opacity', `${settings.globalUIOpacity}%`);

      // 强制触发重绘，确保主题应用生效
      requestAnimationFrame(() => {
        document.body.style.display = 'none';
        void document.body.offsetHeight; // 触发重排
        document.body.style.display = '';
      });
    }
  }, [settings, resolvedTheme, mounted]);

  useEffect(() => {
    if (mounted) {
      // 使用requestAnimationFrame确保在下一帧应用主题，避免与其他渲染冲突
      requestAnimationFrame(() => {
        applyThemeSettings();
      });
    }
  }, [mounted, applyThemeSettings]);

  const handleThemeOpacityChange = (value: number) => {
    const newSettings = { ...settings, themeOpacity: value, isCustom: true };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleGlobalUIOpacityChange = (value: number) => {
    const newSettings = { ...settings, globalUIOpacity: value, isCustom: true };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleHueChange = (value: number) => {
    const newSettings = { ...settings, hue: value, isCustom: true };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleSaturationChange = (value: number) => {
    const newSettings = { ...settings, saturation: value, isCustom: true };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleLightnessChange = (value: number) => {
    const newSettings = { ...settings, lightness: value, isCustom: true };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleBackgroundModeChange = (mode: 'gradient' | 'image') => {
    // 如果切换到图片背景模式，自动设置透明度为100%以确保图片清晰
    const newSettings = {
      ...settings,
      backgroundMode: mode,
      themeOpacity: mode === 'image' ? 100 : settings.themeOpacity,
    };
    setSettings(newSettings);
    saveSettings(newSettings);
    setIsBackgroundModeMenuOpen(false);
  };

  const handleBackgroundImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      // 检查文件大小（限制为 1MB）
      const maxSize = 1 * 1024 * 1024; // 1MB
      if (file.size > maxSize) {
        alert('图片太大，请选择小于 1MB 的图片');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imageDataUrl = e.target?.result as string;

          const newSettings = {
            ...settings,
            backgroundImage: imageDataUrl,
            backgroundMode: 'image' as 'image' | 'gradient',
            themeOpacity: 100, // 设置透明度为100%以确保图片清晰
          };
          setSettings(newSettings);
          saveSettings(newSettings);
        } catch (error) {
          logger.error('Failed to store background image:', error);
          alert('上传背景图片失败，请重试');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveBackgroundImage = () => {
    const newSettings = {
      ...settings,
      backgroundImage: undefined,
      backgroundMode: 'gradient' as 'image' | 'gradient',
    };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleGradientChange = (option: GradientOption) => {
    const newSettings: ThemeSettings = {
      ...settings,
      lightGradient: option.light,
      darkGradient: option.dark,
      hue: option.hue,
      saturation: option.saturation,
      lightness: option.lightness,
      isCustom: false,
      // 如果选择了预设渐变，应该切换到渐变背景模式
      backgroundMode: 'gradient',
    };
    setSettings(newSettings);
    saveSettings(newSettings);
    setIsGradientDropdownOpen(false);

    // 立即应用新的渐变设置，不等待useEffect触发
    if (typeof document !== 'undefined') {
      requestAnimationFrame(() => {
        const root = document.documentElement;
        const isDarkMode =
          resolvedTheme === 'dark' ||
          document.documentElement.classList.contains('dark') ||
          window.matchMedia('(prefers-color-scheme: dark)').matches;

        const currentGradient = isDarkMode ? option.dark : option.light;
        const themeOpacityValue = newSettings.themeOpacity / 100;

        // 特殊处理琉璃通透 - 浅蓝色琉璃效果
        const isGlassBlue =
          option.light.includes('rgba(230, 240, 255, 0.15)') &&
          option.dark.includes('rgba(100, 150, 255, 0.08)');

        if (isGlassBlue) {
          // 琉璃通透模式：真正的玻璃效果
          logger.log('Applied glass transparent theme - real glass effect');

          // 创建真正的透明玻璃效果
          const createGlassEffect = () => {
            logger.log('Creating glass effect...');

            // 步骤1：移除所有现有的背景层
            const existingLayers = document.querySelectorAll('[id^="glass-"]');
            existingLayers.forEach((layer) => layer.remove());

            // 步骤2：强制设置html和body为透明，这是关键
            document.documentElement.style.background = 'transparent';
            document.documentElement.style.backgroundColor = 'transparent';
            document.body.style.background = 'transparent';
            document.body.style.backgroundColor = 'transparent';

            // 步骤3：不需要创建额外的内容层，直接使用页面内容作为背景
            // 琉璃通透效果应该模糊实际的页面内容，而不是添加额外的背景层

            // 移除任何可能干扰的背景设置
            document.documentElement.style.background = 'transparent';
            document.body.style.background = 'transparent';

            // 确保页面内容可见，让玻璃效果可以模糊实际内容
            document.body.style.backgroundColor = 'transparent';
            document.documentElement.style.backgroundColor = 'transparent';

            // 步骤4：创建玻璃效果层，这是核心
            const glassLayer = document.createElement('div');
            glassLayer.id = 'glass-effect-layer';

            glassLayer.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: rgba(255, 255, 255, 0.03); /* 更薄的白色半透明层 */
              backdrop-filter: blur(20px) saturate(200%);
              -webkit-backdrop-filter: blur(20px) saturate(200%);
              z-index: -2; /* 中间层 */
              pointer-events: none;
              border: 1px solid rgba(255, 255, 255, 0.05);
            `;

            // 步骤5：添加光泽层，增强玻璃质感
            const shineLayer = document.createElement('div');
            shineLayer.id = 'glass-shine-layer';

            shineLayer.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: linear-gradient(135deg, 
                rgba(255, 255, 255, 0.2) 0%, 
                rgba(255, 255, 255, 0.1) 25%, 
                rgba(255, 255, 255, 0.05) 50%, 
                rgba(255, 255, 255, 0.1) 75%, 
                rgba(255, 255, 255, 0.2) 100%);
              backdrop-filter: blur(4px);
              -webkit-backdrop-filter: blur(4px);
              z-index: -2; /* 与玻璃层同一层级 */
              pointer-events: none;
              mix-blend-mode: overlay;
              opacity: 0.7;
              animation: shimmer 8s ease-in-out infinite;
            `;

            // 添加光泽动画
            const shimmerStyle = document.createElement('style');
            shimmerStyle.textContent = `
              @keyframes shimmer {
                0%, 100% { opacity: 0.6; }
                50% { opacity: 0.9; }
              }
            `;
            document.head.appendChild(shimmerStyle);

            // 步骤6：按正确顺序添加层
            // 顺序很重要：先玻璃层，再光泽层
            document.body.appendChild(glassLayer);
            document.body.appendChild(shineLayer);

            // 步骤7：设置CSS变量
            const root = document.documentElement;
            root.style.setProperty('--bg-gradient', 'transparent');

            logger.log(
              'Glass effect created with proper layer structure and animated content',
            );
          };

          // 强制移除所有背景设置
          document.body.style.background = 'none';
          document.body.style.backgroundColor = 'transparent';
          document.body.style.backgroundImage = 'none';
          document.documentElement.style.background = 'none';
          document.documentElement.style.backgroundColor = 'transparent';
          document.documentElement.style.backgroundImage = 'none';

          // 设置CSS变量为透明
          root.style.setProperty('--bg-gradient', 'transparent');

          // 强制移除body上的任何背景类
          document.body.className = document.body.className
            .replace(/bg-\w+/g, '')
            .trim();

          // 添加一个特殊的类来标识琉璃通透模式
          document.body.classList.add('glass-transparent-mode');
          document.documentElement.classList.add('glass-transparent-mode');

          // 创建玻璃效果
          createGlassEffect();
        } else {
          // 其他预设渐变
          const gradientWithOpacity = addOpacityToGradient(
            currentGradient,
            themeOpacityValue,
          );

          document.body.style.background = gradientWithOpacity;
          document.body.style.backgroundSize = 'cover';
          document.body.style.backgroundAttachment = 'fixed';
          document.body.style.backgroundColor = 'transparent';
          document.body.style.opacity = '1';

          document.documentElement.style.background = gradientWithOpacity;
          document.documentElement.style.backgroundSize = 'cover';
          document.documentElement.style.backgroundAttachment = 'fixed';
          document.documentElement.style.backgroundColor = 'transparent';
          document.documentElement.style.opacity = '1';

          root.style.setProperty('--bg-gradient', gradientWithOpacity);
          logger.log('Applied preset gradient:', gradientWithOpacity);
          // 移除琉璃通透模式的类
          document.body.classList.remove('glass-transparent-mode');
          document.documentElement.classList.remove('glass-transparent-mode');
        }

        root.style.setProperty('--bg-opacity', `${newSettings.themeOpacity}%`);

        // 强制触发重绘，确保主题应用生效
        document.body.style.display = 'none';
        void document.body.offsetHeight; // 触发重排
        document.body.style.display = '';
      });
    }
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
  };

  const getCurrentGradientName = () => {
    if (settings.isCustom) {
      return '自定义';
    }
    return (
      gradientOptions.find(
        (option) =>
          option.light === settings.lightGradient &&
          option.dark === settings.darkGradient,
      )?.name || '自定义'
    );
  };

  const handleResetSettings = () => {
    const defaultSettings: ThemeSettings = {
      themeOpacity: 100,
      globalUIOpacity: 95,
      lightGradient: gradientOptions[0].light,
      darkGradient: gradientOptions[0].dark,
      hue: gradientOptions[0].hue,
      saturation: gradientOptions[0].saturation,
      lightness: gradientOptions[0].lightness,
      isCustom: false,
      backgroundImage: undefined,
      backgroundMode: 'gradient',
      enableDynamicBackground: false,
      dynamicIntensity: 50,
    };
    setSettings(defaultSettings);
    saveSettings(defaultSettings);
    setIsAdvancedMenuOpen(false);
  };

  if (!mounted) {
    return null;
  }

  if (!isOpen) {
    return null;
  }

  // 设置面板内容
  const panelContent = (
    <>
      {/* 背景遮罩 */}
      <div
        className='fixed inset-0 bg-black/30 backdrop-blur-sm z-[1000]'
        onClick={onClose}
        onTouchMove={(e) => {
          // 只在面板打开时阻止背景滚动
          if (isOpen) {
            e.preventDefault();
          }
        }}
        onWheel={(e) => {
          // 只在面板打开时阻止背景滚轮滚动
          if (isOpen) {
            e.preventDefault();
          }
        }}
        style={{
          touchAction: isOpen ? 'none' : 'auto',
        }}
      />

      {/* 设置面板 */}
      <div className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[95vh] bg-white/60 dark:bg-gray-900/60 backdrop-blur-md rounded-2xl shadow-2xl z-[1001] flex flex-col'>
        {/* 内容容器 - 独立的滚动区域 */}
        <div
          className='flex-1 p-4 md:p-6 overflow-y-auto'
          data-panel-content
          style={{
            touchAction: 'pan-y', // 只允许垂直滚动
            overscrollBehavior: 'contain', // 防止滚动冒泡
          }}
        >
          {/* 标题栏 */}
          <div className='flex items-center justify-between mb-6'>
            <div className='flex items-center gap-3'>
              <Palette className='w-5 h-5 text-blue-500' />
              <h3 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                主题设置
              </h3>
            </div>
            <button
              onClick={onClose}
              className='w-8 h-8 p-1 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
              aria-label='Close'
            >
              <X className='w-full h-full' />
            </button>
          </div>

          {/* 设置项 */}
          <div className='space-y-4'>
            {/* 主题模式 */}
            <div className='space-y-3'>
              <div className='flex items-center gap-2'>
                <Sliders className='w-4 h-4 text-gray-500' />
                <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  主题模式
                </h4>
              </div>
              <div className='flex gap-2'>
                <button
                  onClick={() => handleThemeChange('light')}
                  title='浅色模式'
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    resolvedTheme === 'light'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  <Sun className='w-4 h-4' />
                </button>
                <button
                  onClick={() => handleThemeChange('dark')}
                  title='深色模式'
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    resolvedTheme === 'dark'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  <Moon className='w-4 h-4' />
                </button>
                <button
                  onClick={() => handleThemeChange('system')}
                  title='跟随系统'
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    theme === 'system'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  <Monitor className='w-4 h-4' />
                </button>
              </div>
            </div>

            {/* 分割线 */}
            <div className='border-t border-gray-200 dark:border-gray-700' />

            {/* 预设渐变 */}
            <div className='space-y-3'>
              <div className='flex items-center gap-2'>
                <Palette className='w-4 h-4 text-gray-500' />
                <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  预设渐变
                </h4>
              </div>
              <div className='relative'>
                <button
                  type='button'
                  onClick={() =>
                    setIsGradientDropdownOpen(!isGradientDropdownOpen)
                  }
                  className='w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm hover:border-gray-400 dark:hover:border-gray-500 text-left'
                >
                  {getCurrentGradientName()}
                </button>

                {/* 下拉箭头 */}
                <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
                      isGradientDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>

                {/* 下拉选项列表 */}
                {isGradientDropdownOpen && (
                  <div className='absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto'>
                    {gradientOptions.map((option) => (
                      <button
                        key={option.name}
                        type='button'
                        onClick={() => handleGradientChange(option)}
                        className={`w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 ${
                          option.light === settings.lightGradient &&
                          option.dark === settings.darkGradient
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        <span className='truncate'>{option.name}</span>
                        {option.light === settings.lightGradient &&
                          option.dark === settings.darkGradient && (
                            <Check className='w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2' />
                          )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 渐变预览 */}
              <div className='flex gap-2'>
                <div className='flex-1 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600'>
                  <div
                    className={`w-full h-full ${
                      settings.enableDynamicBackground
                        ? getPreviewAnimationClass(settings.dynamicIntensity)
                        : ''
                    }`}
                    style={{
                      background: settings.isCustom
                        ? generateGradients(
                            settings.hue,
                            settings.saturation,
                            settings.lightness,
                          ).lightGradient
                        : settings.lightGradient,
                    }}
                  />
                </div>
                <div className='flex-1 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600'>
                  <div
                    className={`w-full h-full ${
                      settings.enableDynamicBackground
                        ? getPreviewAnimationClass(settings.dynamicIntensity)
                        : ''
                    }`}
                    style={{
                      background: settings.isCustom
                        ? generateGradients(
                            settings.hue,
                            settings.saturation,
                            settings.lightness,
                          ).darkGradient
                        : settings.darkGradient,
                    }}
                  />
                </div>
              </div>
              <p className='text-xs text-gray-500 dark:text-gray-400'>
                左侧为浅色模式背景，右侧为深色模式背景
                {settings.enableDynamicBackground && ' • 动态效果已启用'}
              </p>

              {/* 动态背景开关 */}
              <div className='flex items-center justify-between mt-4'>
                <div className='flex items-center gap-2'>
                  <Palette className='w-4 h-4 text-gray-500' />
                  <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    动态背景效果
                  </span>
                </div>
                <button
                  type='button'
                  onClick={() => {
                    const newSettings = {
                      ...settings,
                      enableDynamicBackground:
                        !settings.enableDynamicBackground,
                    };
                    setSettings(newSettings);
                    saveSettings(newSettings);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.enableDynamicBackground
                      ? 'bg-blue-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.enableDynamicBackground
                        ? 'translate-x-6'
                        : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* 动态强度调节 */}
              {settings.enableDynamicBackground && (
                <div className='space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700'>
                  <div className='flex items-center gap-2'>
                    <Sliders className='w-4 h-4 text-gray-500' />
                    <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                      动态强度
                    </h4>
                    <span className='text-xs text-gray-500 dark:text-gray-400 ml-auto'>
                      {settings.dynamicIntensity}%
                    </span>
                  </div>
                  <input
                    type='range'
                    min='0'
                    max='100'
                    value={settings.dynamicIntensity}
                    onChange={(e) => {
                      const newSettings = {
                        ...settings,
                        dynamicIntensity: Number(e.target.value),
                      };
                      setSettings(newSettings);
                      saveSettings(newSettings);
                    }}
                    className='w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider'
                  />
                  <p className='text-xs text-gray-500 dark:text-gray-400'>
                    调节动态效果的强度，数值越高动画越明显
                  </p>
                </div>
              )}
            </div>

            {/* 分割线 */}
            <div className='border-t border-gray-200 dark:border-gray-700' />

            {/* 背景模式设置 */}
            <div className='space-y-3'>
              <div className='flex items-center gap-2'>
                <Image
                  className='w-4 h-4 text-gray-500'
                  aria-label='背景模式图标'
                />
                <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  背景模式
                </h4>
              </div>
              <div className='relative'>
                <button
                  type='button'
                  onClick={() =>
                    setIsBackgroundModeMenuOpen(!isBackgroundModeMenuOpen)
                  }
                  className='w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm hover:border-gray-400 dark:hover:border-gray-500 text-left'
                >
                  {settings.backgroundMode === 'gradient'
                    ? '渐变背景'
                    : '图片背景'}
                </button>

                {/* 下拉箭头 */}
                <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
                      isBackgroundModeMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>

                {/* 下拉选项列表 */}
                {isBackgroundModeMenuOpen && (
                  <div className='absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg'>
                    <button
                      type='button'
                      onClick={() => handleBackgroundModeChange('gradient')}
                      className={`w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        settings.backgroundMode === 'gradient'
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      <span>渐变背景</span>
                      {settings.backgroundMode === 'gradient' && (
                        <Check className='w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2' />
                      )}
                    </button>
                    <button
                      type='button'
                      onClick={() => handleBackgroundModeChange('image')}
                      className={`w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        settings.backgroundMode === 'image'
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      <span>图片背景</span>
                      {settings.backgroundMode === 'image' && (
                        <Check className='w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2' />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* 背景图片上传 */}
              {settings.backgroundMode === 'image' && (
                <div className='space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700'>
                  <div className='flex items-center gap-2'>
                    <Upload className='w-4 h-4 text-gray-500' />
                    <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                      背景图片
                    </h4>
                  </div>

                  {settings.backgroundImage ? (
                    <div className='space-y-3'>
                      <div className='relative h-48 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600'>
                        <NextImage
                          src={settings.backgroundImage}
                          alt='背景预览'
                          fill
                          className='w-full h-full object-cover'
                          unoptimized
                        />
                        <button
                          onClick={handleRemoveBackgroundImage}
                          className='absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors'
                          title='移除背景图片'
                        >
                          <Trash2 className='w-4 h-4' />
                        </button>
                      </div>
                      <p className='text-xs text-gray-500 dark:text-gray-400'>
                        当前使用自定义背景图片
                      </p>
                    </div>
                  ) : (
                    <div className='space-y-3'>
                      <label className='block'>
                        <input
                          type='file'
                          accept='image/*'
                          onChange={handleBackgroundImageUpload}
                          className='hidden'
                          id='background-image-upload'
                        />
                        <div className='w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors'>
                          <Upload className='w-8 h-8 text-gray-400 mb-2' />
                          <p className='text-sm text-gray-500 dark:text-gray-400'>
                            点击上传背景图片
                          </p>
                          <p className='text-xs text-gray-400 dark:text-gray-500 mt-1'>
                            支持 JPG、PNG、GIF 格式
                          </p>
                        </div>
                      </label>
                      <p className='text-xs text-gray-500 dark:text-gray-400'>
                        建议上传高分辨率图片以获得最佳效果
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 分割线 */}
            <div className='border-t border-gray-200 dark:border-gray-700' />

            {/* 高级调节菜单 */}
            <div className='space-y-2'>
              <div className='flex items-center justify-between w-full group'>
                <button
                  onClick={() => setIsAdvancedMenuOpen(!isAdvancedMenuOpen)}
                  className='flex items-center gap-2'
                >
                  <Sliders className='w-4 h-4 text-gray-500' />
                  <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    高级调节
                  </h4>
                </button>
                <div className='flex items-center gap-2'>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResetSettings();
                    }}
                    className='px-3 py-1 text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 border border-red-300 dark:border-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'
                    title='恢复默认设置'
                  >
                    重置
                  </button>
                  <button
                    onClick={() => setIsAdvancedMenuOpen(!isAdvancedMenuOpen)}
                    className='p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors'
                  >
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${
                        isAdvancedMenuOpen ? 'rotate-180' : ''
                      }`}
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M19 9l-7 7-7-7'
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {isAdvancedMenuOpen && (
                <div className='space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700 max-h-[70vh] overflow-y-auto overscroll-contain'>
                  {/* 主题背景透明度调节 */}
                  <div className='space-y-3'>
                    <div className='flex items-center gap-2'>
                      <Sliders className='w-4 h-4 text-gray-500' />
                      <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                        主题背景透明度
                      </h4>
                      <span className='text-xs text-gray-500 dark:text-gray-400 ml-auto'>
                        {settings.themeOpacity}%
                      </span>
                    </div>
                    <input
                      type='range'
                      min='50'
                      max='100'
                      value={settings.themeOpacity}
                      onChange={(e) =>
                        handleThemeOpacityChange(Number(e.target.value))
                      }
                      className='w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider'
                    />
                    <p className='text-xs text-gray-500 dark:text-gray-400'>
                      调节背景图片/渐变的透明度，数值越低越透明
                    </p>
                  </div>

                  {/* 分割线 */}
                  <div className='border-t border-gray-200 dark:border-gray-700' />

                  {/* 分割线 */}
                  <div className='border-t border-gray-200 dark:border-gray-700' />

                  {/* 全局UI透明度调节 */}
                  <div className='space-y-3'>
                    <div className='flex items-center gap-2'>
                      <Sliders className='w-4 h-4 text-gray-500' />
                      <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                        全局UI透明度
                      </h4>
                      <span className='text-xs text-gray-500 dark:text-gray-400 ml-auto'>
                        {settings.globalUIOpacity}%
                      </span>
                    </div>
                    <input
                      type='range'
                      min='80'
                      max='100'
                      value={settings.globalUIOpacity}
                      onChange={(e) =>
                        handleGlobalUIOpacityChange(Number(e.target.value))
                      }
                      className='w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider'
                    />
                    <p className='text-xs text-gray-500 dark:text-gray-400'>
                      调节所有UI组件的透明度，数值越低越透明
                    </p>
                  </div>

                  {/* 分割线 */}
                  <div className='border-t border-gray-200 dark:border-gray-700' />

                  {/* 色调调节 */}
                  <div className='space-y-3'>
                    <div className='flex items-center gap-2'>
                      <Palette className='w-4 h-4 text-gray-500' />
                      <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                        色调调节
                      </h4>
                      <span className='text-xs text-gray-500 dark:text-gray-400 ml-auto'>
                        {settings.hue}°
                      </span>
                    </div>
                    <input
                      type='range'
                      min='0'
                      max='360'
                      value={settings.hue}
                      onChange={(e) => handleHueChange(Number(e.target.value))}
                      className='w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider'
                    />
                    <p className='text-xs text-gray-500 dark:text-gray-400'>
                      调节背景的主色调，0-360度色相环
                    </p>
                  </div>

                  {/* 分割线 */}
                  <div className='border-t border-gray-200 dark:border-gray-700' />

                  {/* 饱和度调节 */}
                  <div className='space-y-3'>
                    <div className='flex items-center gap-2'>
                      <Palette className='w-4 h-4 text-gray-500' />
                      <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                        饱和度调节
                      </h4>
                      <span className='text-xs text-gray-500 dark:text-gray-400 ml-auto'>
                        {settings.saturation}%
                      </span>
                    </div>
                    <input
                      type='range'
                      min='0'
                      max='100'
                      value={settings.saturation}
                      onChange={(e) =>
                        handleSaturationChange(Number(e.target.value))
                      }
                      className='w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider'
                    />
                    <p className='text-xs text-gray-500 dark:text-gray-400'>
                      调节背景的色彩鲜艳度，数值越低越灰淡
                    </p>
                  </div>

                  {/* 分割线 */}
                  <div className='border-t border-gray-200 dark:border-gray-700' />

                  {/* 亮度调节 */}
                  <div className='space-y-3'>
                    <div className='flex items-center gap-2'>
                      <Palette className='w-4 h-4 text-gray-500' />
                      <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                        亮度调节
                      </h4>
                      <span className='text-xs text-gray-500 dark:text-gray-400 ml-auto'>
                        {settings.lightness}%
                      </span>
                    </div>
                    <input
                      type='range'
                      min='30'
                      max='95'
                      value={settings.lightness}
                      onChange={(e) =>
                        handleLightnessChange(Number(e.target.value))
                      }
                      className='w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider'
                    />
                    <p className='text-xs text-gray-500 dark:text-gray-400'>
                      调节背景的明暗程度，数值越高颜色越亮，数值越低颜色越暗
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 底部说明 */}
            <div className='mt-6 pt-4 border-t border-gray-200 dark:border-gray-700'>
              <p className='text-xs text-gray-500 dark:text-gray-400 text-center'>
                主题设置将保存在本地浏览器中
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // 使用 React Portal 渲染到 document.body
  if (typeof window !== 'undefined') {
    return createPortal(panelContent, document.body);
  }

  return null;
};
