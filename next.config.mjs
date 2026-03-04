/** @type {import('next').NextConfig} */
const nextConfig = {
  /* 禁用压缩以支持流式响应实时推送 */
  compress: false,
  /*
  images 禁用图片优化以兼容边缘部署平台
  @功能 Cloudflare Pages / 腾讯云 EdgeOne Pages 不支持 Next.js 原生图片优化
  */
  images: {
    unoptimized: true,
  },
  /*
  output 使用 standalone 模式
  @功能 生成独立可部署的输出，兼容 EdgeOne Pages / Cloudflare Pages / Docker 等多种部署方式
  */
  output: "standalone",
  /*
  experimental 实验性功能配置
  @功能 serverActions 默认启用，optimizePackageImports 优化大型包的导入以加快构建和加载速度
  */
  experimental: {
    optimizePackageImports: ["recharts", "lucide-react"],
  },
};

export default nextConfig;
