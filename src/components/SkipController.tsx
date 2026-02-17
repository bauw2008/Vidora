'use client';

import type Artplayer from 'artplayer';
import { useCallback, useEffect, useRef, useState } from 'react';

import { logger } from '@/lib/logger';
import { SkipSegment } from '@/lib/types';

interface SkipControllerProps {
  source: string;
  id: string;
  episodeIndex?: number; // 当前集数索引，用于区分不同集数
  artPlayerRef: React.MutableRefObject<Artplayer | null>;
  currentTime?: number;
  duration?: number;
  onNextEpisode?: () => void; // 跳转下一集的回调
}

// 默认跳过配置
const DEFAULT_SKIP_CONFIG = {
  openingStart: 0, // 片头开始 0:00
  openingEnd: 90, // 片头结束 1:30
  endingRemaining: 120, // 片尾剩余 2:00
  autoSkip: true,
  autoNextEpisode: true,
};

export default function SkipController({
  source,
  id,
  episodeIndex = 0,
  artPlayerRef,
  currentTime = 0,
  duration = 0,
  onNextEpisode,
}: SkipControllerProps) {
  // 跳过设置配置（从 localStorage 或插件获取）
  const [skipSettings, setSkipSettings] = useState(DEFAULT_SKIP_CONFIG);

  // 当前跳过片段
  const [currentSkipSegment, setCurrentSkipSegment] =
    useState<SkipSegment | null>(null);

  // 防重复触发相关
  const lastProcessedSegmentRef = useRef<{
    type: string;
    episodeId: string;
  } | null>(null);
  const episodeSwitchCooldownRef = useRef<number>(0);

  // 从 localStorage 加载跳过设置
  const loadSkipSettings = useCallback(() => {
    try {
      const saved = localStorage.getItem('skipSettings');
      if (saved) {
        const settings = JSON.parse(saved);
        setSkipSettings({ ...DEFAULT_SKIP_CONFIG, ...settings });
      }
    } catch (e) {
      logger.warn('加载跳过设置失败:', e);
    }
  }, []);

  // 自动跳过逻辑
  const handleAutoSkip = useCallback(
    (segment: SkipSegment) => {
      if (!artPlayerRef.current) {
        return;
      }

      // 如果是片尾且开启了自动下一集，直接跳转下一集
      if (
        segment.type === 'ending' &&
        segment.autoNextEpisode &&
        onNextEpisode
      ) {
        // 先暂停视频，防止 video:ended 事件再次触发
        if (artPlayerRef.current) {
          const player = artPlayerRef.current as unknown as {
            paused?: boolean;
            pause?: () => void;
            notice?: { show?: string };
          };
          if (!player.paused) {
            player.pause?.();
          }
          // 显示跳过提示
          if (player.notice) {
            player.notice.show = '自动跳转下一集';
          }
        }
        // 设置冷却时间，防止新集数立即触发
        episodeSwitchCooldownRef.current = Date.now();

        // 立即调用 onNextEpisode
        onNextEpisode();
      } else {
        // 否则跳到片段结束位置
        const targetTime = segment.end + 1;
        artPlayerRef.current.currentTime = targetTime;

        // 显示跳过提示
        if (artPlayerRef.current.notice) {
          const segmentName = segment.type === 'opening' ? '片头' : '片尾';
          artPlayerRef.current.notice.show = `自动跳过${segmentName}`;
        }
      }
    },
    [artPlayerRef, onNextEpisode],
  );

  // 检查当前播放时间是否在跳过区间内
  const checkSkipSegment = useCallback(
    (time: number) => {
      // 检查冷却时间：如果刚切换集数不到3秒，不处理任何跳过逻辑
      const cooldownTime = 3000; // 3秒冷却时间
      const timeSinceSwitch = Date.now() - episodeSwitchCooldownRef.current;
      if (
        episodeSwitchCooldownRef.current > 0 &&
        timeSinceSwitch < cooldownTime
      ) {
        return;
      }

      // 检查是否为短剧，短剧不参与跳过
      try {
        const savedSettings = localStorage.getItem('skipSettings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          if (settings.isShortDrama) {
            return; // 短剧直接返回，不执行跳过逻辑
          }
        }
      } catch (e) {
        logger.error('处理跳过配置失败:', e);
      }

      // 根据 skipSettings 生成跳过配置
      const segments: SkipSegment[] = [];

      // 添加片头配置
      if (skipSettings.openingStart < skipSettings.openingEnd) {
        segments.push({
          type: 'opening',
          start: skipSettings.openingStart,
          end: skipSettings.openingEnd,
          autoSkip: skipSettings.autoSkip,
        });
      }

      // 添加片尾配置（如果设置了）
      if (duration > 0 && skipSettings.endingRemaining > 0) {
        const endingStart = duration - skipSettings.endingRemaining;

        segments.push({
          type: 'ending',
          start: endingStart,
          end: duration,
          autoSkip: skipSettings.autoSkip,
          autoNextEpisode: skipSettings.autoNextEpisode,
        });
      }

      if (!segments || segments.length === 0) {
        return;
      }

      const currentSegment = segments.find(
        (segment) => time >= segment.start && time <= segment.end,
      );

      // 使用 source + id + episodeIndex 作为集数标识，确保不同集数有不同的ID
      const currentEpisodeId = `${source}_${id}_${episodeIndex}`;
      const lastProcessed = lastProcessedSegmentRef.current;

      // 比较片段类型而不是对象引用（避免临时对象导致的重复触发）

      if (currentSegment && currentSegment.type !== currentSkipSegment?.type) {
        // 检查是否已经处理过这个片段（同一集同一片段类型）

        if (
          lastProcessed &&
          lastProcessed.type === currentSegment.type &&
          lastProcessed.episodeId === currentEpisodeId
        ) {
          return;
        }

        // 使用 requestAnimationFrame 来延迟 setState 调用
        requestAnimationFrame(() => {
          setCurrentSkipSegment(currentSegment);
        });

        // 实时检查是否开启自动跳过（从 localStorage 读取最新设置）
        let shouldAutoSkip = true; // 默认开启
        try {
          const savedSettings = localStorage.getItem('skipSettings');
          if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            shouldAutoSkip = settings.autoSkip !== false; // 使用最新的设置
          }
        } catch (e) {
          logger.warn('读取跳过设置失败:', e);
        }

        if (shouldAutoSkip) {
          // 标记已处理

          lastProcessedSegmentRef.current = {
            type: currentSegment.type,

            episodeId: currentEpisodeId,
          };

          // 立即执行跳过

          handleAutoSkip(currentSegment);
        }
      } else if (!currentSegment && currentSkipSegment?.type) {
        // 使用 requestAnimationFrame 来延迟 setState 调用
        requestAnimationFrame(() => {
          setCurrentSkipSegment(null);
        });
      }
    },
    [
      currentSkipSegment,
      handleAutoSkip,
      duration,
      source,
      id,
      episodeIndex,
      skipSettings,
    ],
  );

  // 初始化加载配置
  useEffect(() => {
    // 使用 requestAnimationFrame 来延迟 loadSkipSettings 调用
    requestAnimationFrame(() => {
      loadSkipSettings();
    });
  }, [loadSkipSettings]);

  // 监听 localStorage 变化，同步跳过设置
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'skipSettings' && e.newValue !== null) {
        try {
          const newSettings = JSON.parse(e.newValue);
          setSkipSettings({ ...DEFAULT_SKIP_CONFIG, ...newSettings });
        } catch (err) {
          logger.warn('解析跳过设置失败:', err);
        }
      }
    };

    const handleCustomEvent = (e: CustomEvent) => {
      if (e.detail.key === 'skipSettings') {
        setSkipSettings({ ...DEFAULT_SKIP_CONFIG, ...e.detail.value });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(
      'localStorageChanged',
      handleCustomEvent as EventListener,
    );

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(
        'localStorageChanged',
        handleCustomEvent as EventListener,
      );
    };
  }, []);

  // 监听播放时间变化
  useEffect(() => {
    if (currentTime > 0) {
      checkSkipSegment(currentTime);
    }
  }, [currentTime, checkSkipSegment]);

  // 当 source 或 id 或 episodeIndex 变化时，清理所有状态（换集时）
  useEffect(() => {
    // 使用 requestAnimationFrame 来延迟 setState 调用
    requestAnimationFrame(() => {
      setCurrentSkipSegment(null);
    });
    // 清除已处理标记，允许新集数重新处理
    lastProcessedSegmentRef.current = null;
    // 设置冷却时间，防止新集数立即触发自动跳过
    episodeSwitchCooldownRef.current = Date.now();
  }, [source, id, episodeIndex]);

  return (
    <div className='skip-controller'>
      {/* SkipController 组件已简化，只保留自动跳过功能 */}
    </div>
  );
}
