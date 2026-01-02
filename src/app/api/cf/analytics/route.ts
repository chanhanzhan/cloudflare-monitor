import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CFZone {
  id: string;
  name: string;
  status: string;
  account: {
    id: string;
    name: string;
  };
}

interface CFZonesResponse {
  success: boolean;
  errors: unknown[];
  result: CFZone[];
  result_info: {
    page: number;
    per_page: number;
    total_pages: number;
    total_count: number;
  };
}

interface AccountConfig {
  name: string;
  apiKey: string;
  email: string;
  domains?: string[]; // 域名过滤列表，为空则显示全部
}

function parseAccountConfigs(): AccountConfig[] {
  const accounts: AccountConfig[] = [];

  // 方式一: 单账户配置 CF_API_KEY + CF_EMAIL
  const singleApiKey = process.env.CF_API_KEY;
  const singleEmail = process.env.CF_EMAIL;
  const singleDomains = process.env.CF_DOMAINS?.split(",").map(d => d.trim()).filter(Boolean);

  if (singleApiKey && singleEmail) {
    accounts.push({
      name: process.env.CF_ACCOUNT_NAME || "默认账户",
      apiKey: singleApiKey,
      email: singleEmail,
      domains: singleDomains,
    });
  }

  // 方式二: 多账户配置 CF_API_KEY_1, CF_EMAIL_1, CF_DOMAINS_1, ...
  let index = 1;
  while (process.env[`CF_API_KEY_${index}`] && process.env[`CF_EMAIL_${index}`]) {
    const domains = process.env[`CF_DOMAINS_${index}`]?.split(",").map(d => d.trim()).filter(Boolean);
    accounts.push({
      name: process.env[`CF_ACCOUNT_NAME_${index}`] || `账户 ${index}`,
      apiKey: process.env[`CF_API_KEY_${index}`]!,
      email: process.env[`CF_EMAIL_${index}`]!,
      domains,
    });
    index++;
  }

  return accounts;
}

function getAuthHeaders(apiKey: string, email: string): Record<string, string> {
  return {
    "X-Auth-Key": apiKey,
    "X-Auth-Email": email,
    "Content-Type": "application/json",
  };
}

async function fetchAllZones(headers: Record<string, string>): Promise<CFZone[]> {
  const allZones: CFZone[] = [];
  let page = 1;
  const perPage = 50;

  while (true) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones?page=${page}&per_page=${perPage}`,
      { method: "GET", headers }
    );

    const data: CFZonesResponse = await response.json();

    if (!data.success || !data.result) {
      console.error("Failed to fetch zones:", data.errors);
      break;
    }

    allZones.push(...data.result);

    if (page >= data.result_info.total_pages) {
      break;
    }
    page++;
  }

  return allZones;
}

async function fetchZoneData(headers: Record<string, string>, zoneId: string, domain: string) {
  const daysSince = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const daysUntil = new Date().toISOString().slice(0, 10);
  const hoursSince = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const hoursUntil = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const daysQuery = `
    query($zone: String!, $since: Date!, $until: Date!) {
      viewer {
        zones(filter: {zoneTag: $zone}) {
          httpRequests1dGroups(
            filter: {date_geq: $since, date_leq: $until}
            limit: 100
            orderBy: [date_DESC]
          ) {
            dimensions { date }
            sum { requests bytes threats cachedRequests cachedBytes }
          }
        }
      }
    }`;

  const hoursQuery = `
    query($zone: String!, $since: Time!, $until: Time!) {
      viewer {
        zones(filter: {zoneTag: $zone}) {
          httpRequests1hGroups(
            filter: {datetime_geq: $since, datetime_leq: $until}
            limit: 200
            orderBy: [datetime_DESC]
          ) {
            dimensions { datetime }
            sum { requests bytes threats cachedRequests cachedBytes }
          }
        }
      }
    }`;

  const geoQuery = `
    query($zone: String!, $since: Date!, $until: Date!) {
      viewer {
        zones(filter: {zoneTag: $zone}) {
          httpRequests1dGroups(
            filter: {date_geq: $since, date_leq: $until}
            limit: 100
            orderBy: [date_DESC]
          ) {
            dimensions { date }
            sum {
              countryMap { bytes requests threats clientCountryName }
            }
          }
        }
      }
    }`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const fetchWithTimeout = (body: string) => 
      fetch("https://api.cloudflare.com/client/v4/graphql", {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

    const [daysRes, hoursRes, geoRes] = await Promise.all([
      fetchWithTimeout(JSON.stringify({
        query: daysQuery,
        variables: { zone: zoneId, since: daysSince, until: daysUntil },
      })),
      fetchWithTimeout(JSON.stringify({
        query: hoursQuery,
        variables: { zone: zoneId, since: hoursSince, until: hoursUntil },
      })),
      fetchWithTimeout(JSON.stringify({
        query: geoQuery,
        variables: { zone: zoneId, since: daysSince, until: daysUntil },
      })),
    ]);
    
    clearTimeout(timeoutId);

    const [daysData, hoursData, geoData] = await Promise.all([
      daysRes.json(),
      hoursRes.json(),
      geoRes.json(),
    ]);

    const zoneData: {
      domain: string;
      raw: unknown[];
      rawHours: unknown[];
      geography: unknown[];
      error?: string;
    } = {
      domain,
      raw: [],
      rawHours: [],
      geography: [],
    };

    // Process days data
    if (daysData.data?.viewer?.zones?.[0]?.httpRequests1dGroups) {
      zoneData.raw = daysData.data.viewer.zones[0].httpRequests1dGroups;
    }

    // Process hours data
    if (hoursData.data?.viewer?.zones?.[0]?.httpRequests1hGroups) {
      zoneData.rawHours = hoursData.data.viewer.zones[0].httpRequests1hGroups;
    }

    // Process geo data
    if (geoData.data?.viewer?.zones?.[0]?.httpRequests1dGroups) {
      const rawGeoData = geoData.data.viewer.zones[0].httpRequests1dGroups;
      const countryStats: Record<string, { dimensions: { clientCountryName: string }; sum: { requests: number; bytes: number; threats: number } }> = {};

      rawGeoData.forEach((record: { sum?: { countryMap?: Array<{ clientCountryName: string; requests: number; bytes: number; threats: number }> } }) => {
        if (record.sum?.countryMap && Array.isArray(record.sum.countryMap)) {
          record.sum.countryMap.forEach((countryData) => {
            const country = countryData.clientCountryName;
            if (country && country !== "Unknown" && country !== "") {
              if (!countryStats[country]) {
                countryStats[country] = {
                  dimensions: { clientCountryName: country },
                  sum: { requests: 0, bytes: 0, threats: 0 },
                };
              }
              countryStats[country].sum.requests += countryData.requests || 0;
              countryStats[country].sum.bytes += countryData.bytes || 0;
              countryStats[country].sum.threats += countryData.threats || 0;
            }
          });
        }
      });

      zoneData.geography = Object.values(countryStats)
        .sort((a, b) => b.sum.requests - a.sum.requests)
        .slice(0, 15);
    }

    return zoneData;
  } catch (error) {
    console.error(`Zone ${domain} fetch error:`, error);
    return {
      domain,
      raw: [],
      rawHours: [],
      geography: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const accountConfigs = parseAccountConfigs();

    if (accountConfigs.length === 0) {
      return NextResponse.json(
        { error: "请配置 CF_API_KEY 和 CF_EMAIL", accounts: [] },
        { status: 200 }
      );
    }

    const payload: { accounts: { name: string; zones: unknown[] }[] } = { accounts: [] };

    for (const config of accountConfigs) {
      const headers = getAuthHeaders(config.apiKey, config.email);
      
      // 获取该账户下所有域名
      const allZones = await fetchAllZones(headers);

      if (allZones.length === 0) {
        continue;
      }

      // 如果配置了域名列表，则过滤只显示列表中的域名
      let zonesToFetch: CFZone[];
      if (config.domains && config.domains.length > 0) {
        const domainSet = new Set(config.domains.map(d => d.toLowerCase()));
        zonesToFetch = allZones.filter(zone => domainSet.has(zone.name.toLowerCase()));
      } else {
        // 未配置域名列表则显示全部（限制数量避免超时）
        zonesToFetch = allZones.slice(0, 20);
      }

      if (zonesToFetch.length === 0) {
        continue;
      }

      const accountData: { name: string; zones: unknown[] } = { name: config.name, zones: [] };

      // 并行获取每个域名的分析数据
      const zonePromises = zonesToFetch.map((zone: CFZone) =>
        fetchZoneData(headers, zone.id, zone.name)
      );

      accountData.zones = await Promise.all(zonePromises);
      payload.accounts.push(accountData);
    }

    if (payload.accounts.length === 0) {
      return NextResponse.json(
        { error: "未找到任何匹配的域名，请检查配置", accounts: [] },
        { status: 200 }
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("CF Analytics API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error", accounts: [] },
      { status: 500 }
    );
  }
}
