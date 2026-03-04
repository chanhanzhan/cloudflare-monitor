"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveTabs } from "@/components/ui/responsive-tabs";
import { TopList } from "@/components/ui/top-list";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Zap, Globe, Activity, Database, TrendingUp, Shield, Server, Clock, Wifi, Monitor, Smartphone, Chrome, User, Link2, FileType, MapPin, Timer, Code } from "lucide-react";
import { formatBytes, formatNumber } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, Legend
} from "recharts";

const COLORS = ["#006EFF", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16", "#14B8A6", "#F97316"];

const PROVINCE_MAP: Record<string, string> = {
  '22': '北京', '86': '内蒙古', '146': '山西', '1069': '河北', '1177': '天津',
  '119': '宁夏', '152': '陕西', '1208': '甘肃', '1467': '青海', '1468': '新疆',
  '145': '黑龙江', '1445': '吉林', '1464': '辽宁', '2': '福建', '120': '江苏',
  '121': '安徽', '122': '山东', '1050': '上海', '1442': '浙江', '182': '河南',
  '1135': '湖北', '1465': '江西', '1466': '湖南', '118': '贵州', '153': '云南',
  '1051': '重庆', '1068': '四川', '1155': '西藏', '4': '广东', '173': '广西',
  '1441': '海南', '0': '其他', '1': '港澳台', '-1': '境外'
};

const COUNTRY_MAP: Record<string, string> = {
  'CN': '中国', 'US': '美国', 'JP': '日本', 'KR': '韩国', 'SG': '新加坡',
  'HK': '中国香港', 'TW': '中国台湾', 'MO': '中国澳门', 'DE': '德国', 'FR': '法国',
  'GB': '英国', 'CA': '加拿大', 'AU': '澳大利亚', 'IN': '印度', 'BR': '巴西',
  'RU': '俄罗斯', 'NL': '荷兰', 'IT': '意大利', 'ES': '西班牙', 'SE': '瑞典',
  'CH': '瑞士', 'PL': '波兰', 'ID': '印度尼西亚', 'TH': '泰国', 'VN': '越南',
  'MY': '马来西亚', 'PH': '菲律宾', 'MX': '墨西哥', 'AR': '阿根廷', 'CL': '智利',
  'ZA': '南非', 'EG': '埃及', 'NG': '尼日利亚', 'KE': '肯尼亚', 'AE': '阿联酋',
  'SA': '沙特阿拉伯', 'IL': '以色列', 'TR': '土耳其', 'UA': '乌克兰', 'CZ': '捷克',
  'AT': '奥地利', 'BE': '比利时', 'DK': '丹麦', 'FI': '芬兰', 'NO': '挪威',
  'IE': '爱尔兰', 'PT': '葡萄牙', 'GR': '希腊', 'NZ': '新西兰', 'CO': '哥伦比亚'
};

/*
EO_TAB_ITEMS EdgeOne 站点详情页标签项定义
@功能 定义所有可用的数据分析标签页
*/
const EO_TAB_ITEMS = [
  { value: "traffic", label: "流量趋势" },
  { value: "bandwidth", label: "带宽分析" },
  { value: "origin", label: "回源分析" },
  { value: "edgefunc", label: "边缘函数" },
  { value: "performance", label: "响应性能" },
  { value: "security", label: "安全防护" },
  { value: "country", label: "地区分布" },
  { value: "status", label: "状态码" },
  { value: "domain", label: "域名" },
  { value: "url", label: "热门URL" },
  { value: "resource", label: "资源类型" },
  { value: "referer", label: "来源" },
  { value: "ip", label: "客户端IP" },
  { value: "device", label: "设备/浏览器/OS" },
  { value: "ua", label: "User Agent" },
];

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
  const [activeTab, setActiveTab] = useState("traffic");
  const [trafficData, setTrafficData] = useState<TrafficData[]>([]);
  const [requestData, setRequestData] = useState<TrafficData[]>([]);
  const [countryData, setCountryData] = useState<TopData[]>([]);
  const [statusCodeData, setStatusCodeData] = useState<TopData[]>([]);
  const [urlData, setUrlData] = useState<TopData[]>([]);
  const [domainData, setDomainData] = useState<TopData[]>([]);
  const [refererData, setRefererData] = useState<TopData[]>([]);
  const [deviceData, setDeviceData] = useState<TopData[]>([]);
  const [browserData, setBrowserData] = useState<TopData[]>([]);
  const [osData, setOsData] = useState<TopData[]>([]);
  const [uaData, setUaData] = useState<TopData[]>([]);
  const [resourceTypeData, setResourceTypeData] = useState<TopData[]>([]);
  const [sipData, setSipData] = useState<TopData[]>([]);
  const [provinceData, setProvinceData] = useState<TopData[]>([]);
  const [bandwidthData, setBandwidthData] = useState<BandwidthData[]>([]);
  const [originPullData, setOriginPullData] = useState<TrafficData[]>([]);
  const [originRequestData, setOriginRequestData] = useState<TrafficData[]>([]);
  const [originInFluxData, setOriginInFluxData] = useState<TrafficData[]>([]);
  const [securityData, setSecurityData] = useState<TrafficData[]>([]);
  const [securityAclData, setSecurityAclData] = useState<TrafficData[]>([]);
  const [securityRateData, setSecurityRateData] = useState<TrafficData[]>([]);
  const [performanceData, setPerformanceData] = useState<TrafficData[]>([]);
  const [firstByteData, setFirstByteData] = useState<TrafficData[]>([]);
  const [totalFlux, setTotalFlux] = useState(0);
  const [totalInFlux, setTotalInFlux] = useState(0);
  const [totalRequests, setTotalRequests] = useState(0);
  const [peakBandwidth, setPeakBandwidth] = useState(0);
  const [totalSecurityHits, setTotalSecurityHits] = useState(0);
  const [totalAclHits, setTotalAclHits] = useState(0);
  const [totalRateHits, setTotalRateHits] = useState(0);
  const [originFlux, setOriginFlux] = useState(0);
  const [originInFlux, setOriginInFlux] = useState(0);
  const [originRequests, setOriginRequests] = useState(0);
  const [cacheHitRate, setCacheHitRate] = useState(0);
  const [avgResponseTime, setAvgResponseTime] = useState(0);
  const [avgFirstByteTime, setAvgFirstByteTime] = useState(0);
  // Edge Functions data
  const [edgeFuncRequests, setEdgeFuncRequests] = useState(0);
  const [edgeFuncCpuTime, setEdgeFuncCpuTime] = useState(0);
  const [edgeFuncRequestsData, setEdgeFuncRequestsData] = useState<TrafficData[]>([]);
  const [edgeFuncCpuData, setEdgeFuncCpuData] = useState<TrafficData[]>([]);
  // Enhanced bandwidth data
  const [inBandwidthData, setInBandwidthData] = useState<TrafficData[]>([]);
  const [outBandwidthData, setOutBandwidthData] = useState<TrafficData[]>([]);
  const [peakInBandwidth, setPeakInBandwidth] = useState(0);
  const [peakOutBandwidth, setPeakOutBandwidth] = useState(0);
  // Enhanced origin pull data
  const [originOutBandwidth, setOriginOutBandwidth] = useState(0);
  const [originInBandwidth, setOriginInBandwidth] = useState(0);
  const [originOutBandwidthData, setOriginOutBandwidthData] = useState<TrafficData[]>([]);
  const [originInBandwidthData, setOriginInBandwidthData] = useState<TrafficData[]>([]);

  /*
  topDataLoaded 标记 TOP 数据（按标签懒加载的数据）是否已加载
  @功能 避免重复加载已获取的 TOP 维度数据
  */
  const [topDataLoaded, setTopDataLoaded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchZoneData();
  }, [zoneId]);

  /*
  getTimeRange 获取最近 24 小时的时间范围
  @return startTime 和 endTime 字符串
  */
  const getTimeRange = () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return {
      startTime: yesterday.toISOString().slice(0, 19) + "Z",
      endTime: now.toISOString().slice(0, 19) + "Z",
    };
  };

  /*
  parseTimeline 解析时间线数据（通用解析器）
  @功能 解析腾讯云 API 返回的 Data[].TypeValue[].Detail[] 格式
  */
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

  /*
  parseOriginPullTimeline 解析回源时间线数据
  @功能 解析 TimingDataRecords[].TypeValue[].Detail[] 格式
  */
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

  /*
  parseSecurityData 解析安全防护数据
  @功能 兼容 Data[].Value[].Detail[] 和 Data[].TypeValue[].Detail[] 两种格式
  */
  const parseSecurityData = (data: any) => {
    const result: TrafficData[] = [];
    let total = 0;
    data.Data?.forEach((item: any) => {
      /* 兼容 Value 和 TypeValue 两种字段名 */
      const values = item.Value || item.TypeValue || [];
      values.forEach((v: any) => {
        (v.Detail || []).forEach((d: any) => {
          result.push({
            time: new Date(d.Timestamp * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
            value: d.Value
          });
          total += d.Value;
        });
      });
    });
    /* 如果以上格式都没匹配到，尝试 Data[].Detail[] 直接格式 */
    if (result.length === 0) {
      data.Data?.forEach((item: any) => {
        (item.Detail || item.List || []).forEach((d: any) => {
          const val = d.Value || d.Count || 0;
          result.push({
            time: new Date((d.Timestamp || 0) * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
            value: val,
          });
          total += val;
        });
      });
    }
    return { data: result, total };
  };

  /*
  parseTopData 解析 TOP 排行数据
  @功能 解析 Data[].DetailData[] 格式
  */
  const parseTopData = (data: any, nameMap?: Record<string, string>) => {
    const result: TopData[] = [];
    data.Data?.forEach((item: any) => {
      item.DetailData?.forEach((d: any) => {
        const key = d.Key || d.Name || "Unknown";
        const displayName = nameMap ? (nameMap[key] || key) : key;
        result.push({ name: displayName, value: d.Value || 0 });
      });
    });
    return result.slice(0, 10);
  };

  /*
  fetchZoneData 分阶段加载站点数据
  @功能 阶段1：核心数据（流量/请求）→ 立即取消 loading 显示页面
         阶段2：次要数据（带宽/回源/性能/安全/边缘函数）→ 后台加载渐进渲染
  */
  const fetchZoneData = async () => {
    setLoading(true);
    const { startTime, endTime } = getTimeRange();
    const base = `/api/eo/traffic?zoneId=${zoneId}`;
    const t = (metric: string) => `${base}&metric=${metric}&startTime=${startTime}&endTime=${endTime}`;

    try {
      /* 阶段 0：获取 zone 基本信息 */
      const zonesRes = await fetch("/api/eo/zones");
      const zonesData = await zonesRes.json();
      const zoneInfo = zonesData.Zones?.find((z: ZoneDetail) => z.ZoneId === zoneId);
      if (zoneInfo) setZone(zoneInfo);

      /* 阶段 1：核心流量数据（3 个请求）→ 加载完立即显示 */
      const [fluxRes, inFluxRes, reqRes] = await Promise.all([
        fetch(t("l7Flow_outFlux")),
        fetch(t("l7Flow_inFlux")),
        fetch(t("l7Flow_request")),
      ]);
      const [fluxData, inFluxData, reqData] = await Promise.all([
        fluxRes.json(), inFluxRes.json(), reqRes.json(),
      ]);
      const flux = parseTimeline(fluxData);
      const inFlux = parseTimeline(inFluxData);
      const req = parseTimeline(reqData);
      setTrafficData(flux.data);
      setRequestData(req.data);
      setTotalFlux(flux.total);
      setTotalInFlux(inFlux.total);
      setTotalRequests(req.total);

      /* 取消全屏 loading，页面可交互 */
      setLoading(false);

      /* 阶段 2：带宽 + 回源 + 性能 + 安全 + 边缘函数（后台并行加载） */
      Promise.all([
        fetch(t("l7Flow_bandwidth")),
        fetch(t("l7Flow_inBandwidth")),
        fetch(t("l7Flow_outBandwidth")),
        fetch(t("l7Flow_outFlux_hy")),
        fetch(t("l7Flow_inFlux_hy")),
        fetch(t("l7Flow_request_hy")),
        fetch(t("l7Flow_outBandwidth_hy")),
        fetch(t("l7Flow_inBandwidth_hy")),
        fetch(t("l7Flow_avgResponseTime")),
        fetch(t("l7Flow_avgFirstByteResponseTime")),
        fetch(t("ccManage_interceptNum")),
        fetch(t("ccAcl_interceptNum")),
        fetch(t("ccRate_interceptNum")),
        fetch(`/api/eo/functions?zoneId=${zoneId}&startTime=${startTime}&endTime=${endTime}`),
      ]).then(async (responses) => {
        const [bandwidthJson, inBwJson, outBwJson, originFluxJson, originInFluxJson, originReqJson, originOutBwJson, originInBwJson, perfJson, firstByteJson, securityJson, securityAclJson, securityRateJson, edgeFuncJson] = await Promise.all(
          responses.map((r) => r.json())
        );

        /* 带宽 */
        const bwResult: BandwidthData[] = [];
        let maxBw = 0;
        bandwidthJson.Data?.forEach((item: any) => {
          item.TypeValue?.forEach((tv: any) => {
            tv.Detail?.forEach((d: any) => {
              bwResult.push({ time: new Date(d.Timestamp * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }), bandwidth: d.Value });
              if (d.Value > maxBw) maxBw = d.Value;
            });
          });
        });
        setBandwidthData(bwResult);
        setPeakBandwidth(maxBw);

        const inBw = parseTimeline(inBwJson);
        const outBw = parseTimeline(outBwJson);
        setInBandwidthData(inBw.data);
        setOutBandwidthData(outBw.data);
        setPeakInBandwidth(inBw.data.length > 0 ? Math.max(...inBw.data.map(d => d.value)) : 0);
        setPeakOutBandwidth(outBw.data.length > 0 ? Math.max(...outBw.data.map(d => d.value)) : 0);

        /* 回源 */
        const originResult = parseOriginPullTimeline(originFluxJson);
        const originInResult = parseOriginPullTimeline(originInFluxJson);
        const originReqResult = parseOriginPullTimeline(originReqJson);
        setOriginPullData(originResult.data);
        setOriginInFluxData(originInResult.data);
        setOriginRequestData(originReqResult.data);
        setOriginFlux(originResult.total);
        setOriginInFlux(originInResult.total);
        setOriginRequests(originReqResult.total);

        const originOutBw = parseOriginPullTimeline(originOutBwJson);
        const originInBw = parseOriginPullTimeline(originInBwJson);
        setOriginOutBandwidthData(originOutBw.data);
        setOriginInBandwidthData(originInBw.data);
        setOriginOutBandwidth(originOutBw.data.length > 0 ? Math.max(...originOutBw.data.map(d => d.value)) : 0);
        setOriginInBandwidth(originInBw.data.length > 0 ? Math.max(...originInBw.data.map(d => d.value)) : 0);

        /* 缓存命中率 */
        if (flux.total > 0 && originResult.total > 0) {
          setCacheHitRate(Math.max(0, ((flux.total - originResult.total) / flux.total) * 100));
        }

        /* 性能 */
        const perf = parseTimeline(perfJson);
        const firstByte = parseTimeline(firstByteJson);
        setPerformanceData(perf.data);
        setFirstByteData(firstByte.data);
        if (perf.data.length > 0) setAvgResponseTime(perf.total / perf.data.length);
        if (firstByte.data.length > 0) setAvgFirstByteTime(firstByte.total / firstByte.data.length);

        /* 安全：合并三个来源的时序数据 */
        const securityResult = parseSecurityData(securityJson);
        const securityAclResult = parseSecurityData(securityAclJson);
        const securityRateResult = parseSecurityData(securityRateJson);
        setTotalSecurityHits(securityResult.total);
        setTotalAclHits(securityAclResult.total);
        setTotalRateHits(securityRateResult.total);

        /* 按时间戳合并所有安全数据点 */
        const mergedSecMap = new Map<string, number>();
        [securityResult.data, securityAclResult.data, securityRateResult.data].forEach((arr) => {
          arr.forEach((d) => {
            mergedSecMap.set(d.time, (mergedSecMap.get(d.time) || 0) + d.value);
          });
        });
        const mergedSecurity = Array.from(mergedSecMap.entries())
          .map(([time, value]) => ({ time, value }))
          .sort((a, b) => a.time.localeCompare(b.time));
        setSecurityData(mergedSecurity.length > 0 ? mergedSecurity : securityAclResult.data.length > 0 ? securityAclResult.data : securityResult.data);
        setSecurityAclData(securityAclResult.data);
        setSecurityRateData(securityRateResult.data);

        /* 边缘函数 */
        if (edgeFuncJson) {
          const efReq = parseTimeline(edgeFuncJson.requests || {});
          const efCpu = parseTimeline(edgeFuncJson.cpuTime || {});
          setEdgeFuncRequestsData(efReq.data);
          setEdgeFuncCpuData(efCpu.data);
          setEdgeFuncRequests(efReq.total);
          setEdgeFuncCpuTime(efCpu.total);
        }
      }).catch((err) => console.error("Phase 2 fetch error:", err));

    } catch (err) {
      console.error("Fetch error:", err);
      setLoading(false);
    }
  };

  /*
  懒加载 TOP 数据 - 仅在切换到对应标签时触发
  @功能 地区/状态码/域名/URL/来源/设备/浏览器/OS/UA/资源类型/客户端IP 按需加载
  */
  useEffect(() => {
    if (loading || !zoneId) return;
    const { startTime, endTime } = getTimeRange();
    const base = `/api/eo/traffic?zoneId=${zoneId}`;
    const t = (metric: string) => `${base}&metric=${metric}&startTime=${startTime}&endTime=${endTime}`;

    const tabMetricMap: Record<string, { metrics: { metric: string; setter: (data: TopData[]) => void; nameMap?: Record<string, string> }[] }> = {
      country: {
        metrics: [
          { metric: "l7Flow_outFlux_country", setter: setCountryData, nameMap: COUNTRY_MAP },
          { metric: "l7Flow_outFlux_province", setter: setProvinceData, nameMap: PROVINCE_MAP },
        ],
      },
      status: { metrics: [{ metric: "l7Flow_outFlux_statusCode", setter: setStatusCodeData }] },
      domain: { metrics: [{ metric: "l7Flow_outFlux_domain", setter: setDomainData }] },
      url: { metrics: [{ metric: "l7Flow_outFlux_url", setter: setUrlData }] },
      referer: { metrics: [{ metric: "l7Flow_outFlux_referers", setter: setRefererData }] },
      resource: { metrics: [{ metric: "l7Flow_outFlux_resourceType", setter: setResourceTypeData }] },
      ip: { metrics: [{ metric: "l7Flow_outFlux_sip", setter: setSipData }] },
      device: {
        metrics: [
          { metric: "l7Flow_outFlux_ua_device", setter: setDeviceData },
          { metric: "l7Flow_outFlux_ua_browser", setter: setBrowserData },
          { metric: "l7Flow_outFlux_ua_os", setter: setOsData },
        ],
      },
      ua: { metrics: [{ metric: "l7Flow_outFlux_ua", setter: setUaData }] },
    };

    const config = tabMetricMap[activeTab];
    if (!config || topDataLoaded.has(activeTab)) return;

    Promise.all(
      config.metrics.map(async ({ metric, setter, nameMap }) => {
        try {
          const res = await fetch(t(metric));
          const json = await res.json();
          setter(parseTopData(json, nameMap));
        } catch (err) {
          console.error(`Lazy load ${metric} error:`, err);
        }
      })
    ).then(() => {
      setTopDataLoaded((prev) => new Set(prev).add(activeTab));
    });
  }, [activeTab, loading, zoneId, topDataLoaded]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
          <div className="container mx-auto flex h-14 sm:h-16 items-center gap-4 px-4 max-w-7xl">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-6 w-32" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-7xl">
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
          <Skeleton className="h-10 w-full max-w-2xl" />
          <Card>
            <CardContent className="p-4 sm:p-6">
              <Skeleton className="h-[250px] sm:h-[300px] w-full" />
            </CardContent>
          </Card>
        </main>
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
            <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-edgeone-blue flex-shrink-0" />
            <h1 className="text-base sm:text-xl font-bold truncate">{zone?.ZoneName || zoneId}</h1>
          </div>
          <Badge variant="success" className="flex-shrink-0">
            {zone?.ActiveStatus === "active" ? "已启用" : zone?.ActiveStatus}
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-7xl">
        {/* Overview Cards - Row 1 */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-blue-500/20">
                <Database className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">24h 总流量</p>
                <p className="text-lg sm:text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400 truncate">{formatBytes(totalFlux)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-green-500/20">
                <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">24h 请求数</p>
                <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">{formatNumber(totalRequests)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-purple-500/20">
                <Wifi className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">带宽峰值</p>
                <p className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{formatBytes(peakBandwidth)}/s</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-cyan-500/20">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">缓存命中率</p>
                <p className="text-lg sm:text-2xl font-bold text-cyan-600 dark:text-cyan-400">{cacheHitRate.toFixed(1)}%</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overview Cards - Row 2: Performance & Origin */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-orange-500/20">
                <Server className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">回源流量</p>
                <p className="text-lg sm:text-2xl font-bold text-orange-600 dark:text-orange-400">{formatBytes(originFlux)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border-rose-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-rose-500/20">
                <Timer className="h-5 w-5 sm:h-6 sm:w-6 text-rose-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">平均响应耗时</p>
                <p className="text-lg sm:text-2xl font-bold text-rose-600 dark:text-rose-400">{avgResponseTime.toFixed(0)} ms</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-amber-500/20">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">首字节耗时</p>
                <p className="text-lg sm:text-2xl font-bold text-amber-600 dark:text-amber-400">{avgFirstByteTime.toFixed(0)} ms</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-red-500/20">
                <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">安全拦截</p>
                <p className="text-lg sm:text-2xl font-bold text-red-600 dark:text-red-400">{formatNumber(totalSecurityHits + totalAclHits + totalRateHits)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overview Cards - Row 3: Zone Info */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border-pink-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-pink-500/20">
                <Globe className="h-5 w-5 sm:h-6 sm:w-6 text-pink-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">加速区域</p>
                <p className="text-lg sm:text-2xl font-bold text-pink-600 dark:text-pink-400">{zone?.Area === "global" ? "全球" : zone?.Area}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-indigo-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-indigo-500/20">
                <Link2 className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">接入类型</p>
                <p className="text-base sm:text-lg font-bold text-indigo-600 dark:text-indigo-400">{zone?.Type === "dnsPodAccess" ? "DNSPod" : zone?.Type === "partial" ? "CNAME" : zone?.Type}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-emerald-500/20">
                <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">回源请求</p>
                <p className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(originRequests)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-violet-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-violet-500/20">
                <Database className="h-5 w-5 sm:h-6 sm:w-6 text-violet-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">套餐</p>
                <p className="text-base sm:text-lg font-bold text-violet-600 dark:text-violet-400">{zone?.PlanType === "plan-free" ? "免费版" : zone?.PlanType}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <ResponsiveTabs
          tabs={EO_TAB_ITEMS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          accentColor="bg-edgeone-blue"
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>

          <TabsContent value="traffic" className="space-y-4">
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
                      <Line type="monotone" dataKey="value" stroke="#006EFF" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>请求趋势 (24h)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[250px] sm:h-[300px]">
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
            {/* Bandwidth Stats Cards */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">总带宽峰值 (Total)</p>
                  <p className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{formatBytes(peakBandwidth)}/s</p>
                  <p className="text-xs text-muted-foreground mt-1">访问总带宽峰值</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border-pink-500/20">
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">请求带宽峰值 (In)</p>
                  <p className="text-xl sm:text-2xl font-bold text-pink-600 dark:text-pink-400">{formatBytes(peakInBandwidth)}/s</p>
                  <p className="text-xs text-muted-foreground mt-1">客户端请求带宽峰值</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">响应带宽峰值 (Out)</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{formatBytes(peakOutBandwidth)}/s</p>
                  <p className="text-xs text-muted-foreground mt-1">EdgeOne 响应带宽峰值</p>
                </CardContent>
              </Card>
            </div>
            {/* Bandwidth Chart */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Wifi className="h-5 w-5 text-purple-500" />带宽趋势 (24h)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[250px] sm:h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} allowDuplicatedCategory={false} />
                      <YAxis tickFormatter={(v) => `${formatBytes(v)}/s`} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => `${formatBytes(v)}/s`} />
                      <Legend />
                      <Line data={bandwidthData} type="monotone" dataKey="bandwidth" stroke="#8B5CF6" strokeWidth={2} dot={false} name="总带宽" />
                      <Line data={inBandwidthData} type="monotone" dataKey="value" stroke="#EC4899" strokeWidth={2} dot={false} name="请求带宽" />
                      <Line data={outBandwidthData} type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} dot={false} name="响应带宽" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Timer className="h-5 w-5 text-rose-500" />响应耗时趋势 (24h)</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[250px] sm:h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={performanceData}>
                        <defs>
                          <linearGradient id="colorPerf" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={(v) => `${v.toFixed(0)} ms`} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number) => `${v.toFixed(0)} ms`} />
                        <Area type="monotone" dataKey="value" stroke="#F43F5E" fill="url(#colorPerf)" strokeWidth={2} name="响应耗时" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-amber-500" />首字节耗时趋势 (24h)</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[250px] sm:h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={firstByteData}>
                        <defs>
                          <linearGradient id="colorFirstByte" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={(v) => `${v.toFixed(0)} ms`} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number) => `${v.toFixed(0)} ms`} />
                        <Area type="monotone" dataKey="value" stroke="#F59E0B" fill="url(#colorFirstByte)" strokeWidth={2} name="首字节耗时" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="bg-gradient-to-br from-rose-500/5 to-transparent">
                <CardContent className="p-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">平均响应耗时</p>
                    <p className="text-3xl font-bold text-rose-500">{avgResponseTime.toFixed(0)} ms</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-500/5 to-transparent">
                <CardContent className="p-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">平均首字节耗时</p>
                    <p className="text-3xl font-bold text-amber-500">{avgFirstByteTime.toFixed(0)} ms</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="origin" className="space-y-4">
            {/* Origin Pull Stats Cards - Row 1 */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">回源请求流量</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{formatBytes(originInFlux)}</p>
                  <p className="text-xs text-muted-foreground mt-1">EdgeOne 节点至源站</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">回源请求数</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{formatNumber(originRequests)}</p>
                  <p className="text-xs text-muted-foreground mt-1">EdgeOne 节点至源站</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">回源请求带宽峰值</p>
                  <p className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{formatBytes(originInBandwidth)}/s</p>
                  <p className="text-xs text-muted-foreground mt-1">客户端请求带宽峰值</p>
                </CardContent>
              </Card>
            </div>
            {/* Origin Pull Stats Cards - Row 2 */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
              <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">回源响应流量</p>
                  <p className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400">{formatBytes(originFlux)}</p>
                  <p className="text-xs text-muted-foreground mt-1">源站至 EdgeOne 节点</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border-rose-500/20">
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">回源响应带宽峰值</p>
                  <p className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400">{formatBytes(originOutBandwidth)}/s</p>
                  <p className="text-xs text-muted-foreground mt-1">EdgeOne 响应带宽峰值</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">缓存命中率</p>
                  <p className="text-xl sm:text-2xl font-bold text-cyan-600 dark:text-cyan-400">{cacheHitRate.toFixed(2)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">1 - (源站响应 / EdgeOne 响应)</p>
                </CardContent>
              </Card>
            </div>
            {/* Origin Pull Chart */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-orange-500" />回源趋势 (24h)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[250px] sm:h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} allowDuplicatedCategory={false} />
                      <YAxis tickFormatter={(v) => formatBytes(v)} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => formatBytes(v)} />
                      <Legend />
                      <Line data={originInFluxData} type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} dot={false} name="回源请求流量" />
                      <Line data={originPullData} type="monotone" dataKey="value" stroke="#F97316" strokeWidth={2} dot={false} name="回源响应流量" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="edgefunc" className="space-y-4">
            {/* Edge Functions Stats Cards */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2">
              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">总请求数</p>
                  <p className="text-xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400">
                    {edgeFuncRequests > 10000 ? `${(edgeFuncRequests / 10000).toFixed(2)} 万` : formatNumber(edgeFuncRequests)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Edge Functions 总调用次数</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">总 CPU 时间</p>
                  <p className="text-xl sm:text-3xl font-bold text-cyan-600 dark:text-cyan-400">
                    {formatNumber(edgeFuncCpuTime)} ms
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Edge Functions 总 CPU 耗时</p>
                </CardContent>
              </Card>
            </div>
            {/* Edge Functions Charts */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Code className="h-5 w-5 text-purple-500" />函数请求数趋势</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[250px] sm:h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={edgeFuncRequestsData}>
                        <defs>
                          <linearGradient id="colorEFReq" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number) => formatNumber(v)} />
                        <Area type="monotone" dataKey="value" stroke="#8B5CF6" fill="url(#colorEFReq)" strokeWidth={2} name="请求数" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-cyan-500" />函数 CPU 耗时趋势</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[250px] sm:h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={edgeFuncCpuData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={(v) => `${v} ms`} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number) => `${v} ms`} />
                        <Line type="monotone" dataKey="value" stroke="#06B6D4" strokeWidth={2} dot={false} name="CPU 时间" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-red-500" />安全防护趋势 (24h)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[250px] sm:h-[300px]">
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
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
              <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">总拦截次数</p>
                  <p className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">{formatNumber(totalSecurityHits + totalAclHits + totalRateHits)}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">CC 管理拦截</p>
                  <p className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400">{formatNumber(totalSecurityHits)}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">ACL 规则拦截</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{formatNumber(totalAclHits)}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">速率限制拦截</p>
                  <p className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{formatNumber(totalRateHits)}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="country" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-blue-500" />国家/地区 TOP 10</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[300px] sm:h-[400px]">
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
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-emerald-500" />国内省份 TOP 10</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[300px] sm:h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={provinceData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(v) => formatBytes(v)} />
                        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => formatBytes(v)} />
                        <Bar dataKey="value" fill="#10B981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>状态码分布</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[300px] sm:h-[400px] flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={statusCodeData} 
                          dataKey="value" 
                          nameKey="name" 
                          cx="50%" 
                          cy="50%" 
                          outerRadius={100}
                          innerRadius={40}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}
                          labelLine={{ stroke: '#666', strokeWidth: 1 }}
                        >
                          {statusCodeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatBytes(v)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>状态码流量 TOP 10</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {statusCodeData.length > 0 ? statusCodeData.map((item, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                        <div className="flex-1">
                          <p className="text-sm font-mono">{item.name}</p>
                          <div className="h-2 bg-muted rounded-full mt-1">
                            <div className="h-full rounded-full" style={{ width: `${(item.value / (statusCodeData[0]?.value || 1)) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
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

          <TabsContent value="resource">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileType className="h-5 w-5 text-violet-500" />资源类型 TOP 10</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {resourceTypeData.length > 0 ? resourceTypeData.map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-mono truncate">{item.name || "Unknown"}</p>
                        <div className="h-2 bg-muted rounded-full mt-1">
                          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(item.value / (resourceTypeData[0]?.value || 1)) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatBytes(item.value)}</span>
                    </div>
                  )) : <p className="text-muted-foreground text-center py-8">暂无数据</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ip">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-indigo-500" />客户端 IP TOP 10</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sipData.length > 0 ? sipData.map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-mono truncate">{item.name}</p>
                        <div className="h-2 bg-muted rounded-full mt-1">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(item.value / (sipData[0]?.value || 1)) * 100}%` }} />
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
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-cyan-500" />设备类型 TOP 10</CardTitle></CardHeader>
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
                <CardHeader><CardTitle className="flex items-center gap-2"><Chrome className="h-5 w-5 text-pink-500" />浏览器 TOP 10</CardTitle></CardHeader>
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
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Monitor className="h-5 w-5 text-emerald-500" />操作系统 TOP 10</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {osData.length > 0 ? osData.map((item, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                        <div className="flex-1">
                          <p className="text-sm truncate">{item.name || "Unknown"}</p>
                          <div className="h-2 bg-muted rounded-full mt-1">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(item.value / (osData[0]?.value || 1)) * 100}%` }} />
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

          <TabsContent value="ua">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-amber-500" />User Agent TOP 10</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {uaData.length > 0 ? uaData.map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <span className="w-6 text-center font-medium text-muted-foreground">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-xs font-mono truncate" title={item.name}>{item.name || "Unknown"}</p>
                        <div className="h-2 bg-muted rounded-full mt-1">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(item.value / (uaData[0]?.value || 1)) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatBytes(item.value)}</span>
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
