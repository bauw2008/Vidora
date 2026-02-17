/**
 * ArtPlayer 跳过设置插件
 * 将跳过设置面板集成到播放器内部，而不是页面覆盖层
 */

import type Artplayer from 'artplayer';

import { logger } from './logger';

// 扩展 Window 接口以支持插件全局访问
declare global {
  interface Window {
    artplayerPluginSkipSettings?: typeof artplayerPluginSkipSettings;
  }
}

export interface SkipSettingsConfig {
  // 预设的跳过时间配置
  openingStart: number; // 片头开始时间（秒）
  openingEnd: number; // 片头结束时间（秒）
  endingRemaining: number; // 片尾剩余时间（秒）
  endingStart: number; // 片尾开始时间（绝对模式）
  endingEnd: number; // 片尾结束时间（绝对模式）
  endingMode: 'remaining' | 'absolute'; // 片尾模式
  autoSkip: boolean; // 自动跳过开关
  autoNextEpisode: boolean; // 自动下一集开关
  isShortDrama?: boolean; // 是否为短剧（可选）
}

const DEFAULT_CONFIG: SkipSettingsConfig = {
  openingStart: 0, // 0:00
  openingEnd: 90, // 1:30
  endingRemaining: 120, // 2:00
  endingStart: 0, // 片尾开始时间（绝对模式）
  endingEnd: 0, // 片尾结束时间（绝对模式）
  endingMode: 'remaining', // 默认剩余模式
  autoSkip: true,
  autoNextEpisode: true,
};

export default function artplayerPluginSkipSettings(
  initialConfig?: Partial<SkipSettingsConfig>,
) {
  return (art: Artplayer) => {
    // 使用默认配置和初始配置，具体值由 SkipController 管理
    let config: SkipSettingsConfig = {
      ...DEFAULT_CONFIG,
      ...initialConfig,
    };
    let panelElement: HTMLElement | null = null;
    let isVisible = false;

    // 智能检测是否为短剧（优先时长检测，再检查标签）
    const isShortDrama = () => {
      // 第一优先级：时长检测（最快）
      if (art?.duration && art.duration < 480) {
        return true; // 480秒 = 8分钟
      }

      // 第二优先级：标签检测（兜底）
      if (typeof window !== 'undefined') {
        const search = window.location.search;
        if (
          search.includes('source=shortdrama') ||
          search.includes('stype=shortdrama')
        ) {
          return true;
        }
      }

      return false;
    };

    // 智能检测短剧并禁用跳过功能
    const detectShortDrama = () => {
      const isShort = isShortDrama();
      const configWithShortDrama = config as unknown as {
        isShortDrama?: boolean;
      };
      configWithShortDrama.isShortDrama = isShort;
      // 合并localStorage操作
      try {
        const savedSettings = localStorage.getItem('skipSettings');
        let settingsToSave = { ...config, isShortDrama: isShort };
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          settingsToSave = { ...parsed, isShortDrama: isShort };
        }
        localStorage.setItem('skipSettings', JSON.stringify(settingsToSave));
      } catch {
        // 静默处理错误
      }

      // 显示短剧提醒
      if (isShort) {
        const shortDramaNotice = document.querySelector(
          '.art-short-drama-notice',
        ) as HTMLElement;
        if (shortDramaNotice) {
          shortDramaNotice.style.display = 'block';
          setTimeout(() => {
            shortDramaNotice.style.display = 'none';
          }, 5000);
        }
      }
    };

    const formatTime = (seconds: number): string => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // 创建设置面板
    const createPanel = () => {
      const panel = document.createElement('div');
      panel.className = 'art-skip-settings-panel';
      panel.innerHTML = `
        <div class="art-skip-settings-content">          
          <div class="art-sip-settings-body">
            <!-- 片头设置 -->
            <div class="art-skip-section">
              <div class="art-skip-section-header">
                <span class="art-skip-icon">🎬</span>
                <span class="art-skip-section-title">片头</span>
                <label class="art-skip-switch">
                  <input type="checkbox" id="autoSkip" ${
                    config.autoSkip ? 'checked' : ''
                  }>
                  <span class="art-skip-slider"></span>
                </label>
              </div>
              <div class="art-skip-time-grid">
                <div class="art-skip-time-field">
                  <label class="art-skip-time-label">开始</label>
                  <input type="text" id="openingStart" value="${formatTime(config.openingStart)}" class="art-skip-time-input" placeholder="0:00">
                </div>
                <div class="art-skip-time-field">
                  <label class="art-skip-time-label">结束</label>
                  <input type="text" id="openingEnd" value="${formatTime(config.openingEnd)}" class="art-skip-time-input" placeholder="1:30">
                </div>
                <button class="art-skip-locate-btn" id="locateOpeningBtn" title="标记当前时间为片头结束时间">
                  <span class="art-skip-locate-icon">📍</span>
                </button>
              </div>
            </div>
            
            <!-- 片尾设置 -->
            <div class="art-skip-section">
              <div class="art-skip-section-header">
                <span class="art-skip-icon">🎭</span>
                <span class="art-skip-section-title">片尾</span>
                <div class="art-skip-mode-selector-inline">
                  <label class="art-skip-mode-option">
                    <input type="radio" name="endingMode" value="remaining" checked>
                    <span class="art-skip-mode-label">剩余</span>
                  </label>
                  <label class="art-skip-mode-option">
                    <input type="radio" name="endingMode" value="absolute">
                    <span class="art-skip-mode-label">绝对</span>
                  </label>
                </div>
                <label class="art-skip-switch">
                  <input type="checkbox" id="autoNextEpisode" ${
                    config.autoNextEpisode ? 'checked' : ''
                  }>
                  <span class="art-skip-slider"></span>
                </label>
              </div>
              <div class="art-skip-time-grid">
                <div class="art-skip-time-field">
                  <label class="art-skip-time-label" id="endingFirstLabel">剩余</label>
                  <input type="text" id="endingFirst" value="${formatTime(config.endingRemaining)}" class="art-skip-time-input" placeholder="2:00">
                </div>
                <div class="art-skip-time-field">
                  <label class="art-skip-time-label">结束</label>
                  <input type="text" id="endingEnd" value="" class="art-skip-time-input" placeholder="留空">
                </div>
                <button class="art-skip-locate-btn" id="locateEndingBtn" title="标记当前时间为片尾开始时间">
                  <span class="art-skip-locate-icon">📍</span>
                </button>
              </div>
            </div>
            
            <!-- 状态栏 -->
            <div class="art-skip-status-bar">
              <span>当前: <span id="currentTime">0:00</span></span>
              <span>剩余: <span id="remainingTime">0:00</span></span>
            </div>
            
            <!-- 操作栏 -->
            <div class="art-skip-action-bar">
              <button class="art-skip-btn art-skip-btn-primary" id="saveBtn">💾 保存</button>
              <button class="art-skip-btn art-skip-btn-secondary" id="resetBtn">🔄 重置</button>
            </div>
          </div>
        </div>
      `;

      // 添加样式
      const style = document.createElement('style');
      style.textContent = `
        .art-skip-settings-panel {
          position: absolute;
          bottom: 55px;
		  left: 50%;
		  transform: translateX(-50%);
          width: 270px;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          z-index: 9999;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
          display: none;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .art-skip-settings-content {
          padding: 9px;
          color: #fff;
        }
        
        .art-skip-section {
          margin-bottom: 7px;
          padding: 5px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 5px;
        }
        
        .art-skip-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 5px;
          gap: 5px;
        }
        
        .art-skip-icon {
          font-size: 15px;
          margin-right: 5px;
        }
        
        .art-skip-section-title {
          font-size: 12px;
          font-weight: 500;
          color: #fff;
          flex: 1;
        }
        
        .art-skip-mode-selector-inline {
          display: flex;
          gap: 5px;
          align-items: center;
          margin-right: 10px;
        }
        
        .art-skip-mode-option {
          display: flex;
          align-items: center;
          gap: 2px;
          cursor: pointer;
        }
        
        .art-skip-mode-option input[type="radio"] {
          width: 10px;
          height: 10px;
        }
        
        .art-skip-mode-label {
          font-size: 9px;
          color: #ccc;
          font-weight: 500;
        }
        
        .art-skip-time-grid {
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          gap: 3px;
          align-items: end;
        }
        
        .art-skip-time-field {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        
        .art-skip-time-label {
          font-size: 10px;
          color: #ccc;
          font-weight: 500;
        }
        
        .art-skip-time-input {
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 3px;
          padding: 2px 3px;
          color: #fff;
          font-size: 11px;
          font-weight: 500;
          outline: none;
          width: 100%;
          text-align: center;
          transition: all 0.2s;
          height: 21px;
          box-sizing: border-box;
          line-height: 17px;
        }
        
        .art-skip-time-input:focus {
          border-color: #00a8ff;
          background: rgba(0, 0, 0, 0.8);
        }
        
        .art-skip-switch {
          display: flex;
          align-items: center;
          cursor: pointer;
          flex: 0 0 auto;
          min-width: 45px;
        }
        
        .art-skip-switch input[type="checkbox"] {
          display: none;
        }
        
        .art-skip-slider {
          position: relative;
          width: 34px;
          height: 19px;
          background: rgba(85, 85, 85, 0.8);
          border-radius: 9px;
          margin-right: 6px;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        
        .art-skip-slider::before {
          content: '';
          position: absolute;
          width: 15px;
          height: 15px;
          background: #fff;
          border-radius: 50%;
          top: 2px;
          left: 2px;
          transition: transform 0.2s;
        }
        
        .art-skip-switch input[type="checkbox"]:checked + .art-skip-slider {
          background: rgba(0, 168, 255, 0.8);
        }
        
        .art-skip-switch input[type="checkbox"]:checked + .art-skip-slider::before {
          transform: translateX(15px);
        }
        
        
        
        .art-skip-profile-select {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 3px;
          padding: 2px 6px;
          color: #fff;
          font-size: 11px;
          outline: none;
          flex: 1;
          max-width: 80px;
          cursor: pointer;
        }
        
        .art-skip-profile-select:focus {
          border-color: #00a8ff;
          background: rgba(255, 255, 255, 0.15);
        }
        
        .art-skip-profile-select option {
          background: #333;
          color: #fff;
        }
        
        .art-skip-profile-delete {
          position: absolute;
          top: 2px;
          right: 2px;
          background: rgba(255, 59, 48, 0.8);
          border: none;
          border-radius: 50%;
          color: #fff;
          width: 14px;
          height: 14px;
          font-size: 10px;
          cursor: pointer;
          display: none;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
        }
        
        .art-skip-profile-item.custom:hover .art-skip-profile-delete {
          display: flex;
          opacity: 1;
        }
        
        .art-skip-profile-delete:hover {
          background: rgba(255, 59, 48, 1);
        }
        
        
        
        
        
        .art-skip-number:focus {
          border-color: #00a8ff;
          background: rgba(0, 0, 0, 0.8);
        }
        
        /* 隐藏number输入框的上下箭头 */
        .art-skip-number::-webkit-outer-spin-button,
        .art-skip-number::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        
        .art-skip-number[type=number] {
          -moz-appearance: textfield;
        }
        
        /* 移动端优化：增大点击区域 */
        @media (max-width: 768px) {
          .art-skip-number {
            font-size: 16px; /* 防止iOS缩放 */
            padding: 4px 6px;
          }
        }
        
        
        
        .art-skip-locate-btn {
          background: rgba(0, 168, 255, 0.15);
          border: 1px solid rgba(0, 168, 255, 0.25);
          border-radius: 3px;
          color: #fff;
          cursor: pointer;
          padding: 2px 4px;
          transition: all 0.2s;
          flex-shrink: 0;
          min-width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
        }
        
        .art-skip-locate-icon {
          font-size: 11px;
          line-height: 1;
          display: block;
        }
        
        .art-skip-locate-btn:hover {
          background: rgba(0, 168, 255, 0.25);
          border-color: rgba(0, 168, 255, 0.35);
        }
        
        
        
        .art-skip-status-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 10px;
          color: #999;
          padding: 4px 8px;
          margin-top: 5px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .art-skip-action-bar {
          display: flex;
          justify-content: center;
          gap: 8px;
          padding: 5px 0 3px 0;
        }
        
        .art-skip-btn {
          padding: 3px 8px;
          border: none;
          border-radius: 3px;
          font-size: 10px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
          flex: 1;
          max-width: 75px;
        }
        
        .art-skip-btn-primary {
          background: #00a8ff;
          color: #fff;
        }
        
        .art-skip-btn-primary:hover {
          background: #0096e6;
        }
        
        .art-skip-btn-secondary {
          background: rgba(255, 255, 255, 0.15);
          color: #ccc;
          border: 1px solid rgba(255, 255, 255, 0.25);
        }
        
        .art-skip-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
        }
        
        .art-short-drama-panel-notice {
          padding: 8px 8px 0 8px;
          animation: slideInTop 0.3s ease-out;
        }
        
        .art-short-drama-panel-notice-content {
          background: linear-gradient(135deg, rgba(255, 59, 48, 0.7), rgba(255, 149, 0, 0.7));
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 500;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.15);
        }
        
        .art-short-drama-panel-icon {
          font-size: 10px;
        }
        
        .art-short-drama-panel-text {
          flex: 1;
        }
        
        @keyframes slideInTop {
          from {
            transform: translateY(-10px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        
      `;
      document.head.appendChild(style);

      // 绑定事件
      const locateOpeningBtn = panel.querySelector('#locateOpeningBtn');
      const locateEndingBtn = panel.querySelector('#locateEndingBtn');
      const autoSkipCheckbox = panel.querySelector(
        '#autoSkip',
      ) as HTMLInputElement;
      const autoNextEpisodeCheckbox = panel.querySelector(
        '#autoNextEpisode',
      ) as HTMLInputElement;

      logger.log('SkipSettings: 绑定事件，元素检查', {
        locateOpeningBtn: !!locateOpeningBtn,
        locateEndingBtn: !!locateEndingBtn,
        autoSkipCheckbox: !!autoSkipCheckbox,
        autoNextEpisodeCheckbox: !!autoNextEpisodeCheckbox,
      });

      // 片尾模式切换
      const endingModeRadios = panel.querySelectorAll(
        'input[name="endingMode"]',
      );
      logger.log('SkipSettings: 片尾模式单选框数量', endingModeRadios.length);
      endingModeRadios.forEach((radio) => {
        radio.addEventListener('change', (e) => {
          const target = e.target as HTMLInputElement;
          switchEndingMode(target.value as 'remaining' | 'absolute');
        });
      });

      // 切换片尾模式

      const switchEndingMode = (mode: 'remaining' | 'absolute') => {
        try {
          const endingFirstLabel = panel.querySelector(
            '#endingFirstLabel',
          ) as HTMLElement;

          if (endingFirstLabel) {
            endingFirstLabel.textContent =
              mode === 'remaining' ? '剩余' : '开始';
          }
        } catch (e) {
          logger.error('SkipSettings: 切换片尾模式失败', e);
        }
      };

      // 获取时间值

      const getTimeValues = () => {
        try {
          const openingStartMin =
            parseInt(
              (panel.querySelector('#openingStartMin') as HTMLInputElement)
                ?.value || '0',
            ) || 0;

          const openingStartSec =
            parseInt(
              (panel.querySelector('#openingStartSec') as HTMLInputElement)
                ?.value || '0',
            ) || 0;

          const openingEndMin =
            parseInt(
              (panel.querySelector('#openingEndMin') as HTMLInputElement)
                ?.value || '0',
            ) || 0;

          const openingEndSec =
            parseInt(
              (panel.querySelector('#openingEndSec') as HTMLInputElement)
                ?.value || '0',
            ) || 0;

          const endingFirstMin =
            parseInt(
              (panel.querySelector('#endingFirstMin') as HTMLInputElement)
                ?.value || '0',
            ) || 0;

          const endingFirstSec =
            parseInt(
              (panel.querySelector('#endingFirstSec') as HTMLInputElement)
                ?.value || '0',
            ) || 0;

          const endingEndMin =
            parseInt(
              (panel.querySelector('#endingEndMin') as HTMLInputElement)
                ?.value || '0',
            ) || 0;

          const endingEndSec =
            parseInt(
              (panel.querySelector('#endingEndSec') as HTMLInputElement)
                ?.value || '0',
            ) || 0;

          const endingMode =
            (
              panel.querySelector(
                'input[name="endingMode"]:checked',
              ) as HTMLInputElement
            )?.value || 'remaining';

          return {
            openingStart: openingStartMin * 60 + openingStartSec,

            openingEnd: openingEndMin * 60 + openingEndSec,

            endingFirst: endingFirstMin * 60 + endingFirstSec,

            endingEnd: endingEndMin * 60 + endingEndSec,

            endingMode,
          };
        } catch (e) {
          logger.error('SkipSettings: 获取时间值失败', e);

          return {
            openingStart: 0,

            openingEnd: 90,

            endingFirst: 120,

            endingEnd: 0,

            endingMode: 'remaining',
          };
        }
      };

      // 保存配置
      const saveConfig = () => {
        try {
          const times = getTimeValues();
          config = {
            openingStart: times.openingStart,
            openingEnd: times.openingEnd,
            endingRemaining:
              times.endingMode === 'remaining' ? times.endingFirst : 0,
            endingStart:
              times.endingMode === 'absolute' ? times.endingFirst : 0,
            endingEnd: times.endingEnd,
            endingMode: times.endingMode as 'remaining' | 'absolute',
            autoSkip: autoSkipCheckbox?.checked || false,
            autoNextEpisode: autoNextEpisodeCheckbox?.checked || false,
          };

          localStorage.setItem('skipSettings', JSON.stringify(config));

          if (art?.notice) {
            art.notice.show = '跳过设置已保存';
          }
        } catch (e) {
          logger.error('SkipSettings: 保存配置失败', e);
        }
      };

      // 重置配置
      const resetConfig = () => {
        try {
          config = { ...DEFAULT_CONFIG };
          setTimeValues(
            config.openingStart,
            config.openingEnd,
            config.endingRemaining,
            0,
          );
          if (autoSkipCheckbox) {
            autoSkipCheckbox.checked = config.autoSkip;
          }
          if (autoNextEpisodeCheckbox) {
            autoNextEpisodeCheckbox.checked = config.autoNextEpisode;
          }

          // 重置片尾模式为剩余
          const remainingRadio = panel.querySelector(
            'input[name="endingMode"][value="remaining"]',
          ) as HTMLInputElement;
          if (remainingRadio) {
            remainingRadio.checked = true;
            switchEndingMode('remaining');
          }

          if (art?.notice) {
            art.notice.show = '跳过设置已重置';
          }
        } catch (e) {
          logger.error('SkipSettings: 重置配置失败', e);
        }
      };

      // 绑定保存和重置按钮事件
      const saveBtn = panel.querySelector('#saveBtn');
      const resetBtn = panel.querySelector('#resetBtn');

      if (saveBtn) {
        saveBtn.addEventListener('click', saveConfig);
      }

      if (resetBtn) {
        resetBtn.addEventListener('click', resetConfig);
      }

      // 定位按钮事件
      if (locateOpeningBtn) {
        locateOpeningBtn.addEventListener('click', () => {
          try {
            logger.log('SkipSettings: 片头定位按钮点击');
            if (art?.currentTime !== undefined) {
              logger.log('SkipSettings: 当前时间', art.currentTime);
              const times = getTimeValues();
              logger.log('SkipSettings: 获取到的时间值', times);
              setTimeValues(
                times.openingStart,
                art.currentTime,
                times.endingFirst,
                times.endingEnd,
              );
              logger.log('SkipSettings: 片头定位完成');
            } else {
              logger.warn('SkipSettings: 无法获取当前时间');
            }
          } catch (e) {
            logger.error('SkipSettings: 片头定位失败', e);
          }
        });
      }

      if (locateEndingBtn) {
        locateEndingBtn.addEventListener('click', () => {
          try {
            logger.log('SkipSettings: 片尾定位按钮点击');
            if (
              art?.currentTime !== undefined &&
              art.duration &&
              panelElement
            ) {
              logger.log(
                'SkipSettings: 当前时间',
                art.currentTime,
                '总时长',
                art.duration,
              );
              const endingMode =
                (
                  panelElement.querySelector(
                    'input[name="endingMode"]:checked',
                  ) as HTMLInputElement
                )?.value || 'remaining';
              let endingFirst: number;

              if (endingMode === 'remaining') {
                const remainingTime = Math.max(
                  0,
                  art.duration - art.currentTime,
                );
                endingFirst = remainingTime;
                logger.log('SkipSettings: 剩余模式，剩余时间', remainingTime);
              } else {
                endingFirst = art.currentTime;
                logger.log('SkipSettings: 绝对模式，开始时间', art.currentTime);
              }

              const times = getTimeValues();
              setTimeValues(
                times.openingStart,
                times.openingEnd,
                endingFirst,
                times.endingEnd,
              );
              logger.log('SkipSettings: 片尾定位完成');
            } else {
              logger.warn('SkipSettings: 无法获取时间信息');
            }
          } catch (e) {
            logger.error('SkipSettings: 片尾定位失败', e);
          }
        });
      }

      // 输入框变化时自动保存
      const handleTimeInputChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const value = target.value.replace(/\D/g, ''); // 只保留数字
        target.value = value;
        saveConfig(); // 自动保存
      };

      // 监听输入框变化
      const allTimeInputs = panel.querySelectorAll('.art-skip-number');
      allTimeInputs.forEach((input) => {
        input.addEventListener('input', handleTimeInputChange);

        // 聚焦时选中所有文本，光标自动到末尾
        input.addEventListener('focus', () => {
          (input as HTMLInputElement).select();
        });

        // 只允许数字输入
        input.addEventListener('keypress', (e: Event) => {
          const keyEvent = e as KeyboardEvent;
          if (
            keyEvent.key &&
            !/[0-9]/.test(keyEvent.key) &&
            keyEvent.key !== 'Backspace' &&
            keyEvent.key !== 'Delete' &&
            keyEvent.key !== 'Tab'
          ) {
            keyEvent.preventDefault();
          }
        });
      });

      return panel;
    };

    // 更新时间显示
    const updateTimeDisplayCurrent = () => {
      if (!panelElement || !art) {
        return;
      }

      const currentTimeEl = panelElement.querySelector('#currentTime');
      const remainingTimeEl = panelElement.querySelector('#remainingTime');

      if (currentTimeEl && remainingTimeEl) {
        const current = art.currentTime || 0;
        const duration = art.duration || 0;
        const remaining = duration - current;

        currentTimeEl.textContent = formatTime(current);
        remainingTimeEl.textContent = formatTime(remaining);
      }
    };

    // 设置时间值
    const setTimeValues = (
      openingStart: number,
      openingEnd: number,
      endingFirst: number,
      endingEnd: number,
    ) => {
      try {
        if (!panelElement) {
          return;
        }

        const formatTime = (seconds: number): string => {
          const mins = Math.floor(seconds / 60);
          const secs = Math.floor(seconds % 60);
          return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        logger.log('SkipSettings: 设置时间值', {
          openingStart,
          openingEnd,
          endingFirst,
          endingEnd,
          formattedOpeningStart: formatTime(openingStart),
          formattedOpeningEnd: formatTime(openingEnd),
        });

        const openingStartEl = panelElement.querySelector(
          '#openingStart',
        ) as HTMLInputElement;
        const openingEndEl = panelElement.querySelector(
          '#openingEnd',
        ) as HTMLInputElement;
        const endingFirstEl = panelElement.querySelector(
          '#endingFirst',
        ) as HTMLInputElement;
        const endingEndEl = panelElement.querySelector(
          '#endingEnd',
        ) as HTMLInputElement;

        if (openingStartEl) {
          openingStartEl.value = formatTime(openingStart);
          logger.log('SkipSettings: 设置片头开始时间', openingStartEl.value);
        }
        if (openingEndEl) {
          openingEndEl.value = formatTime(openingEnd);
          logger.log('SkipSettings: 设置片头结束时间', openingEndEl.value);
        }
        if (endingFirstEl) {
          endingFirstEl.value = formatTime(endingFirst);
          logger.log('SkipSettings: 设置片尾时间', endingFirstEl.value);
        }
        if (endingEndEl) {
          endingEndEl.value = endingEnd > 0 ? formatTime(endingEnd) : '';
        }
      } catch (e) {
        logger.error('SkipSettings: 设置时间值失败', e);
      }
    };

    // 显示面板
    const show = () => {
      if (!art || !panelElement) {
        return;
      }

      // 智能检测短剧
      detectShortDrama();

      // 更新UI状态
      const autoSkipCheckbox = panelElement.querySelector(
        '#autoSkip',
      ) as HTMLInputElement;
      const autoNextEpisodeCheckbox = panelElement.querySelector(
        '#autoNextEpisode',
      ) as HTMLInputElement;

      if (autoSkipCheckbox) {
        autoSkipCheckbox.checked = config.autoSkip;
      }
      if (autoNextEpisodeCheckbox) {
        autoNextEpisodeCheckbox.checked = config.autoNextEpisode;
      }

      // 更新时间显示
      setTimeValues(
        config.openingStart,
        config.openingEnd,
        config.endingRemaining,
        0,
      );

      panelElement.style.display = 'block';
      isVisible = true;

      // 保持工具栏显示
      if (art.template?.$controls) {
        art.template.$controls.classList.add('art-control-show');
      }

      updateTimeDisplayCurrent();
    };

    // 隐藏面板
    const hide = () => {
      if (!panelElement) {
        return;
      }

      panelElement.style.display = 'none';
      isVisible = false;

      // 恢复工具栏自动隐藏
      if (art.template?.$controls) {
        art.template.$controls.classList.remove('art-control-show');
      }
    };

    // 切换面板显示状态
    const toggle = () => {
      if (isVisible) {
        hide();
      } else {
        show();
      }
    };

    // 重新定位面板（使用固定定位，不需要动态调整）
    const repositionPanel = () => {
      // 固定定位，无需调整
    };

    // 从 localStorage 加载配置
    try {
      const saved = localStorage.getItem('skipSettings');
      if (saved) {
        config = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      logger.warn('加载跳过设置失败:', e);
    }

    // 创建面板
    panelElement = createPanel();

    // 创建短剧提醒元素
    const shortDramaNotice = document.createElement('div');
    shortDramaNotice.className = 'art-short-drama-notice';
    shortDramaNotice.innerHTML = `
      <div class="art-short-drama-notice-content">
        <span class="art-short-drama-icon">🎬</span>
        <span class="art-short-drama-text">短片模式</span>
        <button class="art-short-drama-close" id="shortDramaCloseBtn">✕</button>
      </div>
    `;
    shortDramaNotice.style.display = 'none';

    // 添加短剧提醒样式
    const noticeStyle = document.createElement('style');
    noticeStyle.textContent = `
      .art-short-drama-notice {
        position: absolute;
        top: 20px;
        left: 20px;
        z-index: 1000;
        animation: slideInLeft 0.3s ease-out;
      }
      
      .art-short-drama-notice-content {
        background: linear-gradient(135deg, rgba(255, 59, 48, 0.9), rgba(255, 149, 0, 0.9));
        color: white;
        padding: 8px 12px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      .art-short-drama-icon {
        font-size: 14px;
      }
      
      .art-short-drama-text {
        flex: 1;
      }
      
      .art-short-drama-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 12px;
        padding: 2px;
        border-radius: 50%;
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }
      
      .art-short-drama-close:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      
      @keyframes slideInLeft {
        from {
          transform: translateX(-100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(noticeStyle);

    // 将面板和提醒添加到播放器容器
    const player = art as unknown as {
      template?: { $player?: HTMLElement };
      container?: HTMLElement;
    };
    if (player.template?.$player) {
      player.template.$player.appendChild(panelElement);
      player.template.$player.appendChild(shortDramaNotice);
    } else if (player.container) {
      player.container.appendChild(panelElement);
      player.container.appendChild(shortDramaNotice);
    }

    // 点击外部关闭面板
    const handleClickOutside = (e: MouseEvent) => {
      if (!panelElement) {
        return;
      }

      const target = e.target as Node;
      const isInPanel = panelElement.contains(target);

      const controls = art.template.$controls;
      const buttons = controls.querySelectorAll('.art-control');
      const skipButton = (Array.from(buttons) as Element[]).find((btn) => {
        const svg = btn.querySelector('svg');
        return svg && svg.getAttribute('viewBox') === '0 0 24 24';
      });
      const isInButton = skipButton && skipButton.contains(target);

      if (!isInPanel && !isInButton) {
        hide();
      }
    };

    // 定时更新时间显示
    let timeUpdateInterval: NodeJS.Timeout | null = null;

    const startTimeUpdate = () => {
      if (timeUpdateInterval) {
        clearInterval(timeUpdateInterval);
      }
      timeUpdateInterval = setInterval(() => {
        if (isVisible) {
          updateTimeDisplayCurrent();
        }
      }, 1000);
    };

    // 延迟添加点击监听器
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      startTimeUpdate();

      // 监听视频元数据加载完成，进行智能检测
      if (art) {
        art.on('video:loadedmetadata', () => {
          logger.log('SkipSettings: 视频元数据加载完成，执行短剧检测');
          detectShortDrama();
        });
      }
    }, 100);

    // 监听窗口大小变化
    window.addEventListener('resize', repositionPanel);

    // 插件卸载时清理
    art.on('destroy', () => {
      if (panelElement && panelElement.parentNode) {
        panelElement.parentNode.removeChild(panelElement);
      }

      // 清理短剧提醒元素
      const shortDramaNotice = document.querySelector(
        '.art-short-drama-notice',
      );
      if (shortDramaNotice && shortDramaNotice.parentNode) {
        shortDramaNotice.parentNode.removeChild(shortDramaNotice);
      }

      panelElement = null;
      isVisible = false;
      window.removeEventListener('resize', repositionPanel);
      document.removeEventListener('click', handleClickOutside);
      if (timeUpdateInterval) {
        clearInterval(timeUpdateInterval);
        timeUpdateInterval = null;
      }
    });

    logger.log('SkipSettings: 插件初始化完成');
    return {
      name: 'artplayerPluginSkipSettings',
      version: '1.0.0',
      show,
      hide,
      toggle,
      repositionPanel,
    };
  };
}

// 添加全局支持
if (typeof window !== 'undefined') {
  (window as Window).artplayerPluginSkipSettings = artplayerPluginSkipSettings;
}
