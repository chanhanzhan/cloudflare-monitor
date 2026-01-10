"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n";
import { useTheme } from "next-themes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Globe,
  Shield,
  Database,
  Activity,
  Moon,
  Sun,
  Languages,
  RefreshCw,
  Cloud,
  Zap,
  Code,
  AlertTriangle,
} from "lucide-react";
import { StatsCards } from "./stats-cards";
import { TrafficChart } from "./traffic-chart";
import { GeographyStats } from "./geography-stats";
import { formatBytes, formatNumber } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CFAnalyticsData, EOZone, ESAData, TimePeriod } from "@/types";

export function Dashboard() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("1day");
  const [activeTab, setActiveTab] = useState<"all" | "CloudFLare" | "EdgeOne" | "ESA">("all");
  const [error, setError] = useState<string | null>(null);

  // Independent loading states for each data source
  const [cfLoading, setCfLoading] = useState(true);
  const [workersLoading, setWorkersLoading] = useState(true);
  const [eoLoading, setEoLoading] = useState(true);
  const [esaLoading, setEsaLoading] = useState(true);

  // Cloudflare data
  const [cfData, setCfData] = useState<CFAnalyticsData | null>(null);
  // Cloudflare Workers data
  const [workersData, setWorkersData] = useState<{
    accounts: { account: string; workers: { scriptName: string; requests: number; errors: number; subrequests: number; cpuTimeP50: number; cpuTimeP99: number }[]; totalRequests: number; totalErrors: number }[];
    totalRequests: number;
    totalErrors: number;
  } | null>(null);
  // EdgeOne data
  const [eoZones, setEoZones] = useState<EOZone[]>([]);
  const [eoOverview, setEoOverview] = useState<{ totalFlux: number; totalRequests: number } | null>(null);
  const [eoEdgeFunctions, setEoEdgeFunctions] = useState<{ totalRequests: number; totalCpuTime: number } | null>(null);
  // ESA data
  const [esaData, setEsaData] = useState<ESAData | null>(null);

  // Combined loading state
  const loading = cfLoading || workersLoading || eoLoading || esaLoading;

  const fetchData = async () => {
    setCfLoading(true);
    setWorkersLoading(true);
    setEoLoading(true);
    setEsaLoading(true);
    setError(null);

    // Fetch each API independently - render as soon as each completes
    fetch("/api/cf/analytics")
      .then((r) => r.json())
      .then((cfRes) => setCfData(cfRes))
      .catch(() => setCfData({ accounts: [] }))
      .finally(() => setCfLoading(false));

    fetch("/api/cf/workers")
      .then((r) => r.json())
      .then((workersRes) => setWorkersData(workersRes))
      .catch(() => setWorkersData({ accounts: [], totalRequests: 0, totalErrors: 0 }))
      .finally(() => setWorkersLoading(false));

    fetch("/api/eo/zones")
      .then((r) => r.json())
      .then((eoRes) => {
        setEoZones(eoRes.Zones || []);
        if (eoRes.overview) setEoOverview(eoRes.overview);
        if (eoRes.accounts) {
          const totalEf = eoRes.accounts.reduce((acc: { totalRequests: number; totalCpuTime: number }, a: any) => {
            if (a.edgeFunctions) {
              acc.totalRequests += a.edgeFunctions.totalRequests || 0;
              acc.totalCpuTime += a.edgeFunctions.totalCpuTime || 0;
            }
            return acc;
          }, { totalRequests: 0, totalCpuTime: 0 });
          if (totalEf.totalRequests > 0 || totalEf.totalCpuTime > 0) {
            setEoEdgeFunctions(totalEf);
          }
        }
      })
      .catch(() => setEoZones([]))
      .finally(() => setEoLoading(false));

    fetch("/api/esa?skipTimeSeries=true")
      .then((r) => r.json())
      .then((esaRes) => {
        setEsaData(esaRes);
        // Load full ESA data in background
        fetch("/api/esa?details=true")
          .then((r) => r.json())
          .then((esaResFull) => {
            if (esaResFull?.accounts) setEsaData(esaResFull);
          })
          .catch(() => {});
      })
      .catch(() => setEsaData({ accounts: [] }))
      .finally(() => setEsaLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate aggregated stats from CF data
  const cfStats = useMemo(() => {
    if (!cfData?.accounts) return null;

    let totalRequests = 0;
    let totalBytes = 0;
    let totalThreats = 0;
    let totalCachedRequests = 0;
    let totalCachedBytes = 0;

    cfData.accounts.forEach((account) => {
      account.zones?.forEach((zone) => {
        const useHourlyData = selectedPeriod === "1day" || selectedPeriod === "3days";
        const rawData = useHourlyData ? zone.rawHours || [] : zone.raw || [];

        const sortedData = rawData
          .filter((d) => d && d.dimensions && d.sum)
          .sort((a, b) => {
            const aDim = a.dimensions as { date?: string; datetime?: string };
            const bDim = b.dimensions as { date?: string; datetime?: string };
            const aTime = useHourlyData ? aDim.datetime : aDim.date;
            const bTime = useHourlyData ? bDim.datetime : bDim.date;
            return new Date(aTime || "").getTime() - new Date(bTime || "").getTime();
          });

        let periodData;
        if (useHourlyData) {
          const periodHours = selectedPeriod === "1day" ? 24 : 72;
          periodData = sortedData.slice(-Math.min(sortedData.length, periodHours));
        } else {
          const periodDays = selectedPeriod === "7days" ? 7 : 30;
          periodData = sortedData.slice(-Math.min(sortedData.length, periodDays));
        }

        periodData.forEach((dataPoint) => {
          if (dataPoint.sum) {
            totalRequests += dataPoint.sum.requests || 0;
            totalBytes += dataPoint.sum.bytes || 0;
            totalThreats += dataPoint.sum.threats || 0;
            totalCachedRequests += dataPoint.sum.cachedRequests || 0;
            totalCachedBytes += dataPoint.sum.cachedBytes || 0;
          }
        });
      });
    });

    return {
      totalRequests,
      totalBytes,
      totalThreats,
      totalCachedRequests,
      totalCachedBytes,
      cacheHitRate: totalRequests > 0 ? ((totalCachedRequests / totalRequests) * 100).toFixed(1) : "0",
    };
  }, [cfData, selectedPeriod]);

  const hasCfData = cfData?.accounts && cfData.accounts.length > 0;
  const hasEoData = eoZones.length > 0;
  const hasEsaData = esaData?.accounts && esaData.accounts.length > 0;

  const esaSummary = useMemo(() => {
    if (!esaData?.accounts) return { totalRequests: 0, totalBytes: 0, quotas: [] as { quotaName: string; total: number; used: number }[] };
    const totalRequests = esaData.accounts.reduce((sum, acc) => sum + (acc.totalRequests || 0), 0);
    const totalBytes = esaData.accounts.reduce((sum, acc) => sum + (acc.totalBytes || 0), 0);
    const quotas: Record<string, { quotaName: string; total: number; used: number }> = {};
    esaData.accounts.forEach((acc) => {
      acc.quotas?.forEach((q) => {
        if (!quotas[q.quotaName]) {
          quotas[q.quotaName] = { quotaName: q.quotaName, total: 0, used: 0 };
        }
        quotas[q.quotaName].total += Number(q.total || 0);
        quotas[q.quotaName].used += Number(q.used || 0);
      });
    });
    return { totalRequests, totalBytes, quotas: Object.values(quotas) };
  }, [esaData]);

  // Loading skeleton component for individual sections
  const SectionSkeleton = ({ height = "h-[200px]" }: { height?: string }) => (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <Skeleton className={`${height} w-full`} />
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4 max-w-7xl">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1 sm:gap-2">
              <Cloud className="h-5 w-5 sm:h-6 sm:w-6 text-cloudflare-orange" />
              <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-edgeone-blue" />
            </div>
            <h1 className="text-base sm:text-xl font-bold">{t("dashboardTitle")}</h1>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Period Selector - Hidden on mobile, shown in dropdown */}
            <ScrollArea className="max-w-[200px] sm:max-w-none hidden sm:block">
              <div className="flex rounded-lg border bg-muted p-1">
                {(["1day", "3days", "7days", "30days"] as TimePeriod[]).map((period) => (
                  <Button
                    key={period}
                    variant={selectedPeriod === period ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setSelectedPeriod(period)}
                    className="px-2 sm:px-3 text-xs sm:text-sm"
                  >
                    {t(period === "1day" ? "singleDay" : period === "3days" ? "threeDays" : period === "7days" ? "sevenDays" : "thirtyDays")}
                  </Button>
                ))}
              </div>
            </ScrollArea>
            {/* Mobile period selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="sm:hidden">
                <Button variant="outline" size="sm" className="text-xs">
                  {t(selectedPeriod === "1day" ? "singleDay" : selectedPeriod === "3days" ? "threeDays" : selectedPeriod === "7days" ? "sevenDays" : "thirtyDays")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {(["1day", "3days", "7days", "30days"] as TimePeriod[]).map((period) => (
                  <DropdownMenuItem key={period} onClick={() => setSelectedPeriod(period)}>
                    {t(period === "1day" ? "singleDay" : period === "3days" ? "threeDays" : period === "7days" ? "sevenDays" : "thirtyDays")}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Refresh */}
            <Button variant="outline" size="icon" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>

            {/* Theme Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  {t("light")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  {t("dark")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  {t("system")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Language Toggle */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
            >
              <Languages className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-7xl">
        {error && (
          <Card className="mb-4 sm:mb-6 border-destructive">
            <CardContent className="flex items-center justify-between p-3 sm:p-4">
              <p className="text-destructive text-sm sm:text-base">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchData}>
                {t("retry")}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading state - show skeleton while any data is loading */}
        {loading && !hasCfData && !hasEoData && !hasEsaData && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">加载中...</p>
            </div>
          </div>
        )}

        {/* Show "no data" only after all loading is complete */}
        {!loading && !hasCfData && !hasEoData && !hasEsaData ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="w-full max-w-md mx-auto">
              <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16">
                <Globe className="mb-4 h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground" />
                <h2 className="mb-2 text-lg sm:text-xl font-semibold">{t("noData")}</h2>
                <p className="text-center text-sm sm:text-base text-muted-foreground">{t("configureToken")}</p>
              </CardContent>
            </Card>
          </div>
        ) : (hasCfData || hasEoData || hasEsaData) && (
          <>
            {/* Provider Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="mb-4 sm:mb-6">
              <TabsList className="grid w-full max-w-2xl grid-cols-4 h-auto">
                <TabsTrigger value="all" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
                  <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline">{t("dashboardTitle")}</span>
                  <span className="xs:hidden">全部</span>
                </TabsTrigger>
                <TabsTrigger value="cloudflare" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2" disabled={!hasCfData}>
                  <Cloud className="h-3 w-3 sm:h-4 sm:w-4 text-cloudflare-orange" />
                  <span className="hidden sm:inline">Cloudflare</span>
                  <span className="sm:hidden">CF</span>
                </TabsTrigger>
                <TabsTrigger value="edgeone" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2" disabled={!hasEoData}>
                  <Zap className="h-3 w-3 sm:h-4 sm:w-4 text-edgeone-blue" />
                  <span className="hidden sm:inline">EdgeOne</span>
                  <span className="sm:hidden">EO</span>
                </TabsTrigger>
                <TabsTrigger value="esa" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2" disabled={!hasEsaData}>
                  <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Aliyun ESA</span>
                  <span className="sm:hidden">ESA</span>
                </TabsTrigger>
              </TabsList>

              {/* All Tab - Combined View */}
              <TabsContent value="all" className="space-y-4 sm:space-y-6">
                {/* Combined Stats Overview */}
                <div className="mb-3 sm:mb-4">
                  <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2 mb-3 sm:mb-4">
                    <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    全平台数据汇总
                  </h2>
                  <StatsCards
                    totalRequests={(cfStats?.totalRequests || 0) + (eoOverview?.totalRequests || 0) + (esaSummary.totalRequests || 0)}
                    totalBytes={(cfStats?.totalBytes || 0) + (eoOverview?.totalFlux || 0) + (esaSummary.totalBytes || 0)}
                    totalThreats={cfStats?.totalThreats || 0}
                    cacheHitRate={cfStats?.cacheHitRate || "0"}
                    formatNumber={formatNumber}
                    formatBytes={formatBytes}
                  />
                </div>

                {/* Cloudflare Zones */}
                {cfLoading && (
                  <section className="animate-pulse">
                    <div className="mb-4 flex items-center gap-2">
                      <Cloud className="h-5 w-5 text-cloudflare-orange" />
                      <h2 className="text-lg font-semibold text-muted-foreground">Cloudflare 加载中...</h2>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {[1, 2].map((i) => (
                        <Card key={i}><CardContent className="p-6"><Skeleton className="h-[200px] w-full" /></CardContent></Card>
                      ))}
                    </div>
                  </section>
                )}
                {!cfLoading && hasCfData && (
                  <section>
                    <div className="mb-4 flex items-center gap-2">
                      <Cloud className="h-5 w-5 text-cloudflare-orange" />
                      <h2 className="text-lg font-semibold">Cloudflare {t("zone")}</h2>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {cfData?.accounts.map((account) =>
                        account.zones?.map((zone) => (
                          <div 
                            key={`${account.name}-${zone.domain}`}
                            className="cursor-pointer transition-all hover:scale-[1.01]"
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/zone/cf/${encodeURIComponent(zone.domain)}`);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                router.push(`/zone/cf/${encodeURIComponent(zone.domain)}`);
                              }
                            }}
                          >
                            <TrafficChart
                              title={zone.domain}
                              subtitle={account.name}
                              data={zone}
                              selectedPeriod={selectedPeriod}
                              provider="cloudflare"
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                )}

                {/* Cloudflare Workers */}
                {workersLoading && (
                  <section className="animate-pulse">
                    <div className="mb-4 flex items-center gap-2">
                      <Code className="h-5 w-5 text-cloudflare-orange" />
                      <h2 className="text-lg font-semibold text-muted-foreground">Cloudflare Workers 加载中...</h2>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {[1, 2, 3, 4].map((i) => (
                        <Card key={i}><CardContent className="p-6"><Skeleton className="h-[80px] w-full" /></CardContent></Card>
                      ))}
                    </div>
                  </section>
                )}
                {!workersLoading && workersData && workersData.totalRequests > 0 && (
                  <section>
                    <div className="mb-4 flex items-center gap-2">
                      <Code className="h-5 w-5 text-cloudflare-orange" />
                      <h2 className="text-lg font-semibold">Cloudflare Workers (24h)</h2>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
                      <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="rounded-full p-3 bg-orange-500/10">
                            <Activity className="h-6 w-6 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">总请求数</p>
                            <p className="text-2xl font-bold">{formatNumber(workersData.totalRequests)}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="rounded-full p-3 bg-red-500/10">
                            <AlertTriangle className="h-6 w-6 text-red-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">错误数</p>
                            <p className="text-2xl font-bold">{formatNumber(workersData.totalErrors)}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="rounded-full p-3 bg-green-500/10">
                            <Shield className="h-6 w-6 text-green-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">成功率</p>
                            <p className="text-2xl font-bold">
                              {workersData.totalRequests > 0 
                                ? ((1 - workersData.totalErrors / workersData.totalRequests) * 100).toFixed(2) 
                                : 100}%
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="rounded-full p-3 bg-blue-500/10">
                            <Code className="h-6 w-6 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Workers 数量</p>
                            <p className="text-2xl font-bold">
                              {workersData.accounts.reduce((sum, a) => sum + a.workers.length, 0)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {workersData.accounts.flatMap((account) =>
                        account.workers.map((worker) => (
                          <Card key={`${account.account}-${worker.scriptName}`}>
                            <CardHeader className="pb-2">
                              <CardTitle className="flex items-center gap-2 text-base">
                                <Code className="h-4 w-4 text-cloudflare-orange" />
                                {worker.scriptName}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">请求数</span>
                                  <span className="font-medium">{formatNumber(worker.requests)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">错误数</span>
                                  <span className={worker.errors > 0 ? "text-red-500 font-medium" : ""}>{formatNumber(worker.errors)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">子请求</span>
                                  <span>{formatNumber(worker.subrequests || 0)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">成功率</span>
                                  <span className={worker.requests > 0 && worker.errors / worker.requests > 0.01 ? "text-yellow-500" : "text-green-500"}>
                                    {worker.requests > 0 ? ((1 - worker.errors / worker.requests) * 100).toFixed(2) : 100}%
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">CPU P50</span>
                                  <span>{(worker.cpuTimeP50 / 1000).toFixed(2)} ms</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">CPU P99</span>
                                  <span>{(worker.cpuTimeP99 / 1000).toFixed(2)} ms</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </section>
                )}

                {/* EdgeOne Overview */}
                {eoLoading && (
                  <section className="animate-pulse">
                    <div className="mb-4 flex items-center gap-2">
                      <Zap className="h-5 w-5 text-edgeone-blue" />
                      <h2 className="text-lg font-semibold text-muted-foreground">EdgeOne 加载中...</h2>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                      {[1, 2, 3, 4].map((i) => (
                        <Card key={i}><CardContent className="p-6"><Skeleton className="h-[80px] w-full" /></CardContent></Card>
                      ))}
                    </div>
                  </section>
                )}
                {!eoLoading && hasEoData && eoOverview && (
                  <section>
                    <div className="mb-4 flex items-center gap-2">
                      <Zap className="h-5 w-5 text-edgeone-blue" />
                      <h2 className="text-lg font-semibold">EdgeOne 概览 (24h)</h2>
                    </div>
                    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
                      <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="rounded-full p-3 bg-blue-500/10">
                            <Database className="h-6 w-6 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">总流量</p>
                            <p className="text-2xl font-bold">{formatBytes(eoOverview.totalFlux)}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="rounded-full p-3 bg-green-500/10">
                            <Activity className="h-6 w-6 text-green-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">总请求</p>
                            <p className="text-2xl font-bold">{formatNumber(eoOverview.totalRequests)}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="rounded-full p-3 bg-purple-500/10">
                            <Code className="h-6 w-6 text-purple-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">边缘函数请求</p>
                            <p className="text-2xl font-bold">{formatNumber(eoEdgeFunctions?.totalRequests || 0)}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="rounded-full p-3 bg-orange-500/10">
                            <Activity className="h-6 w-6 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">边缘函数 CPU</p>
                            <p className="text-2xl font-bold">{formatNumber(eoEdgeFunctions?.totalCpuTime || 0)} ms</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </section>
                )}

                {/* EdgeOne Zones */}
                {eoLoading && (
                  <section className="animate-pulse">
                    <div className="mb-4 flex items-center gap-2">
                      <Zap className="h-5 w-5 text-edgeone-blue" />
                      <h2 className="text-lg font-semibold text-muted-foreground">EdgeOne 站点加载中...</h2>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {[1, 2, 3].map((i) => (
                        <Card key={i}><CardContent className="p-6"><Skeleton className="h-[150px] w-full" /></CardContent></Card>
                      ))}
                    </div>
                  </section>
                )}
                {!eoLoading && hasEoData && (
                  <section>
                    <div className="mb-4 flex items-center gap-2">
                      <Zap className="h-5 w-5 text-edgeone-blue" />
                      <h2 className="text-lg font-semibold">EdgeOne {t("zone")}</h2>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {eoZones.map((zone) => (
                        <Card 
                          key={zone.ZoneId} 
                          className="cursor-pointer transition-all hover:shadow-lg hover:border-edgeone-blue/50"
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/zone/eo/${zone.ZoneId}`);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              router.push(`/zone/eo/${zone.ZoneId}`);
                            }
                          }}
                        >
                          <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-base">
                              <Zap className="h-4 w-4 text-edgeone-blue" />
                              {zone.ZoneName}
                              <span className="ml-auto text-xs text-muted-foreground">点击查看详情 →</span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">状态</span>
                                <span className={(zone as { ActiveStatus?: string }).ActiveStatus === "active" ? "text-green-500 font-medium" : "text-yellow-500"}>
                                  {(zone as { ActiveStatus?: string }).ActiveStatus === "active" ? "已启用" : (zone as { ActiveStatus?: string }).ActiveStatus || zone.Status}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">类型</span>
                                <span>{zone.Type === "dnsPodAccess" ? "DNSPod 托管" : zone.Type === "partial" ? "CNAME 接入" : zone.Type}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">加速区域</span>
                                <span>{zone.Area === "global" ? "全球" : zone.Area}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">套餐</span>
                                <span className="text-blue-500">{(zone as { PlanType?: string }).PlanType === "plan-free" ? "免费版" : (zone as { PlanType?: string }).PlanType}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                )}

                {/* Geography Stats */}
                {selectedPeriod === "1day" && hasCfData && (
                  <GeographyStats data={cfData} formatNumber={formatNumber} formatBytes={formatBytes} />
                )}

                {/* ESA Overview in All Tab */}
                {esaLoading && (
                  <section className="animate-pulse">
                    <div className="mb-4 flex items-center gap-2">
                      <Shield className="h-5 w-5 text-emerald-500" />
                      <h2 className="text-lg font-semibold text-muted-foreground">ESA 加载中...</h2>
                    </div>
                    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
                      {[1, 2, 3, 4].map((i) => (
                        <Card key={i}><CardContent className="p-6"><Skeleton className="h-[80px] w-full" /></CardContent></Card>
                      ))}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {[1, 2, 3].map((i) => (
                        <Card key={i}><CardContent className="p-6"><Skeleton className="h-[150px] w-full" /></CardContent></Card>
                      ))}
                    </div>
                  </section>
                )}
                {!esaLoading && hasEsaData && (
                  <>
                  {/* ESA Stats Cards */}
                  <section>
                    <div className="mb-4 flex items-center gap-2">
                      <Shield className="h-5 w-5 text-emerald-500" />
                      <h2 className="text-lg font-semibold">ESA 概览 (24h)</h2>
                    </div>
                    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
                      <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="rounded-full p-3 bg-emerald-500/10">
                            <Shield className="h-6 w-6 text-emerald-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">站点数</p>
                            <p className="text-2xl font-bold">{esaData?.accounts.reduce((sum, a) => sum + (a.sites?.length || 0), 0) || 0}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="rounded-full p-3 bg-blue-500/10">
                            <Activity className="h-6 w-6 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">总请求</p>
                            <p className="text-2xl font-bold">{formatNumber(esaSummary.totalRequests)}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="rounded-full p-3 bg-cyan-500/10">
                            <Database className="h-6 w-6 text-cyan-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">总流量</p>
                            <p className="text-2xl font-bold">{formatBytes(esaSummary.totalBytes)}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="rounded-full p-3 bg-purple-500/10">
                            <Code className="h-6 w-6 text-purple-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">边缘函数</p>
                            <p className="text-2xl font-bold">{esaData?.accounts.reduce((sum, a) => sum + (a.routineCount || 0), 0) || 0}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </section>
                  {/* ESA Sites */}
                  <section>
                    <div className="mb-4 flex items-center gap-2">
                      <Shield className="h-5 w-5 text-emerald-500" />
                      <h2 className="text-lg font-semibold">ESA 站点</h2>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {esaData?.accounts.flatMap((acc) =>
                        (acc.sites || []).map((s) => (
                          <Card 
                            key={`all-${acc.name}-${s.SiteId}`}
                            className="cursor-pointer transition-all hover:shadow-lg hover:border-emerald-500/50"
                            role="button"
                            tabIndex={0}
                            onClick={() => router.push(`/zone/esa/${encodeURIComponent(s.SiteId || s.SiteName)}`)}
                          >
                            <CardHeader className="pb-2">
                              <CardTitle className="flex items-center gap-2 text-base">
                                <Shield className="h-4 w-4 text-emerald-500" />
                                {s.SiteName}
                                <span className="ml-auto text-xs text-muted-foreground">详情 →</span>
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">请求数</span>
                                  <span className="font-medium">{formatNumber(s.requests || 0)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">流量</span>
                                  <span className="font-medium">{formatBytes(s.bytes || 0)}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </section>
                  </>
                )}
              </TabsContent>

              {/* Cloudflare Tab */}
              <TabsContent value="cloudflare" className="space-y-6">
                {cfStats && (
                  <StatsCards
                    totalRequests={cfStats.totalRequests}
                    totalBytes={cfStats.totalBytes}
                    totalThreats={cfStats.totalThreats}
                    cacheHitRate={cfStats.cacheHitRate}
                    formatNumber={formatNumber}
                    formatBytes={formatBytes}
                  />
                )}

                {cfData?.accounts.map((account) => (
                  <section key={account.name}>
                    <h2 className="mb-4 text-lg font-semibold">{t("account")}: {account.name}</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      {account.zones?.map((zone) => (
                        <div
                          key={zone.domain}
                          role="button"
                          tabIndex={0}
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/zone/cf/${encodeURIComponent(zone.domain)}`);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              router.push(`/zone/cf/${encodeURIComponent(zone.domain)}`);
                            }
                          }}
                        >
                          <TrafficChart
                            title={zone.domain}
                            subtitle={account.name}
                            data={zone}
                            selectedPeriod={selectedPeriod}
                            provider="cloudflare"
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                ))}

                {selectedPeriod === "1day" && <GeographyStats data={cfData} formatNumber={formatNumber} formatBytes={formatBytes} />}

                {/* Cloudflare Workers in CF Tab */}
                {workersData && workersData.totalRequests > 0 && (
                  <section>
                    <div className="mb-4 flex items-center gap-2">
                      <Code className="h-5 w-5 text-cloudflare-orange" />
                      <h2 className="text-lg font-semibold">Cloudflare Workers (24h)</h2>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
                      <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="rounded-full p-3 bg-orange-500/10">
                            <Activity className="h-6 w-6 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">总请求数</p>
                            <p className="text-2xl font-bold">{formatNumber(workersData.totalRequests)}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="rounded-full p-3 bg-red-500/10">
                            <AlertTriangle className="h-6 w-6 text-red-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">错误数</p>
                            <p className="text-2xl font-bold">{formatNumber(workersData.totalErrors)}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="rounded-full p-3 bg-green-500/10">
                            <Shield className="h-6 w-6 text-green-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">成功率</p>
                            <p className="text-2xl font-bold">
                              {workersData.totalRequests > 0 
                                ? ((1 - workersData.totalErrors / workersData.totalRequests) * 100).toFixed(2) 
                                : 100}%
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="rounded-full p-3 bg-blue-500/10">
                            <Code className="h-6 w-6 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Workers 数量</p>
                            <p className="text-2xl font-bold">
                              {workersData.accounts.reduce((sum, a) => sum + a.workers.length, 0)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {workersData.accounts.flatMap((account) =>
                        account.workers.map((worker) => (
                          <Card 
                            key={`cf-tab-${account.account}-${worker.scriptName}`}
                            className="cursor-pointer transition-all hover:shadow-lg hover:border-cloudflare-orange/50"
                            role="button"
                            tabIndex={0}
                            onClick={() => router.push(`/zone/cf/workers/${encodeURIComponent(worker.scriptName)}`)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                router.push(`/zone/cf/workers/${encodeURIComponent(worker.scriptName)}`);
                              }
                            }}
                          >
                            <CardHeader className="pb-2">
                              <CardTitle className="flex items-center gap-2 text-base">
                                <Code className="h-4 w-4 text-cloudflare-orange" />
                                <span className="truncate">{worker.scriptName}</span>
                                <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">详情 →</span>
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">请求数</span>
                                  <span className="font-medium">{formatNumber(worker.requests)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">错误数</span>
                                  <span className={worker.errors > 0 ? "text-red-500 font-medium" : ""}>{formatNumber(worker.errors)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">子请求</span>
                                  <span>{formatNumber(worker.subrequests || 0)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">成功率</span>
                                  <span className={worker.requests > 0 && worker.errors / worker.requests > 0.01 ? "text-yellow-500" : "text-green-500"}>
                                    {worker.requests > 0 ? ((1 - worker.errors / worker.requests) * 100).toFixed(2) : 100}%
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">CPU P50</span>
                                  <span>{(worker.cpuTimeP50 / 1000).toFixed(2)} ms</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">CPU P99</span>
                                  <span>{(worker.cpuTimeP99 / 1000).toFixed(2)} ms</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </section>
                )}
              </TabsContent>

              {/* EdgeOne Tab */}
              <TabsContent value="edgeone" className="space-y-6">
                {/* EdgeOne 概览 */}
                {eoOverview && (eoOverview.totalFlux > 0 || eoOverview.totalRequests > 0) && (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardContent className="flex items-center gap-4 p-6">
                        <div className="rounded-full p-3 bg-blue-500/10">
                          <Database className="h-6 w-6 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">24h 总流量</p>
                          <p className="text-2xl font-bold">{formatBytes(eoOverview.totalFlux)}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="flex items-center gap-4 p-6">
                        <div className="rounded-full p-3 bg-green-500/10">
                          <Activity className="h-6 w-6 text-green-500" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">24h 总请求</p>
                          <p className="text-2xl font-bold">{formatNumber(eoOverview.totalRequests)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {eoZones.map((zone) => (
                    <Card 
                      key={zone.ZoneId}
                      className="cursor-pointer transition-all hover:shadow-lg hover:border-edgeone-blue/50"
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/zone/eo/${zone.ZoneId}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          router.push(`/zone/eo/${zone.ZoneId}`);
                        }
                      }}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Zap className="h-5 w-5 text-edgeone-blue" />
                          {zone.ZoneName}
                          <span className="ml-auto text-xs text-muted-foreground">点击查看详情 →</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Zone ID</span>
                            <span className="font-mono text-xs">{zone.ZoneId.slice(0, 12)}...</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">状态</span>
                            <span className={(zone as { ActiveStatus?: string }).ActiveStatus === "active" ? "text-green-500 font-medium" : "text-yellow-500"}>
                              {(zone as { ActiveStatus?: string }).ActiveStatus === "active" ? "已启用" : (zone as { ActiveStatus?: string }).ActiveStatus || zone.Status}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">类型</span>
                            <span>{zone.Type === "dnsPodAccess" ? "DNSPod 托管" : zone.Type === "partial" ? "CNAME 接入" : zone.Type}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">加速区域</span>
                            <span>{zone.Area === "global" ? "全球" : zone.Area}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">套餐</span>
                            <span className="text-blue-500">{(zone as { PlanType?: string }).PlanType === "plan-free" ? "免费版" : (zone as { PlanType?: string }).PlanType}</span>
                          </div>
                          {zone.CnameSpeedUp && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">CNAME 加速</span>
                              <span className="text-green-500">{zone.CnameSpeedUp === "enabled" ? "已开启" : zone.CnameSpeedUp}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* ESA Tab */}
              <TabsContent value="esa" className="space-y-6">
                {esaLoading && (
                  <div className="space-y-6 animate-pulse">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {[1, 2, 3, 4].map((i) => (
                        <Card key={i}><CardContent className="p-6"><Skeleton className="h-[80px] w-full" /></CardContent></Card>
                      ))}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {[1, 2, 3].map((i) => (
                        <Card key={i}><CardContent className="p-6"><Skeleton className="h-[150px] w-full" /></CardContent></Card>
                      ))}
                    </div>
                  </div>
                )}
                {!esaLoading && hasEsaData && (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="rounded-full p-3 bg-blue-500/10">
                            <Shield className="h-6 w-6 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">账户数</p>
                            <p className="text-2xl font-bold">{esaData?.accounts.length || 0}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="rounded-full p-3 bg-emerald-500/10">
                            <Activity className="h-6 w-6 text-emerald-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">总请求数 (24h)</p>
                            <p className="text-2xl font-bold">{formatNumber(esaSummary.totalRequests)}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="rounded-full p-3 bg-cyan-500/10">
                            <Database className="h-6 w-6 text-cyan-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">总流量 (24h)</p>
                            <p className="text-2xl font-bold">{formatBytes(esaSummary.totalBytes)}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                          <div className="rounded-full p-3 bg-purple-500/10">
                            <Code className="h-6 w-6 text-purple-500" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">边缘函数</p>
                            <p className="text-2xl font-bold">{esaData?.accounts.reduce((sum, a) => sum + (a.routineCount || 0), 0) || 0}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* ESA Sites Grid */}
                    <section>
                      <div className="mb-4 flex items-center gap-2">
                        <Shield className="h-5 w-5 text-emerald-500" />
                        <h2 className="text-lg font-semibold">ESA 站点</h2>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {esaData?.accounts.flatMap((acc) =>
                          (acc.sites || []).map((s) => (
                            <Card 
                              key={`${acc.name}-${s.SiteId}`}
                              className="cursor-pointer transition-all hover:shadow-lg hover:border-emerald-500/50"
                              role="button"
                              tabIndex={0}
                              onClick={() => router.push(`/zone/esa/${encodeURIComponent(s.SiteId || s.SiteName)}`)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  router.push(`/zone/esa/${encodeURIComponent(s.SiteId || s.SiteName)}`);
                                }
                              }}
                            >
                              <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-base">
                                  <Shield className="h-4 w-4 text-emerald-500" />
                                  {s.SiteName}
                                  <span className="ml-auto text-xs text-muted-foreground">点击查看详情 →</span>
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">状态</span>
                                    <Badge variant={s.Status === "active" ? "success" : "secondary"} className="text-xs">
                                      {s.Status || "未知"}
                                    </Badge>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">请求数 (24h)</span>
                                    <span className="font-medium">{formatNumber(s.requests || 0)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">流量 (24h)</span>
                                    <span className="font-medium">{formatBytes(s.bytes || 0)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">账户</span>
                                    <span className="text-xs">{acc.name}</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </section>

                    {/* ESA Routines (Workers) */}
                    {esaData?.accounts.some(a => a.routineCount && a.routineCount > 0) && (
                      <section>
                        <div className="mb-4 flex items-center gap-2">
                          <Code className="h-5 w-5 text-purple-500" />
                          <h2 className="text-lg font-semibold">边缘函数 (Routines)</h2>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {esaData?.accounts.flatMap((acc) =>
                            (acc.routines || []).map((routine) => (
                              <Card key={`${acc.name}-${routine.name}`}>
                                <CardHeader className="pb-2">
                                  <CardTitle className="flex items-center gap-2 text-base">
                                    <Code className="h-4 w-4 text-purple-500" />
                                    {routine.name}
                                    <Badge variant={routine.status === "Running" || routine.status === "deployed" || routine.status === "active" ? "success" : routine.status === "Creating" ? "info" : "secondary"} className="ml-auto text-xs">
                                      {routine.status === "Running" || routine.status === "deployed" ? "运行中" : routine.status === "Creating" ? "创建中" : routine.status === "NotOpened" ? "未开通" : routine.status || "未知"}
                                    </Badge>
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-2 text-sm">
                                    {routine.description && (
                                      <p className="text-muted-foreground text-xs truncate">{routine.description}</p>
                                    )}
                                    {routine.codeVersion && (
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">版本</span>
                                        <span className="font-mono text-xs">{routine.codeVersion}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">账户</span>
                                      <span className="text-xs">{acc.name}</span>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))
                          )}
                        </div>
                      </section>
                    )}

                  </>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container flex flex-col items-center gap-4 px-4 text-center text-sm text-muted-foreground">
          <p>{t("poweredBy")} Cloudflare GraphQL Analytics API, Tencent Cloud EdgeOne API & Aliyun ESA API</p>
          <div className="flex gap-4 flex-wrap justify-center">
            <a
              href="https://developers.cloudflare.com/analytics/graphql-api/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              Cloudflare Docs
            </a>
            <a
              href="https://cloud.tencent.com/document/product/1552"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              EdgeOne Docs
            </a>
            <a
              href="https://help.aliyun.com/zh/edge-security-acceleration/esa/api-esa-2024-09-10-overview"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              Aliyun ESA Docs
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
