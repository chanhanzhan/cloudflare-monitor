import { NextRequest, NextResponse } from "next/server";
import * as cache from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_KEY = "cf_analytics";
const CACHE_TTL = 3 * 60 * 1000; /* 3 分钟 */

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
            sum {
              requests bytes threats cachedRequests cachedBytes
              pageViews encryptedBytes encryptedRequests
            }
            uniq { uniques }
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
            sum {
              requests bytes threats cachedRequests cachedBytes
              pageViews encryptedBytes encryptedRequests
            }
            uniq { uniques }
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

  const clientQuery = `
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
              browserMap { pageViews uaBrowserFamily }
              clientSSLMap { requests clientSSLProtocol }
              clientHTTPVersionMap { requests clientHTTPProtocol }
              responseStatusMap { requests edgeResponseStatus }
              contentTypeMap { bytes requests edgeResponseContentTypeName }
              threatPathingMap { requests threatPathingName }
              ipClassMap { requests ipType }
            }
          }
        }
      }
    }`;

  /*
  methodQuery 使用 httpRequestsAdaptiveGroups 获取 HTTP 请求方法分布
  @功能 独立查询避免影响其他客户端数据
  @注意 httpRequestsAdaptiveGroups 最大查询范围为 86400 秒，需使用 Time 类型精确控制
  */
  const methodQuery = `
    query($zone: String!, $since: Time!, $until: Time!) {
      viewer {
        zones(filter: {zoneTag: $zone}) {
          httpRequestsAdaptiveGroups(
            filter: {datetime_geq: $since, datetime_leq: $until}
            limit: 20
            orderBy: [count_DESC]
          ) {
            count
            dimensions { clientRequestHTTPMethodName }
          }
        }
      }
    }`;

  try {
    /*
    fetchGQL 独立超时的 GraphQL 请求封装
    @param body 请求体字符串
    @param timeoutMs 超时时间（毫秒），默认 30000
    @return GraphQL 响应 JSON
    */
    const fetchGQL = async (body: string, timeoutMs = 30000) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
        });
        return await res.json();
      } finally {
        clearTimeout(timeoutId);
      }
    };

    /* 客户端详细数据使用较短的日期范围（30天），减少 GraphQL 查询复杂度 */
    const clientSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [daysData, hoursData, geoData] = await Promise.all([
      fetchGQL(JSON.stringify({
        query: daysQuery,
        variables: { zone: zoneId, since: daysSince, until: daysUntil },
      })),
      fetchGQL(JSON.stringify({
        query: hoursQuery,
        variables: { zone: zoneId, since: hoursSince, until: hoursUntil },
      })),
      fetchGQL(JSON.stringify({
        query: geoQuery,
        variables: { zone: zoneId, since: daysSince, until: daysUntil },
      })),
    ]);

    /* 客户端数据和 HTTP 方法数据并行请求 */
    const methodSince = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    const methodUntil = new Date().toISOString();

    const [clientResult, methodResult] = await Promise.allSettled([
      fetchGQL(JSON.stringify({
        query: clientQuery,
        variables: { zone: zoneId, since: clientSince, until: daysUntil },
      })),
      fetchGQL(JSON.stringify({
        query: methodQuery,
        variables: { zone: zoneId, since: methodSince, until: methodUntil },
      })),
    ]);

    let clientData: any = clientResult.status === "fulfilled" ? clientResult.value : null;
    let methodData: any = methodResult.status === "fulfilled" ? methodResult.value : null;

    if (clientData?.errors) {
      console.warn(`Zone ${domain} clientQuery errors (30d):`, JSON.stringify(clientData.errors));
      clientData = null;
    }
    if (methodData?.errors) {
      console.warn(`Zone ${domain} methodQuery errors:`, JSON.stringify(methodData.errors));
      methodData = null;
    }

    /* clientQuery 30天失败时使用7天范围重试 */
    if (!clientData?.data?.viewer?.zones?.[0]?.httpRequests1dGroups) {
      try {
        const retrySince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        clientData = await fetchGQL(JSON.stringify({
          query: clientQuery,
          variables: { zone: zoneId, since: retrySince, until: daysUntil },
        }));
        if (clientData?.errors) {
          console.warn(`Zone ${domain} clientQuery errors (7d):`, JSON.stringify(clientData.errors));
          clientData = null;
        }
      } catch (e) {
        console.warn(`Zone ${domain} clientQuery retry failed (7d):`, e);
        clientData = null;
      }
    }

    const zoneData: {
      domain: string;
      raw: unknown[];
      rawHours: unknown[];
      geography: unknown[];
      browsers: unknown[];
      statusCodes: unknown[];
      contentTypes: unknown[];
      sslVersions: unknown[];
      httpVersions: unknown[];
      httpMethods: unknown[];
      threatTypes: unknown[];
      ipClasses: unknown[];
      error?: string;
    } = {
      domain,
      raw: [],
      rawHours: [],
      geography: [],
      browsers: [],
      statusCodes: [],
      contentTypes: [],
      sslVersions: [],
      httpVersions: [],
      httpMethods: [],
      threatTypes: [],
      ipClasses: [],
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

    // Process client data (browsers, status codes, content types, SSL, HTTP versions)
    if (clientData?.data?.viewer?.zones?.[0]?.httpRequests1dGroups) {
      const rawClientData = clientData.data.viewer.zones[0].httpRequests1dGroups;
      
      const browserStats: Record<string, { name: string; pageViews: number }> = {};
      const statusCodeStats: Record<string, { name: string; requests: number }> = {};
      const contentTypeStats: Record<string, { name: string; bytes: number; requests: number }> = {};
      const sslStats: Record<string, { name: string; requests: number }> = {};
      const httpStats: Record<string, { name: string; requests: number }> = {};

      rawClientData.forEach((record: any) => {
        // Process browsers
        record.sum?.browserMap?.forEach((b: any) => {
          const name = b.uaBrowserFamily || "Unknown";
          if (!browserStats[name]) browserStats[name] = { name, pageViews: 0 };
          browserStats[name].pageViews += b.pageViews || 0;
        });

        // Process status codes
        record.sum?.responseStatusMap?.forEach((s: any) => {
          const name = String(s.edgeResponseStatus);
          if (!statusCodeStats[name]) statusCodeStats[name] = { name, requests: 0 };
          statusCodeStats[name].requests += s.requests || 0;
        });

        // Process content types
        record.sum?.contentTypeMap?.forEach((c: any) => {
          const name = c.edgeResponseContentTypeName || "Unknown";
          if (!contentTypeStats[name]) contentTypeStats[name] = { name, bytes: 0, requests: 0 };
          contentTypeStats[name].bytes += c.bytes || 0;
          contentTypeStats[name].requests += c.requests || 0;
        });

        // Process SSL versions
        record.sum?.clientSSLMap?.forEach((ssl: any) => {
          const name = ssl.clientSSLProtocol || "Unknown";
          if (!sslStats[name]) sslStats[name] = { name, requests: 0 };
          sslStats[name].requests += ssl.requests || 0;
        });

        // Process HTTP versions
        record.sum?.clientHTTPVersionMap?.forEach((http: any) => {
          const name = http.clientHTTPProtocol || "Unknown";
          if (!httpStats[name]) httpStats[name] = { name, requests: 0 };
          httpStats[name].requests += http.requests || 0;
        });
      });

      /* 解析威胁类型分布 */
      const threatPathStats: Record<string, { name: string; requests: number }> = {};
      /* 解析 IP 分类分布 */
      const ipClassStats: Record<string, { name: string; requests: number }> = {};

      rawClientData.forEach((record: any) => {
        record.sum?.threatPathingMap?.forEach((t: any) => {
          const name = t.threatPathingName || "Unknown";
          if (!threatPathStats[name]) threatPathStats[name] = { name, requests: 0 };
          threatPathStats[name].requests += t.requests || 0;
        });
        record.sum?.ipClassMap?.forEach((ip: any) => {
          const name = ip.ipType || "Unknown";
          if (!ipClassStats[name]) ipClassStats[name] = { name, requests: 0 };
          ipClassStats[name].requests += ip.requests || 0;
        });
      });

      zoneData.browsers = Object.values(browserStats).sort((a, b) => b.pageViews - a.pageViews).slice(0, 10);
      zoneData.statusCodes = Object.values(statusCodeStats).sort((a, b) => b.requests - a.requests).slice(0, 10);
      zoneData.contentTypes = Object.values(contentTypeStats).sort((a, b) => b.bytes - a.bytes).slice(0, 10);
      zoneData.sslVersions = Object.values(sslStats).sort((a, b) => b.requests - a.requests);
      zoneData.httpVersions = Object.values(httpStats).sort((a, b) => b.requests - a.requests);
      zoneData.threatTypes = Object.values(threatPathStats).sort((a, b) => b.requests - a.requests).slice(0, 10);
      zoneData.ipClasses = Object.values(ipClassStats).sort((a, b) => b.requests - a.requests);
    }

    /* 从独立查询结果中解析 HTTP 方法数据（独立于 clientData，确保即使 clientData 失败也能工作） */
    const httpMethodStats: Record<string, { name: string; requests: number }> = {};
    if (methodData?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups) {
      methodData.data.viewer.zones[0].httpRequestsAdaptiveGroups.forEach((g: any) => {
        const name = g.dimensions?.clientRequestHTTPMethodName || "Unknown";
        if (!httpMethodStats[name]) httpMethodStats[name] = { name, requests: 0 };
        httpMethodStats[name].requests += g.count || 0;
      });
    }
    zoneData.httpMethods = Object.values(httpMethodStats).sort((a, b) => b.requests - a.requests);

    return zoneData;
  } catch (error) {
    console.error(`Zone ${domain} fetch error:`, error);
    return {
      domain,
      raw: [],
      rawHours: [],
      geography: [],
      browsers: [],
      statusCodes: [],
      contentTypes: [],
      sslVersions: [],
      httpVersions: [],
      httpMethods: [],
      threatTypes: [],
      ipClasses: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const useStream = searchParams.get("stream") !== "false";
  const targetDomain = searchParams.get("domain");

  try {
    const accountConfigs = parseAccountConfigs();
    if (accountConfigs.length === 0) {
      return NextResponse.json(
        { error: "请配置 CF_API_KEY 和 CF_EMAIL", accounts: [] },
        { status: 200 }
      );
    }

    /* 单域名查询模式：优先从全量缓存中提取，否则只查询该域名 */
    if (targetDomain) {
      const fullCached = cache.get<{ accounts: { name: string; zones: any[] }[] }>(CACHE_KEY);
      if (fullCached) {
        /* 从全量缓存中提取单域名数据 */
        for (const acc of fullCached.accounts) {
          const found = acc.zones?.find((z: any) => z.domain === targetDomain);
          if (found) {
            return NextResponse.json({ accounts: [{ name: acc.name, zones: [found] }] });
          }
        }
      }
      /* 缓存未命中，直接查询单个域名 */
      for (const config of accountConfigs) {
        const headers = getAuthHeaders(config.apiKey, config.email);
        const allZones = await fetchAllZones(headers);
        const zone = allZones.find(z => z.name.toLowerCase() === targetDomain.toLowerCase());
        if (zone) {
          const data = await fetchZoneData(headers, zone.id, zone.name);
          const singleCacheKey = `cf_analytics_${targetDomain}`;
          const result = { accounts: [{ name: config.name, zones: [data] }] };
          cache.set(singleCacheKey, result, CACHE_TTL);
          return NextResponse.json(result);
        }
      }
      return NextResponse.json({ accounts: [] });
    }

    /* 全量模式：命中缓存直接返回 */
    const cached = cache.get<{ accounts: { name: string; zones: unknown[] }[] }>(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached);
    }

    /* 收集账户配置和待获取的 zone 列表 */
    const tasks: { accountName: string; headers: Record<string, string>; zones: CFZone[] }[] = [];
    for (const config of accountConfigs) {
      const headers = getAuthHeaders(config.apiKey, config.email);
      const allZones = await fetchAllZones(headers);
      if (allZones.length === 0) continue;

      let zonesToFetch: CFZone[];
      if (config.domains && config.domains.length > 0) {
        const domainSet = new Set(config.domains.map(d => d.toLowerCase()));
        zonesToFetch = allZones.filter(zone => domainSet.has(zone.name.toLowerCase()));
      } else {
        zonesToFetch = allZones.slice(0, 20);
      }
      if (zonesToFetch.length === 0) continue;
      tasks.push({ accountName: config.name, headers, zones: zonesToFetch });
    }

    if (tasks.length === 0) {
      return NextResponse.json(
        { error: "未找到任何匹配的域名，请检查配置", accounts: [] },
        { status: 200 }
      );
    }

    /*
    流式响应：使用 NDJSON 格式，每个 zone 完成后立即推送
    @格式 每行一个 JSON 对象: {type: "zone", account, zone} 或 {type: "done"}
    @策略 逐个 zone 串行获取，每完成一个立即推送给前端，实现真正渐进式渲染
    */
    if (useStream) {
      const encoder = new TextEncoder();

      /* 将所有 zone 展开为扁平任务列表 */
      const flatTasks: { accountName: string; headers: Record<string, string>; zone: CFZone }[] = [];
      for (const task of tasks) {
        for (const zone of task.zones) {
          flatTasks.push({ accountName: task.accountName, headers: task.headers, zone });
        }
      }

      /*
      使用 TransformStream 实现流式响应
      @原理 Response 立即返回 readable 端，writable 端在后台逐步写入
      @优势 比 ReadableStream.start 更可靠，Next.js 不会缓冲整个响应
      */
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();

      /* 后台逐个获取 zone 并写入流 */
      (async () => {
        const allZoneResults: { accountName: string; zone: unknown }[] = [];
        try {
          await writer.write(encoder.encode(JSON.stringify({ type: "init", total: flatTasks.length }) + "\n"));

          /* 每次并发2个 zone，每批完成后立即推送 */
          const BATCH_SIZE = 2;
          for (let i = 0; i < flatTasks.length; i += BATCH_SIZE) {
            const batch = flatTasks.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(
              batch.map(async (t) => {
                const data = await fetchZoneData(t.headers, t.zone.id, t.zone.name);
                return { accountName: t.accountName, zone: data };
              })
            );
            for (const r of results) {
              allZoneResults.push(r);
              await writer.write(encoder.encode(JSON.stringify({
                type: "zone",
                account: r.accountName,
                zone: r.zone,
              }) + "\n"));
            }
          }

          await writer.write(encoder.encode(JSON.stringify({ type: "done" }) + "\n"));

          /* 构建完整数据写入缓存 */
          const accountMap = new Map<string, unknown[]>();
          for (const r of allZoneResults) {
            if (!accountMap.has(r.accountName)) accountMap.set(r.accountName, []);
            accountMap.get(r.accountName)!.push(r.zone);
          }
          cache.set(CACHE_KEY, {
            accounts: Array.from(accountMap.entries()).map(([name, zones]) => ({ name, zones })),
          }, CACHE_TTL);
        } catch (err) {
          await writer.write(encoder.encode(JSON.stringify({ type: "error", error: String(err) }) + "\n"));
        } finally {
          await writer.close();
        }
      })();

      return new Response(readable, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "no-cache, no-transform",
        },
      });
    }

    /* 非流式：传统 JSON 响应（兼容模式） */
    const payload: { accounts: { name: string; zones: unknown[] }[] } = { accounts: [] };
    for (const task of tasks) {
      const zonePromises = task.zones.map((zone) => fetchZoneData(task.headers, zone.id, zone.name));
      const zones = await Promise.all(zonePromises);
      payload.accounts.push({ name: task.accountName, zones });
    }
    cache.set(CACHE_KEY, payload, CACHE_TTL);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("CF Analytics API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error", accounts: [] },
      { status: 500 }
    );
  }
}
