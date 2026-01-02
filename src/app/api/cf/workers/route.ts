import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const singleAccountId = process.env.CF_ACCOUNT_ID;

  if (singleApiKey && singleEmail) {
    accounts.push({
      name: process.env.CF_ACCOUNT_NAME || "默认账户",
      apiKey: singleApiKey,
      email: singleEmail,
      accountId: singleAccountId,
    });
  }

  // Multi-account support
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
    const res = await fetch("https://api.cloudflare.com/client/v4/accounts?page=1&per_page=1", {
      headers,
    });
    const data = await res.json();
    return data.result?.[0]?.id || null;
  } catch {
    return null;
  }
}

async function fetchWorkersList(headers: HeadersInit, accountId: string): Promise<string[]> {
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`, {
      headers,
    });
    const data = await res.json();
    return data.result?.map((w: { id: string }) => w.id) || [];
  } catch {
    return [];
  }
}

interface WorkerStats {
  scriptName: string;
  requests: number;
  errors: number;
  subrequests: number;
  cpuTimeP50: number;
  cpuTimeP99: number;
}

async function fetchWorkersAnalytics(
  headers: HeadersInit,
  accountId: string,
  startTime: string,
  endTime: string
): Promise<WorkerStats[]> {
  const query = `
    query GetWorkersAnalytics($accountTag: String!, $datetimeStart: Time!, $datetimeEnd: Time!) {
      viewer {
        accounts(filter: {accountTag: $accountTag}) {
          workersInvocationsAdaptive(
            limit: 1000,
            filter: {
              datetime_geq: $datetimeStart,
              datetime_leq: $datetimeEnd
            }
          ) {
            sum {
              subrequests
              requests
              errors
            }
            quantiles {
              cpuTimeP50
              cpuTimeP99
            }
            dimensions {
              scriptName
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        variables: {
          accountTag: accountId,
          datetimeStart: startTime,
          datetimeEnd: endTime,
        },
      }),
    });

    const data = await res.json();
    const invocations = data.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive || [];

    // Aggregate by script name
    const statsMap = new Map<string, WorkerStats>();
    
    invocations.forEach((inv: any) => {
      const scriptName = inv.dimensions?.scriptName || "unknown";
      const existing = statsMap.get(scriptName) || {
        scriptName,
        requests: 0,
        errors: 0,
        subrequests: 0,
        cpuTimeP50: 0,
        cpuTimeP99: 0,
      };
      
      existing.requests += inv.sum?.requests || 0;
      existing.errors += inv.sum?.errors || 0;
      existing.subrequests += inv.sum?.subrequests || 0;
      existing.cpuTimeP50 = Math.max(existing.cpuTimeP50, inv.quantiles?.cpuTimeP50 || 0);
      existing.cpuTimeP99 = Math.max(existing.cpuTimeP99, inv.quantiles?.cpuTimeP99 || 0);
      
      statsMap.set(scriptName, existing);
    });

    return Array.from(statsMap.values()).sort((a, b) => b.requests - a.requests);
  } catch (error) {
    console.error("Workers analytics error:", error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const accountConfigs = parseAccountConfigs();

    if (accountConfigs.length === 0) {
      return NextResponse.json({ error: "请配置 CF_API_KEY 和 CF_EMAIL", workers: [] });
    }

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startTime = yesterday.toISOString();
    const endTime = now.toISOString();

    const allWorkers: { account: string; workers: WorkerStats[]; totalRequests: number; totalErrors: number }[] = [];

    for (const config of accountConfigs) {
      const headers = {
        "X-Auth-Key": config.apiKey,
        "X-Auth-Email": config.email,
        "Content-Type": "application/json",
      };

      let accountId: string | undefined = config.accountId;
      if (!accountId) {
        const fetchedId = await fetchAccountId(headers);
        if (fetchedId) accountId = fetchedId;
      }

      if (!accountId) {
        continue;
      }

      const workers = await fetchWorkersAnalytics(headers, accountId, startTime, endTime);
      
      const totalRequests = workers.reduce((sum, w) => sum + w.requests, 0);
      const totalErrors = workers.reduce((sum, w) => sum + w.errors, 0);

      allWorkers.push({
        account: config.name,
        workers,
        totalRequests,
        totalErrors,
      });
    }

    return NextResponse.json({ 
      accounts: allWorkers,
      totalRequests: allWorkers.reduce((sum, a) => sum + a.totalRequests, 0),
      totalErrors: allWorkers.reduce((sum, a) => sum + a.totalErrors, 0),
    });
  } catch (error) {
    console.error("Workers API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error", accounts: [] },
      { status: 500 }
    );
  }
}
