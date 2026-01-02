"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

type Language = "zh" | "en";

interface Translations {
  [key: string]: {
    zh: string;
    en: string;
  };
}

const translations: Translations = {
  dashboardTitle: {
    zh: "CDN 流量监控",
    en: "CDN Traffic Monitor",
  },
  cloudflare: {
    zh: "Cloudflare",
    en: "Cloudflare",
  },
  edgeone: {
    zh: "EdgeOne",
    en: "EdgeOne",
  },
  loading: {
    zh: "加载中...",
    en: "Loading...",
  },
  loadError: {
    zh: "加载数据失败，请稍后重试",
    en: "Failed to load data, please try again later",
  },
  retry: {
    zh: "重试",
    en: "Retry",
  },
  noData: {
    zh: "暂无数据",
    en: "No data available",
  },
  singleDay: {
    zh: "单日",
    en: "1 Day",
  },
  threeDays: {
    zh: "3天",
    en: "3 Days",
  },
  sevenDays: {
    zh: "7天",
    en: "7 Days",
  },
  thirtyDays: {
    zh: "30天",
    en: "30 Days",
  },
  totalRequests: {
    zh: "总请求数",
    en: "Total Requests",
  },
  totalBandwidth: {
    zh: "总流量",
    en: "Total Bandwidth",
  },
  totalThreats: {
    zh: "安全威胁",
    en: "Threats Blocked",
  },
  cachedRequests: {
    zh: "缓存请求",
    en: "Cached Requests",
  },
  cachedBandwidth: {
    zh: "缓存流量",
    en: "Cached Bandwidth",
  },
  cacheHitRate: {
    zh: "缓存命中率",
    en: "Cache Hit Rate",
  },
  webTrafficTrends: {
    zh: "流量趋势",
    en: "Traffic Trends",
  },
  account: {
    zh: "账户",
    en: "Account",
  },
  zone: {
    zh: "站点",
    en: "Zone",
  },
  requests: {
    zh: "请求数",
    en: "Requests",
  },
  bandwidth: {
    zh: "流量",
    en: "Bandwidth",
  },
  geography: {
    zh: "地理分布",
    en: "Geography",
  },
  topCountries: {
    zh: "访问国家/地区 TOP",
    en: "Top Countries/Regions",
  },
  configureToken: {
    zh: "请配置 API Token",
    en: "Please configure API Token",
  },
  poweredBy: {
    zh: "Powered by",
    en: "Powered by",
  },
  settings: {
    zh: "设置",
    en: "Settings",
  },
  theme: {
    zh: "主题",
    en: "Theme",
  },
  language: {
    zh: "语言",
    en: "Language",
  },
  light: {
    zh: "浅色",
    en: "Light",
  },
  dark: {
    zh: "深色",
    en: "Dark",
  },
  system: {
    zh: "系统",
    en: "System",
  },
  originPull: {
    zh: "回源",
    en: "Origin Pull",
  },
  ddosProtection: {
    zh: "DDoS 防护",
    en: "DDoS Protection",
  },
  edgeFunctions: {
    zh: "边缘函数",
    en: "Edge Functions",
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("zh");

  const t = useCallback(
    (key: string): string => {
      return translations[key]?.[language] || key;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
