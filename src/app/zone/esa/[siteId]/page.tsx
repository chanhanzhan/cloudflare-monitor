"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Shield, Globe, Activity, Database, TrendingUp, Code, Server, Clock, Zap, FileCode, Cpu } from "lucide-react";
import { formatBytes, formatNumber } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import type { ESAData, ESASite, ESAAccount, ESARoutine } from "@/types";

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

  useEffect(() => {
    fetchSiteData();
  }, [siteId]);

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

        <Tabs defaultValue="overview" className="space-y-3 sm:space-y-4">
          <ScrollArea className="w-full">
            <TabsList className="inline-flex h-auto gap-1 bg-muted/50 p-1 w-max min-w-full">
              <TabsTrigger value="overview" className="text-xs sm:text-sm data-[state=active]:bg-emerald-500 data-[state=active]:text-white">概览</TabsTrigger>
              <TabsTrigger value="routines" className="text-xs sm:text-sm data-[state=active]:bg-emerald-500 data-[state=active]:text-white">边缘函数</TabsTrigger>
              <TabsTrigger value="traffic" className="text-xs sm:text-sm data-[state=active]:bg-emerald-500 data-[state=active]:text-white">流量趋势</TabsTrigger>
            </TabsList>
          </ScrollArea>

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
        </Tabs>
      </main>
    </div>
  );
}
