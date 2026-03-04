"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveTabs } from "@/components/ui/responsive-tabs";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Code, Activity, AlertTriangle, Cpu, Clock, Zap, TrendingUp, Server } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell
} from "recharts";

const COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6"];

/*
WORKER_TAB_ITEMS Workers 详情页标签项定义
@功能 定义 Workers 详情页的所有标签页
*/
const WORKER_TAB_ITEMS = [
  { value: "overview", label: "概览" },
  { value: "trends", label: "请求趋势" },
  { value: "errors", label: "错误分析" },
  { value: "cpu", label: "CPU 性能" },
  { value: "quota", label: "配额使用" },
  { value: "comparison", label: "Workers 对比" },
];

interface WorkerData {
  scriptName: string;
  requests: number;
  errors: number;
  subrequests: number;
  cpuTimeP50: number;
  cpuTimeP99: number;
}

interface AccountData {
  account: string;
  workers: WorkerData[];
  totalRequests: number;
  totalErrors: number;
  quota?: {
    dailyRequestLimit: number;
    dailyRequestUsed: number;
    cpuTimeLimit: number;
    plan: string;
  };
}

export default function WorkerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const scriptName = decodeURIComponent(params.scriptName as string);

  const [worker, setWorker] = useState<WorkerData | null>(null);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [allWorkers, setAllWorkers] = useState<{ account: string; worker: WorkerData }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  /* 时序数据状态 */
  const [timeseries, setTimeseries] = useState<{ time: string; requests: number; errors: number; subrequests: number; cpuP50: number; cpuP99: number; errorRate: number }[]>([]);
  const [statusDist, setStatusDist] = useState<{ name: string; value: number }[]>([]);
  const [tsLoaded, setTsLoaded] = useState(false);

  useEffect(() => {
    fetchWorkerData();
  }, [scriptName]);

  /*
  懒加载时序数据 - 切换到趋势/错误/CPU标签时触发
  @功能 获取按小时分组的请求/错误/CPU时序数据和状态分布
  */
  useEffect(() => {
    if (tsLoaded || !scriptName || loading) return;
    if (!["trends", "errors", "cpu"].includes(activeTab)) return;
    setTsLoaded(true);
    fetch(`/api/cf/workers/timeseries?scriptName=${encodeURIComponent(scriptName)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.timeseries) setTimeseries(data.timeseries);
        if (data.statusDistribution) setStatusDist(data.statusDistribution);
      })
      .catch((err) => console.error("Workers timeseries error:", err));
  }, [activeTab, scriptName, loading, tsLoaded]);

  const fetchWorkerData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cf/workers");
      const data = await res.json();
      
      const workers: { account: string; worker: WorkerData }[] = [];
      
      for (const acc of data.accounts || []) {
        for (const w of acc.workers || []) {
          workers.push({ account: acc.account, worker: w });
          if (w.scriptName === scriptName) {
            setWorker(w);
            setAccount(acc);
          }
        }
      }
      setAllWorkers(workers);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const successRate = useMemo(() => {
    if (!worker || worker.requests === 0) return 100;
    return ((1 - worker.errors / worker.requests) * 100);
  }, [worker]);

  const quotaUsagePercent = useMemo(() => {
    if (!account?.quota) return 0;
    return (account.quota.dailyRequestUsed / account.quota.dailyRequestLimit) * 100;
  }, [account]);

  const pieData = useMemo(() => {
    if (!worker) return [];
    return [
      { name: "成功", value: worker.requests - worker.errors },
      { name: "错误", value: worker.errors },
    ].filter(d => d.value > 0);
  }, [worker]);

  const comparisonData = useMemo(() => {
    return allWorkers
      .map(({ account, worker: w }) => ({
        name: w.scriptName.length > 12 ? w.scriptName.slice(0, 12) + "..." : w.scriptName,
        fullName: w.scriptName,
        requests: w.requests,
        errors: w.errors,
        cpuP50: w.cpuTimeP50 / 1000,
        cpuP99: w.cpuTimeP99 / 1000,
        account,
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);
  }, [allWorkers]);

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
        </main>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-4">
        <p className="text-muted-foreground">未找到该 Worker 数据</p>
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
            <Code className="h-5 w-5 sm:h-6 sm:w-6 text-cloudflare-orange flex-shrink-0" />
            <h1 className="text-base sm:text-xl font-bold truncate">{scriptName}</h1>
          </div>
          <Badge variant="info" className="flex-shrink-0">Worker</Badge>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-7xl">
        {/* Overview Cards - Row 1 */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-orange-500/20">
                <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">24h 请求</p>
                <p className="text-lg sm:text-2xl font-bold text-orange-600 dark:text-orange-400">{formatNumber(worker.requests)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-red-500/20">
                <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">错误数</p>
                <p className="text-lg sm:text-2xl font-bold text-red-600 dark:text-red-400">{formatNumber(worker.errors)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-green-500/20">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">成功率</p>
                <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">{successRate.toFixed(2)}%</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-blue-500/20">
                <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">子请求</p>
                <p className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{formatNumber(worker.subrequests)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overview Cards - Row 2 */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-purple-500/20">
                <Cpu className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">CPU P50</p>
                <p className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{(worker.cpuTimeP50 / 1000).toFixed(2)} ms</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-cyan-500/20">
                <Cpu className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">CPU P99</p>
                <p className="text-lg sm:text-2xl font-bold text-cyan-600 dark:text-cyan-400">{(worker.cpuTimeP99 / 1000).toFixed(2)} ms</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-indigo-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-indigo-500/20">
                <Server className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">账户</p>
                <p className="text-base sm:text-lg font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-[100px]">{account?.account || "-"}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border-pink-500/20">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
              <div className="rounded-full p-2 sm:p-3 bg-pink-500/20">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-pink-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">套餐</p>
                <p className="text-base sm:text-lg font-bold text-pink-600 dark:text-pink-400">{account?.quota?.plan || "free"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <ResponsiveTabs
          tabs={WORKER_TAB_ITEMS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          accentColor="bg-cloudflare-orange"
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Success/Error Pie Chart */}
              <Card>
                <CardHeader><CardTitle>请求状态分布</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[250px] sm:h-[300px]">
                    {pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? "#10B981" : "#EF4444"} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatNumber(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">暂无数据</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Worker Details */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Code className="h-5 w-5" /> Worker 详情</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">脚本名称</p>
                      <p className="font-mono text-sm break-all">{worker.scriptName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">所属账户</p>
                      <p className="font-medium">{account?.account || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">账户 Workers 总数</p>
                      <p className="font-medium">{account?.workers?.length || 0}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">账户总请求</p>
                      <p className="font-medium">{formatNumber(account?.totalRequests || 0)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">账户总错误</p>
                      <p className="font-medium text-red-500">{formatNumber(account?.totalErrors || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 请求趋势 */}
          <TabsContent value="trends" className="space-y-4">
            {timeseries.length > 0 ? (
              <>
                <Card>
                  <CardHeader><CardTitle>请求数趋势 (24h)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[300px] sm:h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={timeseries}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                          <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number) => formatNumber(v)} />
                          <Bar dataKey="requests" fill="#F6821F" name="请求数" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>子请求趋势 (24h)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[250px] sm:h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={timeseries}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                          <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number) => formatNumber(v)} />
                          <Line type="monotone" dataKey="subrequests" stroke="#3B82F6" strokeWidth={2} dot={false} name="子请求" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card><CardContent className="py-12 text-center text-muted-foreground">{tsLoaded ? "暂无时序数据" : "加载中..."}</CardContent></Card>
            )}
          </TabsContent>

          {/* 错误分析 */}
          <TabsContent value="errors" className="space-y-4">
            {timeseries.length > 0 || statusDist.length > 0 ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader><CardTitle>错误数趋势 (24h)</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-[250px] sm:h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={timeseries}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                            <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(v: number) => formatNumber(v)} />
                            <Bar dataKey="errors" fill="#EF4444" name="错误数" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>错误率趋势 (24h)</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-[250px] sm:h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={timeseries}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                            <YAxis tickFormatter={(v) => `${v.toFixed(1)}%`} tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
                            <Line type="monotone" dataKey="errorRate" stroke="#F59E0B" strokeWidth={2} dot={false} name="错误率" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                {/* 状态分布 */}
                {statusDist.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>请求状态分布 (24h)</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={statusDist} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}>
                                {statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                              </Pie>
                              <Tooltip formatter={(v: number) => formatNumber(v)} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-3">
                          {statusDist.map((item, i) => (
                            <div key={i} className="flex items-center gap-4">
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <div className="flex-1">
                                <p className="text-sm font-medium">{item.name}</p>
                                <div className="h-2 bg-muted rounded-full mt-1">
                                  <div className="h-full rounded-full" style={{ width: `${(item.value / (statusDist[0]?.value || 1)) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                                </div>
                              </div>
                              <span className="text-sm text-muted-foreground">{formatNumber(item.value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card><CardContent className="py-12 text-center text-muted-foreground">{tsLoaded ? "暂无错误数据" : "加载中..."}</CardContent></Card>
            )}
          </TabsContent>

          {/* CPU 性能 */}
          <TabsContent value="cpu" className="space-y-4">
            {timeseries.length > 0 ? (
              <>
                <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                  <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                    <CardContent className="p-4 sm:p-6">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">CPU P50</p>
                      <p className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{(worker?.cpuTimeP50 || 0) / 1000} ms</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
                    <CardContent className="p-4 sm:p-6">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">CPU P99</p>
                      <p className="text-lg sm:text-2xl font-bold text-cyan-600 dark:text-cyan-400">{(worker?.cpuTimeP99 || 0) / 1000} ms</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                    <CardContent className="p-4 sm:p-6">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">P50 趋势最大值</p>
                      <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">{timeseries.length > 0 ? Math.max(...timeseries.map(d => d.cpuP50)).toFixed(2) : 0} ms</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                    <CardContent className="p-4 sm:p-6">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">P99 趋势最大值</p>
                      <p className="text-lg sm:text-2xl font-bold text-orange-600 dark:text-orange-400">{timeseries.length > 0 ? Math.max(...timeseries.map(d => d.cpuP99)).toFixed(2) : 0} ms</p>
                    </CardContent>
                  </Card>
                </div>
                <Card>
                  <CardHeader><CardTitle>CPU 时间趋势 (24h)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[300px] sm:h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={timeseries}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                          <YAxis tickFormatter={(v) => `${v} ms`} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: number) => `${v.toFixed(2)} ms`} />
                          <Line type="monotone" dataKey="cpuP50" stroke="#8B5CF6" strokeWidth={2} dot={false} name="CPU P50" />
                          <Line type="monotone" dataKey="cpuP99" stroke="#06B6D4" strokeWidth={2} dot={false} name="CPU P99" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card><CardContent className="py-12 text-center text-muted-foreground">{tsLoaded ? "暂无 CPU 数据" : "加载中..."}</CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="quota" className="space-y-4">
            {account?.quota ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>每日请求配额</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm">
                        <span>已使用</span>
                        <span>{formatNumber(account.quota.dailyRequestUsed)} / {formatNumber(account.quota.dailyRequestLimit)}</span>
                      </div>
                      <div className="h-4 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            quotaUsagePercent > 90 ? "bg-red-500" : quotaUsagePercent > 70 ? "bg-yellow-500" : "bg-green-500"
                          }`}
                          style={{ width: `${Math.min(100, quotaUsagePercent)}%` }} 
                        />
                      </div>
                      <p className="text-sm text-muted-foreground text-center">{quotaUsagePercent.toFixed(2)}% 已使用</p>
                      <div className="pt-4 border-t">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-muted-foreground">剩余配额</span>
                          <span className="font-medium text-green-500">{formatNumber(account.quota.dailyRequestLimit - account.quota.dailyRequestUsed)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">套餐类型</span>
                          <Badge variant="outline">{account.quota.plan}</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>CPU 时间限制</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="text-center py-8">
                        <p className="text-4xl font-bold text-cloudflare-orange">{account.quota.cpuTimeLimit} ms</p>
                        <p className="text-muted-foreground mt-2">每次请求 CPU 时间上限</p>
                      </div>
                      <div className="pt-4 border-t space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">当前 P50</span>
                          <span className={worker.cpuTimeP50 / 1000 > account.quota.cpuTimeLimit * 0.8 ? "text-yellow-500" : "text-green-500"}>
                            {(worker.cpuTimeP50 / 1000).toFixed(2)} ms
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">当前 P99</span>
                          <span className={worker.cpuTimeP99 / 1000 > account.quota.cpuTimeLimit * 0.8 ? "text-yellow-500" : "text-green-500"}>
                            {(worker.cpuTimeP99 / 1000).toFixed(2)} ms
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  暂无配额数据
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="comparison" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Workers 请求数对比 (Top 10)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px] sm:h-[400px]">
                  {comparisonData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comparisonData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tickFormatter={(v) => formatNumber(v)} />
                        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                        <Tooltip 
                          formatter={(v: number) => formatNumber(v)}
                          labelFormatter={(label) => comparisonData.find(d => d.name === label)?.fullName || label}
                        />
                        <Bar dataKey="requests" fill="#F6821F" name="请求数" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">暂无数据</div>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Workers CPU 时间对比 (Top 10)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px] sm:h-[400px]">
                  {comparisonData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comparisonData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" unit=" ms" />
                        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                        <Tooltip 
                          formatter={(v: number) => `${v.toFixed(2)} ms`}
                          labelFormatter={(label) => comparisonData.find(d => d.name === label)?.fullName || label}
                        />
                        <Bar dataKey="cpuP50" fill="#8B5CF6" name="CPU P50" />
                        <Bar dataKey="cpuP99" fill="#06B6D4" name="CPU P99" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">暂无数据</div>
                  )}
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
