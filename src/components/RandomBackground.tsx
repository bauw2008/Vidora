interface RandomBackgroundProps {
  className?: string;
  imageUrl: string;
}

export const RandomBackground: React.FC<RandomBackgroundProps> = ({
  className = '',
  imageUrl,
}) => {
  return (
    <div className={`absolute inset-0 ${className}`}>
      {/* 使用原生 img 避免 next/image 的双重加载问题 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt='Random background'
        className='absolute inset-0 w-full h-full object-cover'
        style={{ filter: 'brightness(0.7)' }}
      />
    </div>
  );
};
