"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveTabs } from "@/components/ui/responsive-tabs";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Shield, Globe, Activity, Database, TrendingUp, Code, Server, Clock, Zap, FileCode, Cpu } from "lucide-react";
import { formatBytes, formatNumber } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import type { ESAData, ESASite, ESAAccount, ESARoutine } from "@/types";

/*
ESA_TAB_ITEMS ESA 站点详情页标签项定义
@功能 定义 ESA 站点详情页的所有标签页
*/
/*
ESA 国家代码中文映射
*/
const COUNTRY_ZH: Record<string, string> = {
  CN: "中国", US: "美国", JP: "日本", KR: "韩国", SG: "新加坡",
  HK: "中国香港", TW: "中国台湾", MO: "中国澳门", DE: "德国", FR: "法国",
  GB: "英国", CA: "加拿大", AU: "澳大利亚", IN: "印度", BR: "巴西",
  RU: "俄罗斯", NL: "荷兰", IT: "意大利", ES: "西班牙", SE: "瑞典",
  CH: "瑞士", PL: "波兰", ID: "印度尼西亚", TH: "泰国", VN: "越南",
  MY: "马来西亚", PH: "菲律宾", FI: "芬兰", NO: "挪威", DK: "丹麦",
  IE: "爱尔兰", PT: "葡萄牙", GR: "希腊", NZ: "新西兰", AR: "阿根廷",
  MX: "墨西哥", ZA: "南非", AE: "阿联酋", SA: "沙特阿拉伯", TR: "土耳其",
  UA: "乌克兰", IL: "以色列", CZ: "捷克", AT: "奥地利", BE: "比利时",
  RO: "罗马尼亚", HU: "匈牙利", CL: "智利", CO: "哥伦比亚",
};

/*
ESA 缓存状态中文映射
*/
const CACHE_STATUS_ZH: Record<string, string> = {
  HIT: "命中", MISS: "未命中", EXPIRED: "已过期", STALE: "陈旧",
  BYPASS: "绕过", REVALIDATED: "重新验证", DYNAMIC: "动态内容",
  "NONE/UNKNOWN": "无/未知", UPDATING: "更新中",
};

/*
translateName 通用名称翻译函数
@param name 原始名称
@param map 翻译映射表
@return 翻译后的名称，未匹配时返回原值
*/
const translateName = (name: string, map: Record<string, string>) =>
  map[name] || map[name.toUpperCase()] || name;

const ESA_TAB_ITEMS = [
  { value: "overview", label: "概览" },
  { value: "traffic", label: "流量趋势" },
  { value: "country", label: "地区分布" },
  { value: "status", label: "状态码" },
  { value: "cache", label: "缓存分析" },
  { value: "content", label: "内容类型" },
  { value: "host", label: "域名分布" },
  { value: "device", label: "设备/浏览器" },
  { value: "method", label: "请求方法" },
  { value: "protocol", label: "协议版本" },
  { value: "ip", label: "客户端 IP" },
  { value: "referer", label: "来源分析" },
  { value: "security", label: "安全防护" },
  { value: "routines", label: "边缘函数" },
];

interface TrafficData {
  time: string;
  requests: number;
  bytes: number;
}

export default function ESASiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.siteId as string;

  const [site, setSite] = useState<ESASite | null>(null);
  const [account, setAccount] = useState<ESAAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  /* TOP 数据状态（懒加载） */
  const [topData, setTopData] = useState<Record<string, { name: string; value: number }[]>>({});
  const [topLoaded, setTopLoaded] = useState<Set<string>>(new Set());

  /* WAF 安全数据 */
  const [wafData, setWafData] = useState<any>(null);
  const [wafLoaded, setWafLoaded] = useState(false);

  useEffect(() => {
    fetchSiteData();
  }, [siteId]);

  /*
  懒加载 WAF 安全数据 - 切换到安全防护标签时触发
  @功能 获取 WAF 规则集列表和规则使用统计
  */
  useEffect(() => {
    if (activeTab !== "security" || wafLoaded || loading || !site?.SiteId) return;
    setWafLoaded(true);
    /* 并行获取 WAF 规则 + 安全相关状态码数据（403/444 作为拦截统计） */
    const base = `/api/esa/top?siteId=${site.SiteId}`;
    Promise.all([
      fetch(`/api/esa/waf?siteId=${site.SiteId}`).then((r) => r.json()),
      fetch(`${base}&dimension=EdgeResponseStatusCode&fieldName=Requests`).then((r) => r.json()),
    ]).then(([waf, statusData]) => {
      /* 从状态码数据中提取安全拦截指标 */
      const securityCodes = ["403", "444", "503"];
      const allStatus = statusData.data || [];
      const blockedRequests = allStatus
        .filter((s: any) => securityCodes.includes(String(s.name)))
        .reduce((sum: number, s: any) => sum + (s.value || 0), 0);
      const totalRequests = allStatus.reduce((sum: number, s: any) => sum + (s.value || 0), 0);
      setWafData({
        ...waf,
        securityStats: {
          blockedRequests,
          totalRequests,
          blockRate: totalRequests > 0 ? ((blockedRequests / totalRequests) * 100).toFixed(2) : "0",
          statusBreakdown: allStatus.filter((s: any) => securityCodes.includes(String(s.name))),
        },
      });
    }).catch((err) => console.error("ESA WAF error:", err));
  }, [activeTab, wafLoaded, loading, site]);

  const fetchSiteData = async () => {
    setLoading(true);
    try {
      // Fast initial load, then fetch full details
      const res = await fetch("/api/esa?skipTimeSeries=true");
      const data: ESAData = await res.json();
      
      // Find the site by siteId (compare as strings since SiteId can be number or string)
      for (const acc of data.accounts || []) {
        const found = acc.sites?.find((s) => 
          String(s.SiteId) === siteId || 
          s.SiteName === siteId || 
          String(s.SiteId) === decodeURIComponent(siteId)
        );
        if (found) {
          setSite(found);
          setAccount(acc);
          
          // Fetch full data with time series in background
          fetch("/api/esa?details=true").then(r => r.json()).then((fullData: ESAData) => {
            for (const fullAcc of fullData.accounts || []) {
              const fullSite = fullAcc.sites?.find((s) => String(s.SiteId) === String(found.SiteId));
              if (fullSite) {
                setSite(fullSite);
                setAccount(fullAcc);
                break;
              }
            }
          }).catch(() => {});
          break;
        }
      }

    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  /*
  懒加载 TOP 数据 - 仅在切换到对应标签时触发
  @功能 按需获取地区/状态码/缓存/内容类型/浏览器/设备/方法/协议等 TOP 数据
  */
  useEffect(() => {
    if (loading || !site?.SiteId || topLoaded.has(activeTab)) return;
    const base = `/api/esa/top?siteId=${site.SiteId}`;

    const tabDimensionMap: Record<string, { key: string; dimension: string; fieldName?: string }[]> = {
      country: [
        { key: "country", dimension: "ClientCountryCode" },
      ],
      status: [
        { key: "statusCode", dimension: "EdgeResponseStatusCode", fieldName: "Requests" },
        { key: "originStatus", dimension: "OriginResponseStatusCode", fieldName: "Requests" },
      ],
      cache: [
        { key: "cacheStatus", dimension: "EdgeCacheStatus", fieldName: "Requests" },
      ],
      content: [
        { key: "contentType", dimension: "EdgeResponseContentType" },
      ],
      device: [
        { key: "browser", dimension: "ClientBrowser", fieldName: "Requests" },
        { key: "device", dimension: "ClientDevice", fieldName: "Requests" },
        { key: "os", dimension: "ClientOS", fieldName: "Requests" },
      ],
      method: [
        { key: "method", dimension: "ClientRequestMethod", fieldName: "Requests" },
      ],
      protocol: [
        { key: "protocol", dimension: "ClientRequestProtocol", fieldName: "Requests" },
        { key: "ssl", dimension: "ClientSSLProtocol", fieldName: "Requests" },
      ],
      host: [
        { key: "host", dimension: "ClientRequestHost" },
      ],
      ip: [
        { key: "clientIP", dimension: "ClientIP", fieldName: "Requests" },
      ],
      referer: [
        { key: "referer", dimension: "ClientRequestReferer" },
      ],
    };

    const configs = tabDimensionMap[activeTab];
    if (!configs) return;

    Promise.all(
      configs.map(async ({ key, dimension, fieldName }) => {
        try {
          const url = `${base}&dimension=${dimension}${fieldName ? `&fieldName=${fieldName}` : ""}`;
          const res = await fetch(url);
          const json = await res.json();
          setTopData((prev) => ({ ...prev, [key]: json.data || [] }));
        } catch (err) {
          console.error(`ESA top ${key} error:`, err);
        }
      })
    ).then(() => {
      setTopLoaded((prev) => new Set(prev).add(activeTab));
    });
  }, [activeTab, loading, site, topLoaded]);

  // Transform time series data for charts
  const trafficData = useMemo(() => {
    if (!site?.timeSeriesRequests?.length && !site?.timeSeriesTraffic?.length) {
      return [];
    }
    const requestsMap = new Map<string, number>();
    const trafficMap = new Map<string, number>();
    
    site.timeSeriesRequests?.forEach((p) => {
      requestsMap.set(p.time, p.value);
    });
    site.timeSeriesTraffic?.forEach((p) => {
      trafficMap.set(p.time, p.value);
    });
    
    const allTimes = [...new Set([
      ...(site.timeSeriesRequests?.map(p => p.time) || []),
      ...(site.timeSeriesTraffic?.map(p => p.time) || [])
    ])].sort();
    
    return allTimes.map((time) => ({
      time: new Date(time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      requests: requestsMap.get(time) || 0,
      bytes: trafficMap.get(time) || 0,
    }));
  }, [site]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
          <div className="container mx-auto flex h-14 sm:h-16 items-center gap-4 px-3 sm:px-4 max-w-7xl">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-6 w-32" />
          </div>
        </header>
        <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-7xl">
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 sm:p-6">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-8 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Skeleton className="h-10 w-full max-w-xl" />
          <Card>
            <CardContent className="p-4 sm:p-6">
              <Skeleton className="h-[250px] sm:h-[300px] w-full" />
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-4">
        <p className="text-muted-foreground">未找到该站点数据</p>
        <Button onClick={() => router.back()}>返回</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-14 sm:h-16 items-center gap-2 sm:gap-4 px-3 sm:px-4 max-w-7xl">
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500 flex-shrink-0" />
            <h1 className="text-base sm:text-xl font-bold truncate">{site.SiteName}</h1>
          </div>
          <Badge variant={site.Status === "active" ? "success" : "secondary"} className="flex-shrink-0">
            {site.Status === "active" ? "已启用" : site.Status || "未知"}
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-7xl">
        {/* Overview Cards - Row 1 */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-emerald-500/20">
                <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">24h 请求数</p>
                <p className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(site.requests || 0)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-blue-500/20">
                <Database className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">24h 流量</p>
                <p className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{formatBytes(site.bytes || 0)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-purple-500/20">
                <Code className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">边缘函数</p>
                <p className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{account?.routineCount || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-orange-500/20">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">ER服务状态</p>
                <p className="text-base sm:text-lg font-bold text-orange-600 dark:text-orange-400">{account?.erService?.Status || "未启用"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overview Cards - Row 2 */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-cyan-500/20">
                <Globe className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">加速区域</p>
                <p className="text-base sm:text-lg font-bold text-cyan-600 dark:text-cyan-400">
                  {site.Coverage === "global" ? "全球加速" : site.Coverage === "domestic" ? "中国大陆" : site.Coverage === "overseas" ? "海外加速" : site.Coverage || site.Area || "全球"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border-pink-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-pink-500/20">
                <Server className="h-5 w-5 sm:h-6 sm:w-6 text-pink-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">接入类型</p>
                <p className="text-base sm:text-lg font-bold text-pink-600 dark:text-pink-400">{site.AccessType || site.Type || "NS"}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-indigo-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-indigo-500/20">
                <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">CNAME 状态</p>
                <p className="text-base sm:text-lg font-bold text-indigo-600 dark:text-indigo-400">{site.CnameStatus || "正常"}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border-rose-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-rose-500/20">
                <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-rose-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">站点 ID</p>
                <p className="text-xs sm:text-sm font-mono font-bold text-rose-600 dark:text-rose-400 truncate max-w-[120px]">{site.SiteId}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <ResponsiveTabs
          tabs={ESA_TAB_ITEMS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          accentColor="bg-emerald-500"
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>

          <TabsContent value="overview" className="space-y-4">
            {/* Site Info */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> 站点信息</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">站点名称</p>
                    <p className="font-medium">{site.SiteName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">站点 ID</p>
                    <p className="font-mono text-sm">{site.SiteId}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">状态</p>
                    <Badge variant={site.Status === "active" ? "success" : "secondary"}>
                      {site.Status === "active" ? "已启用" : site.Status === "pending" ? "待验证" : site.Status || "未知"}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">接入类型</p>
                    <p className="font-medium">{site.AccessType === "CNAME" ? "CNAME 接入" : site.AccessType === "NS" ? "NS 接入" : site.AccessType || site.Type || "NS"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">加速区域</p>
                    <p className="font-medium">
                      {site.Coverage === "global" ? "全球加速" : site.Coverage === "domestic" ? "中国大陆" : site.Coverage === "overseas" ? "海外加速" : site.Coverage || site.Area || "全球"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">CNAME 状态</p>
                    <Badge variant={(site as any).CnameStatus === "configured" || (site as any).CnameStatus === "正常" ? "success" : "secondary"}>
                      {(site as any).CnameStatus === "configured" ? "已配置" : (site as any).CnameStatus || "正常"}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">实例 ID</p>
                    <p className="font-mono text-sm break-all">{(site as any).InstanceId || account?.instanceId || "-"}</p>
                  </div>
                  {(site as any).CreateTime && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">创建时间</p>
                      <p className="font-medium">{new Date((site as any).CreateTime).toLocaleString("zh-CN")}</p>
                    </div>
                  )}
                  {(site as any).NameServerList && (
                    <div className="space-y-1 md:col-span-2">
                      <p className="text-sm text-muted-foreground">NS 服务器</p>
                      <div className="flex flex-wrap gap-1">
                        {(Array.isArray((site as any).NameServerList) 
                          ? (site as any).NameServerList 
                          : [(site as any).NameServerList]
                        ).filter(Boolean).map((ns: string, i: number) => (
                          <Badge key={i} variant="outline" className="font-mono text-xs">{ns}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Account Summary */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> 账户统计 (24h)</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">总请求数</p>
                    <p className="text-2xl font-bold">{formatNumber(account?.totalRequests || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">总流量</p>
                    <p className="text-2xl font-bold">{formatBytes(account?.totalBytes || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">站点数</p>
                    <p className="text-2xl font-bold">{account?.sites?.length || 0}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">边缘函数数</p>
                    <p className="text-2xl font-bold">{account?.routineCount || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 配额使用 */}
            {account?.quotas && account.quotas.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> 资源配额使用</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {account.quotas.filter(q => q.total > 0).map((q, i) => {
                      const pct = q.total > 0 ? (q.used / q.total) * 100 : 0;
                      const quotaLabel: Record<string, string> = {
                        customHttpCert: "自定义证书", transition_rule: "转换规则",
                        "cache_rules|rule_quota": "缓存规则", "redirect_rules|rule_quota": "重定向规则",
                        "origin_rules|rule_quota": "回源规则", "https|rule_quota": "HTTPS 规则",
                        "configuration_rules|rule_quota": "配置规则", "compression_rules|rule_quota": "压缩规则",
                        "ratelimit_rules|rule_quota": "速率限制规则", "waf_rules|rule_quota": "WAF 规则",
                        ssl_certificates: "SSL 证书", waiting_room: "等候室",
                      };
                      return (
                        <div key={i} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{quotaLabel[q.quotaName] || q.quotaName}</span>
                            <span className="font-medium">{q.used} / {q.total}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full">
                            <div
                              className={`h-full rounded-full transition-all ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-emerald-500"}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 其他站点 */}
            {account && account.sites.length > 1 && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> 同账户其他站点</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {account.sites.filter(s => String(s.SiteId) !== String(site.SiteId)).map((s, i) => (
                      <div key={i} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{s.SiteName}</p>
                          <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                            <span>{formatNumber(s.requests || 0)} 请求</span>
                            <span>{formatBytes(s.bytes || 0)}</span>
                          </div>
                        </div>
                        <Badge variant={s.Status === "active" ? "success" : "secondary"} className="flex-shrink-0 ml-2">
                          {s.Status === "active" ? "启用" : s.Status || "未知"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="routines" className="space-y-4">
            {/* Edge Routines */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" /> 
                  边缘函数 (Routines)
                  <Badge variant="outline" className="ml-2">{account?.routineCount || 0} 个</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {account?.routines && account.routines.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {account.routines.map((routine, i) => (
                      <Card key={routine.name || i} className="border-dashed">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <FileCode className="h-4 w-4 text-purple-500" />
                              <span className="font-medium truncate max-w-[150px]">{routine.name}</span>
                            </div>
                            <Badge variant={routine.status === "Running" || routine.status === "deployed" || routine.status === "active" ? "success" : routine.status === "Creating" ? "info" : "secondary"} className="text-xs">
                              {routine.status === "Running" || routine.status === "deployed" ? "运行中" : routine.status === "Creating" ? "创建中" : routine.status === "NotOpened" ? "未开通" : routine.status || "未知"}
                            </Badge>
                          </div>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            {routine.description && <p className="truncate">{routine.description}</p>}
                            {(routine as any).relatedRecord && (
                              <div className="flex justify-between">
                                <span>访问域名</span>
                                <span className="font-mono text-xs truncate max-w-[120px]">{(routine as any).relatedRecord}</span>
                              </div>
                            )}
                            {(routine as any).env && (
                              <div className="flex justify-between">
                                <span>环境</span>
                                <span>{(routine as any).env === "production" ? "生产" : (routine as any).env}</span>
                              </div>
                            )}
                            {routine.createTime && (
                              <div className="flex justify-between">
                                <span>创建时间</span>
                                <span>{new Date(routine.createTime).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">暂无边缘函数</p>
                )}
              </CardContent>
            </Card>

            {/* Edge Routine Plans */}
            {account?.edgeRoutinePlans && account.edgeRoutinePlans.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Cpu className="h-5 w-5" /> 边缘计算套餐</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {account.edgeRoutinePlans.map((plan: any, i) => (
                      <Card key={i} className="border-dashed">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{plan.PlanName || plan.planName || `套餐 ${i + 1}`}</span>
                            <Badge variant="outline">{plan.Status || plan.status || "有效"}</Badge>
                          </div>
                          <div className="space-y-2 text-sm">
                            {(plan.RequestQuota || plan.requestQuota) && (
                              <div>
                                <div className="flex justify-between text-muted-foreground mb-1">
                                  <span>请求配额</span>
                                  <span>{formatNumber(plan.RequestUsed || plan.requestUsed || 0)} / {formatNumber(plan.RequestQuota || plan.requestQuota)}</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full">
                                  <div 
                                    className="h-full bg-emerald-500 rounded-full" 
                                    style={{ width: `${Math.min(100, ((plan.RequestUsed || plan.requestUsed || 0) / (plan.RequestQuota || plan.requestQuota || 1)) * 100)}%` }} 
                                  />
                                </div>
                              </div>
                            )}
                            {(plan.CpuTimeQuota || plan.cpuTimeQuota) && (
                              <div>
                                <div className="flex justify-between text-muted-foreground mb-1">
                                  <span>CPU 时间配额</span>
                                  <span>{formatNumber(plan.CpuTimeUsed || plan.cpuTimeUsed || 0)} / {formatNumber(plan.CpuTimeQuota || plan.cpuTimeQuota)} ms</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full">
                                  <div 
                                    className="h-full bg-blue-500 rounded-full" 
                                    style={{ width: `${Math.min(100, ((plan.CpuTimeUsed || plan.cpuTimeUsed || 0) / (plan.CpuTimeQuota || plan.cpuTimeQuota || 1)) * 100)}%` }} 
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ER Service Status */}
            {account?.erService && Object.keys(account.erService).length > 0 && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" /> 边缘计算服务状态</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">服务状态</p>
                      <Badge variant={account.erService.Status === "active" || account.erService.Status === "online" ? "success" : "secondary"}>
                        {account.erService.Status || "未知"}
                      </Badge>
                    </div>
                    {account.erService.PlanName && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">套餐</p>
                        <p className="font-medium">{account.erService.PlanName}</p>
                      </div>
                    )}
                    {account.erService.RequestQuota && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">请求配额</p>
                        <p className="font-medium">{formatNumber(account.erService.RequestUsed || 0)} / {formatNumber(account.erService.RequestQuota)}</p>
                      </div>
                    )}
                    {account.erService.CpuTimeQuota && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">CPU 时间配额</p>
                        <p className="font-medium">{formatNumber(account.erService.CpuTimeUsed || 0)} / {formatNumber(account.erService.CpuTimeQuota)} ms</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="traffic" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>请求趋势 (24h)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[250px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trafficData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => formatNumber(v)} />
                      <Line type="monotone" dataKey="requests" stroke="#10B981" strokeWidth={2} dot={false} name="请求" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>流量趋势 (24h)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[250px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trafficData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => formatBytes(v)} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => formatBytes(v)} />
                      <Line type="monotone" dataKey="bytes" stroke="#3B82F6" strokeWidth={2} dot={false} name="流量" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 地区分布 */}
          <TabsContent value="country">
            <Card>
              <CardHeader><CardTitle>地区分布 TOP 10 (24h)</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(topData.country?.length ?? 0) > 0 ? topData.country.map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm">{translateName(item.name, COUNTRY_ZH)}</p>
                        <div className="h-2 bg-muted rounded-full mt-1">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(item.value / (topData.country[0]?.value || 1)) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatBytes(item.value)}</span>
                    </div>
                  )) : <p className="text-muted-foreground text-center py-8">{topLoaded.has("country") ? "暂无数据" : "加载中..."}</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 状态码 */}
          <TabsContent value="status" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>边缘状态码 TOP 10</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(topData.statusCode?.length ?? 0) > 0 ? topData.statusCode.map((item, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                        <div className="flex-1">
                          <p className="text-sm font-mono">{item.name}</p>
                          <div className="h-2 bg-muted rounded-full mt-1">
                            <div className="h-full rounded-full" style={{ width: `${(item.value / (topData.statusCode[0]?.value || 1)) * 100}%`, backgroundColor: item.name.startsWith("2") ? "#10B981" : item.name.startsWith("3") ? "#3B82F6" : item.name.startsWith("4") ? "#F59E0B" : "#EF4444" }} />
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground">{formatNumber(item.value)}</span>
                      </div>
                    )) : <p className="text-muted-foreground text-center py-8">{topLoaded.has("status") ? "暂无数据" : "加载中..."}</p>}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>源站状态码 TOP 10</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(topData.originStatus?.length ?? 0) > 0 ? topData.originStatus.map((item, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                        <div className="flex-1">
                          <p className="text-sm font-mono">{item.name}</p>
                          <div className="h-2 bg-muted rounded-full mt-1">
                            <div className="h-full rounded-full" style={{ width: `${(item.value / (topData.originStatus[0]?.value || 1)) * 100}%`, backgroundColor: item.name.startsWith("2") ? "#10B981" : item.name.startsWith("3") ? "#3B82F6" : item.name.startsWith("4") ? "#F59E0B" : "#EF4444" }} />
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground">{formatNumber(item.value)}</span>
                      </div>
                    )) : <p className="text-muted-foreground text-center py-8">{topLoaded.has("status") ? "暂无数据" : "加载中..."}</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 缓存分析 */}
          <TabsContent value="cache">
            <Card>
              <CardHeader><CardTitle>缓存状态分布</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(topData.cacheStatus?.length ?? 0) > 0 ? topData.cacheStatus.map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-mono">{translateName(item.name, CACHE_STATUS_ZH)}</p>
                        <div className="h-2 bg-muted rounded-full mt-1">
                          <div className="h-full rounded-full" style={{ width: `${(item.value / (topData.cacheStatus[0]?.value || 1)) * 100}%`, backgroundColor: item.name.toLowerCase().includes("hit") ? "#10B981" : "#F59E0B" }} />
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatNumber(item.value)}</span>
                    </div>
                  )) : <p className="text-muted-foreground text-center py-8">{topLoaded.has("cache") ? "暂无数据" : "加载中..."}</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 内容类型 */}
          <TabsContent value="content">
            <Card>
              <CardHeader><CardTitle>内容类型分布 TOP 10</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(topData.contentType?.length ?? 0) > 0 ? topData.contentType.map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-mono truncate">{item.name}</p>
                        <div className="h-2 bg-muted rounded-full mt-1">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(item.value / (topData.contentType[0]?.value || 1)) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatBytes(item.value)}</span>
                    </div>
                  )) : <p className="text-muted-foreground text-center py-8">{topLoaded.has("content") ? "暂无数据" : "加载中..."}</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 设备/浏览器 */}
          <TabsContent value="device" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { key: "browser", title: "浏览器分布", color: "bg-blue-500" },
                { key: "device", title: "设备类型分布", color: "bg-orange-500" },
                { key: "os", title: "操作系统分布", color: "bg-green-500" },
              ].map(({ key, title, color }) => (
                <Card key={key}>
                  <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(topData[key]?.length ?? 0) > 0 ? topData[key].map((item, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="w-5 text-center text-xs font-medium text-muted-foreground">{i + 1}</span>
                          <div className="flex-1">
                            <p className="text-xs truncate">{item.name || "Unknown"}</p>
                            <div className="h-1.5 bg-muted rounded-full mt-1">
                              <div className={`h-full ${color} rounded-full`} style={{ width: `${(item.value / (topData[key][0]?.value || 1)) * 100}%` }} />
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatNumber(item.value)}</span>
                        </div>
                      )) : <p className="text-muted-foreground text-center py-4 text-xs">{topLoaded.has("device") ? "暂无数据" : "加载中..."}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* 请求方法 */}
          <TabsContent value="method">
            <Card>
              <CardHeader><CardTitle>HTTP 请求方法分布</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(topData.method?.length ?? 0) > 0 ? topData.method.map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-mono font-semibold">{item.name}</p>
                        <div className="h-2 bg-muted rounded-full mt-1">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(item.value / (topData.method[0]?.value || 1)) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatNumber(item.value)}</span>
                    </div>
                  )) : <p className="text-muted-foreground text-center py-8">{topLoaded.has("method") ? "暂无数据" : "加载中..."}</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 协议版本 */}
          <TabsContent value="protocol" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>HTTP 协议版本</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(topData.protocol?.length ?? 0) > 0 ? topData.protocol.map((item, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                        <div className="flex-1">
                          <p className="text-sm font-mono">{item.name}</p>
                          <div className="h-2 bg-muted rounded-full mt-1">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(item.value / (topData.protocol[0]?.value || 1)) * 100}%` }} />
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground">{formatNumber(item.value)}</span>
                      </div>
                    )) : <p className="text-muted-foreground text-center py-8">{topLoaded.has("protocol") ? "暂无数据" : "加载中..."}</p>}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>SSL/TLS 版本</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(topData.ssl?.length ?? 0) > 0 ? topData.ssl.map((item, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                        <div className="flex-1">
                          <p className="text-sm font-mono">{item.name}</p>
                          <div className="h-2 bg-muted rounded-full mt-1">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${(item.value / (topData.ssl[0]?.value || 1)) * 100}%` }} />
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground">{formatNumber(item.value)}</span>
                      </div>
                    )) : <p className="text-muted-foreground text-center py-8">{topLoaded.has("protocol") ? "暂无数据" : "加载中..."}</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 域名分布 */}
          <TabsContent value="host">
            <Card>
              <CardHeader><CardTitle>域名流量分布 TOP 10</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(topData.host?.length ?? 0) > 0 ? (() => {
                    const total = topData.host.reduce((s, d) => s + d.value, 0);
                    return topData.host.map((item, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-mono truncate">{item.name}</p>
                            <span className="text-xs text-muted-foreground">({total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%)</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full mt-1">
                            <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(item.value / (topData.host[0]?.value || 1)) * 100}%` }} />
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{formatBytes(item.value)}</span>
                      </div>
                    ));
                  })() : <p className="text-muted-foreground text-center py-8">{topLoaded.has("host") ? "暂无数据" : "加载中..."}</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 客户端 IP */}
          <TabsContent value="ip">
            <Card>
              <CardHeader><CardTitle>客户端 IP TOP 10</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(topData.clientIP?.length ?? 0) > 0 ? topData.clientIP.map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-mono">{item.name}</p>
                        <div className="h-2 bg-muted rounded-full mt-1">
                          <div className="h-full bg-rose-500 rounded-full" style={{ width: `${(item.value / (topData.clientIP[0]?.value || 1)) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatNumber(item.value)}</span>
                    </div>
                  )) : <p className="text-muted-foreground text-center py-8">{topLoaded.has("ip") ? "暂无数据" : "加载中..."}</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 来源分析 */}
          <TabsContent value="referer">
            <Card>
              <CardHeader><CardTitle>Referer 来源 TOP 10</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(topData.referer?.length ?? 0) > 0 ? (() => {
                    const total = topData.referer.reduce((s, d) => s + d.value, 0);
                    return topData.referer.map((item, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-mono truncate" title={item.name}>{item.name || "(直接访问)"}</p>
                            <span className="text-xs text-muted-foreground">({total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%)</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full mt-1">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(item.value / (topData.referer[0]?.value || 1)) * 100}%` }} />
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{formatBytes(item.value)}</span>
                      </div>
                    ));
                  })() : <p className="text-muted-foreground text-center py-8">{topLoaded.has("referer") ? "暂无数据" : "加载中..."}</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 安全防护 */}
          <TabsContent value="security" className="space-y-4">
            {wafData ? (
              <>
                {/* 安全拦截统计（基于 403/444/503 状态码） */}
                <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                  <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
                    <CardContent className="p-4 sm:p-6">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">24h 拦截请求</p>
                      <p className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">{formatNumber(wafData.securityStats?.blockedRequests || 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">403/444/503 状态码</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                    <CardContent className="p-4 sm:p-6">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">拦截率</p>
                      <p className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400">{wafData.securityStats?.blockRate || "0"}%</p>
                      <p className="text-xs text-muted-foreground mt-1">拦截请求/总请求</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                    <CardContent className="p-4 sm:p-6">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">WAF 规则集</p>
                      <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{wafData.summary?.totalRulesets || 0}</p>
                      <p className="text-xs text-muted-foreground mt-1">{wafData.summary?.enabledRules || 0} 条已启用</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                    <CardContent className="p-4 sm:p-6">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">WAF 规则</p>
                      <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{wafData.summary?.totalRules || 0}</p>
                      <p className="text-xs text-muted-foreground mt-1">自定义+托管+频率限制</p>
                    </CardContent>
                  </Card>
                </div>
                {/* 安全状态码明细 */}
                {wafData.securityStats?.statusBreakdown?.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-red-500" /> 安全拦截明细 (24h)</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {wafData.securityStats.statusBreakdown.map((item: any, i: number) => {
                          const codeLabels: Record<string, string> = { "403": "403 禁止访问（WAF 拦截）", "444": "444 无响应关闭（恶意请求）", "503": "503 服务不可用（速率限制）" };
                          return (
                            <div key={i} className="flex items-center gap-4">
                              <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                              <div className="flex-1">
                                <p className="text-sm font-mono">{codeLabels[String(item.name)] || `${item.name} 状态码`}</p>
                                <div className="h-2 bg-muted rounded-full mt-1">
                                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${(item.value / (wafData.securityStats.statusBreakdown[0]?.value || 1)) * 100}%` }} />
                                </div>
                              </div>
                              <span className="text-sm text-muted-foreground">{formatNumber(item.value)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {wafData.rulesets?.filter((p: any) => p.totalCount > 0).map((phase: any, pi: number) => (
                  <Card key={pi}>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> {phase.phaseZh} ({phase.totalCount} 个规则集)</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {phase.rulesets.map((rs: any, ri: number) => (
                          <div key={ri} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{rs.name || `规则集 ${rs.id}`}</p>
                                <Badge variant={rs.status === "on" ? "success" : "secondary"}>{rs.status === "on" ? "已启用" : rs.status || "未知"}</Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">{rs.rules?.length || 0} 条规则</span>
                            </div>
                            {rs.rules?.length > 0 && (
                              <div className="space-y-2">
                                {rs.rules.slice(0, 5).map((rule: any, rri: number) => (
                                  <div key={rri} className="flex items-center justify-between text-sm py-1 border-t border-muted/50">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${rule.status === "on" ? "bg-green-500" : "bg-gray-300"}`} />
                                      <span className="truncate">{rule.name || `规则 ${rule.id}`}</span>
                                    </div>
                                    <Badge variant="outline" className="text-xs flex-shrink-0 ml-2">{rule.action || "未设置"}</Badge>
                                  </div>
                                ))}
                                {rs.rules.length > 5 && <p className="text-xs text-muted-foreground text-center pt-1">还有 {rs.rules.length - 5} 条规则...</p>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {wafData.rulesets?.every((p: any) => p.totalCount === 0) && (
                  <Card><CardContent className="py-12 text-center text-muted-foreground">暂无 WAF 规则集配置，可在阿里云 ESA 控制台配置安全防护规则</CardContent></Card>
                )}
              </>
            ) : (
              <Card><CardContent className="py-12 text-center text-muted-foreground">{wafLoaded ? "暂无安全防护数据" : "加载中..."}</CardContent></Card>
            )}
          </TabsContent>

          </Tabs>
        </ResponsiveTabs>
      </main>
    </div>
  );
}
