"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Cloud, Globe, Activity, Database, Shield, TrendingUp, Zap, Clock } from "lucide-react";
import { formatBytes, formatNumber } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from "recharts";
import type { CFZone, CFAnalyticsData } from "@/types";

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

  useEffect(() => {
    fetchZoneData();
  }, [domain]);

  const fetchZoneData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cf/analytics");
      const data: CFAnalyticsData = await res.json();
      
      // Find the zone by domain
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
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
        <div className="container flex h-16 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Cloud className="h-6 w-6 text-cloudflare-orange" />
            <h1 className="text-xl font-bold">{domain}</h1>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6">
        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full p-3 bg-orange-500/20">
                <Activity className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">总请求数</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatNumber(stats.totalRequests)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full p-3 bg-blue-500/20">
                <Database className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">总流量</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatBytes(stats.totalBytes)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full p-3 bg-red-500/20">
                <Shield className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">威胁拦截</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatNumber(stats.totalThreats)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full p-3 bg-green-500/20">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">缓存命中率</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.cacheRate.toFixed(1)}%</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overview Cards - Row 2 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full p-3 bg-purple-500/20">
                <Database className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">缓存流量</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatBytes(stats.cachedBytes)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full p-3 bg-cyan-500/20">
                <Zap className="h-6 w-6 text-cyan-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">缓存请求</p>
                <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{formatNumber(stats.cachedRequests)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-indigo-500/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full p-3 bg-indigo-500/20">
                <Globe className="h-6 w-6 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">访问国家</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{geoData.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border-pink-500/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full p-3 bg-pink-500/20">
                <Clock className="h-6 w-6 text-pink-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">数据天数</p>
                <p className="text-2xl font-bold text-pink-600 dark:text-pink-400">{zone?.raw?.length || 0} 天</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="hourly" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="hourly" className="data-[state=active]:bg-cloudflare-orange data-[state=active]:text-white">小时趋势</TabsTrigger>
            <TabsTrigger value="daily" className="data-[state=active]:bg-cloudflare-orange data-[state=active]:text-white">每日趋势</TabsTrigger>
            <TabsTrigger value="geography" className="data-[state=active]:bg-cloudflare-orange data-[state=active]:text-white">地区分布</TabsTrigger>
            <TabsTrigger value="cache" className="data-[state=active]:bg-cloudflare-orange data-[state=active]:text-white">缓存分析</TabsTrigger>
            <TabsTrigger value="threats" className="data-[state=active]:bg-cloudflare-orange data-[state=active]:text-white">威胁分析</TabsTrigger>
          </TabsList>

          <TabsContent value="hourly" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>请求趋势 (72h)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
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
                <div className="h-[300px]">
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
                <div className="h-[300px]">
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
                <div className="h-[300px]">
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
                <div className="h-[500px]">
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
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>缓存流量趋势</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[300px]">
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
                  <div className="h-[300px]">
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
                <div className="h-[300px]">
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
                <div className="h-[300px]">
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
        </Tabs>
      </main>
    </div>
  );
}
