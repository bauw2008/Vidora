/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Brain, Send, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  AI_RECOMMEND_PRESETS,
  AIMessage,
  cleanMovieTitle,
  formatAIResponseWithLinks,
  generateSearchUrl,
  MovieRecommendation,
  sendAIRecommendMessage,
} from '@/lib/ai-recommend.client';
import { logger } from '@/lib/logger';

interface AIRecommendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ExtendedAIMessage extends AIMessage {
  recommendations?: MovieRecommendation[];
  videoLinks?: any[];
  type?: string;
}

export default function AIRecommendModal({
  isOpen,
  onClose,
}: AIRecommendModalProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ExtendedAIMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{
    message: string;
    details?: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 拖动相关状态
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 从localStorage加载历史对话
  useEffect(() => {
    try {
      const cachedMessages = localStorage.getItem('ai-recommend-messages');
      if (cachedMessages) {
        const { messages: storedMessages, timestamp } =
          JSON.parse(cachedMessages);
        const now = new Date().getTime();
        // 30分钟缓存
        if (now - timestamp < 30 * 60 * 1000) {
          setMessages(
            storedMessages.map((msg: ExtendedAIMessage) => ({
              ...msg,
              timestamp: msg.timestamp || new Date().toISOString(),
            })),
          );
          return; // 有缓存就不显示欢迎消息
        } else {
          // 🔥 修复Bug #2: 超过30分钟时真正删除localStorage中的过期数据
          logger.log('AI聊天记录已超过30分钟，自动清除缓存');
          localStorage.removeItem('ai-recommend-messages');
        }
      }

      // 没有有效缓存时显示欢迎消息
      const welcomeMessage: ExtendedAIMessage = {
        role: 'assistant',
        content:
          '你好！我是AI智能助手，支持以下功能：\n\n🎬 影视剧推荐 - 推荐电影、电视剧、动漫等\n\n💡 直接告诉我你想看什么类型的内容！',
        timestamp: new Date().toISOString(),
      };
      setMessages([welcomeMessage]);
    } catch (error) {
      logger.error('Failed to load messages from cache', error);
      // 发生错误时也清除可能损坏的缓存
      localStorage.removeItem('ai-recommend-messages');
    }
  }, []);

  // 保存对话到localStorage并滚动到底部
  useEffect(() => {
    scrollToBottom();
    try {
      // 🔥 修复Bug #1: 保持原有时间戳，不要每次都重置
      const existingCache = localStorage.getItem('ai-recommend-messages');
      let existingTimestamp = new Date().getTime(); // 默认当前时间

      if (existingCache) {
        try {
          const parsed = JSON.parse(existingCache);
          existingTimestamp = parsed.timestamp || existingTimestamp;
        } catch {
          // 解析失败时使用当前时间
        }
      }

      const cache = {
        messages,
        timestamp: existingTimestamp, // 保持原有时间戳，不重置
      };
      localStorage.setItem('ai-recommend-messages', JSON.stringify(cache));
    } catch (error) {
      logger.error('Failed to save messages to cache', error);
    }
  }, [messages]);

  // 处理片名点击搜索（保留用于文本中的链接点击）
  const handleTitleClick = (title: string) => {
    const cleanTitle = cleanMovieTitle(title);
    const searchUrl = generateSearchUrl(cleanTitle);
    router.push(searchUrl);
    onClose(); // 关闭对话框
  };

  // 发送消息
  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) {
      return;
    }

    const userMessage: AIMessage = {
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      // 智能上下文管理：只发送最近8条消息（4轮对话）
      const updatedMessages = [...messages, userMessage];
      const conversationHistory = updatedMessages.slice(-8);

      const response = await sendAIRecommendMessage(conversationHistory);
      const assistantMessage: ExtendedAIMessage = {
        role: 'assistant',
        content: response.choices[0].message.content,
        timestamp: new Date().toISOString(),
        recommendations: response.recommendations || [],
        videoLinks: response.videoLinks || [],
        type: response.type || 'normal',
      };
      // 添加AI回复到完整的消息历史（不是截取的历史）
      setMessages([...updatedMessages, assistantMessage]);
    } catch (error) {
      logger.error('AI推荐请求失败:', error);

      if (error instanceof Error) {
        // 尝试解析错误响应中的详细信息
        try {
          const errorResponse = JSON.parse(error.message);
          setError({
            message: errorResponse.error || error.message,
            details: errorResponse.details,
          });
        } catch {
          setError({
            message: error.message,
            details: '如果问题持续，请联系管理员检查AI配置',
          });
        }
      } else {
        setError({
          message: '请求失败，请稍后重试',
          details: '未知错误，请检查网络连接',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 处理预设问题
  const handlePresetClick = (preset: { title: string; message: string }) => {
    sendMessage(preset.message);
  };

  // 处理表单提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputMessage);
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputMessage);
    }
  };

  // 重置对话
  const resetChat = () => {
    // 清除localStorage缓存
    try {
      localStorage.removeItem('ai-recommend-messages');
    } catch (error) {
      logger.error('Failed to clear messages cache', error);
    }

    // 重新显示欢迎消息
    const welcomeMessage: ExtendedAIMessage = {
      role: 'assistant',
      content:
        '你好！我是AI智能助手，支持以下功能：\n\n🎬 影视剧推荐 - 推荐电影、电视剧、动漫等\n\n💡 直接告诉我你想看什么类型的内容！',
      timestamp: new Date().toISOString(),
    };
    setMessages([welcomeMessage]);
    setError(null);
    setInputMessage('');
  };

  // 检测是否为移动端
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  // 拖动处理函数
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return; // 移动端不启用拖动

    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || isMobile) return;

      e.preventDefault();
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart, isMobile],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 添加全局鼠标事件监听
  useEffect(() => {
    if (isDragging && !isMobile) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart, isMobile, handleMouseMove, handleMouseUp]);

  if (!isOpen) {
    return null;
  }

  // 直接在页面上显示，不使用Portal和背景遮罩
  return (
    <div
      ref={modalRef}
      className={`fixed z-[99999] w-[85.5vw] max-w-sm max-h-[72vh] bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-800 dark:to-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-blue-200/50 dark:border-blue-800/30 backdrop-blur-xl ${
        isDragging ? 'cursor-grabbing shadow-3xl' : 'shadow-2xl'
      } ${isMobile ? 'top-4 right-4' : ''}`}
      style={{
        left: !isMobile && position.x ? `${position.x}px` : 'auto',
        right: !isMobile && position.x ? 'auto' : '4px',
        top: !isMobile && position.y ? `${position.y}px` : '4px',
        cursor: isDragging ? 'grabbing' : 'default',
        transition: isDragging ? 'none' : 'all 0.3s ease',
      }}
    >
      {/* 头部 - 可拖动区域 */}
      <div
        className={`flex items-center justify-between p-4 border-b border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 ${
          !isMobile ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className='flex items-center space-x-3'>
          <div className='p-2 bg-white/20 backdrop-blur-sm rounded-xl'>
            <Brain className='h-6 w-6 text-white drop-shadow-sm' />
          </div>
          <div>
            <h2 className='text-xl font-bold text-white drop-shadow-sm'>
              AI 智能助手
            </h2>
            <p className='text-blue-100 text-sm drop-shadow-sm'>影视推荐</p>
          </div>
        </div>
        <div className='flex items-center space-x-2'>
          {messages.length > 0 && (
            <button
              onClick={resetChat}
              className='px-3 py-1 text-sm bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 transition-all duration-200 hover:scale-105'
            >
              清空对话
            </button>
          )}
          <button
            onClick={onClose}
            className='p-2 hover:bg-white/20 rounded-xl transition-all duration-200 hover:scale-110 text-white backdrop-blur-sm'
          >
            <X className='h-5 w-5' />
          </button>
        </div>
      </div>

      {/* 消息区域 */}
      <div className='flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-transparent to-blue-50/30 dark:to-gray-800/30 backdrop-blur-sm min-h-[180px]'>
        {messages.length <= 1 &&
          messages.every(
            (msg) =>
              msg.role === 'assistant' && msg.content.includes('AI智能助手'),
          ) && (
            <div className='text-center py-8'>
              <div className='inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full mb-4 shadow-lg ring-4 ring-white/20'>
                <Sparkles className='h-8 w-8 text-white drop-shadow-sm' />
              </div>
              <h3 className='text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2'>
                欢迎使用AI智能助手
              </h3>
              <p className='text-gray-600 dark:text-gray-400 mb-6'>
                支持影视推荐
              </p>

              {/* 预设问题 */}
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl mx-auto w-full'>
                {AI_RECOMMEND_PRESETS.map((preset, index) => (
                  <button
                    key={index}
                    onClick={() => handlePresetClick(preset)}
                    className='p-3 text-left bg-gradient-to-r from-white/80 to-blue-50/80 dark:from-gray-700/80 dark:to-blue-900/40 backdrop-blur-md rounded-xl border border-blue-200/50 dark:border-blue-800/30 hover:border-blue-400/60 dark:hover:border-blue-600/60 hover:shadow-lg transition-all duration-300 hover:scale-105 group'
                    disabled={isLoading}
                  >
                    <div className='font-medium text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors'>
                      {preset.title}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

        {/* 消息列表 */}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[80%] p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/60 dark:bg-gray-700/60 backdrop-blur-md text-gray-900 dark:text-gray-100 border border-gray-200/40 dark:border-gray-600/40'
              }`}
            >
              {message.role === 'assistant' ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: formatAIResponseWithLinks(
                      message.content,
                      handleTitleClick,
                    ),
                  }}
                  className='prose prose-sm dark:prose-invert max-w-none'
                />
              ) : (
                <div className='whitespace-pre-wrap'>{message.content}</div>
              )}
            </div>
          </div>
        ))}

        {/* 加载状态 */}
        {isLoading && (
          <div className='flex justify-start'>
            <div className='bg-white/60 dark:bg-gray-700/60 backdrop-blur-md p-3 rounded-lg border border-gray-200/40 dark:border-gray-600/40'>
              <div className='flex space-x-1'>
                <div className='w-2 h-2 bg-blue-500 rounded-full animate-bounce'></div>
                <div
                  className='w-2 h-2 bg-blue-500 rounded-full animate-bounce'
                  style={{ animationDelay: '0.1s' }}
                ></div>
                <div
                  className='w-2 h-2 bg-blue-500 rounded-full animate-bounce'
                  style={{ animationDelay: '0.2s' }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className='bg-red-50/60 dark:bg-red-900/30 backdrop-blur-md border border-red-200/40 dark:border-red-800/40 text-red-700 dark:text-red-400 p-4 rounded-lg'>
            <div className='flex items-start space-x-3'>
              <div className='flex-shrink-0'>
                <svg
                  className='h-5 w-5 text-red-400'
                  viewBox='0 0 20 20'
                  fill='currentColor'
                >
                  <path
                    fillRule='evenodd'
                    d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                    clipRule='evenodd'
                  />
                </svg>
              </div>
              <div className='flex-1'>
                <h3 className='text-sm font-medium text-red-800 dark:text-red-300'>
                  {error.message}
                </h3>
                {error.details && (
                  <div className='mt-2 text-sm text-red-700 dark:text-red-400'>
                    <p>{error.details}</p>
                  </div>
                )}
                <div className='mt-3'>
                  <button
                    onClick={() => setError(null)}
                    className='text-sm bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 text-red-800 dark:text-red-200 px-3 py-1 rounded-md transition-colors'
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className='flex-shrink-0 p-4 border-t border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-t from-blue-50/50 to-transparent dark:from-gray-800/50 backdrop-blur-md'>
        <form onSubmit={handleSubmit} className='flex space-x-3'>
          <div className='flex-1'>
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='输入影视推荐类型...'
              className='w-full p-3 border border-blue-300/60 dark:border-blue-600/60 rounded-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-md text-gray-900 dark:text-gray-100 placeholder-gray-500/60 dark:placeholder-gray-400/60 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none transition-all duration-200'
              rows={2}
              disabled={isLoading}
            />
          </div>
          <button
            type='submit'
            disabled={!inputMessage.trim() || isLoading}
            className='px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg flex items-center space-x-2'
          >
            <Send className='h-4 w-4' />
            <span>发送</span>
          </button>
        </form>

        {/* 提示信息 */}
        <div className='mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400'>
          <span>💡 支持影视推荐</span>
          <span>按 Enter 发送，Shift+Enter 换行</span>
        </div>
      </div>
    </div>
  );
}
