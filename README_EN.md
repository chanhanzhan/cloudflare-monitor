# CDN Monitor Dashboard

A powerful CDN monitoring dashboard that supports multi-account monitoring for both Cloudflare and EdgeOne (Tencent Cloud CDN).

## ✨ Features

- 📊 **Multi-CDN Platform Support**
  - Full Cloudflare support (including Workers monitoring)
  - EdgeOne (Tencent Cloud CDN) support
  
- 🔐 **Multi-Account Management**
  - Multiple Cloudflare account configuration
  - Multiple EdgeOne account configuration
  - Flexible domain filtering

- 📈 **Data Visualization**
  - Real-time traffic monitoring
  - Request analytics
  - Geographic distribution
  - Threat detection
  - Cache hit rates
  - Workers performance monitoring

- 🌓 **User Experience**
  - Dark/Light theme toggle
  - Responsive design
  - Multi-language support (Chinese/English)
  - Multiple time period selection (1/3/7/30 days)

- ⚡ **High Performance**
  - Built with Next.js 15+ and React 19+
  - Edge Runtime support
  - Deployable to Cloudflare Pages

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm (recommended) or npm
- Cloudflare API keys (if monitoring Cloudflare)
- Tencent Cloud API keys (if monitoring EdgeOne)

### Installation

```bash
# Clone the repository
git clone https://github.com/chanhanzhan/cloudflare-monitor.git
cd cloudflare-monitor

# Install dependencies
pnpm install
```

### Configuration

1. Copy the example environment file:

```bash
cp .env.demo .env.local
```

2. Edit `.env.local` and configure your API keys:

#### Cloudflare Configuration

**Single Account:**

```env
CF_API_KEY=your_cloudflare_api_key
CF_EMAIL=your_cloudflare_email
CF_ACCOUNT_NAME=CloudFlare
CF_DOMAINS=example.com,example.org
CF_ACCOUNT_ID=your_account_id
```

**Multiple Accounts:**

```env
# Account 1
CF_API_KEY_1=api-key-for-account-1
CF_EMAIL_1=email-for-account-1
CF_ACCOUNT_NAME_1=Account 1
CF_DOMAINS_1=domain1.com,domain2.com

# Account 2
CF_API_KEY_2=api-key-for-account-2
CF_EMAIL_2=email-for-account-2
CF_ACCOUNT_NAME_2=Account 2
CF_DOMAINS_2=domain3.com
```

#### EdgeOne Configuration

**Single Account:**

```env
SECRET_ID=your_tencent_cloud_secret_id
SECRET_KEY=your_tencent_cloud_secret_key
EO_ACCOUNT_NAME=EdgeOne
EO_ZONES=zone1.com,zone2.com
```

**Multiple Accounts:**

```env
# Account 1
SECRET_ID_1=AKIDxxx
SECRET_KEY_1=xxx
EO_ACCOUNT_NAME_1=Account 1
EO_ZONES_1=site1.com,site2.com
```

#### Other Configuration

```env
SITE_NAME=CDN Monitor Dashboard
```

### Running

#### Development Mode

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000)

#### Production Build

```bash
pnpm build
pnpm start
```

## 📦 Deployment

### Cloudflare Pages

This project supports deployment to Cloudflare Pages, leveraging free edge computing.

1. Connect your GitHub repository to Cloudflare Pages
2. Configure build settings:
   - **Build command**: `pnpm build`
   - **Build output directory**: `.vercel/output/static`
3. Add environment variables in Cloudflare Pages settings
4. Deploy

### Vercel

```bash
vercel deploy
```

### Docker (Optional)

```bash
docker build -t cdn-monitor .
docker run -p 3000:3000 --env-file .env.local cdn-monitor
```

## 🛠️ Tech Stack

- **Framework**: [Next.js 15+](https://nextjs.org/)
- **UI Library**: [React 19+](https://react.dev/)
- **UI Components**: [Radix UI](https://www.radix-ui.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Charts**: [Recharts](https://recharts.org/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Types**: [TypeScript](https://www.typescriptlang.org/)

## 📖 API Documentation

The project includes the following API endpoints:

- `/api/cf/analytics` - Cloudflare analytics data
- `/api/cf/workers` - Cloudflare Workers data
- `/api/eo/zones` - EdgeOne zones list
- `/api/eo/traffic` - EdgeOne traffic data

## 🔧 Development Guide

### Project Structure

```
cloudflare-monitor/
├── src/
│   ├── app/              # Next.js app router
│   │   ├── api/          # API routes
│   │   │   ├── cf/       # Cloudflare API
│   │   │   └── eo/       # EdgeOne API
│   │   ├── layout.tsx    # Root layout
│   │   └── page.tsx      # Home page
│   ├── components/       # React components
│   │   ├── ui/           # Base UI components
│   │   ├── dashboard.tsx # Main dashboard component
│   │   └── ...           # Other components
│   ├── lib/              # Utility functions
│   └── types/            # TypeScript type definitions
├── public/               # Static assets
├── .env.demo             # Environment variables example
└── package.json          # Project dependencies
```

### Adding New Features

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Standards

```bash
# Linting
pnpm lint

# Type checking
pnpm build
```

## 🔒 Security

- Never commit `.env.local` to version control
- API keys should have appropriate permissions (read-only is sufficient)
- Use dedicated API keys instead of master account keys

## 🤝 Contributing

Contributions are welcome! Please check the [Contributing Guide](CONTRIBUTING.md) (if available).

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/)
- [Cloudflare API](https://api.cloudflare.com/)
- [Tencent Cloud EdgeOne](https://cloud.tencent.com/product/edgeone)
- [Radix UI](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)

## 📮 Contact

- Author: Geekertao
- Repository: [https://github.com/chanhanzhan/cloudflare-monitor](https://github.com/chanhanzhan/cloudflare-monitor)
- Issues: [GitHub Issues](https://github.com/chanhanzhan/cloudflare-monitor/issues)

## 🗺️ Roadmap

- [ ] Add support for more CDN platforms
- [ ] Add alerting functionality
- [ ] Support custom dashboards
- [ ] Add data export features
- [ ] Mobile optimization

---

If this project helps you, please give it a ⭐️ Star!
