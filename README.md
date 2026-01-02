# CDN Monitor Dashboard

一个功能强大的 CDN 监控仪表板，支持 Cloudflare 和 EdgeOne（腾讯云 CDN）多账户监控。

## ✨ 特性

- 📊 **多 CDN 平台支持**
  - Cloudflare 完整支持（包括 Workers 监控）
  - EdgeOne（腾讯云 CDN）支持
  
- 🔐 **多账户管理**
  - 支持 Cloudflare 多账户配置
  - 支持 EdgeOne 多账户配置
  - 灵活的域名过滤

- 📈 **数据可视化**
  - 实时流量监控
  - 请求统计分析
  - 地理位置分布
  - 威胁监测
  - 缓存命中率
  - Workers 性能监控

- 🌓 **用户体验**
  - 深色/浅色主题切换
  - 响应式设计
  - 多语言支持（中文/英文）
  - 多时间段选择（1天/3天/7天/30天）

- ⚡ **高性能**
  - 基于 Next.js 15+ 和 React 19+
  - Edge Runtime 支持
  - 可部署到 Cloudflare Pages

## 🚀 快速开始

### 前置要求

- Node.js 20+
- pnpm（推荐）或 npm
- Cloudflare API 密钥（如需 Cloudflare 监控）
- 腾讯云 API 密钥（如需 EdgeOne 监控）

### 安装

```bash
# 克隆项目
git clone https://github.com/XxxXTeam/cloudflare-monitor.git
cd cloudflare-monitor

# 安装依赖
pnpm install
```

### 配置

1. 复制环境变量示例文件：

```bash
cp .env.demo .env
```

2. 编辑 `.env` 文件，配置你的 API 密钥：

#### Cloudflare 配置

**单账户配置：**

```env
CF_API_KEY=your_cloudflare_api_key
CF_EMAIL=your_cloudflare_email
CF_ACCOUNT_NAME=CloudFlare
CF_DOMAINS=example.com,example.org
CF_ACCOUNT_ID=your_account_id
```

**多账户配置：**

```env
# 账户 1
CF_API_KEY_1=api-key-for-account-1
CF_EMAIL_1=email-for-account-1
CF_ACCOUNT_NAME_1=账户1
CF_DOMAINS_1=domain1.com,domain2.com

# 账户 2
CF_API_KEY_2=api-key-for-account-2
CF_EMAIL_2=email-for-account-2
CF_ACCOUNT_NAME_2=账户2
CF_DOMAINS_2=domain3.com
```

#### EdgeOne 配置

**单账户配置：**

```env
SECRET_ID=your_tencent_cloud_secret_id
SECRET_KEY=your_tencent_cloud_secret_key
EO_ACCOUNT_NAME=EdgeOne
EO_ZONES=zone1.com,zone2.com
```

**多账户配置：**

```env
# 账户 1
SECRET_ID_1=AKIDxxx
SECRET_KEY_1=xxx
EO_ACCOUNT_NAME_1=账户1
EO_ZONES_1=site1.com,site2.com
```

#### 其他配置

```env
SITE_NAME=CDN Monitor Dashboard
```

### 运行

#### 开发模式

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)

#### 生产构建

```bash
pnpm build
pnpm start
```

## 📦 部署

### Cloudflare Pages

本项目支持部署到 Cloudflare Pages，享受免费的边缘计算能力。

1. 连接 GitHub 仓库到 Cloudflare Pages
2. 配置构建设置：
   - **构建命令**: `pnpm build`
   - **构建输出目录**: `.vercel/output/static`
3. 在 Cloudflare Pages 设置中添加环境变量
4. 部署

### Vercel

```bash
vercel deploy
```

### Docker（可选）

```bash
docker build -t cdn-monitor .
docker run -p 3000:3000 --env-file .env.local cdn-monitor
```

## 🛠️ 技术栈

- **框架**: [Next.js 15+](https://nextjs.org/)
- **UI 库**: [React 19+](https://react.dev/)
- **UI 组件**: [Radix UI](https://www.radix-ui.com/)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **图表**: [Recharts](https://recharts.org/)
- **图标**: [Lucide React](https://lucide.dev/)
- **类型**: [TypeScript](https://www.typescriptlang.org/)

## 📖 API 说明

项目包含以下 API 端点：

- `/api/cf/analytics` - Cloudflare 分析数据
- `/api/cf/workers` - Cloudflare Workers 数据
- `/api/eo/zones` - EdgeOne 站点列表
- `/api/eo/traffic` - EdgeOne 流量数据

## 🔧 开发指南

### 项目结构

```
cloudflare-monitor/
├── src/
│   ├── app/              # Next.js 应用路由
│   │   ├── api/          # API 路由
│   │   │   ├── cf/       # Cloudflare API
│   │   │   └── eo/       # EdgeOne API
│   │   ├── layout.tsx    # 根布局
│   │   └── page.tsx      # 首页
│   ├── components/       # React 组件
│   │   ├── ui/           # UI 基础组件
│   │   ├── dashboard.tsx # 仪表板主组件
│   │   └── ...           # 其他组件
│   ├── lib/              # 工具函数
│   └── types/            # TypeScript 类型定义
├── public/               # 静态资源
├── .env.demo             # 环境变量示例
└── package.json          # 项目依赖
```

### 添加新功能

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

```bash
# 代码检查
pnpm lint

# 类型检查
pnpm build
```

## 🔒 安全性

- 请勿将 `.env.local` 文件提交到版本控制系统
- API 密钥应当设置适当的权限（只读权限即可）
- 建议使用专用的 API 密钥，避免使用主账户密钥

## 🤝 贡献

欢迎贡献！请查看 [贡献指南](CONTRIBUTING.md)（如有）。

## 📝 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Next.js](https://nextjs.org/)
- [Cloudflare API](https://api.cloudflare.com/)
- [Tencent Cloud EdgeOne](https://cloud.tencent.com/product/edgeone)
- [Radix UI](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)

## 📮 联系方式

- 项目地址: [https://github.com/XxxXTeam/cloudflare-monitor](https://github.com/XxxXTeam/cloudflare-monitor)
- 问题反馈: [GitHub Issues](https://github.com/XxxXTeam/cloudflare-monitor/issuesh

---

如果这个项目对你有帮助，请给一个 ⭐️ Star！
