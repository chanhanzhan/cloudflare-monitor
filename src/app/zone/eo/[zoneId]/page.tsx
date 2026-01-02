"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Zap, Globe, Activity, Database, TrendingUp, Shield, Server, Clock, Wifi } from "lucide-react";
import { formatBytes, formatNumber } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, Legend
} from "recharts";

const COLORS = ["#006EFF", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16", "#14B8A6", "#F97316"];

interface ZoneDetail {
  ZoneId: string;
  ZoneName: string;
  Status: string;
  ActiveStatus: string;
  Type: string;
  Area: string;
  PlanType: string;
  CnameSpeedUp: string;
}

interface TrafficData {
  time: string;
  value: number;
  inFlux?: number;
  outFlux?: number;
}

interface TopData {
  name: string;
  value: number;
}

interface BandwidthData {
  time: string;
  bandwidth: number;
  inBandwidth?: number;
  outBandwidth?: number;
}

export default function EOZoneDetailPage() {
  const params = useParams();
  const router = useRouter();
  const zoneId = params.zoneId as string;

  const [zone, setZone] = useState<ZoneDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [trafficData, setTrafficData] = useState<TrafficData[]>([]);
  const [requestData, setRequestData] = useState<TrafficData[]>([]);
  const [countryData, setCountryData] = useState<TopData[]>([]);
  const [statusCodeData, setStatusCodeData] = useState<TopData[]>([]);
  const [urlData, setUrlData] = useState<TopData[]>([]);
  const [domainData, setDomainData] = useState<TopData[]>([]);
  const [refererData, setRefererData] = useState<TopData[]>([]);
  const [deviceData, setDeviceData] = useState<TopData[]>([]);
  const [browserData, setBrowserData] = useState<TopData[]>([]);
  const [bandwidthData, setBandwidthData] = useState<BandwidthData[]>([]);
  const [originPullData, setOriginPullData] = useState<TrafficData[]>([]);
  const [securityData, setSecurityData] = useState<TrafficData[]>([]);
  const [totalFlux, setTotalFlux] = useState(0);
  const [totalRequests, setTotalRequests] = useState(0);
  const [peakBandwidth, setPeakBandwidth] = useState(0);
  const [totalSecurityHits, setTotalSecurityHits] = useState(0);
  const [originFlux, setOriginFlux] = useState(0);
  const [cacheHitRate, setCacheHitRate] = useState(0);

  useEffect(() => {
    fetchZoneData();
  }, [zoneId]);

  const fetchZoneData = async () => {
    setLoading(true);
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startTime = yesterday.toISOString().slice(0, 19) + "Z";
    const endTime = now.toISOString().slice(0, 19) + "Z";

    try {
      // Fetch zone info
      const zonesRes = await fetch("/api/eo/zones");
      const zonesData = await zonesRes.json();
      const zoneInfo = zonesData.Zones?.find((z: ZoneDetail) => z.ZoneId === zoneId);
      if (zoneInfo) setZone(zoneInfo);

      // Fetch all traffic data
      const [fluxRes, reqRes, bandwidthRes, originFluxRes, countryRes, statusRes, urlRes, domainRes, refererRes, deviceRes, browserRes, securityRes] = await Promise.all([
        fetch(`/api/eo/traffic?zoneId=${zoneId}&metric=l7Flow_outFlux&startTime=${startTime}&endTime=${endTime}`),
        fetch(`/api/eo/traffic?zoneId=${zoneId}&metric=l7Flow_request&startTime=${startTime}&endTime=${endTime}`),
        fetch(`/api/eo/traffic?zoneId=${zoneId}&metric=l7Flow_bandwidth&startTime=${startTime}&endTime=${endTime}`),
        fetch(`/api/eo/traffic?zoneId=${zoneId}&metric=l7Flow_outFlux_hy&startTime=${startTime}&endTime=${endTime}`),
        fetch(`/api/eo/traffic?zoneId=${zoneId}&metric=l7Flow_outFlux_country&startTime=${startTime}&endTime=${endTime}`),
        fetch(`/api/eo/traffic?zoneId=${zoneId}&metric=l7Flow_outFlux_statusCode&startTime=${startTime}&endTime=${endTime}`),
        fetch(`/api/eo/traffic?zoneId=${zoneId}&metric=l7Flow_outFlux_url&startTime=${startTime}&endTime=${endTime}`),
        fetch(`/api/eo/traffic?zoneId=${zoneId}&metric=l7Flow_outFlux_domain&startTime=${startTime}&endTime=${endTime}`),
        fetch(`/api/eo/traffic?zoneId=${zoneId}&metric=l7Flow_outFlux_referers&startTime=${startTime}&endTime=${endTime}`),
        fetch(`/api/eo/traffic?zoneId=${zoneId}&metric=l7Flow_outFlux_ua_device&startTime=${startTime}&endTime=${endTime}`),
        fetch(`/api/eo/traffic?zoneId=${zoneId}&metric=l7Flow_outFlux_ua_browser&startTime=${startTime}&endTime=${endTime}`),
        fetch(`/api/eo/traffic?zoneId=${zoneId}&metric=ccManage_interceptNum&startTime=${startTime}&endTime=${endTime}`),
      ]);

      const [fluxData, reqData, bandwidthJson, originFluxJson, countryJson, statusJson, urlJson, domainJson, refererJson, deviceJson, browserJson, securityJson] = await Promise.all([
        fluxRes.json(), reqRes.json(), bandwidthRes.json(), originFluxRes.json(), countryRes.json(), statusRes.json(), urlRes.json(), domainRes.json(), refererRes.json(), deviceRes.json(), browserRes.json(), securityRes.json()
      ]);

      // Parse traffic timeline
      const parseTimeline = (data: any) => {
        const result: TrafficData[] = [];
        let total = 0;
        data.Data?.forEach((item: any) => {
          item.TypeValue?.forEach((tv: any) => {
            tv.Detail?.forEach((d: any) => {
              result.push({
                time: new Date(d.Timestamp * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
                value: d.Value
              });
              total += d.Value;
            });
          });
        });
        return { data: result, total };
      };

      const flux = parseTimeline(fluxData);
      const req = parseTimeline(reqData);
      setTrafficData(flux.data);
      setRequestData(req.data);
      setTotalFlux(flux.total);
      setTotalRequests(req.total);

      // Parse top data - API returns Key not Name
      const parseTopData = (data: any) => {
        const result: TopData[] = [];
        data.Data?.forEach((item: any) => {
          item.DetailData?.forEach((d: any) => {
            result.push({ name: d.Key || d.Name || "Unknown", value: d.Value || 0 });
          });
        });
        return result.slice(0, 10);
      };

      setCountryData(parseTopData(countryJson));
      setStatusCodeData(parseTopData(statusJson));
      setUrlData(parseTopData(urlJson));
      setDomainData(parseTopData(domainJson));
      setRefererData(parseTopData(refererJson));
      setDeviceData(parseTopData(deviceJson));
      setBrowserData(parseTopData(browserJson));

      // Parse bandwidth data
      const bwResult: BandwidthData[] = [];
      let maxBw = 0;
      bandwidthJson.Data?.forEach((item: any) => {
        item.TypeValue?.forEach((tv: any) => {
          tv.Detail?.forEach((d: any) => {
            bwResult.push({
              time: new Date(d.Timestamp * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
              bandwidth: d.Value
            });
            if (d.Value > maxBw) maxBw = d.Value;
          });
        });
      });
      setBandwidthData(bwResult);
      setPeakBandwidth(maxBw);

      // Parse origin pull data - uses TimingDataRecords not Data
      const parseOriginPullTimeline = (data: any) => {
        const result: TrafficData[] = [];
        let total = 0;
        data.TimingDataRecords?.forEach((item: any) => {
          item.TypeValue?.forEach((tv: any) => {
            tv.Detail?.forEach((d: any) => {
              result.push({
                time: new Date(d.Timestamp * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
                value: d.Value
              });
              total += d.Value;
            });
          });
        });
        return { data: result, total };
      };
      const originResult = parseOriginPullTimeline(originFluxJson);
      setOriginPullData(originResult.data);
      setOriginFlux(originResult.total);

      // Parse security data - uses Data[].Value[].Detail format
      const parseSecurityData = (data: any) => {
        const result: TrafficData[] = [];
        let total = 0;
        data.Data?.forEach((item: any) => {
          item.Value?.forEach((v: any) => {
            v.Detail?.forEach((d: any) => {
              result.push({
                time: new Date(d.Timestamp * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
                value: d.Value
              });
              total += d.Value;
            });
          });
        });
        return { data: result, total };
      };
      const securityResult = parseSecurityData(securityJson);
      setSecurityData(securityResult.data);
      setTotalSecurityHits(securityResult.total);

      // Calculate cache hit rate
      if (flux.total > 0 && originResult.total > 0) {
        const rate = ((flux.total - originResult.total) / flux.total) * 100;
        setCacheHitRate(Math.max(0, rate));
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
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
            <Zap className="h-6 w-6 text-edgeone-blue" />
            <h1 className="text-xl font-bold">{zone?.ZoneName || zoneId}</h1>
          </div>
          <span className="text-sm text-green-500 font-medium ml-2">
            {zone?.ActiveStatus === "active" ? "已启用" : zone?.ActiveStatus}
          </span>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6">
        {/* Overview Cards - Row 1 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full p-3 bg-blue-500/20">
                <Database className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">24h 总流量</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatBytes(totalFlux)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full p-3 bg-green-500/20">
                <Activity className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">24h 请求数</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatNumber(totalRequests)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full p-3 bg-purple-500/20">
                <Wifi className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">带宽峰值</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatBytes(peakBandwidth)}/s</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full p-3 bg-cyan-500/20">
                <TrendingUp className="h-6 w-6 text-cyan-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">缓存命中率</p>
                <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{cacheHitRate.toFixed(1)}%</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overview Cards - Row 2 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full p-3 bg-orange-500/20">
                <Server className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">回源流量</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatBytes(originFlux)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border-pink-500/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full p-3 bg-pink-500/20">
                <Globe className="h-6 w-6 text-pink-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">加速区域</p>
                <p className="text-2xl font-bold text-pink-600 dark:text-pink-400">{zone?.Area === "global" ? "全球" : zone?.Area}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-indigo-500/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full p-3 bg-indigo-500/20">
                <Clock className="h-6 w-6 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">接入类型</p>
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{zone?.Type === "dnsPodAccess" ? "DNSPod" : zone?.Type === "partial" ? "CNAME" : zone?.Type}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full p-3 bg-emerald-500/20">
                <Shield className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">套餐</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{zone?.PlanType === "plan-free" ? "免费版" : zone?.PlanType}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="traffic" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="traffic" className="data-[state=active]:bg-edgeone-blue data-[state=active]:text-white">流量趋势</TabsTrigger>
            <TabsTrigger value="bandwidth" className="data-[state=active]:bg-edgeone-blue data-[state=active]:text-white">带宽分析</TabsTrigger>
            <TabsTrigger value="origin" className="data-[state=active]:bg-edgeone-blue data-[state=active]:text-white">回源分析</TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-edgeone-blue data-[state=active]:text-white">安全防护</TabsTrigger>
            <TabsTrigger value="country" className="data-[state=active]:bg-edgeone-blue data-[state=active]:text-white">地区分布</TabsTrigger>
            <TabsTrigger value="status" className="data-[state=active]:bg-edgeone-blue data-[state=active]:text-white">状态码</TabsTrigger>
            <TabsTrigger value="domain" className="data-[state=active]:bg-edgeone-blue data-[state=active]:text-white">域名</TabsTrigger>
            <TabsTrigger value="url" className="data-[state=active]:bg-edgeone-blue data-[state=active]:text-white">热门URL</TabsTrigger>
            <TabsTrigger value="referer" className="data-[state=active]:bg-edgeone-blue data-[state=active]:text-white">来源</TabsTrigger>
            <TabsTrigger value="device" className="data-[state=active]:bg-edgeone-blue data-[state=active]:text-white">设备/浏览器</TabsTrigger>
          </TabsList>

          <TabsContent value="traffic" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>流量趋势 (24h)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trafficData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => formatBytes(v)} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => formatBytes(v)} />
                      <Line type="monotone" dataKey="value" stroke="#006EFF" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>请求趋势 (24h)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={requestData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => formatNumber(v)} />
                      <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bandwidth" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Wifi className="h-5 w-5 text-purple-500" />带宽趋势 (24h)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={bandwidthData}>
                      <defs>
                        <linearGradient id="colorBw" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => `${formatBytes(v)}/s`} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => `${formatBytes(v)}/s`} />
                      <Area type="monotone" dataKey="bandwidth" stroke="#8B5CF6" fill="url(#colorBw)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="origin" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-orange-500" />回源流量趋势 (24h)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={originPullData}>
                      <defs>
                        <linearGradient id="colorOrigin" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F97316" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#F97316" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => formatBytes(v)} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => formatBytes(v)} />
                      <Area type="monotone" dataKey="value" stroke="#F97316" fill="url(#colorOrigin)" strokeWidth={2} name="回源流量" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="bg-gradient-to-br from-orange-500/5 to-transparent">
                <CardContent className="p-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">回源流量占比</p>
                    <p className="text-3xl font-bold text-orange-500">{totalFlux > 0 ? ((originFlux / totalFlux) * 100).toFixed(1) : 0}%</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-cyan-500/5 to-transparent">
                <CardContent className="p-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">节省流量</p>
                    <p className="text-3xl font-bold text-cyan-500">{formatBytes(totalFlux - originFlux)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-red-500" />安全防护趋势 (24h)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={securityData}>
                      <defs>
                        <linearGradient id="colorSecurity" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => formatNumber(v)} />
                      <Area type="monotone" dataKey="value" stroke="#EF4444" fill="url(#colorSecurity)" strokeWidth={2} name="拦截次数" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="bg-gradient-to-br from-red-500/5 to-transparent">
                <CardContent className="p-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">总拦截次数</p>
                    <p className="text-3xl font-bold text-red-500">{formatNumber(totalSecurityHits)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-500/5 to-transparent">
                <CardContent className="p-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">防护状态</p>
                    <p className="text-3xl font-bold text-green-500">已启用</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="country">
            <Card>
              <CardHeader><CardTitle>访问地区 TOP 10</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={countryData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => formatBytes(v)} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v: number) => formatBytes(v)} />
                      <Bar dataKey="value" fill="#006EFF" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="status">
            <Card>
              <CardHeader><CardTitle>状态码分布</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[400px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusCodeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label={(e) => e.name}>
                        {statusCodeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatBytes(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="domain">
            <Card>
              <CardHeader><CardTitle>域名流量 TOP 10</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {domainData.length > 0 ? domainData.map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-mono truncate">{item.name}</p>
                        <div className="h-2 bg-muted rounded-full mt-1">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(item.value / (domainData[0]?.value || 1)) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatBytes(item.value)}</span>
                    </div>
                  )) : <p className="text-muted-foreground text-center py-8">暂无数据</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="url">
            <Card>
              <CardHeader><CardTitle>热门 URL TOP 10</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {urlData.length > 0 ? urlData.map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-mono truncate">{item.name}</p>
                        <div className="h-2 bg-muted rounded-full mt-1">
                          <div className="h-full bg-edgeone-blue rounded-full" style={{ width: `${(item.value / (urlData[0]?.value || 1)) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatBytes(item.value)}</span>
                    </div>
                  )) : <p className="text-muted-foreground text-center py-8">暂无数据</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="referer">
            <Card>
              <CardHeader><CardTitle>来源 (Referer) TOP 10</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {refererData.length > 0 ? refererData.map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-mono truncate">{item.name || "(直接访问)"}</p>
                        <div className="h-2 bg-muted rounded-full mt-1">
                          <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(item.value / (refererData[0]?.value || 1)) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatBytes(item.value)}</span>
                    </div>
                  )) : <p className="text-muted-foreground text-center py-8">暂无数据</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="device" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>设备类型 TOP 10</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {deviceData.length > 0 ? deviceData.map((item, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                        <div className="flex-1">
                          <p className="text-sm truncate">{item.name || "Unknown"}</p>
                          <div className="h-2 bg-muted rounded-full mt-1">
                            <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(item.value / (deviceData[0]?.value || 1)) * 100}%` }} />
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground">{formatBytes(item.value)}</span>
                      </div>
                    )) : <p className="text-muted-foreground text-center py-8">暂无数据</p>}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>浏览器 TOP 10</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {browserData.length > 0 ? browserData.map((item, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                        <div className="flex-1">
                          <p className="text-sm truncate">{item.name || "Unknown"}</p>
                          <div className="h-2 bg-muted rounded-full mt-1">
                            <div className="h-full bg-pink-500 rounded-full" style={{ width: `${(item.value / (browserData[0]?.value || 1)) * 100}%` }} />
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground">{formatBytes(item.value)}</span>
                      </div>
                    )) : <p className="text-muted-foreground text-center py-8">暂无数据</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
