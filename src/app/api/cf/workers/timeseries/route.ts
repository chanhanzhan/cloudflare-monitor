import { NextRequest, NextResponse } from "next/server";
import * as cache from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL = 3 * 60 * 1000;

/*
Workers 时序数据 API
@功能 通过 Cloudflare GraphQL 获取单个 Worker 脚本的时序数据（按小时分组）
@参数 scriptName 脚本名称
@返回 按小时的请求/错误/子请求/CPU 时间趋势 + 按状态分布
*/

interface AccountConfig {
  name: string;
  apiKey: string;
  email: string;
  accountId?: string;
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
      accountId: process.env.CF_ACCOUNT_ID,
    });
  }
  let i = 1;
  while (process.env[`CF_API_KEY_${i}`] && process.env[`CF_EMAIL_${i}`]) {
    accounts.push({
      name: process.env[`CF_ACCOUNT_NAME_${i}`] || `账户 ${i}`,
      apiKey: process.env[`CF_API_KEY_${i}`]!,
      email: process.env[`CF_EMAIL_${i}`]!,
      accountId: process.env[`CF_ACCOUNT_ID_${i}`],
    });
    i++;
  }
  return accounts;
}

async function fetchAccountId(headers: HeadersInit): Promise<string | null> {
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/accounts?per_page=1", { headers });
    const data = await res.json();
    return data.result?.[0]?.id || null;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scriptName = searchParams.get("scriptName");

  if (!scriptName) {
    return NextResponse.json({ error: "缺少 scriptName 参数" }, { status: 400 });
  }

  const cacheKey = `cf_worker_ts_${scriptName}`;
  const cached = cache.get(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const configs = parseAccountConfigs();
    if (configs.length === 0) {
      return NextResponse.json({ error: "未配置 CF 凭证" }, { status: 400 });
    }

    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const config of configs) {
      const headers: Record<string, string> = {
        "X-Auth-Key": config.apiKey,
        "X-Auth-Email": config.email,
        "Content-Type": "application/json",
      };

      let accountId = config.accountId;
      if (!accountId) accountId = await fetchAccountId(headers) || undefined;
      if (!accountId) continue;

      /*
      查询1: 按小时分组的时序数据
      查询2: 按状态分组的分布数据
      两个查询并行执行
      */
      const timeseriesQuery = `
        query($accountTag: String!, $start: Time!, $end: Time!, $script: string!) {
          viewer {
            accounts(filter: {accountTag: $accountTag}) {
              workersInvocationsAdaptive(
                limit: 5000,
                filter: {
                  scriptName: $script,
                  datetime_geq: $start,
                  datetime_leq: $end
                }
              ) {
                sum { requests errors subrequests }
                quantiles { cpuTimeP50 cpuTimeP99 }
                dimensions { datetimeHour status }
              }
            }
          }
        }`;

      const variables = {
        accountTag: accountId,
        start: start.toISOString(),
        end: now.toISOString(),
        script: scriptName,
      };

      const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
        method: "POST",
        headers,
        body: JSON.stringify({ query: timeseriesQuery, variables }),
      });
      const data = await res.json();

      if (data.errors) {
        console.warn("Workers timeseries errors:", JSON.stringify(data.errors));
        continue;
      }

      const invocations = data.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive || [];
      if (invocations.length === 0) continue;

      /* 按小时聚合时序数据 */
      const hourMap = new Map<string, { requests: number; errors: number; subrequests: number; cpuP50: number; cpuP99: number }>();
      /* 按状态聚合分布数据 */
      const statusMap = new Map<string, number>();

      invocations.forEach((inv: any) => {
        const hour = inv.dimensions?.datetimeHour || "";
        const status = inv.dimensions?.status || "unknown";
        const requests = inv.sum?.requests || 0;

        /* 时序 */
        if (hour) {
          const existing = hourMap.get(hour) || { requests: 0, errors: 0, subrequests: 0, cpuP50: 0, cpuP99: 0 };
          existing.requests += requests;
          existing.errors += inv.sum?.errors || 0;
          existing.subrequests += inv.sum?.subrequests || 0;
          existing.cpuP50 = Math.max(existing.cpuP50, inv.quantiles?.cpuTimeP50 || 0);
          existing.cpuP99 = Math.max(existing.cpuP99, inv.quantiles?.cpuTimeP99 || 0);
          hourMap.set(hour, existing);
        }

        /* 状态分布 */
        statusMap.set(status, (statusMap.get(status) || 0) + requests);
      });

      /* 排序输出 */
      const timeseries = Array.from(hourMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([hour, d]) => ({
          time: new Date(hour).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
          fullTime: hour,
          ...d,
          cpuP50: d.cpuP50 / 1000,
          cpuP99: d.cpuP99 / 1000,
          errorRate: d.requests > 0 ? (d.errors / d.requests) * 100 : 0,
        }));

      const statusDistribution = Array.from(statusMap.entries())
        .map(([status, count]) => ({
          name: status === "success" ? "成功" : status === "clientDisconnect" ? "客户端断开" : status === "scriptThrewException" ? "脚本异常" : status === "exceededCpu" ? "CPU超限" : status === "exceededMemory" ? "内存超限" : status === "unknown" ? "未知" : status,
          value: count,
        }))
        .sort((a, b) => b.value - a.value);

      const result = { timeseries, statusDistribution, scriptName };
      cache.set(cacheKey, result, CACHE_TTL);
      return NextResponse.json(result);
    }

    return NextResponse.json({ timeseries: [], statusDistribution: [], scriptName });
  } catch (error) {
    console.error("Workers timeseries error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
