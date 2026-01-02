// Cloudflare Types
export interface CFZone {
  domain: string;
  raw: CFDayData[];
  rawHours: CFHourData[];
  geography: CFGeoData[];
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
