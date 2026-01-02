"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EOZone, CFZone } from "@/types";
import { Globe, BarChart3, FileText, MapPin, Loader2, Database, Activity, Shield } from "lucide-react";

interface ZoneDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zone: EOZone | null;
  cfZone?: CFZone | null;
  provider: "edgeone" | "cloudflare";
  formatBytes: (bytes: number) => string;
  formatNumber: (num: number) => string;
}

interface TopDataItem {
  Key: string;
  Value: number;
}

interface TopAnalysisData {
  Data?: Array<{
    Key?: string;
    Value?: number;
    DetailData?: Array<{
      Key: string;
      Value: number;
    }>;
  }>;
}

export function ZoneDetailModal({
  open,
  onOpenChange,
  zone,
  cfZone,
  provider,
  formatBytes,
  formatNumber,
}: ZoneDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [countryData, setCountryData] = useState<TopDataItem[]>([]);
  const [statusCodeData, setStatusCodeData] = useState<TopDataItem[]>([]);
  const [urlData, setUrlData] = useState<TopDataItem[]>([]);
  const [domainData, setDomainData] = useState<TopDataItem[]>([]);

  useEffect(() => {
    if (open && provider === "edgeone" && zone) {
      fetchEOAnalytics();
    } else if (open && provider === "cloudflare" && cfZone) {
      parseCFData();
    }
  }, [open, zone, cfZone, provider]);

  const parseCFData = () => {
    if (!cfZone) return;
    setLoading(true);
    
    // 解析 Cloudflare 地理数据
    const geoMap = new Map<string, { bytes: number; requests: number }>();
    cfZone.geography?.forEach((geo) => {
      geo.sum?.countryMap?.forEach((country: { clientCountryName: string; bytes: number; requests: number }) => {
        const existing = geoMap.get(country.clientCountryName) || { bytes: 0, requests: 0 };
        geoMap.set(country.clientCountryName, {
          bytes: existing.bytes + (country.bytes || 0),
          requests: existing.requests + (country.requests || 0),
        });
      });
    });
    
    const geoArray = Array.from(geoMap.entries())
      .map(([key, value]) => ({ Key: key, Value: value.bytes }))
      .sort((a, b) => b.Value - a.Value)
      .slice(0, 10);
    
    setCountryData(geoArray);
    setStatusCodeData([]); // CF GraphQL 不直接返回状态码分布
    setUrlData([]); // CF GraphQL 不直接返回 URL 分布
    setDomainData([]);
    setLoading(false);
  };

  const fetchEOAnalytics = async () => {
    if (!zone) return;
    setLoading(true);

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startTime = yesterday.toISOString().slice(0, 19) + "Z";
    const endTime = now.toISOString().slice(0, 19) + "Z";

    try {
      const [countryRes, statusRes, urlRes, domainRes] = await Promise.all([
        fetch(`/api/eo/traffic?metric=l7Flow_outFlux_country&zoneId=${zone.ZoneId}&startTime=${startTime}&endTime=${endTime}`),
        fetch(`/api/eo/traffic?metric=l7Flow_outFlux_statusCode&zoneId=${zone.ZoneId}&startTime=${startTime}&endTime=${endTime}`),
        fetch(`/api/eo/traffic?metric=l7Flow_outFlux_url&zoneId=${zone.ZoneId}&startTime=${startTime}&endTime=${endTime}`),
        fetch(`/api/eo/traffic?metric=l7Flow_outFlux_domain&zoneId=${zone.ZoneId}&startTime=${startTime}&endTime=${endTime}`),
      ]);

      const [countryJson, statusJson, urlJson, domainJson] = await Promise.all([
        countryRes.json() as Promise<TopAnalysisData>,
        statusRes.json() as Promise<TopAnalysisData>,
        urlRes.json() as Promise<TopAnalysisData>,
        domainRes.json() as Promise<TopAnalysisData>,
      ]);

      setCountryData(parseTopData(countryJson));
      setStatusCodeData(parseTopData(statusJson));
      setUrlData(parseTopData(urlJson));
      setDomainData(parseTopData(domainJson));
    } catch (err) {
      console.error("Failed to fetch EO analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  const parseTopData = (data: TopAnalysisData): TopDataItem[] => {
    if (!data?.Data) return [];
    // API 返回格式: Data[].DetailData[].{Key, Value}
    const allItems: TopDataItem[] = [];
    data.Data.forEach((item) => {
      if (item.DetailData && Array.isArray(item.DetailData)) {
        item.DetailData.forEach((detail) => {
          allItems.push({
            Key: detail.Key || "Unknown",
            Value: detail.Value || 0,
          });
        });
      } else if (item.Key !== undefined) {
        // 兼容旧格式
        allItems.push({
          Key: item.Key || "Unknown",
          Value: item.Value || 0,
        });
      }
    });
    return allItems.slice(0, 10);
  };

  const getCountryName = (code: string): string => {
    const countryMap: Record<string, string> = {
      CN: "中国",
      US: "美国",
      JP: "日本",
      KR: "韩国",
      DE: "德国",
      FR: "法国",
      GB: "英国",
      SG: "新加坡",
      HK: "中国香港",
      TW: "中国台湾",
      RU: "俄罗斯",
      AU: "澳大利亚",
      CA: "加拿大",
      IN: "印度",
      BR: "巴西",
    };
    return countryMap[code] || code;
  };

  const zoneName = provider === "edgeone" ? zone?.ZoneName : cfZone?.domain;
  
  if (!zone && !cfZone) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {provider === "edgeone" ? (
              <span className="text-edgeone-blue">⚡</span>
            ) : (
              <span className="text-cf-orange">☁️</span>
            )}
            {zoneName} - 详细分析
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">加载分析数据...</span>
          </div>
        ) : (
          <Tabs defaultValue="geography" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="geography" className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                地区分布
              </TabsTrigger>
              <TabsTrigger value="status" className="flex items-center gap-1">
                <BarChart3 className="h-4 w-4" />
                状态码
              </TabsTrigger>
              <TabsTrigger value="domains" className="flex items-center gap-1">
                <Globe className="h-4 w-4" />
                域名
              </TabsTrigger>
              <TabsTrigger value="urls" className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                热门URL
              </TabsTrigger>
            </TabsList>

            <TabsContent value="geography" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">访问地区 TOP 10 (24h 流量)</CardTitle>
                </CardHeader>
                <CardContent>
                  {countryData.length > 0 ? (
                    <div className="space-y-3">
                      {countryData.map((item, idx) => (
                        <div key={item.Key} className="flex items-center gap-3">
                          <span className="w-6 text-sm text-muted-foreground">{idx + 1}</span>
                          <span className="flex-1 font-medium">{getCountryName(item.Key)}</span>
                          <span className="text-blue-500 font-semibold">{formatBytes(item.Value)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">暂无数据</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="status" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">状态码分布 (24h 流量)</CardTitle>
                </CardHeader>
                <CardContent>
                  {statusCodeData.length > 0 ? (
                    <div className="space-y-3">
                      {statusCodeData.map((item, idx) => (
                        <div key={item.Key} className="flex items-center gap-3">
                          <span className="w-6 text-sm text-muted-foreground">{idx + 1}</span>
                          <span className={`flex-1 font-mono font-medium ${
                            item.Key.startsWith("2") ? "text-green-500" :
                            item.Key.startsWith("3") ? "text-blue-500" :
                            item.Key.startsWith("4") ? "text-yellow-500" :
                            item.Key.startsWith("5") ? "text-red-500" : ""
                          }`}>
                            {item.Key}
                          </span>
                          <span className="font-semibold">{formatBytes(item.Value)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">暂无数据</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="domains" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">域名流量 TOP 10 (24h)</CardTitle>
                </CardHeader>
                <CardContent>
                  {domainData.length > 0 ? (
                    <div className="space-y-3">
                      {domainData.map((item, idx) => (
                        <div key={item.Key} className="flex items-center gap-3">
                          <span className="w-6 text-sm text-muted-foreground">{idx + 1}</span>
                          <span className="flex-1 font-mono text-sm truncate">{item.Key}</span>
                          <span className="text-blue-500 font-semibold">{formatBytes(item.Value)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">暂无数据</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="urls" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">热门 URL TOP 10 (24h 流量)</CardTitle>
                </CardHeader>
                <CardContent>
                  {urlData.length > 0 ? (
                    <div className="space-y-3">
                      {urlData.map((item, idx) => (
                        <div key={item.Key} className="flex items-center gap-3">
                          <span className="w-6 text-sm text-muted-foreground">{idx + 1}</span>
                          <span className="flex-1 font-mono text-xs truncate" title={item.Key}>{item.Key}</span>
                          <span className="text-blue-500 font-semibold whitespace-nowrap">{formatBytes(item.Value)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">暂无数据</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
