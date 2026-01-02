"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe } from "lucide-react";
import type { CFAnalyticsData } from "@/types";

interface GeographyStatsProps {
  data: CFAnalyticsData | null;
  formatNumber: (num: number) => string;
  formatBytes: (bytes: number) => string;
}

export function GeographyStats({ data, formatNumber, formatBytes }: GeographyStatsProps) {
  const geoData = useMemo(() => {
    if (!data?.accounts) return [];

    const countryStats: Record<string, { requests: number; bytes: number; threats: number }> = {};

    data.accounts.forEach((account) => {
      account.zones?.forEach((zone) => {
        zone.geography?.forEach((geo) => {
          // 从 countryMap 获取国家数据
          geo.sum.countryMap?.forEach((country) => {
            const countryName = country.clientCountryName;
            if (!countryStats[countryName]) {
              countryStats[countryName] = { requests: 0, bytes: 0, threats: 0 };
            }
            countryStats[countryName].requests += country.requests || 0;
            countryStats[countryName].bytes += country.bytes || 0;
            countryStats[countryName].threats += country.threats || 0;
          });
        });
      });
    });

    return Object.entries(countryStats)
      .map(([country, stats]) => ({
        country,
        ...stats,
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);
  }, [data]);

  if (geoData.length === 0) {
    return null;
  }

  const maxRequests = Math.max(...geoData.map((g) => g.requests));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          访问国家/地区 TOP 10
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {geoData.map((geo, index) => (
            <div key={geo.country} className="flex items-center gap-4">
              <span className="w-6 text-center text-sm font-medium text-muted-foreground">
                {index + 1}
              </span>
              <div className="flex-1">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{geo.country}</span>
                  <div className="flex gap-4 text-muted-foreground">
                    <span>{formatNumber(geo.requests)} 请求</span>
                    <span>{formatBytes(geo.bytes)}</span>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(geo.requests / maxRequests) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
