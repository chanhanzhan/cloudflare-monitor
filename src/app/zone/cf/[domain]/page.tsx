"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveTabs } from "@/components/ui/responsive-tabs";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Cloud, Globe, Activity, Database, Shield, TrendingUp, Zap, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatBytes, formatNumber } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from "recharts";
import type { CFZone, CFAnalyticsData } from "@/types";

/*
CF_TAB_ITEMS Cloudflare 站点详情页标签项定义
@功能 定义所有可用的数据分析标签页
*/
const CF_TAB_ITEMS = [
  { value: "hourly", label: "小时趋势" },
  { value: "daily", label: "每日趋势" },
  { value: "geography", label: "地区分布" },
  { value: "cache", label: "缓存分析" },
  { value: "threats", label: "威胁分析" },
  { value: "firewall", label: "防火墙" },
  { value: "dns", label: "DNS" },
  { value: "browser", label: "浏览器" },
  { value: "status", label: "状态码" },
  { value: "content", label: "内容类型" },
  { value: "method", label: "请求方法" },
  { value: "ipclass", label: "IP 分类" },
  { value: "protocol", label: "协议版本" },
];

interface TrafficData {
  time: string;
  requests: number;
  bytes: number;
  cached: number;
  threats: number;
}

interface GeoData {
  name: string;
  bytes: number;
  requests: number;
}

export default function CFZoneDetailPage() {
  const params = useParams();
  const router = useRouter();
  const domain = decodeURIComponent(params.domain as string);

  const [zone, setZone] = useState<CFZone | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("hourly");
  const [firewallData, setFirewallData] = useState<any>(null);
  const [firewallError, setFirewallError] = useState<string | null>(null);
  const [dnsData, setDnsData] = useState<any>(null);
  const [firewallLoading, setFirewallLoading] = useState(false);
  const [dnsLoading, setDnsLoading] = useState(false);

  useEffect(() => {
    fetchZoneData();
  }, [domain]);

  /*
  懒加载防火墙和 DNS 数据 - 仅在切换到对应标签时触发请求
  @功能 减少初始加载时间，按需获取防火墙事件和 DNS 查询统计
  */
  useEffect(() => {
    if (activeTab === "firewall" && !firewallData && !firewallError && !firewallLoading) {
      setFirewallLoading(true);
      fetch(`/api/cf/firewall?domain=${encodeURIComponent(domain)}`)
        .then((r) => r.json())
        .then((data) => {
          const zoneEvents = data.accounts?.flatMap((a: any) => a.zones || [])?.find((z: any) => z.domain === domain);
          if (zoneEvents?.error) {
            setFirewallError(zoneEvents.error);
          } else {
            setFirewallData(zoneEvents?.events || null);
          }
        })
        .catch(() => setFirewallData(null))
        .finally(() => setFirewallLoading(false));
    }
    if (activeTab === "dns" && !dnsData && !dnsLoading) {
      setDnsLoading(true);
      fetch(`/api/cf/dns?domain=${encodeURIComponent(domain)}`)
        .then((r) => r.json())
        .then((data) => {
          const zoneDns = data.accounts?.flatMap((a: any) => a.zones || [])?.find((z: any) => z.domain === domain);
          setDnsData(zoneDns?.dns || null);
        })
        .catch(() => setDnsData(null))
        .finally(() => setDnsLoading(false));
    }
  }, [activeTab, domain, firewallData, firewallError, firewallLoading, dnsData, dnsLoading]);

  /*
  fetchZoneData 只查询单个域名的分析数据
  @功能 通过 ?domain= 参数只获取该域名数据，避免查询全部域名
  */
  const fetchZoneData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cf/analytics?stream=false&domain=${encodeURIComponent(domain)}`);
      const data: CFAnalyticsData = await res.json();
      
      for (const account of data.accounts || []) {
        const found = account.zones?.find((z) => z.domain === domain);
        if (found) {
          setZone(found);
          break;
        }
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const trafficData = useMemo<TrafficData[]>(() => {
    if (!zone?.rawHours) return [];
    return zone.rawHours
      .map((h) => ({
        time: new Date(h.dimensions.datetime).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
        requests: h.sum.requests,
        bytes: h.sum.bytes,
        cached: h.sum.cachedBytes,
        threats: h.sum.threats,
      }))
      .reverse();
  }, [zone]);

  const dailyData = useMemo<TrafficData[]>(() => {
    if (!zone?.raw) return [];
    return zone.raw
      .map((d) => ({
        time: d.dimensions.date,
        requests: d.sum.requests,
        bytes: d.sum.bytes,
        cached: d.sum.cachedBytes,
        threats: d.sum.threats,
      }))
      .reverse();
  }, [zone]);

  const geoData = useMemo<GeoData[]>(() => {
    if (!zone?.geography || !Array.isArray(zone.geography)) return [];
    
    // API already returns processed geography data with dimensions.clientCountryName and sum
    return zone.geography
      .filter((geo: any) => geo.dimensions?.clientCountryName)
      .map((geo: any) => ({
        name: geo.dimensions.clientCountryName,
        bytes: geo.sum?.bytes || 0,
        requests: geo.sum?.requests || 0,
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 15);
  }, [zone]);

  const browserData = useMemo(() => {
    if (!zone?.browsers || !Array.isArray(zone.browsers)) return [];
    return zone.browsers as { name: string; pageViews: number }[];
  }, [zone]);

  const statusCodeData = useMemo(() => {
    if (!zone?.statusCodes || !Array.isArray(zone.statusCodes)) return [];
    return zone.statusCodes as { name: string; requests: number }[];
  }, [zone]);

  const contentTypeData = useMemo(() => {
    if (!zone?.contentTypes || !Array.isArray(zone.contentTypes)) return [];
    return zone.contentTypes as { name: string; bytes: number; requests: number }[];
  }, [zone]);

  const sslData = useMemo(() => {
    if (!zone?.sslVersions || !Array.isArray(zone.sslVersions)) return [];
    return zone.sslVersions as { name: string; requests: number }[];
  }, [zone]);

  const httpData = useMemo(() => {
    if (!zone?.httpVersions || !Array.isArray(zone.httpVersions)) return [];
    return zone.httpVersions as { name: string; requests: number }[];
  }, [zone]);

  const stats = useMemo(() => {
    if (!zone?.raw) return { totalRequests: 0, totalBytes: 0, totalThreats: 0, cacheRate: 0, cachedBytes: 0, cachedRequests: 0 };
    
    let totalRequests = 0, totalBytes = 0, totalThreats = 0, totalCached = 0, cachedRequests = 0;
    zone.raw.forEach((d) => {
      totalRequests += d.sum.requests;
      totalBytes += d.sum.bytes;
      totalThreats += d.sum.threats;
      totalCached += d.sum.cachedBytes;
      cachedRequests += d.sum.cachedRequests;
    });
    
    return {
      totalRequests,
      totalBytes,
      totalThreats,
      cachedBytes: totalCached,
      cachedRequests,
      cacheRate: totalBytes > 0 ? (totalCached / totalBytes) * 100 : 0,
    };
  }, [zone]);

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

  if (!zone) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-4">
        <p className="text-muted-foreground">未找到该域名数据</p>
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
            <Cloud className="h-5 w-5 sm:h-6 sm:w-6 text-cloudflare-orange flex-shrink-0" />
            <h1 className="text-base sm:text-xl font-bold truncate">{domain}</h1>
          </div>
          <Badge variant="info" className="flex-shrink-0">Cloudflare</Badge>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-7xl">
        {/* Overview Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-orange-500/20">
                <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">总请求数</p>
                <p className="text-lg sm:text-2xl font-bold text-orange-600 dark:text-orange-400">{formatNumber(stats.totalRequests)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-blue-500/20">
                <Database className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">总流量</p>
                <p className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{formatBytes(stats.totalBytes)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-red-500/20">
                <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">威胁拦截</p>
                <p className="text-lg sm:text-2xl font-bold text-red-600 dark:text-red-400">{formatNumber(stats.totalThreats)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-green-500/20">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">缓存命中率</p>
                <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">{stats.cacheRate.toFixed(1)}%</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overview Cards - Row 2 */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-purple-500/20">
                <Database className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">缓存流量</p>
                <p className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{formatBytes(stats.cachedBytes)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-cyan-500/20">
                <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">缓存请求</p>
                <p className="text-lg sm:text-2xl font-bold text-cyan-600 dark:text-cyan-400">{formatNumber(stats.cachedRequests)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-indigo-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-indigo-500/20">
                <Globe className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">访问国家</p>
                <p className="text-lg sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">{geoData.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border-pink-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-pink-500/20">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-pink-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">数据天数</p>
                <p className="text-lg sm:text-2xl font-bold text-pink-600 dark:text-pink-400">{zone?.raw?.length || 0} 天</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <ResponsiveTabs
          tabs={CF_TAB_ITEMS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          accentColor="bg-cloudflare-orange"
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>

          <TabsContent value="hourly" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>请求趋势 (72h)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px] sm:h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trafficData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => formatNumber(v)} />
                      <Line type="monotone" dataKey="requests" stroke="#F6821F" strokeWidth={2} dot={false} name="请求" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>流量趋势 (72h)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px] sm:h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trafficData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => formatBytes(v)} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => formatBytes(v)} />
                      <Line type="monotone" dataKey="bytes" stroke="#10B981" strokeWidth={2} dot={false} name="流量" />
                      <Line type="monotone" dataKey="cached" stroke="#8B5CF6" strokeWidth={2} dot={false} name="缓存" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="daily" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>每日请求趋势</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px] sm:h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => formatNumber(v)} />
                      <Bar dataKey="requests" fill="#F6821F" name="请求" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>每日流量趋势</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px] sm:h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => formatBytes(v)} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => formatBytes(v)} />
                      <Bar dataKey="bytes" fill="#10B981" name="流量" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="geography">
            <Card>
              <CardHeader><CardTitle>访问地区 TOP 15</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[350px] sm:h-[500px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={geoData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => formatBytes(v)} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v: number) => formatBytes(v)} />
                      <Bar dataKey="bytes" fill="#F6821F" name="流量" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cache" className="space-y-4">
            {/* 缓存统计指标卡片 */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
              <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">缓存命中率(流量)</p>
                  <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">{stats.cacheRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatBytes(stats.cachedBytes)} / {formatBytes(stats.totalBytes)}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">缓存命中率(请求)</p>
                  <p className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalRequests > 0 ? ((stats.cachedRequests / stats.totalRequests) * 100).toFixed(1) : "0.0"}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatNumber(stats.cachedRequests)} / {formatNumber(stats.totalRequests)}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">缓存流量</p>
                  <p className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{formatBytes(stats.cachedBytes)}</p>
                  <p className="text-xs text-muted-foreground mt-1">节省源站流量</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">未缓存流量</p>
                  <p className="text-lg sm:text-2xl font-bold text-orange-600 dark:text-orange-400">{formatBytes(stats.totalBytes - stats.cachedBytes)}</p>
                  <p className="text-xs text-muted-foreground mt-1">需要回源的流量</p>
                </CardContent>
              </Card>
            </div>
            {/* 缓存趋势图表 */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>缓存流量趋势 (72h)</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[300px] sm:h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trafficData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={(v) => formatBytes(v)} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number) => formatBytes(v)} />
                        <Line type="monotone" dataKey="bytes" stroke="#F6821F" strokeWidth={2} dot={false} name="总流量" />
                        <Line type="monotone" dataKey="cached" stroke="#10B981" strokeWidth={2} dot={false} name="缓存流量" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>每日缓存对比</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[300px] sm:h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={(v) => formatBytes(v)} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number) => formatBytes(v)} />
                        <Bar dataKey="bytes" fill="#F6821F" name="总流量" />
                        <Bar dataKey="cached" fill="#10B981" name="缓存流量" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="threats" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>威胁拦截趋势</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px] sm:h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trafficData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => formatNumber(v)} />
                      <Line type="monotone" dataKey="threats" stroke="#EF4444" strokeWidth={2} dot={false} name="威胁" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>每日威胁统计</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px] sm:h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => formatNumber(v)} />
                      <Bar dataKey="threats" fill="#EF4444" name="威胁" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="browser">
            <Card>
              <CardHeader><CardTitle>浏览器分布 TOP 10</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {browserData.length > 0 ? (() => {
                    const total = browserData.reduce((s, d) => s + d.pageViews, 0);
                    return browserData.map((item, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm truncate">{item.name || "Unknown"}</p>
                            <span className="text-xs text-muted-foreground">({total > 0 ? ((item.pageViews / total) * 100).toFixed(1) : 0}%)</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full mt-1">
                            <div className="h-full bg-cloudflare-orange rounded-full" style={{ width: `${(item.pageViews / (browserData[0]?.pageViews || 1)) * 100}%` }} />
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{formatNumber(item.pageViews)} PV</span>
                      </div>
                    ));
                  })() : <p className="text-muted-foreground text-center py-8">暂无数据</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="status">
            <Card>
              <CardHeader><CardTitle>状态码分布 TOP 10</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {statusCodeData.length > 0 ? (() => {
                    const total = statusCodeData.reduce((s, d) => s + d.requests, 0);
                    return statusCodeData.map((item, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-mono">{item.name}</p>
                            <span className="text-xs text-muted-foreground">({total > 0 ? ((item.requests / total) * 100).toFixed(1) : 0}%)</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full mt-1">
                            <div 
                              className="h-full rounded-full" 
                              style={{ 
                                width: `${(item.requests / (statusCodeData[0]?.requests || 1)) * 100}%`,
                                backgroundColor: item.name.startsWith('2') ? '#10B981' : item.name.startsWith('3') ? '#3B82F6' : item.name.startsWith('4') ? '#F59E0B' : '#EF4444'
                              }} 
                            />
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{formatNumber(item.requests)}</span>
                      </div>
                    ));
                  })() : <p className="text-muted-foreground text-center py-8">暂无数据</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content">
            <Card>
              <CardHeader><CardTitle>内容类型分布 TOP 10</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {contentTypeData.length > 0 ? (() => {
                    const totalBytes = contentTypeData.reduce((s, d) => s + d.bytes, 0);
                    return contentTypeData.map((item, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-mono truncate">{item.name || "Unknown"}</p>
                            <span className="text-xs text-muted-foreground">({totalBytes > 0 ? ((item.bytes / totalBytes) * 100).toFixed(1) : 0}%)</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full mt-1">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(item.bytes / (contentTypeData[0]?.bytes || 1)) * 100}%` }} />
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm text-muted-foreground whitespace-nowrap">{formatBytes(item.bytes)}</span>
                          <p className="text-xs text-muted-foreground">{formatNumber(item.requests)} 次</p>
                        </div>
                      </div>
                    ));
                  })() : <p className="text-muted-foreground text-center py-8">暂无数据</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="protocol" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>SSL/TLS 版本</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {sslData.length > 0 ? sslData.map((item, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                        <div className="flex-1">
                          <p className="text-sm font-mono">{item.name || "Unknown"}</p>
                          <div className="h-2 bg-muted rounded-full mt-1">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${(item.requests / (sslData[0]?.requests || 1)) * 100}%` }} />
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground">{formatNumber(item.requests)}</span>
                      </div>
                    )) : <p className="text-muted-foreground text-center py-8">暂无数据</p>}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>HTTP 版本</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {httpData.length > 0 ? httpData.map((item, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                        <div className="flex-1">
                          <p className="text-sm font-mono">{item.name || "Unknown"}</p>
                          <div className="h-2 bg-muted rounded-full mt-1">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(item.requests / (httpData[0]?.requests || 1)) * 100}%` }} />
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground">{formatNumber(item.requests)}</span>
                      </div>
                    )) : <p className="text-muted-foreground text-center py-8">暂无数据</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 防火墙事件标签 */}
          <TabsContent value="firewall" className="space-y-4">
            {firewallLoading ? (
              <Card><CardContent className="p-6"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
            ) : firewallData ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>防火墙动作分布 (24h)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {firewallData.byAction?.length > 0 ? firewallData.byAction.map((item: any, i: number) => (
                        <div key={i} className="flex items-center gap-4">
                          <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                          <div className="flex-1">
                            <p className="text-sm font-mono">{item.action}</p>
                            <div className="h-2 bg-muted rounded-full mt-1">
                              <div className="h-full bg-red-500 rounded-full" style={{ width: `${(item.count / (firewallData.byAction[0]?.count || 1)) * 100}%` }} />
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground">{formatNumber(item.count)}</span>
                        </div>
                      )) : <p className="text-muted-foreground text-center py-8">暂无防火墙事件</p>}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>规则来源分布 (24h)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {firewallData.bySource?.length > 0 ? firewallData.bySource.map((item: any, i: number) => (
                        <div key={i} className="flex items-center gap-4">
                          <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                          <div className="flex-1">
                            <p className="text-sm font-mono">{item.source}</p>
                            <div className="h-2 bg-muted rounded-full mt-1">
                              <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(item.count / (firewallData.bySource[0]?.count || 1)) * 100}%` }} />
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground">{formatNumber(item.count)}</span>
                        </div>
                      )) : <p className="text-muted-foreground text-center py-8">暂无数据</p>}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>拦截国家 TOP 10 (24h)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {firewallData.byCountry?.length > 0 ? firewallData.byCountry.map((item: any, i: number) => (
                        <div key={i} className="flex items-center gap-4">
                          <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                          <div className="flex-1">
                            <p className="text-sm">{item.country}</p>
                            <div className="h-2 bg-muted rounded-full mt-1">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(item.count / (firewallData.byCountry[0]?.count || 1)) * 100}%` }} />
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground">{formatNumber(item.count)}</span>
                        </div>
                      )) : <p className="text-muted-foreground text-center py-8">暂无数据</p>}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>拦截路径 TOP 10 (24h)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {firewallData.byPath?.length > 0 ? firewallData.byPath.map((item: any, i: number) => (
                        <div key={i} className="flex items-center gap-4">
                          <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                          <div className="flex-1">
                            <p className="text-sm font-mono truncate" title={item.path}>{item.path}</p>
                            <div className="h-2 bg-muted rounded-full mt-1">
                              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(item.count / (firewallData.byPath[0]?.count || 1)) * 100}%` }} />
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground">{formatNumber(item.count)}</span>
                        </div>
                      )) : <p className="text-muted-foreground text-center py-8">暂无数据</p>}
                    </div>
                  </CardContent>
                </Card>
                {/* 客户端 IP TOP 10 */}
                {firewallData.byIP?.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>客户端 IP TOP 10 (24h)</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {firewallData.byIP.map((item: any, i: number) => (
                          <div key={i} className="flex items-center gap-4">
                            <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                            <div className="flex-1">
                              <p className="text-sm font-mono">{item.ip}</p>
                              <div className="h-2 bg-muted rounded-full mt-1">
                                <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(item.count / (firewallData.byIP[0]?.count || 1)) * 100}%` }} />
                              </div>
                            </div>
                            <span className="text-sm text-muted-foreground">{formatNumber(item.count)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {/* 请求方法分布 */}
                {firewallData.byMethod?.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>请求方法分布 (24h)</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {firewallData.byMethod.map((item: any, i: number) => (
                          <div key={i} className="flex items-center gap-4">
                            <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                            <div className="flex-1">
                              <p className="text-sm font-mono font-semibold">{item.method}</p>
                              <div className="h-2 bg-muted rounded-full mt-1">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(item.count / (firewallData.byMethod[0]?.count || 1)) * 100}%` }} />
                              </div>
                            </div>
                            <span className="text-sm text-muted-foreground">{formatNumber(item.count)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {/* 最近事件日志 */}
                {firewallData.recentEvents?.length > 0 && (
                  <Card className="md:col-span-2">
                    <CardHeader><CardTitle>最近防火墙事件 (24h)</CardTitle></CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs sm:text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2 pr-3">时间</th>
                              <th className="pb-2 pr-3">动作</th>
                              <th className="pb-2 pr-3">来源</th>
                              <th className="pb-2 pr-3">IP</th>
                              <th className="pb-2 pr-3">国家</th>
                              <th className="pb-2 pr-3">方法</th>
                              <th className="pb-2">路径</th>
                            </tr>
                          </thead>
                          <tbody>
                            {firewallData.recentEvents.map((evt: any, i: number) => (
                              <tr key={i} className="border-b border-muted/50 hover:bg-muted/30">
                                <td className="py-1.5 pr-3 font-mono whitespace-nowrap">{evt.time ? new Date(evt.time).toLocaleTimeString("zh-CN") : "-"}</td>
                                <td className="py-1.5 pr-3"><span className={`px-1.5 py-0.5 rounded text-xs font-medium ${evt.action === "block" ? "bg-red-500/10 text-red-500" : evt.action === "challenge" || evt.action === "managedchallenge" ? "bg-yellow-500/10 text-yellow-500" : "bg-blue-500/10 text-blue-500"}`}>{evt.action}</span></td>
                                <td className="py-1.5 pr-3 text-muted-foreground">{evt.source}</td>
                                <td className="py-1.5 pr-3 font-mono">{evt.ip}</td>
                                <td className="py-1.5 pr-3">{evt.country}</td>
                                <td className="py-1.5 pr-3 font-mono">{evt.method}</td>
                                <td className="py-1.5 font-mono truncate max-w-[200px]" title={evt.path}>{evt.path}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : firewallError ? (
              <Card><CardContent className="p-8 text-center text-amber-600 dark:text-amber-400">{firewallError}</CardContent></Card>
            ) : (
              <Card><CardContent className="p-8 text-center text-muted-foreground">点击标签加载防火墙数据</CardContent></Card>
            )}
          </TabsContent>

          {/* DNS 查询标签 */}
          <TabsContent value="dns" className="space-y-4">
            {dnsLoading ? (
              <Card><CardContent className="p-6"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
            ) : dnsData ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
                  <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                    <CardContent className="p-4 sm:p-6">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">24h DNS 总查询</p>
                      <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{formatNumber(dnsData.totalQueries || 0)}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                    <CardContent className="p-4 sm:p-6">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">查询类型数</p>
                      <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{dnsData.byQueryType?.length || 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                    <CardContent className="p-4 sm:p-6">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">查询域名数</p>
                      <p className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{dnsData.byQueryName?.length || 0}</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader><CardTitle>查询类型分布</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {dnsData.byQueryType?.length > 0 ? dnsData.byQueryType.map((item: any, i: number) => (
                          <div key={i} className="flex items-center gap-4">
                            <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                            <div className="flex-1">
                              <p className="text-sm font-mono">{item.type}</p>
                              <div className="h-2 bg-muted rounded-full mt-1">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(item.count / (dnsData.byQueryType[0]?.count || 1)) * 100}%` }} />
                              </div>
                            </div>
                            <span className="text-sm text-muted-foreground">{formatNumber(item.count)}</span>
                          </div>
                        )) : <p className="text-muted-foreground text-center py-8">暂无数据</p>}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>响应码分布</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {dnsData.byResponseCode?.length > 0 ? dnsData.byResponseCode.map((item: any, i: number) => (
                          <div key={i} className="flex items-center gap-4">
                            <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                            <div className="flex-1">
                              <p className="text-sm font-mono">{item.code}</p>
                              <div className="h-2 bg-muted rounded-full mt-1">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${(item.count / (dnsData.byResponseCode[0]?.count || 1)) * 100}%` }} />
                              </div>
                            </div>
                            <span className="text-sm text-muted-foreground">{formatNumber(item.count)}</span>
                          </div>
                        )) : <p className="text-muted-foreground text-center py-8">暂无数据</p>}
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <Card>
                  <CardHeader><CardTitle>查询域名 TOP 15</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {dnsData.byQueryName?.length > 0 ? dnsData.byQueryName.map((item: any, i: number) => (
                        <div key={i} className="flex items-center gap-4">
                          <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                          <div className="flex-1">
                            <p className="text-sm font-mono truncate" title={item.name}>{item.name}</p>
                            <div className="h-2 bg-muted rounded-full mt-1">
                              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(item.count / (dnsData.byQueryName[0]?.count || 1)) * 100}%` }} />
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground">{formatNumber(item.count)}</span>
                        </div>
                      )) : <p className="text-muted-foreground text-center py-8">暂无数据</p>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card><CardContent className="p-8 text-center text-muted-foreground">点击标签加载 DNS 数据</CardContent></Card>
            )}
          </TabsContent>

          {/* 请求方法标签 */}
          <TabsContent value="method">
            <Card>
              <CardHeader><CardTitle>HTTP 请求方法分布</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(zone?.httpMethods as { name: string; requests: number }[] | undefined)?.length ? (zone.httpMethods as { name: string; requests: number }[]).map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-mono font-semibold">{item.name}</p>
                        <div className="h-2 bg-muted rounded-full mt-1">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(item.requests / ((zone?.httpMethods as { name: string; requests: number }[])?.[0]?.requests || 1)) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatNumber(item.requests)}</span>
                    </div>
                  )) : <p className="text-muted-foreground text-center py-8">暂无数据</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* IP 分类标签 */}
          <TabsContent value="ipclass">
            <Card>
              <CardHeader><CardTitle>IP 分类分布</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(zone?.ipClasses as { name: string; requests: number }[] | undefined)?.length ? (zone.ipClasses as { name: string; requests: number }[]).map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-mono">{item.name}</p>
                        <div className="h-2 bg-muted rounded-full mt-1">
                          <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(item.requests / ((zone?.ipClasses as { name: string; requests: number }[])?.[0]?.requests || 1)) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatNumber(item.requests)}</span>
                    </div>
                  )) : <p className="text-muted-foreground text-center py-8">暂无数据</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          </Tabs>
        </ResponsiveTabs>
      </main>
    </div>
  );
}
