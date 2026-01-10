// Cloudflare Types
export interface CFZone {
  domain: string;
  raw: CFDayData[];
  rawHours: CFHourData[];
  geography: CFGeoData[];
  browsers?: { name: string; pageViews: number }[];
  statusCodes?: { name: string; requests: number }[];
  contentTypes?: { name: string; bytes: number; requests: number }[];
  sslVersions?: { name: string; requests: number }[];
  httpVersions?: { name: string; requests: number }[];
  error?: string;
}

export interface CFDayData {
  dimensions: {
    date: string;
  };
  sum: {
    requests: number;
    bytes: number;
    threats: number;
    cachedRequests: number;
    cachedBytes: number;
  };
}

export interface CFHourData {
  dimensions: {
    datetime: string;
  };
  sum: {
    requests: number;
    bytes: number;
    threats: number;
    cachedRequests: number;
    cachedBytes: number;
  };
}

export interface CFGeoData {
  dimensions: {
    date: string;
  };
  sum: {
    requests: number;
    bytes: number;
    threats: number;
    countryMap?: Array<{
      clientCountryName: string;
      bytes: number;
      requests: number;
      threats: number;
    }>;
  };
}

export interface CFAccount {
  name: string;
  zones: CFZone[];
}

export interface CFAnalyticsData {
  accounts: CFAccount[];
}

// EdgeOne Types
export interface EOZone {
  ZoneId: string;
  ZoneName: string;
  OriginalNameServers?: string[];
  NameServers?: string[];
  Status?: string;
  Type?: string;
  Paused?: boolean;
  CnameSpeedUp?: string;
  CnameStatus?: string;
  Tags?: string[];
  Area?: string;
  Resources?: EOZoneResource[];
  traffic?: {
    totalFlux: number;
    totalRequests: number;
    timingData?: unknown[];
  };
}

export interface EOZoneResource {
  Id: string;
  Type: string;
  Resource: string;
  CreateTime: string;
  Status: string;
}

export interface EOTrafficData {
  Data: {
    MetricName: string;
    DetailData: {
      Time: string;
      Value: number;
    }[];
  }[];
  TotalCount?: number;
}

export interface EOTopData {
  Data: {
    DetailData: {
      Name: string;
      Value: number;
    }[];
  }[];
}

export interface EOZonesResponse {
  Zones: EOZone[];
  TotalCount: number;
}

// Dashboard Types
export type TimePeriod = "1day" | "3days" | "7days" | "30days";

export interface StatsCardData {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export interface ChartDataPoint {
  time: string;
  requests: number;
  bandwidth: number;
  threats?: number;
  cached?: number;
}

// Aliyun ESA Types
export interface ESASite {
  SiteId: string;
  SiteName: string;
  Status?: string;
  DomainCount?: number;
  Type?: string;
  Coverage?: string;
  CnameStatus?: string;
  Area?: string;
  AccessType?: string;
  PlanType?: string;
  InstanceId?: string;
  Traffic?: {
    requests: number;
    bytes: number;
  };
  requests?: number;
  bytes?: number;
  timeSeriesRequests?: { time: string; value: number }[];
  timeSeriesTraffic?: { time: string; value: number }[];
}

export interface ESAQuota {
  quotaName: string;
  total: number;
  used: number;
}

export interface ESARoutine {
  name: string;
  description?: string;
  codeVersion?: string;
  status?: string;
  createTime?: string;
  updateTime?: string;
}

export interface ESAEdgeRoutinePlan {
  PlanName?: string;
  RequestQuota?: number;
  RequestUsed?: number;
  CpuTimeQuota?: number;
  CpuTimeUsed?: number;
  Status?: string;
}

export interface ESAErService {
  Status?: string;
  PlanName?: string;
  RequestQuota?: number;
  RequestUsed?: number;
  CpuTimeQuota?: number;
  CpuTimeUsed?: number;
}

export interface ESAAccount {
  name: string;
  sites: ESASite[];
  quotas: ESAQuota[];
  totalRequests: number;
  totalBytes: number;
  instanceId?: string;
  quotaSource?: string;
  routines?: ESARoutine[];
  routineCount?: number;
  edgeRoutinePlans?: ESAEdgeRoutinePlan[];
  erService?: ESAErService;
}

export interface ESAData {
  accounts: ESAAccount[];
}

// CF Workers quota
export interface CFWorkerQuota {
  account: string;
  plan?: string;
  total?: number;
  used?: number;
  remaining?: number;
  period?: string;
}
