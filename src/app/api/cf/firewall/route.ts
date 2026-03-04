import { NextRequest, NextResponse } from "next/server";
import * as cache from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL = 3 * 60 * 1000;

/*
parseAccountConfigs 解析 Cloudflare 账户配置
@功能 从环境变量中读取单账户或多账户配置
@return 账户配置数组
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

/*
fetchFirewallEventsRaw 获取防火墙事件原始记录（非聚合）
@param headers 认证头
@param zoneId 站点 ID
@param since 开始时间
@param until 结束时间
@return { events: 事件数组, authzError: 是否权限错误 }
*/
async function fetchFirewallEventsRaw(
  headers: Record<string, string>,
  zoneId: string,
  since: string,
  until: string
): Promise<{ events: any[]; authzError: boolean }> {
  const query = `
    query($zone: String!, $since: Time!, $until: Time!) {
      viewer {
        zones(filter: {zoneTag: $zone}) {
          firewallEventsAdaptive(
            filter: {datetime_geq: $since, datetime_leq: $until}
            limit: 200
            orderBy: [datetime_DESC]
          ) {
            action
            source
            clientCountryName
            clientIP
            clientRequestPath
            clientRequestHTTPHost
            clientRequestHTTPMethodName
            datetime
            ruleId
            userAgent
          }
        }
      }
    }`;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables: { zone: zoneId, since, until } }),
    });
    const json = await res.json();
    if (json.errors) {
      const isAuthz = json.errors.some((e: any) => e.extensions?.code === "authz");
      if (isAuthz) return { events: [], authzError: true };
      console.warn(`Firewall events query errors:`, JSON.stringify(json.errors));
      return { events: [], authzError: false };
    }
    return {
      events: json.data?.viewer?.zones?.[0]?.firewallEventsAdaptive || [],
      authzError: false,
    };
  } catch (error) {
    console.error(`Firewall events fetch error:`, error);
    return { events: [], authzError: false };
  }
}

/*
防火墙动作中文映射
*/
const ACTION_MAP: Record<string, string> = {
  block: "拦截", challenge: "质询", jschallenge: "JS质询",
  managedchallenge: "托管质询", managed_challenge: "托管质询",
  log: "日志记录", allow: "放行", bypass: "绕过",
  connectionclose: "关闭连接", skip: "跳过",
  challengesolved: "质询已解决", challengebypassed: "质询已绕过",
  jschallengesolved: "JS质询已解决", jschallengebypassed: "JS质询已绕过",
  managedchallengenoninteractivesolved: "托管质询(非交互)已解决",
  managedchallengeinteractivesolved: "托管质询(交互)已解决",
  managedchallengebypassed: "托管质询已绕过",
  link_maze_injected: "链接迷宫注入",
};

/*
防火墙规则来源中文映射
*/
const SOURCE_MAP: Record<string, string> = {
  waf: "WAF 托管规则", firewallrules: "防火墙规则",
  ratelimit: "速率限制", bic: "浏览器完整性检查",
  hot: "热链接保护", securitylevel: "安全级别",
  zonelockdown: "区域锁定", uablock: "UA 拦截",
  ipAccessRules: "IP 访问规则", asn: "ASN 规则",
  country: "国家规则", managed_rules: "托管规则",
  botFight: "Bot Fight 模式", linkMaze: "链接迷宫",
  botManagement: "Bot 管理", apiShield: "API Shield",
  dlp: "数据防泄漏", l7ddos: "L7 DDoS 防护",
  sanitycheck: "健全性检查",
};

/*
国家代码中文映射（常见国家）
*/
const COUNTRY_MAP: Record<string, string> = {
  CN: "中国", US: "美国", JP: "日本", KR: "韩国", SG: "新加坡",
  HK: "中国香港", TW: "中国台湾", MO: "中国澳门", DE: "德国", FR: "法国",
  GB: "英国", CA: "加拿大", AU: "澳大利亚", IN: "印度", BR: "巴西",
  RU: "俄罗斯", NL: "荷兰", IT: "意大利", ES: "西班牙", SE: "瑞典",
  CH: "瑞士", PL: "波兰", ID: "印度尼西亚", TH: "泰国", VN: "越南",
  MY: "马来西亚", PH: "菲律宾", FI: "芬兰", NO: "挪威", DK: "丹麦",
  IE: "爱尔兰", PT: "葡萄牙", GR: "希腊", NZ: "新西兰", AR: "阿根廷",
  MX: "墨西哥", ZA: "南非", AE: "阿联酋", SA: "沙特阿拉伯", TR: "土耳其",
  UA: "乌克兰", IL: "以色列", EG: "埃及", NG: "尼日利亚", KE: "肯尼亚",
  CL: "智利", CO: "哥伦比亚", CZ: "捷克", AT: "奥地利", BE: "比利时",
  RO: "罗马尼亚", HU: "匈牙利", BG: "保加利亚", RS: "塞尔维亚",
  HR: "克罗地亚", SK: "斯洛伐克", LT: "立陶宛", LV: "拉脱维亚",
  EE: "爱沙尼亚", BD: "孟加拉", PK: "巴基斯坦", LK: "斯里兰卡",
  MM: "缅甸", KH: "柬埔寨", LA: "老挝", NP: "尼泊尔",
};

/*
aggregateFirewallEvents 将原始防火墙事件按多维度聚合，并汉化名称
@param events 原始事件数组
@return 聚合后的数据对象
*/
function aggregateFirewallEvents(events: any[]) {
  const actionMap: Record<string, number> = {};
  const sourceMap: Record<string, number> = {};
  const countryMap: Record<string, number> = {};
  const ipMap: Record<string, number> = {};
  const pathMap: Record<string, number> = {};
  const hostMap: Record<string, number> = {};
  const methodMap: Record<string, number> = {};
  const recentEvents: any[] = [];

  events.forEach((e: any) => {
    if (e.action) {
      const label = ACTION_MAP[e.action] || e.action;
      actionMap[label] = (actionMap[label] || 0) + 1;
    }
    if (e.source) {
      const label = SOURCE_MAP[e.source] || e.source;
      sourceMap[label] = (sourceMap[label] || 0) + 1;
    }
    if (e.clientCountryName) {
      const label = COUNTRY_MAP[e.clientCountryName] || e.clientCountryName;
      countryMap[label] = (countryMap[label] || 0) + 1;
    }
    if (e.clientIP) ipMap[e.clientIP] = (ipMap[e.clientIP] || 0) + 1;
    if (e.clientRequestPath) pathMap[e.clientRequestPath] = (pathMap[e.clientRequestPath] || 0) + 1;
    if (e.clientRequestHTTPHost) hostMap[e.clientRequestHTTPHost] = (hostMap[e.clientRequestHTTPHost] || 0) + 1;
    if (e.clientRequestHTTPMethodName) methodMap[e.clientRequestHTTPMethodName] = (methodMap[e.clientRequestHTTPMethodName] || 0) + 1;
    if (recentEvents.length < 20) {
      recentEvents.push({
        time: e.datetime,
        action: ACTION_MAP[e.action] || e.action,
        source: SOURCE_MAP[e.source] || e.source,
        ip: e.clientIP,
        country: COUNTRY_MAP[e.clientCountryName] || e.clientCountryName,
        path: e.clientRequestPath,
        host: e.clientRequestHTTPHost,
        method: e.clientRequestHTTPMethodName,
        ua: e.userAgent,
        ruleId: e.ruleId,
      });
    }
  });

  const toSorted = (map: Record<string, number>, key: string) =>
    Object.entries(map)
      .map(([k, v]) => ({ [key]: k, count: v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

  return {
    byAction: toSorted(actionMap, "action"),
    bySource: toSorted(sourceMap, "source"),
    byCountry: toSorted(countryMap, "country"),
    byIP: toSorted(ipMap, "ip"),
    byPath: toSorted(pathMap, "path"),
    byHost: toSorted(hostMap, "host"),
    byMethod: toSorted(methodMap, "method"),
    recentEvents,
    totalEvents: events.length,
  };
}

/*
fetchAllZoneIds 获取该账户下所有 zone 的 ID 和域名
@功能 通过 REST API 获取账户下所有站点列表
*/
async function fetchAllZoneIds(headers: Record<string, string>) {
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/zones?per_page=50", {
      headers,
    });
    const data = await res.json();
    return (data.result || []).map((z: { id: string; name: string }) => ({
      id: z.id,
      name: z.name,
    }));
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetDomain = searchParams.get("domain");

    const cacheKey = `cf_firewall_${targetDomain || "all"}`;
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
        events: {
          byAction: { action: string; count: number }[];
          bySource: { source: string; count: number }[];
          byCountry: { country: string; count: number }[];
          byIP: { ip: string; count: number }[];
          byHost: { host: string; count: number }[];
          byPath: { path: string; count: number }[];
          totalEvents: number;
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

        /* 并行获取所有 zone 的防火墙数据 */
      const zonePromises = filteredZones.map(async (zone: { id: string; name: string }) => {
        const result = await fetchFirewallEventsRaw(headers, zone.id, since, until);

        if (result.authzError) {
          return {
            domain: zone.name,
            events: null,
            error: "当前套餐不支持防火墙事件分析，需要 Pro 或更高级别套餐",
          };
        }

        return {
          domain: zone.name,
          events: aggregateFirewallEvents(result.events),
        };
      });

      accountData.zones = await Promise.all(zonePromises);

      allAccounts.push(accountData);
    }

    const payload = { accounts: allAccounts };
    cache.set(cacheKey, payload, CACHE_TTL);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("CF Firewall API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error", accounts: [] },
      { status: 500 }
    );
  }
}
