import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { PosterItem } from '@/lib/poster-carousel.client';

interface PosterCarouselProps {
  posters: PosterItem[];
  loading: boolean;
}

export default function PosterCarousel({
  posters: initialPosters,
  loading,
}: PosterCarouselProps) {
  const router = useRouter();
  const [posters, setPosters] = useState<PosterItem[]>(initialPosters || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedOverview, setExpandedOverview] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  // 检测是否为移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 使用 useRef 来跟踪 initialPosters 的前一个值
  const prevInitialPostersRef = useRef<PosterItem[] | undefined>(undefined);

  // 更新海报数据当props变化时
  useEffect(() => {
    const prevPosters = prevInitialPostersRef.current;
    const hasChanged =
      !prevPosters ||
      prevPosters.length !== (initialPosters?.length || 0) ||
      (initialPosters || []).some((poster, index) => {
        const prevPoster = prevPosters[index];
        return (
          !prevPoster ||
          prevPoster.id !== poster.id ||
          prevPoster.poster !== poster.poster
        );
      });

    if (hasChanged) {
      // 使用 requestAnimationFrame 来延迟 setState 调用
      requestAnimationFrame(() => {
        setPosters(initialPosters || []);
      });
      prevInitialPostersRef.current = initialPosters
        ? [...initialPosters]
        : undefined;
    }
  }, [initialPosters]);

  // 预加载图片
  useEffect(() => {
    if (posters.length > 0) {
      posters.forEach((poster) => {
        const img = new window.Image();
        img.src = poster.poster;
      });
    }
  }, [posters]);

  // 自动轮播
  useEffect(() => {
    if (posters.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % posters.length);
    }, 12000); // 延长到12秒，给用户更多阅读时间

    return () => clearInterval(interval);
  }, [posters.length]);

  // 手动切换
  const goToPrevious = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev - 1 + posters.length) % posters.length);
    setTimeout(() => setIsTransitioning(false), 500);
  };

  const goToNext = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev + 1) % posters.length);
    setTimeout(() => setIsTransitioning(false), 500);
  };

  // 触摸手势处理
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrevious();
    }
  };

  // 处理播放按钮点击 - 复用VideoCard的逻辑
  const handlePlay = (poster: PosterItem) => {
    // 构建播放URL，参考VideoCard的handlePlayInNewTab逻辑
    let url = '';

    if (poster.doubanId) {
      // 豆瓣内容，使用标题搜索
      url = `/play?title=${encodeURIComponent(poster.title.trim())}${
        poster.year ? `&year=${poster.year}` : ''
      }${
        poster.doubanId && poster.doubanId !== '0'
          ? `&douban_id=${poster.doubanId}`
          : ''
      }${
        poster.type === 'movie'
          ? '&stype=movie'
          : poster.type === 'tv' || poster.type === 'anime'
            ? '&stype=tv'
            : ''
      }&prefer=true`;
    } else {
      // 其他内容，使用ID
      url = `/play?title=${encodeURIComponent(poster.title.trim())}${
        poster.year ? `&year=${poster.year}` : ''
      }&prefer=true`;
    }

    window.open(url, '_blank');
  };

  // 获取分类对应的链接
  const getCategoryLink = (category: string) => {
    const linkMap: { [key: string]: string } = {
      热门电影: '/douban?type=movie',
      热门剧集: '/douban?type=tv',
      海外剧集: '/douban?type=tv',
    };
    return linkMap[category] || '/douban';
  };

  // 如果正在加载或没有海报数据，不显示任何内容
  if (loading || posters.length === 0) {
    return null;
  }

  return (
    <div className='mb-8 relative -mt-16 z-10 px-2 md:px-4'>
      {/* 海报轮播容器 */}
      <div
        className='relative h-[50vh] sm:h-[55vh] md:h-[calc(58vh+2rem)] min-h-[360px] sm:min-h-[450px] md:min-h-[480px] max-h-[600px] sm:max-h-[700px] md:max-h-[750px] overflow-hidden bg-black w-full rounded-2xl shadow-2xl'
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          clipPath: 'inset(0 0 0 0 round 1rem)',
          transform: 'scale(1)',
          transition: 'none',
        }}
      >
        <div
          ref={carouselRef}
          className='flex h-full transition-transform duration-1000 ease-in-out'
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {Array.isArray(posters) &&
            posters.map((poster) => (
              <div
                key={poster.id}
                className='w-full h-full flex-shrink-0 relative'
                style={{
                  transform: 'scale(1)',
                  transition: 'none',
                }}
              >
                {/* 背景海报 */}
                <div className='absolute inset-0'>
                  <Image
                    src={
                      isMobile && poster.portraitPoster
                        ? poster.portraitPoster
                        : poster.poster
                    }
                    alt={poster.title}
                    fill
                    sizes='(max-width: 1366px) 100vw, (max-width: 1920px) 1600px, 1920px'
                    quality={poster.isTMDB ? 75 : 70}
                    priority={posters.indexOf(poster) === 0}
                    className='object-cover'
                    style={{
                      filter: poster.isTMDB
                        ? 'contrast(1.05) brightness(0.95)'
                        : 'none',
                      transform: 'scale(1)',
                      transition: 'none',
                    }}
                  />
                  {/* 左侧信息面板渐变遮罩 - 更轻的效果 */}
                  <div className='absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent' />
                  {/* 底部渐变遮罩 - 轻柔效果 */}
                  <div className='absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent' />
                </div>

                {/* 左侧信息面板 - 移动端优化 */}
                <div className='absolute left-0 bottom-0 w-full md:w-1/2 lg:w-2/5 p-3 sm:p-4 md:p-6 pt-8 sm:pt-12 text-white flex flex-col justify-end pb-6 sm:pb-8'>
                  <div className='max-w-md space-y-3 sm:space-y-4'>
                    {/* 分类标签 */}
                    <div className='flex flex-wrap items-center gap-2'>
                      <div
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const link = getCategoryLink(poster.category);

                          router.push(link);
                        }}
                        className='inline-block px-2.5 py-1 sm:px-3 sm:py-1.5 bg-red-600 text-white text-xs font-medium rounded-full hover:bg-red-700 transition-colors duration-300 cursor-pointer relative z-20 shadow-md'
                      >
                        {poster.category}
                      </div>
                      {poster.isTMDB && (
                        <span className='inline-flex items-center text-xs bg-blue-600/90 backdrop-blur-sm px-2 py-1 rounded-full shadow-md animate-pulse'>
                          HD画质
                        </span>
                      )}
                    </div>

                    {/* 标题 */}
                    <h2 className='text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold mb-2 sm:mb-3 drop-shadow-lg leading-tight line-clamp-2 text-white'>
                      {poster.title}
                    </h2>

                    {/* 评分和年份 */}
                    <div className='flex items-center space-x-3 sm:space-x-4 text-white/90'>
                      {poster.rate && (
                        <div className='flex items-center text-xs sm:text-sm bg-white/10 backdrop-blur-sm px-2 py-1 rounded-full'>
                          <span className='text-yellow-400 mr-1 drop-shadow'>
                            ★
                          </span>
                          <span className='font-medium'>{poster.rate}</span>
                        </div>
                      )}
                      {poster.year && (
                        <span className='text-xs sm:text-sm text-white/80 font-medium'>
                          {poster.year}
                        </span>
                      )}
                    </div>

                    {/* 简介 */}
                    {poster.overview && (
                      <div className='mb-3 sm:mb-4 max-w-md'>
                        <p
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // 只有当内容被截断时才响应点击
                            if (poster.overview.length > 80) {
                              setExpandedOverview(
                                poster.id === expandedOverview
                                  ? null
                                  : poster.id,
                              );
                            }
                          }}
                          className={`text-white/85 text-xs leading-relaxed transition-all duration-300 sm:text-sm backdrop-blur-sm ${
                            poster.id === expandedOverview ? '' : 'line-clamp-2'
                          } ${
                            poster.overview.length > 80 ? 'cursor-pointer' : ''
                          }`}
                        >
                          {poster.overview}
                        </p>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className='flex flex-wrap gap-2 sm:gap-3'>
                      <button
                        onClick={() => handlePlay(poster)}
                        className='flex items-center space-x-1 sm:space-x-1.5 bg-red-600 hover:bg-red-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors duration-300 shadow-lg text-xs font-medium backdrop-blur-sm'
                      >
                        <Play className='w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current' />
                        <span>播放</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* 底部切换和指示器 - 移动端优化 */}
      <div className='absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center space-x-1 sm:space-x-2'>
        {/* 左侧切换按钮 - 优化样式 */}
        <button
          onClick={goToPrevious}
          className='text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors duration-300 p-0.5 sm:p-1 rounded-full backdrop-blur-sm'
          aria-label='上一个'
        >
          <ChevronLeft className='w-2.5 h-2.5 sm:w-3.5 sm:h-3.5' />
        </button>

        {/* 指示器 - 缩小尺寸 */}
        <div className='flex space-x-0.5 sm:space-x-1'>
          {posters.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                if (isTransitioning || index === currentIndex) return;
                setIsTransitioning(true);
                setCurrentIndex(index);
                setTimeout(() => setIsTransitioning(false), 500);
              }}
              className={`h-0.75 sm:h-1 rounded-full transition-all duration-500 ease-out ${
                index === currentIndex
                  ? 'w-3 sm:w-4 bg-white shadow-md shadow-white/20'
                  : 'w-0.75 sm:w-1 bg-white/20 hover:bg-white/40'
              }`}
              aria-label={`切换到第${index + 1}张海报`}
            />
          ))}
        </div>

        {/* 右侧切换按钮 - 优化样式 */}
        <button
          onClick={goToNext}
          className='text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors duration-300 p-0.5 sm:p-1 rounded-full backdrop-blur-sm'
          aria-label='下一个'
        >
          <ChevronRight className='w-2.5 h-2.5 sm:w-3.5 sm:h-3.5' />
        </button>
      </div>
    </div>
  );
}
