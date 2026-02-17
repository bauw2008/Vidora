// 图片占位符组件 - 实现骨架屏效果（支持暗色模式）
const ImagePlaceholder = ({ aspectRatio }: { aspectRatio: string }) => {
  return (
    <div className={`w-full ${aspectRatio} rounded-lg image-placeholder`} />
  );
};

export { ImagePlaceholder };
