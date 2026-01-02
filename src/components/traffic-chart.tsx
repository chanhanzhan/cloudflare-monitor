"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Cloud, Zap } from "lucide-react";
import type { CFZone, TimePeriod } from "@/types";
import { formatBytes, formatCompactNumber } from "@/lib/utils";

interface TrafficChartProps {
  title: string;
  subtitle?: string;
  data: CFZone;
  selectedPeriod: TimePeriod;
  provider: "cloudflare" | "edgeone";
}

export function TrafficChart({
  title,
  subtitle,
  data,
  selectedPeriod,
  provider,
}: TrafficChartProps) {
  const chartData = useMemo(() => {
    const useHourlyData = selectedPeriod === "1day" || selectedPeriod === "3days";
    const rawData = useHourlyData ? data.rawHours || [] : data.raw || [];

    const sortedData = rawData
      .filter((d) => d && d.dimensions && d.sum)
      .sort((a, b) => {
        const aTime = useHourlyData
          ? (a as { dimensions: { datetime: string } }).dimensions.datetime
          : (a as { dimensions: { date: string } }).dimensions.date;
        const bTime = useHourlyData
          ? (b as { dimensions: { datetime: string } }).dimensions.datetime
          : (b as { dimensions: { date: string } }).dimensions.date;
        return new Date(aTime).getTime() - new Date(bTime).getTime();
      });

    let periodData;
    if (useHourlyData) {
      const periodHours = selectedPeriod === "1day" ? 24 : 72;
      periodData = sortedData.slice(-Math.min(sortedData.length, periodHours));
    } else {
      const periodDays = selectedPeriod === "7days" ? 7 : 30;
      periodData = sortedData.slice(-Math.min(sortedData.length, periodDays));
    }

    return periodData.map((item) => {
      const time = useHourlyData
        ? (item as { dimensions: { datetime: string } }).dimensions.datetime
        : (item as { dimensions: { date: string } }).dimensions.date;

      const date = new Date(time);
      let label: string;
      if (useHourlyData) {
        label = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
      } else {
        label = `${date.getMonth() + 1}/${date.getDate()}`;
      }

      return {
        time: label,
        requests: item.sum.requests,
        bandwidth: item.sum.bytes,
        cached: item.sum.cachedRequests,
      };
    });
  }, [data, selectedPeriod]);

  const Icon = provider === "cloudflare" ? Cloud : Zap;
  const iconColor = provider === "cloudflare" ? "text-cloudflare-orange" : "text-edgeone-blue";
  const lineColor = provider === "cloudflare" ? "#F38020" : "#006EFF";

  if (data.error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className={`h-4 w-4 ${iconColor}`} />
            {title}
          </CardTitle>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{data.error}</p>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className={`h-4 w-4 ${iconColor}`} />
            {title}
          </CardTitle>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">暂无数据</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          {title}
          <span className="ml-auto text-xs font-normal text-muted-foreground">点击查看详情 →</span>
        </CardTitle>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%" style={{ pointerEvents: 'none' }}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCompactNumber(value)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
                formatter={(value: number, name: string) => {
                  if (name === "bandwidth") {
                    return [formatBytes(value), "流量"];
                  }
                  return [formatCompactNumber(value), name === "requests" ? "请求数" : "缓存请求"];
                }}
              />
              <Legend
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    requests: "请求数",
                    bandwidth: "流量",
                    cached: "缓存请求",
                  };
                  return labels[value] || value;
                }}
              />
              <Line
                type="monotone"
                dataKey="requests"
                stroke={lineColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="cached"
                stroke="#10B981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
