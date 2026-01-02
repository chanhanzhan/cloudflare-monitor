"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Activity, Database, Shield, Gauge } from "lucide-react";

interface StatsCardsProps {
  totalRequests: number;
  totalBytes: number;
  totalThreats: number;
  cacheHitRate: string;
  formatNumber: (num: number) => string;
  formatBytes: (bytes: number) => string;
}

export function StatsCards({
  totalRequests,
  totalBytes,
  totalThreats,
  cacheHitRate,
  formatNumber,
  formatBytes,
}: StatsCardsProps) {
  const stats = [
    {
      title: "总请求数",
      value: formatNumber(totalRequests),
      icon: Activity,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "总流量",
      value: formatBytes(totalBytes),
      icon: Database,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "安全威胁",
      value: formatNumber(totalThreats),
      icon: Shield,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      title: "缓存命中率",
      value: `${cacheHitRate}%`,
      icon: Gauge,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardContent className="flex items-center gap-4 p-6">
            <div className={`rounded-full p-3 ${stat.bgColor}`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{stat.title}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
