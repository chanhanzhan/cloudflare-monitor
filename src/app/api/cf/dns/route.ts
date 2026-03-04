import { NextRequest, NextResponse } from "next/server";
import * as cache from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL = 3 * 60 * 1000;

/*
CF DNS 查询统计 API
@功能 通过 Cloudflare GraphQL API 获取 DNS 查询统计数据，包括按查询类型、响应码分布
*/

interface AccountConfig {
  name: string;
  apiKey: string;
  email: string;
}

function parseAccountConfigs(): AccountConfig[] {
  const accounts: AccountConfig[] = [];
  const singleApiKey = process.env.CF_API_KEY;
  const singleEmail = process.env.CF_EMAIL;
  if (singleApiKey && singleEmail) {
    accounts.push({
      name: process.env.CF_ACCOUNT_NAME || "默认账户",
      apiKey: singleApiKey,
      email: singleEmail,
    });
  }
  let i = 1;
  while (process.env[`CF_API_KEY_${i}`] && process.env[`CF_EMAIL_${i}`]) {
    accounts.push({
      name: process.env[`CF_ACCOUNT_NAME_${i}`] || `账户 ${i}`,
      apiKey: process.env[`CF_API_KEY_${i}`]!,
      email: process.env[`CF_EMAIL_${i}`]!,
    });
    i++;
  }
  return accounts;
}

async function fetchAllZoneIds(headers: Record<string, string>) {
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/zones?per_page=50", { headers });
    const data = await res.json();
    return (data.result || []).map((z: { id: string; name: string }) => ({ id: z.id, name: z.name }));
  } catch {
    return [];
  }
}

/*
fetchDnsAnalytics 获取指定 zone 的 DNS 查询统计
@功能 通过 GraphQL 获取 DNS 查询总量、按类型分布、按响应码分布
@param headers 认证头
@param zoneId 站点 ID
@param since 开始时间
@param until 结束时间
*/
async function fetchDnsAnalytics(
  headers: Record<string, string>,
  zoneId: string,
  since: string,
  until: string
) {
  const query = `
    query($zone: String!, $since: Time!, $until: Time!) {
      viewer {
        zones(filter: {zoneTag: $zone}) {
          dns1hGroups: dnsAnalyticsAdaptiveGroups(
            filter: {datetime_geq: $since, datetime_leq: $until}
            limit: 500
            orderBy: [count_DESC]
          ) {
            count
            dimensions {
              queryType
              responseCode
              queryName
            }
          }
        }
      }
    }`;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        variables: { zone: zoneId, since, until },
      }),
    });
    const data = await res.json();
    return data.data?.viewer?.zones?.[0]?.dns1hGroups || [];
  } catch (error) {
    console.error("DNS analytics fetch error:", error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetDomain = searchParams.get("domain");
    const cacheKey = `cf_dns_${targetDomain || "all"}`;
    const cached = cache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    const accountConfigs = parseAccountConfigs();
    if (accountConfigs.length === 0) {
      return NextResponse.json({ error: "请配置 CF_API_KEY 和 CF_EMAIL", accounts: [] });
    }

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const since = yesterday.toISOString();
    const until = now.toISOString();

    const allAccounts: {
      account: string;
      zones: {
        domain: string;
        dns: {
          totalQueries: number;
          byQueryType: { type: string; count: number }[];
          byResponseCode: { code: string; count: number }[];
          byQueryName: { name: string; count: number }[];
        };
      }[];
    }[] = [];

    for (const config of accountConfigs) {
      const headers = {
        "X-Auth-Key": config.apiKey,
        "X-Auth-Email": config.email,
        "Content-Type": "application/json",
      };

      const zones = await fetchAllZoneIds(headers);
      const filteredZones = targetDomain
        ? zones.filter((z: { name: string }) => z.name === targetDomain)
        : zones.slice(0, 10);

      const accountData: typeof allAccounts[number] = {
        account: config.name,
        zones: [],
      };

      for (const zone of filteredZones) {
        const rawData = await fetchDnsAnalytics(headers, zone.id, since, until);

        /* 按维度聚合 DNS 查询数据 */
        const typeMap: Record<string, number> = {};
        const codeMap: Record<string, number> = {};
        const nameMap: Record<string, number> = {};
        let totalQueries = 0;

        rawData.forEach((e: any) => {
          const count = e.count || 0;
          totalQueries += count;
          const d = e.dimensions || {};

          if (d.queryType) {
            typeMap[d.queryType] = (typeMap[d.queryType] || 0) + count;
          }
          if (d.responseCode) {
            codeMap[d.responseCode] = (codeMap[d.responseCode] || 0) + count;
          }
          if (d.queryName) {
            nameMap[d.queryName] = (nameMap[d.queryName] || 0) + count;
          }
        });

        const toSorted = (map: Record<string, number>, key: string) =>
          Object.entries(map)
            .map(([k, v]) => ({ [key]: k, count: v }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15);

        accountData.zones.push({
          domain: zone.name,
          dns: {
            totalQueries,
            byQueryType: toSorted(typeMap, "type") as { type: string; count: number }[],
            byResponseCode: toSorted(codeMap, "code") as { code: string; count: number }[],
            byQueryName: toSorted(nameMap, "name") as { name: string; count: number }[],
          },
        });
      }

      allAccounts.push(accountData);
    }

    const payload = { accounts: allAccounts };
    cache.set(cacheKey, payload, CACHE_TTL);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("CF DNS API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error", accounts: [] },
      { status: 500 }
    );
  }
}
